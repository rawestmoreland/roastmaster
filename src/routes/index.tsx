// src/routes/index.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Game } from "#/types/game";
import { Join } from "@/components/join";
import { Landing } from "@/components/landing";
import { Lobby } from "@/components/lobby";
import { usePocketBase } from "@/contexts/pocketbase";
import { clearSession, loadSession, saveSession } from "@/hooks/useSession";

type Screen =
	| { name: "landing" }
	| { name: "joining"; code: string }
	| { name: "lobby"; game: Game; playerId: string; token: string };

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const navigate = useNavigate();
	const pb = usePocketBase();
	const [screen, setScreen] = useState<Screen>({ name: "landing" });

	useEffect(() => {
		const stored = loadSession();
		if (!stored) return;
		pb.collection("games")
			.getOne<Game>(stored.gameId)
			.then((game) => {
				if (game.status === "lobby") {
					setScreen({
						name: "lobby",
						game,
						playerId: stored.playerId,
						token: stored.token,
					});
				} else if (game.status === "playing") {
					navigate({ to: "/game/$gameId", params: { gameId: stored.gameId } });
				} else {
					clearSession();
				}
			})
			.catch(() => clearSession());
	}, [pb, navigate]);

	return (
		<main className="min-h-screen bg-rm-bg flex items-center justify-center p-4">
			{screen.name === "landing" && (
				<Landing
					onCreateGame={(game, session) => {
						saveSession({
							gameId: game.id,
							playerId: session.playerId,
							token: session.token,
						});
						setScreen({
							name: "lobby",
							game,
							playerId: session.playerId,
							token: session.token,
						});
					}}
					onJoinGame={(code) => setScreen({ name: "joining", code })}
				/>
			)}

			{screen.name === "joining" && (
				<Join
					code={screen.code}
					onJoined={(game, session) => {
						saveSession({
							gameId: game.id,
							playerId: session.playerId,
							token: session.token,
						});
						setScreen({
							name: "lobby",
							game,
							playerId: session.playerId,
							token: session.token,
						});
					}}
					onBack={() => setScreen({ name: "landing" })}
				/>
			)}

			{screen.name === "lobby" && (
				<Lobby
					game={screen.game}
					myPlayerId={screen.playerId}
					myToken={screen.token}
					onGameStart={() =>
						navigate({
							to: "/game/$gameId",
							params: { gameId: screen.game.id },
						})
					}
				/>
			)}
		</main>
	);
}
