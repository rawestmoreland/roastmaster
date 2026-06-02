// src/routes/game/$gameId.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/game/$gameId')({
  component: GameScreen,
});

function GameScreen() {
  const { gameId } = Route.useParams();

  // game screen goes here — we'll build this next
  return (
    <div className='min-h-screen flex items-center justify-center'>
      <p className='text-rm-text-muted font-display text-2xl'>
        Game {gameId} — coming soon
      </p>
    </div>
  );
}
