// src/components/Lobby.tsx
import { useEffect, useState, useCallback } from 'react';
import type { RecordSubscription } from 'pocketbase';
import { usePocketBase } from '@/contexts/pocketbase';

// ─── types ────────────────────────────────────────────────────────────────────

interface Game {
  id: string;
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  host: string;
  totalRounds: number;
}

interface Player {
  id: string;
  name: string;
  status: 'active' | 'disconnected';
  game: string;
  score: number;
}

interface LobbyProps {
  game: Game;
  myPlayerId: string;
  myToken: string;
  onGameStart: () => void;
}

// ─── constants ────────────────────────────────────────────────────────────────

const CHIP_COUNT = 6;

const TICKER_TEXT = Array(4)
  .fill(
    '★ ROASTMASTER ★ \u00a0\u00a0\u00a0 get ready to get absolutely destroyed ' +
      '\u00a0\u00a0\u00a0 ★ ROASTMASTER ★ \u00a0\u00a0\u00a0 the AI has no mercy ' +
      '\u00a0\u00a0\u00a0 ★ ROASTMASTER ★ \u00a0\u00a0\u00a0 your friends are judging you \u00a0\u00a0\u00a0',
  )
  .join('');

function chipStyle(index: number): React.CSSProperties {
  const i = index % CHIP_COUNT;
  return {
    background: `var(--rm-chip-${i}-bg)`,
    border: `1px solid var(--rm-chip-${i}-border)`,
    color: `var(--rm-chip-${i}-text)`,
    '--avatar-bg': `var(--rm-chip-${i}-avatar)`,
    '--avatar-color': `var(--rm-chip-${i}-avatar-text)`,
  } as React.CSSProperties;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Ticker() {
  return (
    <div className='bg-rm-yellow text-rm-bg font-display text-[13px] tracking-[0.08em] py-1.5 overflow-hidden whitespace-nowrap'>
      <span className='inline-block animate-rm-ticker'>{TICKER_TEXT}</span>
    </div>
  );
}

function PlayerChip({
  player,
  isHost,
  index,
}: {
  player: Player;
  isHost: boolean;
  index: number;
}) {
  const initials = player.name.slice(0, 2).toUpperCase();

  return (
    <div
      className='flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-bold animate-rm-chip-in'
      style={chipStyle(index)}
    >
      {/* avatar circle */}
      <div
        className='w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-black shrink-0'
        style={{
          background: `var(--rm-chip-${index % CHIP_COUNT}-avatar)`,
          color: `var(--rm-chip-${index % CHIP_COUNT}-avatar-text, #fff)`,
        }}
      >
        {initials}
      </div>

      <span>{player.name}</span>

      {isHost && (
        <span
          className='text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-px rounded-[3px] ml-0.5'
          style={{
            background: `var(--rm-chip-${index % CHIP_COUNT}-border)`,
            color: `var(--rm-chip-${index % CHIP_COUNT}-text)`,
          }}
        >
          HOST
        </span>
      )}
    </div>
  );
}

function WaitingDots() {
  return (
    <div className='flex flex-col items-center gap-2 opacity-35'>
      <div className='flex gap-1.5'>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className='w-1.5 h-1.5 rounded-full bg-rm-border block animate-rm-dot-bounce'
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className='text-[12px] text-rm-text-muted'>
        Waiting for more players to join
      </span>
    </div>
  );
}

function SettingPill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className='flex items-center gap-1.5 bg-rm-surface-1 border border-rm-border rounded-full px-3 py-1 text-[12px] text-rm-text-secondary'>
      <span className='text-rm-red'>{icon}</span>
      {label}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function Lobby({ game, myPlayerId, myToken, onGameStart }: LobbyProps) {
  const pb = usePocketBase();
  const [players, setPlayers] = useState<Player[]>([]);
  const [starting, setStarting] = useState(false);

  const isHost = game.host === myPlayerId;
  const activePlayers = players.filter((p) => p.status === 'active');
  const canStart = activePlayers.length >= 2 && !starting;

  // ── stable onGameStart ref so useEffect deps stay clean ───────────────────
  const onGameStartRef = useCallback(onGameStart, [onGameStart]);

  // ── realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    // initial fetch before subscription catches up
    pb.collection('players')
      .getFullList<Player>({
        filter: `game = "${game.id}" && status = "active"`,
        sort: 'created',
      })
      .then(setPlayers)
      .catch(console.error);

    const playerUnsub = pb
      .collection('players')
      .subscribe<Player>('*', (e: RecordSubscription<Player>) => {
        if (e.record.game !== game.id) return;
        setPlayers((prev) => {
          switch (e.action) {
            case 'create':
              return prev.some((p) => p.id === e.record.id)
                ? prev
                : [...prev, e.record];
            case 'update':
              return prev.map((p) => (p.id === e.record.id ? e.record : p));
            case 'delete':
              return prev.filter((p) => p.id !== e.record.id);
            default:
              return prev;
          }
        });
      });

    const gameUnsub = pb.collection('games').subscribe<Game>(game.id, (e) => {
      if (e.record.status === 'playing') onGameStartRef();
    });

    return () => {
      playerUnsub.then((fn) => fn());
      gameUnsub.then((fn) => fn());
    };
  }, [game.id, pb, onGameStartRef]);

  // ── start handler ──────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!isHost || !canStart) return;
    setStarting(true);
    try {
      await pb.send(`/api/games/${game.id}/start`, {
        method: 'POST',
        headers: { 'X-Player-Token': myToken },
      });
      // navigation fires via the game subscription above
    } catch (err) {
      console.error('[lobby] start failed:', err);
      setStarting(false);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className='bg-rm-bg rounded-xl overflow-hidden font-body min-h-[520px]'>
      <Ticker />

      {/* two-column body */}
      <div className='grid grid-cols-2 min-h-[460px]'>
        {/* ── left: code + controls ── */}
        <div className='flex flex-col gap-5 p-7 border-r-2 border-dashed border-rm-border'>
          {/* logo */}
          <span className='font-display text-[13px] text-rm-red tracking-[0.15em] uppercase'>
            ★ Roastmaster
          </span>

          {/* join code */}
          <div className='flex-1 flex flex-col justify-center gap-2.5'>
            <span className='text-[11px] font-bold tracking-[0.2em] uppercase text-rm-text-secondary'>
              Join code
            </span>
            <span className='font-display text-[72px] leading-none text-rm-yellow tracking-[0.05em] animate-rm-pulse-code'>
              {game.code}
            </span>
            <span className='text-[12px] text-rm-text-muted'>
              Share this with your friends
            </span>
          </div>

          {/* dashed divider */}
          <div className='rm-dash-rule' />

          {/* settings pills */}
          <div className='flex gap-4 items-center'>
            <SettingPill icon='↻' label={`${game.totalRounds} rounds`} />
            <SettingPill icon='⏱' label='60s answer' />
          </div>

          {/* start / waiting */}
          {isHost ? (
            <div className='flex flex-col gap-2'>
              <button
                onClick={handleStart}
                disabled={!canStart}
                className={[
                  'w-full py-3.5 rounded-lg font-display text-[22px] tracking-[0.06em]',
                  'transition-transform duration-100 relative overflow-hidden',
                  canStart
                    ? 'bg-rm-red text-white cursor-pointer hover:bg-rm-red-dark hover:-translate-y-px active:translate-y-px rm-stripe'
                    : 'bg-rm-surface-1 text-rm-text-disabled cursor-not-allowed',
                ].join(' ')}
              >
                {starting
                  ? 'Starting…'
                  : canStart
                    ? 'Start the game!'
                    : 'Wait for players…'}
              </button>

              {!canStart && !starting && (
                <span className='text-[11px] text-rm-text-muted text-center'>
                  Need at least 2 players to start
                </span>
              )}
            </div>
          ) : (
            <div className='w-full py-3.5 rounded-lg bg-rm-surface-1 border border-rm-border text-center text-[13px] text-rm-text-muted font-display tracking-[0.05em]'>
              Waiting for host to start…
            </div>
          )}
        </div>

        {/* ── right: player list ── */}
        <div className='flex flex-col gap-4 p-7'>
          {/* header */}
          <div className='flex items-baseline justify-between'>
            <span className='text-[11px] font-bold tracking-[0.2em] uppercase text-rm-text-secondary'>
              Players in lobby
            </span>
            <span className='font-display text-[15px] text-rm-yellow'>
              {activePlayers.length} / 8
            </span>
          </div>

          {/* chips */}
          <div className='flex-1 flex flex-wrap content-start gap-2'>
            {activePlayers.map((p, i) => (
              <PlayerChip
                key={p.id}
                player={p}
                isHost={game.host === p.id}
                index={i}
              />
            ))}
          </div>

          {/* waiting state */}
          {activePlayers.length < 2 && <WaitingDots />}
        </div>
      </div>
    </div>
  );
}
