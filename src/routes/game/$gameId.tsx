import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { RecordSubscription } from "pocketbase";
import { useEffect, useRef, useState } from "react";
import type { Game, Player, Round } from "#/types/game";
import { usePocketBase } from "@/contexts/pocketbase";
import { loadSession } from "@/hooks/useSession";
import { AnswerScreen } from "@/components/game/AnswerScreen";
import { GameOver } from "@/components/game/GameOver";
import { JudgingScreen } from "@/components/game/JudgingScreen";
import { RevealScreen } from "@/components/game/RevealScreen";
import { RoundError } from "@/components/game/RoundError";
import { RoundTransition } from "@/components/game/RoundTransition";

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
	const [hostToast, setHostToast] = useState<string | null>(null);
	const prevHostRef = useRef<string>("");

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
						filter: `game = "${gameId}"`,
						sort: "created",
					}),
				]);

				if (cancelled) return;

				prevHostRef.current = game.host;
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

					// Detect host transfer
					if (
						prev.status === "active" &&
						prevHostRef.current &&
						e.record.host !== prevHostRef.current
					) {
						const newHost = players.find((p) => p.id === e.record.host);
						if (newHost) {
							setHostToast(newHost.name);
							setTimeout(() => setHostToast(null), 3000);
						}
					}
					prevHostRef.current = e.record.host;

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
						return prev.players.some((p) => p.id === e.record.id)
							? prev
							: { ...prev, players: [...players, e.record] };
					}
					if (e.action === "update") {
						return {
							...prev,
							players: players.map((p) =>
								p.id === e.record.id ? e.record : p,
							),
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

	// Fire-and-forget DELETE on tab/window close
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
			<div className="min-h-screen bg-rm-bg flex items-center justify-center gap-1.5">
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
					className="text-rm-accent underline font-body text-sm cursor-pointer"
					onClick={() => navigate({ to: "/" })}
				>
					Go home
				</button>
			</div>
		);
	}

	const sharedProps: GameScreenProps =
		state.status === "active"
			? {
					game: state.game,
					round: state.round,
					players: state.players,
					myPlayerId,
					myToken,
					isHost: state.game.host === myPlayerId,
				}
			: {
					game: state.game,
					round: null,
					players: state.players,
					myPlayerId,
					myToken,
					isHost: state.game.host === myPlayerId,
				};

	return (
		<>
			{state.status === "ended" && (
				<GameOver
					game={state.game}
					players={state.players}
					myPlayerId={myPlayerId}
					myToken={myToken}
				/>
			)}

			{state.status === "active" && (() => {
				const round = state.round;

				if (!round) return <RoundTransition {...sharedProps} />;
				if (round.status === "answering") return <AnswerScreen {...sharedProps} />;
				if (round.status === "judging") return <JudgingScreen {...sharedProps} />;
				if (round.status === "reveal") return <RevealScreen {...sharedProps} />;
				if (round.status === "error") return <RoundError {...sharedProps} />;
				return null;
			})()}

			{/* host transfer toast */}
			{hostToast && (
				<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-rm-fade-in">
					<div className="bg-rm-text text-rm-bg text-sm font-body font-medium px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
						{hostToast} is now the host
					</div>
				</div>
			)}
		</>
	);
}
