export interface Game {
  id: string
  code: string
  status: 'lobby' | 'playing' | 'ended'
  host: string
  totalRounds: number
  currentRound: number
}

export interface Player {
  id: string
  name: string
  status: 'active' | 'disconnected'
  game: string
  score: number
}

export interface Round {
  id: string
  game: string
  prompt: string
  index: number
  status: 'answering' | 'judging' | 'reveal' | 'error'
}

export interface Answer {
  id: string
  round: string
  player: string
  text: string
  score: number
  critique: string
}

export interface SessionInfo {
  gameId: string
  playerId: string
  token: string
}