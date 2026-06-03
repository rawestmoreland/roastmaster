import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { RecordSubscription } from "pocketbase";
import { useEffect, useState } from "react";
import type { Game, Player, Round } from "#/types/game";
import { usePocketBase } from "@/contexts/pocketbase";
import { loadSession } from "@/hooks/useSession";

export const Route = createFileRoute("/game/$gameId")({
	component: GameScreen,
});

export interface GameScreenProps {
	game: Game;
	round: Round | null;
	players: Player[];
	myPlayerId: string;
	myToken: string;
	isHost: boolean;
}

type GameState =
	| { status: "loading" }
	| { status: "active"; game: Game; round: Round | null; players: Player[] }
	| { status: "ended"; game: Game; players: Player[] }
	| { status: "error"; message: string };

function GameScreen() {
	const { gameId } = Route.useParams();
	const navigate = useNavigate();

	const session = loadSession();
	const hasValidSession = Boolean(session && session.gameId === gameId);

	useEffect(() => {
		if (!hasValidSession) {
			navigate({ to: "/" });
		}
	}, [hasValidSession, navigate]);

	if (!hasValidSession || !session) return null;

	return (
		<GameScreenInner
			gameId={gameId}
			myPlayerId={session.playerId}
			myToken={session.token}
		/>
	);
}

function GameScreenInner({
	gameId,
	myPlayerId,
	myToken,
}: {
	gameId: string;
	myPlayerId: string;
	myToken: string;
}) {
	const pb = usePocketBase();
	const navigate = useNavigate();
	const [state, setState] = useState<GameState>({ status: "loading" });

	// Fetch initial state and set up realtime subscriptions
	useEffect(() => {
		let cancelled = false;

		async function init() {
			try {
				const [game, roundsPage, players] = await Promise.all([
					pb.collection("games").getOne<Game>(gameId),
					pb.collection("rounds").getList<Round>(1, 1, {
						filter: `game = "${gameId}"`,
						sort: "-index",
					}),
					pb.collection("players").getFullList<Player>({
						filter: `game = "${gameId}" && status = "active"`,
						sort: "created",
					}),
				]);

				if (cancelled) return;

				const round = roundsPage.items[0] ?? null;

				if (game.status === "ended") {
					setState({ status: "ended", game, players });
				} else {
					setState({ status: "active", game, round, players });
				}
			} catch {
				if (!cancelled)
					setState({ status: "error", message: "Failed to load game." });
			}
		}

		init();

		const unsubGames = pb
			.collection("games")
			.subscribe<Game>(gameId, (e: RecordSubscription<Game>) => {
				setState((prev) => {
					const players =
						prev.status === "active" || prev.status === "ended"
							? prev.players
							: [];
					if (e.record.status === "ended") {
						return { status: "ended", game: e.record, players };
					}
					if (prev.status === "active") {
						return { ...prev, game: e.record };
					}
					return prev;
				});
			});

		const unsubRounds = pb
			.collection("rounds")
			.subscribe<Round>("*", (e: RecordSubscription<Round>) => {
				if (e.record.game !== gameId) return;
				if (e.action === "create" || e.action === "update") {
					setState((prev) => {
						if (prev.status !== "active") return prev;
						return { ...prev, round: e.record };
					});
				}
			});

		const unsubPlayers = pb
			.collection("players")
			.subscribe<Player>("*", (e: RecordSubscription<Player>) => {
				if (e.record.game !== gameId) return;
				setState((prev) => {
					if (prev.status !== "active" && prev.status !== "ended") return prev;
					const players = prev.players;
					if (e.action === "create") {
						if (e.record.status === "active")
							return { ...prev, players: [...players, e.record] };
						return prev;
					}
					if (e.action === "update") {
						return {
							...prev,
							players:
								e.record.status === "disconnected"
									? players.filter((p) => p.id !== e.record.id)
									: players.map((p) => (p.id === e.record.id ? e.record : p)),
						};
					}
					if (e.action === "delete") {
						return {
							...prev,
							players: players.filter((p) => p.id !== e.record.id),
						};
					}
					return prev;
				});
			});

		return () => {
			cancelled = true;
			for (const u of [unsubGames, unsubRounds, unsubPlayers]) {
				u.then((fn) => fn());
			}
		};
	}, [gameId, pb]);

	// Unload handler — fire-and-forget DELETE to mark player disconnected
	useEffect(() => {
		const handleUnload = () => {
			fetch(`/api/players/${myPlayerId}`, {
				method: "DELETE",
				headers: { "X-Player-Token": myToken },
				keepalive: true,
			});
		};
		window.addEventListener("beforeunload", handleUnload);
		return () => window.removeEventListener("beforeunload", handleUnload);
	}, [myPlayerId, myToken]);

	if (state.status === "loading") {
		return (
			<div className="min-h-screen bg-rm-bg flex items-center justify-center gap-1">
				{[0, 1, 2].map((i) => (
					<span
						key={i}
						className="w-2 h-2 rounded-full bg-rm-text-muted animate-rm-dot-bounce"
						style={{ animationDelay: `${i * 0.15}s` }}
					/>
				))}
			</div>
		);
	}

	if (state.status === "error") {
		return (
			<div className="min-h-screen bg-rm-bg flex flex-col items-center justify-center gap-4">
				<p className="text-rm-error font-body">{state.message}</p>
				<button
					type="button"
					className="text-rm-accent underline font-body text-sm"
					onClick={() => navigate({ to: "/" })}
				>
					Go home
				</button>
			</div>
		);
	}

	if (state.status === "ended") {
		return <div className="text-rm-text">GameOver — coming soon</div>;
	}

	const round = state.round;

	if (!round) {
		return <div className="text-rm-text">RoundTransition — coming soon</div>;
	}

	if (round.status === "answering") {
		return <div className="text-rm-text">AnswerScreen — coming soon</div>;
	}

	if (round.status === "judging") {
		return <div className="text-rm-text">JudgingScreen — coming soon</div>;
	}

	if (round.status === "reveal") {
		return <div className="text-rm-text">RevealScreen — coming soon</div>;
	}

	if (round.status === "error") {
		return <div className="text-rm-text">RoundError — coming soon</div>;
	}

	return null;
}
