package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// ─── types ───────────────────────────────────────────────────────────────────

type verdict struct {
	Index    int    `json:"index"`
	Score    int    `json:"score"`
	Critique string `json:"critique"`
}

type anthropicReq struct {
	Model     string        `json:"model"`
	MaxTokens int           `json:"max_tokens"`
	System    string        `json:"system"`
	Messages  []chatMessage `json:"messages"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResp struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

// ─── judge a round ───────────────────────────────────────────────────────────

func judgeRound(app core.App, roundID string) error {
	round, err := app.FindRecordById("rounds", roundID)
	if err != nil {
		return fmt.Errorf("fetch round: %w", err)
	}

	answers, err := app.FindRecordsByFilter(
		"answers",
		"round = {:round}",
		"created", 100, 0,
		dbx.Params{"round": roundID},
	)
	if err != nil {
		return fmt.Errorf("fetch answers: %w", err)
	}

	if len(answers) == 0 {
		round.Set("status", "reveal")
		return app.Save(round)
	}

	// Build the numbered list the model will score
	var sb strings.Builder
	for i, a := range answers {
		fmt.Fprintf(&sb, "#%d: %s\n", i, a.GetString("text"))
	}

	verdicts, err := callAI(round.GetString("prompt"), sb.String())
	if err != nil {
		return fmt.Errorf("ai: %w", err)
	}

	for _, v := range verdicts {
		if v.Index >= len(answers) {
			continue
		}
		ans := answers[v.Index]
		ans.Set("score", v.Score)
		ans.Set("critique", v.Critique)

		// Each Save() broadcasts a realtime "update" event →
		// score + roast pops in for every connected client
		if err := app.Save(ans); err != nil {
			log.Printf("[judge] save answer %s: %v", ans.Id, err)
		}

		player, err := app.FindRecordById("players", ans.GetString("player"))
		if err != nil {
			log.Printf("[judge] find player: %v", err)
			continue
		}
		player.Set("score", player.GetInt("score")+v.Score)
		if err := app.Save(player); err != nil {
			log.Printf("[judge] save player: %v", err)
		}
	}

	// Flip to reveal — triggers this hook again, but the "judging" guard exits early
	round.Set("status", "reveal")
	return app.Save(round)
}

// ─── AI call ─────────────────────────────────────────────────────────────────

const judgeSystem = `You are the host of a chaotic party game. You get a prompt and a
numbered list of player answers. Score each 0–100 on wit + absurdity + relevance,
and write ONE short savage-but-friendly roast (≤20 words).
Reply ONLY with a JSON array, no prose or fences:
[{"index":0,"score":87,"critique":"Technically correct, the worst kind of correct."}]`

func callAI(prompt, entries string) ([]verdict, error) {
	// Check docs.claude.com/en/docs/about-claude/models for the current id
	const model = "claude-sonnet-4-5"

	payload := anthropicReq{
		Model:     model,
		MaxTokens: 1024,
		System:    judgeSystem,
		Messages: []chatMessage{
			{Role: "user", Content: "PROMPT: " + prompt + "\n\nANSWERS:\n" + entries},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", os.Getenv("ANTHROPIC_API_KEY"))
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("anthropic %d: %s", resp.StatusCode, b)
	}

	var ar anthropicResp
	if err := json.NewDecoder(resp.Body).Decode(&ar); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if len(ar.Content) == 0 {
		return nil, fmt.Errorf("empty content block")
	}

	// Strip accidental code fences defensively
	raw := strings.TrimSpace(ar.Content[0].Text)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")

	var verdicts []verdict
	return verdicts, json.Unmarshal([]byte(strings.TrimSpace(raw)), &verdicts)
}