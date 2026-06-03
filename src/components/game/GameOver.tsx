import { useNavigate } from "@tanstack/react-router";
import type { Game, Player } from "#/types/game";
import { clearSession } from "@/hooks/useSession";

interface GameOverProps {
	game: Game;
	players: Player[];
	myPlayerId: string;
	myToken: string;
}

export function GameOver({ players, myPlayerId, myToken }: GameOverProps) {
	const navigate = useNavigate();

	const sorted = [...players].sort((a, b) => b.score - a.score);
	const podium = sorted.slice(0, 3);
	const rest = sorted.slice(3);

	const handlePlayAgain = () => {
		clearSession();
		navigate({ to: "/" });
	};

	const handleLeave = async () => {
		clearSession();
		try {
			await fetch(`/api/players/${myPlayerId}`, {
				method: "DELETE",
				headers: { "X-Player-Token": myToken },
			});
		} catch {
			// best-effort
		}
		navigate({ to: "/" });
	};

	return (
		<div className="min-h-screen bg-rm-bg flex flex-col items-center justify-center p-6">
			<div className="w-full max-w-lg flex flex-col items-center gap-8 animate-rm-fade-in">
				<h1 className="font-display text-5xl md:text-6xl text-rm-text">Game over</h1>

				<div className="rm-dash-rule w-full" />

				{/* podium — top 3 */}
				<div className="w-full flex flex-col gap-2">
					{podium.map((player, rank) => {
						const i = players.findIndex((p) => p.id === player.id) % 6;
						const isWinner = rank === 0;
						const rankLabel = ["1", "2", "3"][rank];

						return (
							<div
								key={player.id}
								className="flex items-center gap-4 px-4 py-3 rounded-xl animate-rm-fade-in"
								style={{
									animationDelay: `${rank * 0.1}s`,
									background: `var(--rm-chip-${i}-bg)`,
									border: `1px solid var(--rm-chip-${i}-border)`,
								}}
							>
								<span className="font-display text-xl text-rm-text-muted w-5 text-center shrink-0">
									{rankLabel}
								</span>
								<div
									className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
									style={{
										background: `var(--rm-chip-${i}-avatar)`,
										color: `var(--rm-chip-${i}-avatar-text, #fff)`,
									}}
								>
									{player.name.slice(0, 2).toUpperCase()}
								</div>
								<span
									className={[
										"flex-1 font-body font-semibold text-sm md:text-base",
										isWinner ? "text-rm-accent" : "text-rm-text",
									].join(" ")}
								>
									{player.name}
								</span>
								<span className="font-display font-mono text-xl text-rm-text">
									{player.score}
								</span>
							</div>
						);
					})}
				</div>

				{/* remaining players */}
				{rest.length > 0 && (
					<div className="w-full flex flex-col gap-1.5">
						{rest.map((player, i) => {
							const globalRank = 3 + i;
							return (
								<div
									key={player.id}
									className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-rm-surface-1 border border-rm-border animate-rm-fade-in"
									style={{ animationDelay: `${globalRank * 0.1}s` }}
								>
									<span className="text-rm-text-disabled text-sm w-5 text-center font-mono shrink-0">
										{globalRank + 1}
									</span>
									<span className="flex-1 font-body text-rm-text text-sm">
										{player.name}
									</span>
									<span className="font-mono text-rm-text-muted text-sm">
										{player.score}
									</span>
								</div>
							);
						})}
					</div>
				)}

				<div className="rm-dash-rule w-full" />

				{/* actions */}
				<div className="flex gap-3 w-full">
					<button
						type="button"
						onClick={handlePlayAgain}
						className="flex-1 py-3.5 rounded-xl bg-rm-accent text-rm-text-on-accent font-display text-xl cursor-pointer hover:bg-rm-accent-dark active:scale-[0.99] transition-all rm-stripe"
					>
						Play again
					</button>
					<button
						type="button"
						onClick={handleLeave}
						className="flex-1 py-3.5 rounded-xl bg-rm-surface-1 border border-rm-border text-rm-text-muted font-display text-xl cursor-pointer hover:border-rm-border-strong transition-all"
					>
						Leave
					</button>
				</div>
			</div>
		</div>
	);
}
