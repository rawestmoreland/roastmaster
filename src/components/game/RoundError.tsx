import { useState } from "react";
import { usePocketBase } from "@/contexts/pocketbase";
import type { GameScreenProps } from "@/routes/game/$gameId";

export function RoundError({ game, round, myToken, isHost }: GameScreenProps) {
	if (!round) return null;

	const pb = usePocketBase();
	const [retrying, setRetrying] = useState(false);
	const [skipping, setSkipping] = useState(false);

	const handleRetry = async () => {
		if (retrying) return;
		setRetrying(true);
		try {
			await pb.collection("rounds").update(round.id, { status: "judging" });
		} catch (err) {
			console.error("[error] retry failed:", err);
			setRetrying(false);
		}
	};

	const handleSkip = async () => {
		if (skipping) return;
		setSkipping(true);
		try {
			await pb.send("/api/rounds", {
				method: "POST",
				headers: { "X-Player-Token": myToken },
				body: JSON.stringify({ gameId: game.id, roundIndex: round.index + 1 }),
			});
		} catch (err) {
			console.error("[error] skip failed:", err);
			setSkipping(false);
		}
	};

	return (
		<div className="min-h-screen bg-rm-bg flex flex-col items-center justify-center gap-8 p-6">
			<div className="flex flex-col items-center gap-4 text-center max-w-sm animate-rm-fade-in">
				<div className="w-12 h-12 rounded-full bg-rm-surface-1 border border-rm-error flex items-center justify-center">
					<span className="text-rm-error text-xl font-bold">!</span>
				</div>
				<h2 className="font-display text-3xl text-rm-text">Something went wrong</h2>
				<p className="text-rm-text-muted text-sm font-body">
					The AI had a moment. It happens to the best of us.
				</p>
			</div>

			{isHost ? (
				<div className="flex flex-col gap-3 w-full max-w-xs">
					<button
						type="button"
						onClick={handleRetry}
						disabled={retrying}
						className="w-full py-3.5 rounded-xl bg-rm-accent text-rm-text-on-accent font-display text-xl cursor-pointer hover:bg-rm-accent-dark active:scale-[0.99] transition-all rm-stripe disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{retrying ? "Retrying…" : "Retry"}
					</button>
					<button
						type="button"
						onClick={handleSkip}
						disabled={skipping}
						className="w-full py-3.5 rounded-xl bg-rm-surface-1 border border-rm-border text-rm-text-muted font-display text-xl cursor-pointer hover:border-rm-border-strong transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{skipping ? "Skipping…" : "Skip round"}
					</button>
				</div>
			) : (
				<p className="text-rm-text-muted text-sm font-body">
					Waiting for the host to sort this out…
				</p>
			)}
		</div>
	);
}
