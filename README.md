# Roastmaster

> An AI-judged multiplayer party game where your wit gets scored and your answers get roasted.

**How it works:** Create a room, share the 6-character code, answer absurd prompts — then sit back while Claude reads your submissions, scores them 0–100 on wit + absurdity + relevance, and delivers a savage-but-friendly roast for each one. Results pop in live for everyone in the room.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TanStack Router (file-based) |
| Backend | [PocketBase](https://pocketbase.io/) (Go) with custom API routes |
| Realtime | PocketBase SSE subscriptions |
| AI Judge | Anthropic Claude via Messages API |
| Styling | Tailwind CSS v4 + design tokens |

---

## Getting Started

You need two processes running: the PocketBase backend and the Vite dev server.

### 1. Backend

```bash
cd pocketbase/base
cp .env.example .env      # add your ANTHROPIC_API_KEY
make run                  # go run . serve --http="127.0.0.1:8080"
```

The first run will bootstrap the SQLite database and all collections automatically. The admin UI is available at `http://127.0.0.1:8080/_/`.

**Required env var:**

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Frontend

```bash
npm install
npm run dev               # starts on http://localhost:3000
```

Open two browser tabs, create a game in one, join with the code in the other. Hit **Start** and start typing nonsense.

---

## Project Structure

```
roastmaster/
├── src/
│   ├── components/
│   │   ├── game/             # in-game screens (answer, judging, reveal, game over)
│   │   ├── landing.tsx       # home page
│   │   ├── lobby.tsx         # waiting room with realtime player list
│   │   └── join.tsx          # join-by-code flow
│   ├── routes/               # TanStack Router file-based routes
│   ├── contexts/             # PocketBase client context
│   ├── hooks/                # useSession (player token management)
│   └── styles.css            # design tokens + Tailwind theme
└── pocketbase/base/
    ├── main.go               # server setup, route registration, judge hook
    ├── judge.go              # AI scoring logic
    ├── lobby.go              # create/join/start/leave handlers
    ├── rounds.go             # round creation and answer submission
    └── presence.go           # disconnect detection + host promotion
```

---

## How the AI Judging Works

When all answers are submitted, the host triggers judging. PocketBase flips the round `status` to `"judging"`, which fires a hook in `main.go`. The hook calls `judgeRound()` in `judge.go`, which:

1. Fetches all answers for the round
2. Sends the prompt + numbered answers to Claude with this system prompt:

   > *You are the host of a chaotic party game. Score each answer 0–100 on wit + absurdity + relevance, and write ONE short savage-but-friendly roast (≤20 words).*

3. Parses the JSON verdict array from Claude's response
4. Writes scores + critiques back to each `answer` record
5. Accumulates scores on each `player` record
6. Flips the round to `"reveal"`

PocketBase's realtime layer broadcasts every `Save()` as an SSE event — so each player's score and roast pops in on every connected client the moment it's written, no polling needed.

---

## Game Flow

```
lobby (waiting) → answering → judging → reveal → [next round or game over]
```

- **Lobby**: Players join by code. The host sees a Start button once at least one other player is in.
- **Answering**: Everyone gets the same prompt and a timer. Submit before time runs out.
- **Judging**: Claude is thinking. A spinner taunts you.
- **Reveal**: Scores and roasts appear live, one player at a time as Claude responds.
- **Game Over**: Final leaderboard. The highest-scoring player is crowned Roastmaster.

**Presence / host promotion**: If a player disconnects mid-game, `presence.go` flips them to `disconnected` and promotes the oldest remaining active player to host. If everyone leaves, the game ends.

---

## PocketBase Collections

| Collection | Key fields |
|---|---|
| `games` | `code`, `status` (lobby/playing/ended), `host`, `totalRounds`, `currentRound` |
| `players` | `game`, `name`, `token`, `status` (active/disconnected), `score` |
| `rounds` | `game`, `prompt`, `index`, `status` (answering/judging/reveal/error) |
| `answers` | `round`, `player`, `text`, `score`, `critique` |

Player auth is token-based (not PocketBase's built-in auth). On create/join the backend returns a random hex token once. The client stores it in memory and sends it as `X-Player-Token` on privileged calls (start game, leave).

---

## Commands

### Frontend

```bash
npm run dev       # dev server on port 3000
npm run build     # production build
npm run test      # Vitest
npm run lint      # Biome lint
npm run format    # Biome format
npm run check     # lint + format check combined
```

### Backend

```bash
make run          # go run . serve --http="127.0.0.1:8080"
make build        # docker compose build pocketbase
make recreate     # docker compose up --force-recreate -d
```

---

## Contributing

Bug reports, roast-quality improvements, and new prompt ideas are all welcome. Open an issue or send a PR.

---

## License

MIT
