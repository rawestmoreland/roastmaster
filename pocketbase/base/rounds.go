package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// ─── fallback prompts ─────────────────────────────────────────────────────────

var fallbackPrompts = []string{
	"You've accidentally become the mayor. What's your first decree?",
	"Explain your job to a medieval peasant in one sentence.",
	"You have 10 seconds to convince a bear not to eat you. Go.",
	"A genie gives you three wishes. You waste all three. How?",
	"You discover you can talk to furniture. What does your couch say?",
	"Your pet gives a TED Talk about you. What's the title?",
	"You're hiring a henchman. What's the job posting say?",
	"Write your own tombstone inscription in 10 words or less.",
	"You're trapped in an elevator with your childhood self. What do you say?",
	"You wake up as a cloud. What's your day like?",
	"Design the worst theme park ride ever invented.",
	"Pitch a terrible idea for a reality TV show.",
	"You're the villain in a movie. What's your unnecessarily complex plan?",
	"Describe your last meal to someone who's never heard of food.",
	"The apocalypse starts and your only weapon is what's in your left pocket. Explain your plan.",
}

// ─── prompt generation ────────────────────────────────────────────────────────

const promptSystem = `You are the host of a wild party game called Roastmaster.
Generate ONE short, creative, absurdist party game prompt.
Rules: under 20 words, answerable in 60 seconds, funny and unexpected, family-friendly.
Reply with ONLY the prompt text. No quotes, no explanation, no punctuation at the end.`

func generateRoundPrompt() (string, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("no api key")
	}

	payload := anthropicReq{
		Model:     "claude-haiku-4-5-20251001",
		MaxTokens: 80,
		System:    promptSystem,
		Messages:  []chatMessage{{Role: "user", Content: "Generate one party game prompt."}},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("anthropic %d: %s", resp.StatusCode, b)
	}

	var ar anthropicResp
	if err := json.NewDecoder(resp.Body).Decode(&ar); err != nil {
		return "", err
	}
	if len(ar.Content) == 0 {
		return "", fmt.Errorf("empty response")
	}

	prompt := strings.TrimSpace(ar.Content[0].Text)
	prompt = strings.Trim(prompt, `"'`)
	return prompt, nil
}

// ─── POST /api/rounds ─────────────────────────────────────────────────────────

type createRoundReq struct {
	GameID     string `json:"gameId"`
	RoundIndex int    `json:"roundIndex"`
}

func handleCreateRound(e *core.RequestEvent) error {
	var req createRoundReq
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return apis.NewBadRequestError("invalid body", err)
	}
	if req.GameID == "" {
		return apis.NewBadRequestError("gameId required", nil)
	}

	game, err := e.App.FindRecordById("games", req.GameID)
	if err != nil {
		return apis.NewNotFoundError("game not found", nil)
	}
	if game.GetString("status") != "playing" {
		return apis.NewBadRequestError("game is not in playing state", nil)
	}

	// Only the host can create rounds
	if _, err := verifyPlayerToken(e, game.GetString("host")); err != nil {
		return err
	}

	// Guard against duplicate creation
	existing, _ := e.App.FindRecordsByFilter(
		"rounds",
		"game = {:game} && index = {:index}",
		"", 1, 0,
		dbx.Params{"game": req.GameID, "index": req.RoundIndex},
	)
	if len(existing) > 0 {
		return e.JSON(http.StatusOK, map[string]any{"roundId": existing[0].Id})
	}

	// Generate prompt — fall back to a local one if the AI call fails
	prompt, err := generateRoundPrompt()
	if err != nil {
		prompt = fallbackPrompts[rand.Intn(len(fallbackPrompts))]
	}

	roundsCol, err := e.App.FindCollectionByNameOrId("rounds")
	if err != nil {
		return err
	}

	round := core.NewRecord(roundsCol)
	round.Set("game", req.GameID)
	round.Set("prompt", prompt)
	round.Set("index", req.RoundIndex)
	round.Set("status", "answering")
	if err := e.App.Save(round); err != nil {
		return err
	}

	game.Set("current_round", req.RoundIndex)
	if err := e.App.Save(game); err != nil {
		return err
	}

	return e.JSON(http.StatusCreated, map[string]any{"roundId": round.Id})
}
