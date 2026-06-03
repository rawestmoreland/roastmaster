# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Roastmaster is an AI-judged multiplayer party game. Players create or join a room with a 6-character code, submit answers to prompts, and a Claude model scores and roasts each answer. The frontend is a React SPA; the backend is a custom PocketBase server written in Go.

## Commands

### Frontend (root)
```bash
npm run dev        # dev server on port 3000
npm run build      # production build
npm run test       # run Vitest tests
npm run lint       # Biome lint
npm run format     # Biome format
npm run check      # Biome lint + format check combined
```

### PocketBase backend (`pocketbase/` directory)
```bash
make run           # go run . serve --http="127.0.0.1:8080"
make build         # docker compose build pocketbase
make recreate      # docker compose up --force-recreate -d
```

The backend requires `ANTHROPIC_API_KEY` in the environment for AI judging to work.

## Architecture

The app has two independent processes that must both be running:

**Frontend** — Vite + React 19 + TanStack Router (file-based routing). All routes are files under `src/routes/`. The root layout (`src/routes/__root.tsx`) wraps everything in `PocketBaseProvider`.

**Backend** — PocketBase (`pocketbase/base/`) with four custom API routes mounted in `main.go`:
- `POST /api/games` — create a room, returns `{gameId, code, playerId, token}`
- `POST /api/games/{code}/join` — join by code, returns `{gameId, playerId, token}`
- `POST /api/games/{id}/start` — host-only, requires `X-Player-Token` header
- `DELETE /api/players/{id}` — leave/disconnect, requires `X-Player-Token`

Player auth is token-based, not PocketBase auth. On create/join, the backend generates a random hex token and returns it once. The client stores it in memory and sends it as `X-Player-Token` on privileged calls.

**AI judging** fires as a PocketBase hook in `main.go`: whenever a `rounds` record is saved with `status = "judging"`, `judgeRound()` in `judge.go` collects answers, calls the Anthropic Messages API, and writes scores + critiques back to each `answer` record. PocketBase's realtime broadcast then pushes those updates to all connected clients automatically.

**Realtime** is PocketBase SSE subscriptions. The lobby (`src/components/lobby.tsx`) subscribes to `players/*` and `games/{id}` to update the player list and detect game start without polling.

**Presence / host promotion** is handled by `presence.go`: when a player's status flips to `disconnected`, PocketBase promotes the oldest remaining active player to host, or ends the game if none remain.

## PocketBase collections

| Collection | Key fields |
|---|---|
| `games` | `code`, `status` (lobby/playing/ended), `host` (player id), `totalRounds`, `currentRound` |
| `players` | `game`, `name`, `token`, `status` (active/disconnected), `score` |
| `rounds` | `game`, `prompt`, `index`, `status` (answering/judging/reveal/error) |
| `answers` | `round`, `player`, `text`, `score`, `critique` |

## Design system

All design tokens live in `src/styles.css` as CSS custom properties and are exposed to Tailwind v4 via `@theme inline`. Never hardcode color hex values in components — use the token utilities.

The theme is dark (deep navy `#1b1c34` background) with a single neon-mint accent (`#04fccc`) — the Pied Piper palette. Source vars: `#04fccc` · `#7bfde4` · `#08947c` · `#01977a` · `#1b1c34`.

Key token families:
- **Brand/accent**: `text-rm-accent`, `bg-rm-accent`, `bg-rm-accent-dark` (hover), `bg-rm-accent-light` (tinted surface), `text-rm-text-on-accent` (white, for text on accent buttons)
- **Surfaces**: `bg-rm-bg`, `bg-rm-surface-1`, `bg-rm-surface-2`, `border-rm-border`, `border-rm-border-strong`
- **Text**: `text-rm-text`, `text-rm-text-secondary`, `text-rm-text-muted`, `text-rm-text-disabled`
- **Round states**: `text-rm-answering`, `text-rm-judging`, `text-rm-reveal`, `text-rm-error`, `text-rm-ended`
- **Player chips**: CSS vars `--rm-chip-{0-5}-{bg,border,avatar,avatar-text,text}` — light-mode tints, cycle with `index % 6`
- **Convenience alias**: `text-rm-red` → same as `text-rm-error` (`#DC2626`)

Fonts (three roles):
- `font-display` — DM Serif Display, used for headings and the join code
- `font-body` — DM Sans, used for all UI copy
- `font-mono` — DM Mono, used for the join code input and code badges

Named animations: `animate-rm-ticker`, `animate-rm-pulse-code` (opacity pulse), `animate-rm-chip-in` (6px slide-up), `animate-rm-dot-bounce`, `animate-rm-score-slam`, `animate-rm-fade-in`. Keyframes are defined globally in `src/styles.css`.

Reusable CSS classes: `.rm-stripe` (faint diagonal stripe on CTA buttons), `.rm-dash-rule` (1px dashed divider), `.rm-status-badge` (round status pill base).

## Path aliases

- `@/*` → `src/*` (Vite tsconfigPaths)
- `#/*` → `src/*` (Node `imports` field in `package.json`)

Both are in use across the codebase — either is valid.
