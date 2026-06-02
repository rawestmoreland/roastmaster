package main

import (
	"log"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// registerPresenceHook watches for player disconnections and promotes
// the next active player to host when the current host goes offline.
func registerPresenceHook(app core.App) {
	app.OnRecordAfterUpdateSuccess("players").BindFunc(func(e *core.RecordEvent) error {
		if e.Record.GetString("status") != "disconnected" {
			return e.Next()
		}

		gameID := e.Record.GetString("game")
		disconnectedID := e.Record.Id

		game, err := e.App.FindRecordById("games", gameID)
		if err != nil {
			return e.Next() // game already gone
		}

		// Only care if this was actually the host
		if game.GetString("host") != disconnectedID {
			return e.Next()
		}

		// Find the next active player by join order (oldest created != disconnected player)
		candidates, err := e.App.FindRecordsByFilter(
			"players",
			"game = {:game} && status = 'active' && id != {:skip}",
			"created", // ascending → oldest first
			1, 0,
			dbx.Params{"game": gameID, "skip": disconnectedID},
		)
		if err != nil || len(candidates) == 0 {
			// No active players left — close the room
			game.Set("status", "ended")
			if saveErr := e.App.Save(game); saveErr != nil {
				log.Printf("[presence] close empty game: %v", saveErr)
			}
			return e.Next()
		}

		newHost := candidates[0]
		game.Set("host", newHost.Id)
		if err := e.App.Save(game); err != nil {
			log.Printf("[presence] promote host: %v", err)
		}

		// Realtime "update" on games → clients see the new hostId and
		// can render the host controls on the right player's screen

		return e.Next()
	})
}