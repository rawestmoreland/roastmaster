import { useState } from "react";
import { usePocketBase } from "@/contexts/pocketbase";
import type { GameScreenProps } from "@/routes/game/$gameId";

export function RoundTransition({
	game,
	round,
	players,
	myToken,
	isHost,
}: GameScreenProps) {
	const pb = usePocketBase();
	const [starting, setStarting] = useState(false);

	const nextRoundIndex = (round?.index ?? -1) + 1;
	const nextRoundNumber = nextRoundIndex + 1;
	const activePlayers = players.filter((p) => p.status === "active");

	const handleStart = async () => {
		if (!isHost || starting) return;
		setStarting(true);
		try {
			await pb.send("/api/rounds", {
				method: "POST",
				headers: { "X-Player-Token": myToken },
				body: JSON.stringify({ gameId: game.id, roundIndex: nextRoundIndex }),
			});
		} catch (err) {
			console.error("[transition] start round failed:", err);
			setStarting(false);
		}
	};

	return (
		<div className="min-h-screen bg-rm-bg flex flex-col items-center justify-center p-6">
			<div className="w-full max-w-md flex flex-col items-center gap-8 animate-rm-fade-in">
				<div className="text-center">
					<span className="text-rm-text-muted text-xs font-body tracking-widest uppercase">
						Round
					</span>
					<h1 className="font-display text-[80px] leading-none text-rm-text mt-1">
						{nextRoundNumber}
						<span className="text-rm-text-muted text-3xl"> / {game.total_rounds}</span>
					</h1>
				</div>

				<div className="rm-dash-rule w-full" />

				{isHost ? (
					<div className="flex flex-col items-center gap-3 w-full">
						<p className="text-rm-text-secondary text-sm text-center font-body">
							When everyone is ready, kick off the round.
						</p>
						<button
							type="button"
							onClick={handleStart}
							disabled={starting}
							className="w-full py-4 rounded-xl bg-rm-accent text-rm-text-on-accent font-display text-2xl tracking-wide cursor-pointer hover:bg-rm-accent-dark active:scale-[0.99] transition-all rm-stripe disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{starting ? "Starting…" : "Start round"}
						</button>
					</div>
				) : (
					<div className="flex flex-col items-center gap-4">
						<div className="flex gap-1.5">
							{[0, 1, 2].map((i) => (
								<span
									key={i}
									className="w-2 h-2 rounded-full bg-rm-text-muted animate-rm-dot-bounce"
									style={{ animationDelay: `${i * 0.15}s` }}
								/>
							))}
						</div>
						<p className="text-rm-text-muted text-sm font-body">
							Waiting for the host to start the round…
						</p>
					</div>
				)}

				<p className="text-rm-text-disabled text-xs font-body">
					{activePlayers.length} player
					{activePlayers.length !== 1 ? "s" : ""} ready
				</p>
			</div>
		</div>
	);
}
