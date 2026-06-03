import { useState } from 'react';
import { usePocketBase } from '@/contexts/pocketbase';
import type { Game, SessionInfo } from '#/types/game';

interface JoinProps {
  code: string;
  onJoined: (game: Game, session: SessionInfo) => void;
  onBack: () => void;
}

export function Join({ code, onJoined, onBack }: JoinProps) {
  const pb = usePocketBase();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    const name = nickname.trim();
    if (!name) {
      setError('Pick a nickname first');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await pb.send<{
        gameId: string;
        playerId: string;
        token: string;
      }>(`/api/games/${code}/join`, {
        method: 'POST',
        body: JSON.stringify({ nickname: name }),
      });
      const game = await pb.collection('games').getOne<Game>(res.gameId);
      onJoined(game, {
        gameId: res.gameId,
        playerId: res.playerId,
        token: res.token,
      });
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      setError(
        msg.includes('already taken')
          ? 'That nickname is taken in this room'
          : msg.includes('not found')
            ? 'Room not found — check the code'
            : 'Failed to join, try again',
      );
      setLoading(false);
    }
  };

  return (
    <div className='w-full max-w-sm'>
      {/* back */}
      <button
        onClick={onBack}
        className='flex items-center gap-2 text-rm-text-muted hover:text-rm-text-secondary text-[13px] mb-6 transition-colors group'
      >
        <span className='group-hover:-translate-x-0.5 transition-transform'>
          ←
        </span>
        Back
      </button>

      {/* card */}
      <div className='bg-rm-surface-1 border border-rm-border rounded-xl overflow-hidden'>
        {/* header */}
        <div className='px-6 pt-6 pb-4 border-b border-rm-border'>
          <p className='text-[11px] font-bold tracking-[0.2em] uppercase text-rm-text-secondary mb-1'>
            Joining room
          </p>
          <p className='font-mono italic text-4xl text-rm-text tracking-[0.15em]'>
            {code}
          </p>
        </div>

        <div className='p-6 flex flex-col gap-4'>
          <div className='flex flex-col gap-1.5'>
            <label className='text-[11px] font-bold tracking-[0.2em] uppercase text-rm-text-secondary'>
              Your nickname
            </label>
            <input
              type='text'
              placeholder='e.g. Alex'
              maxLength={20}
              autoFocus
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className='w-full bg-rm-bg border border-rm-border rounded-lg px-4 py-3 text-rm-text text-[15px] placeholder:text-rm-text-disabled focus:outline-none focus:border-rm-accent transition-colors'
            />
          </div>

          {error && (
            <p className='text-rm-error text-[13px] text-center -mb-1'>
              {error}
            </p>
          )}

          <button
            onClick={handleJoin}
            disabled={loading}
            className={[
              'w-full py-3.5 rounded-lg font-display text-[22px] tracking-[0.06em]',
              'transition-transform duration-100 relative overflow-hidden',
              !loading
                ? 'bg-rm-accent text-rm-text-on-accent hover:bg-rm-accent-dark hover:-translate-y-px active:translate-y-px rm-stripe cursor-pointer'
                : 'bg-rm-surface-2 text-rm-text-disabled cursor-not-allowed',
            ].join(' ')}
          >
            {loading ? 'Joining…' : "Let's go!"}
          </button>
        </div>
      </div>
    </div>
  );
}
