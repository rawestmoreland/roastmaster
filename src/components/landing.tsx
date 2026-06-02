import { useState } from 'react';
import { usePocketBase } from '@/contexts/pocketbase';
import type { Game, SessionInfo } from '#/types/game';

interface LandingProps {
  onCreateGame: (game: Game, session: SessionInfo) => void;
  onJoinGame: (code: string) => void;
}

type Tab = 'create' | 'join';

export function Landing({ onCreateGame, onJoinGame }: LandingProps) {
  const pb = usePocketBase();
  const [tab, setTab] = useState<Tab>('create');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [rounds, setRounds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
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
        code: string;
        playerId: string;
        token: string;
      }>('/api/games', {
        method: 'POST',
        body: JSON.stringify({ nickname: name, totalRounds: rounds }),
      });
      const game = await pb.collection('games').getOne<Game>(res.gameId);
      onCreateGame(game, {
        gameId: res.gameId,
        playerId: res.playerId,
        token: res.token,
      });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create game');
      setLoading(false);
    }
  };

  const handleJoin = () => {
    const c = code.trim().toUpperCase();
    if (c.length === 0) {
      setError('Enter a join code');
      return;
    }
    setError(null);
    onJoinGame(c);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') tab === 'create' ? handleCreate() : handleJoin();
  };

  return (
    <div className='w-full max-w-md'>
      {/* logo */}
      <div className='text-center mb-8'>
        <h1 className='font-display text-7xl text-rm-yellow leading-none tracking-wide'>
          ROAST
        </h1>
        <h1 className='font-display text-7xl text-rm-red leading-none tracking-wide -mt-2'>
          MASTER
        </h1>
        <p className='text-rm-text-secondary text-sm mt-3 tracking-widest uppercase font-bold'>
          The AI-judged party game
        </p>
      </div>

      {/* card */}
      <div className='bg-rm-surface-1 border border-rm-border rounded-xl overflow-hidden'>
        {/* tabs */}
        <div className='grid grid-cols-2 border-b border-rm-border'>
          {(['create', 'join'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={[
                'py-3.5 font-display text-[15px] tracking-[0.08em] uppercase transition-colors',
                tab === t
                  ? 'text-rm-yellow border-b-2 border-rm-yellow bg-rm-surface-2'
                  : 'text-rm-text-muted hover:text-rm-text-secondary',
              ].join(' ')}
            >
              {t === 'create' ? 'Create room' : 'Join room'}
            </button>
          ))}
        </div>

        <div className='p-6 flex flex-col gap-4'>
          {/* nickname — shown on both tabs */}
          <div className='flex flex-col gap-1.5'>
            <label className='text-[11px] font-bold tracking-[0.2em] uppercase text-rm-text-secondary'>
              Your nickname
            </label>
            <input
              type='text'
              placeholder='e.g. Gabe'
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={handleKeyDown}
              className='w-full bg-rm-bg border border-rm-border rounded-lg px-4 py-3 text-rm-text text-[15px] placeholder:text-rm-text-disabled focus:outline-none focus:border-rm-yellow transition-colors'
            />
          </div>

          {tab === 'create' && (
            <div className='flex flex-col gap-1.5'>
              <label className='text-[11px] font-bold tracking-[0.2em] uppercase text-rm-text-secondary'>
                Rounds
              </label>
              {/* round selector pills */}
              <div className='flex gap-2'>
                {[3, 5, 7, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRounds(n)}
                    className={[
                      'flex-1 py-2.5 rounded-lg font-display text-[18px] tracking-wide transition-colors',
                      rounds === n
                        ? 'bg-rm-red text-white'
                        : 'bg-rm-bg border border-rm-border text-rm-text-secondary hover:border-rm-red hover:text-rm-red',
                    ].join(' ')}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'join' && (
            <div className='flex flex-col gap-1.5'>
              <label className='text-[11px] font-bold tracking-[0.2em] uppercase text-rm-text-secondary'>
                Join code
              </label>
              <input
                type='text'
                placeholder='e.g. A3F9C1'
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className='w-full bg-rm-bg border border-rm-border rounded-lg px-4 py-3 text-rm-yellow font-display text-[28px] tracking-[0.3em] text-center placeholder:text-rm-text-disabled placeholder:text-[15px] placeholder:tracking-normal placeholder:font-body focus:outline-none focus:border-rm-yellow transition-colors uppercase'
              />
            </div>
          )}

          {/* error */}
          {error && (
            <p className='text-rm-error text-[13px] text-center -mb-1'>
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={tab === 'create' ? handleCreate : handleJoin}
            disabled={loading}
            className={[
              'w-full py-3.5 rounded-lg font-display text-[22px] tracking-[0.06em]',
              'transition-transform duration-100 relative overflow-hidden',
              !loading
                ? 'bg-rm-red text-white hover:bg-rm-red-dark hover:-translate-y-px active:translate-y-px rm-stripe cursor-pointer'
                : 'bg-rm-surface-2 text-rm-text-disabled cursor-not-allowed',
            ].join(' ')}
          >
            {loading
              ? 'One sec…'
              : tab === 'create'
                ? 'Create room'
                : 'Join room'}
          </button>
        </div>
      </div>

      {/* footer flavour */}
      <p className='text-center text-rm-text-muted text-[11px] mt-4 tracking-widest uppercase'>
        No account needed · Just vibes
      </p>
    </div>
  );
}
