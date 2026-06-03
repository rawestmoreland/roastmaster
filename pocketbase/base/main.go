package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/joho/godotenv"
)

func main() {
	app := pocketbase.New()
	err := godotenv.Load()
	if err != nil {
		log.Printf("No .env file found: %v", err)
	}

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.POST("/api/games", handleCreateGame)
		e.Router.POST("/api/games/{code}/join", handleJoinGame)
		e.Router.POST("/api/games/{id}/start", handleStartGame)
		e.Router.DELETE("/api/players/{id}", handleLeaveGame)
		e.Router.POST("/api/rounds", handleCreateRound)
		return e.Next()
	})

	// Judge hook from earlier
	app.OnRecordAfterUpdateSuccess("rounds").BindFunc(func(e *core.RecordEvent) error {
		if e.Record.GetString("status") != "judging" {
			return e.Next()
		}
		roundID := e.Record.Id
		pbApp := e.App
		go func() {
			if err := judgeRound(pbApp, roundID); err != nil {
				log.Printf("[judge] %v", err)
				if round, err := pbApp.FindRecordById("rounds", roundID); err == nil {
					round.Set("status", "error")
					pbApp.Save(round)
				}
			}
		}()
		return e.Next()
	})

	registerPresenceHook(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}