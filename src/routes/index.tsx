// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Landing } from '@/components/landing';
import { Join } from '@/components/join';
import { Lobby } from '@/components/lobby';
import { useNavigate } from '@tanstack/react-router';
import type { Game } from '#/types/game';

type Screen =
  | { name: 'landing' }
  | { name: 'joining'; code: string }
  | { name: 'lobby'; game: Game; playerId: string; token: string };

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>({ name: 'landing' });

  return (
    <main className='min-h-screen bg-rm-bg flex items-center justify-center p-4'>
      {screen.name === 'landing' && (
        <Landing
          onCreateGame={(game, session) =>
            setScreen({
              name: 'lobby',
              game,
              playerId: session.playerId,
              token: session.token,
            })
          }
          onJoinGame={(code) => setScreen({ name: 'joining', code })}
        />
      )}

      {screen.name === 'joining' && (
        <Join
          code={screen.code}
          onJoined={(game, session) =>
            setScreen({
              name: 'lobby',
              game,
              playerId: session.playerId,
              token: session.token,
            })
          }
          onBack={() => setScreen({ name: 'landing' })}
        />
      )}

      {screen.name === 'lobby' && (
        <Lobby
          game={screen.game}
          myPlayerId={screen.playerId}
          myToken={screen.token}
          onGameStart={() =>
            navigate({
              to: '/game/$gameId',
              params: { gameId: screen.game.id },
            })
          }
        />
      )}
    </main>
  );
}
