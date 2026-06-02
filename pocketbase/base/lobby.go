package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"

	"net/http"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// ─── helpers ─────────────────────────────────────────────────────────────────

func randomToken() (string, error) {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	return hex.EncodeToString(b), err
}

func randomCode() (string, error) {
	b := make([]byte, 3) // 6 hex chars — short enough to type, enough entropy for a party
	_, err := rand.Read(b)
	return strings.ToUpper(hex.EncodeToString(b)), err
}

// verifyPlayerToken checks the X-Player-Token header against the stored token.
// Returns the player record on success, writes 401/403 and returns nil on failure.
func verifyPlayerToken(e *core.RequestEvent, playerID string) (*core.Record, error) {
	token := e.Request.Header.Get("X-Player-Token")
	if token == "" {
		return nil, apis.NewUnauthorizedError("missing X-Player-Token", nil)
	}
	player, err := e.App.FindRecordById("players", playerID)
	if err != nil {
		return nil, apis.NewNotFoundError("player not found", nil)
	}
	if player.GetString("token") != token {
		return nil, apis.NewForbiddenError("invalid token", nil)
	}
	return player, nil
}

// ─── POST /api/games — create a room ─────────────────────────────────────────

type createGameReq struct {
	Nickname    string `json:"nickname"`
	TotalRounds int    `json:"totalRounds"` // 0 → default 5
}

func handleCreateGame(e *core.RequestEvent) error {
	var req createGameReq
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return apis.NewBadRequestError("invalid body", err)
	}
	req.Nickname = strings.TrimSpace(req.Nickname)
	if req.Nickname == "" {
		return apis.NewBadRequestError("nickname required", nil)
	}
	if req.TotalRounds <= 0 {
		req.TotalRounds = 5
	}

	code, err := randomCode()
	if err != nil {
		return err
	}
	token, err := randomToken()
	if err != nil {
		return err
	}

	gamesCol, err := e.App.FindCollectionByNameOrId("games")
	if err != nil {
		return err
	}
	playersCol, err := e.App.FindCollectionByNameOrId("players")
	if err != nil {
		return err
	}

	// Create game first (no host yet — chicken-and-egg with player)
	game := core.NewRecord(gamesCol)
	game.Set("code", code)
	game.Set("status", "lobby")
	game.Set("totalRounds", req.TotalRounds)
	game.Set("currentRound", 0)
	if err := e.App.Save(game); err != nil {
		return err
	}

	// Create the host player
	player := core.NewRecord(playersCol)
	player.Set("game", game.Id)
	player.Set("name", req.Nickname)
	player.Set("token", token)
	player.Set("status", "active")
	player.Set("score", 0)
	if err := e.App.Save(player); err != nil {
		return err
	}

	// Now point the game at its host
	game.Set("host", player.Id)
	if err := e.App.Save(game); err != nil {
		return err
	}

	return e.JSON(http.StatusCreated, map[string]any{
		"gameId":   game.Id,
		"code":     code,
		"playerId": player.Id,
		"token":    token, // client stores this; it's never returned again
	})
}

// ─── POST /api/games/:code/join ───────────────────────────────────────────────

type joinGameReq struct {
	Nickname string `json:"nickname"`
}

func handleJoinGame(e *core.RequestEvent) error {
	code := strings.ToUpper(e.Request.PathValue("code"))

	var req joinGameReq
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return apis.NewBadRequestError("invalid body", err)
	}
	req.Nickname = strings.TrimSpace(req.Nickname)
	if req.Nickname == "" {
		return apis.NewBadRequestError("nickname required", nil)
	}

	games, err := e.App.FindRecordsByFilter(
		"games", "code = {:code} && status = 'lobby'",
		"", 1, 0, dbx.Params{"code": code},
	)
	if err != nil || len(games) == 0 {
		return apis.NewNotFoundError("game not found or already started", nil)
	}
	game := games[0]

	// Reject duplicate nicknames in the same room
	existing, _ := e.App.FindRecordsByFilter(
		"players", "game = {:game} && name = {:name}",
		"", 1, 0, dbx.Params{"game": game.Id, "name": req.Nickname},
	)
	if len(existing) > 0 {
		return apis.NewBadRequestError("nickname already taken in this room", nil)
	}

	token, err := randomToken()
	if err != nil {
		return err
	}

	playersCol, err := e.App.FindCollectionByNameOrId("players")
	if err != nil {
		return err
	}

	player := core.NewRecord(playersCol)
	player.Set("game", game.Id)
	player.Set("name", req.Nickname)
	player.Set("token", token)
	player.Set("status", "active")
	player.Set("score", 0)
	if err := e.App.Save(player); err != nil {
		return err
	}

	// Save() broadcasts a realtime "create" event on players →
	// everyone in the lobby sees the new player appear instantly

	return e.JSON(http.StatusCreated, map[string]any{
		"gameId":   game.Id,
		"playerId": player.Id,
		"token":    token,
	})
}

// ─── POST /api/games/:id/start ────────────────────────────────────────────────

func handleStartGame(e *core.RequestEvent) error {
	gameID := e.Request.PathValue("id")

	game, err := e.App.FindRecordById("games", gameID)
	if err != nil {
		return apis.NewNotFoundError("game not found", nil)
	}
	if game.GetString("status") != "lobby" {
		return apis.NewBadRequestError("game already started", nil)
	}

	// Only the host can start
	hostPlayer, err := verifyPlayerToken(e, game.GetString("host"))
	if err != nil {
		return err
	}
	_ = hostPlayer

	players, err := e.App.FindRecordsByFilter(
		"players", "game = {:game} && status = 'active'",
		"", 100, 0, dbx.Params{"game": gameID},
	)
	if err != nil || len(players) < 2 {
		return apis.NewBadRequestError("need at least 2 players to start", nil)
	}

	game.Set("status", "playing")
	if err := e.App.Save(game); err != nil {
		return err
	}

	// Broadcast "playing" → clients swap lobby UI for the game screen
	return e.JSON(http.StatusOK, map[string]any{"status": "playing"})
}

// ─── DELETE /api/players/:id — leave / close tab ─────────────────────────────

func handleLeaveGame(e *core.RequestEvent) error {
	playerID := e.Request.PathValue("id")

	player, err := verifyPlayerToken(e, playerID)
	if err != nil {
		return err
	}

	player.Set("status", "disconnected")
	return e.App.Save(player)
	// The presence hook in presence.go handles host promotion if needed
}