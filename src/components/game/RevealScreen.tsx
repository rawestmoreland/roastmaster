import { useEffect, useState } from "react";
import type { RecordSubscription } from "pocketbase";
import { usePocketBase } from "@/contexts/pocketbase";
import type { Answer, Player } from "#/types/game";
import type { GameScreenProps } from "@/routes/game/$gameId";
import { PlayerChip } from "./PlayerChip";

const CHIP_COUNT = 6;

export function RevealScreen({
	game,
	round,
	players,
	myToken,
	isHost,
}: GameScreenProps) {
	if (!round) return null;

	const pb = usePocketBase();
	const [answers, setAnswers] = useState<Answer[]>([]);
	const [starting, setStarting] = useState(false);
	const [ending, setEnding] = useState(false);

	const allScored = answers.length > 0 && answers.every((a) => a.score > 0);
	const isLastRound = round.index + 1 >= game.total_rounds;

	// Initial fetch
	useEffect(() => {
		pb.collection("answers")
			.getFullList<Answer>({ filter: `round = "${round.id}"`, sort: "created" })
			.then(setAnswers)
			.catch(console.error);
	}, [round.id, pb]);

	// Stream score updates
	useEffect(() => {
		const unsub = pb
			.collection("answers")
			.subscribe<Answer>("*", (e: RecordSubscription<Answer>) => {
				if (e.record.round !== round.id) return;
				if (e.action === "update") {
					setAnswers((prev) =>
						prev.map((a) => (a.id === e.record.id ? e.record : a)),
					);
				}
				if (e.action === "create") {
					setAnswers((prev) =>
						prev.some((a) => a.id === e.record.id) ? prev : [...prev, e.record],
					);
				}
			});
		return () => {
			unsub.then((fn) => fn());
		};
	}, [round.id, pb]);

	const sortedAnswers = allScored
		? [...answers].sort((a, b) => b.score - a.score)
		: answers;

	const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

	const handleNextRound = async () => {
		if (!isHost || starting) return;
		setStarting(true);
		try {
			await pb.send("/api/rounds", {
				method: "POST",
				headers: { "X-Player-Token": myToken },
				body: JSON.stringify({ gameId: game.id, roundIndex: round.index + 1 }),
			});
		} catch (err) {
			console.error("[reveal] next round failed:", err);
			setStarting(false);
		}
	};

	const handleEndGame = async () => {
		if (!isHost || ending) return;
		setEnding(true);
		try {
			await pb.collection("games").update(game.id, { status: "ended" });
		} catch (err) {
			console.error("[reveal] end game failed:", err);
			setEnding(false);
		}
	};

	return (
		<div className="min-h-screen bg-rm-bg flex flex-col">
			{/* header */}
			<div className="px-4 md:px-6 pt-5 pb-4 border-b border-rm-border">
				<div className="max-w-3xl mx-auto">
					<span className="text-rm-text-muted text-xs uppercase tracking-widest font-body">
						Round {round.index + 1} results
					</span>
					<h2 className="font-display text-2xl md:text-3xl text-rm-text mt-1 leading-snug">
						{round.prompt}
					</h2>
				</div>
			</div>

			{/* answer cards */}
			<div className="flex-1 px-4 md:px-6 py-5">
				<div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
					{sortedAnswers.map((ans, i) => {
						const player = players.find((p) => p.id === ans.player);
						const playerIndex = players.findIndex((p) => p.id === ans.player);
						return (
							<AnswerCard
								key={ans.id}
								answer={ans}
								player={player}
								playerIndex={playerIndex}
								delay={i * 0.08}
							/>
						);
					})}
				</div>
			</div>

			{/* running scores */}
			<div className="border-t border-rm-border px-4 md:px-6 py-4">
				<div className="max-w-3xl mx-auto">
					<span className="text-rm-text-disabled text-[10px] uppercase tracking-widest font-body">
						Running scores
					</span>
					<div className="flex flex-wrap gap-2 mt-2">
						{sortedPlayers.map((p) => (
							<PlayerChip
								key={p.id}
								player={p}
								index={players.findIndex((pl) => pl.id === p.id)}
								showScore
								score={p.score}
							/>
						))}
					</div>
				</div>
			</div>

			{/* host controls */}
			<div className="border-t border-rm-border px-4 md:px-6 py-4">
				<div className="max-w-3xl mx-auto">
					{isHost ? (
						<div className="flex gap-3">
							{!isLastRound && (
								<button
									type="button"
									onClick={handleNextRound}
									disabled={starting}
									className="flex-1 py-3 rounded-xl bg-rm-accent text-rm-text-on-accent font-display text-lg cursor-pointer hover:bg-rm-accent-dark active:scale-[0.99] transition-all rm-stripe disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{starting ? "Starting…" : "Next round"}
								</button>
							)}
							<button
								type="button"
								onClick={handleEndGame}
								disabled={ending}
								className={[
									"py-3 rounded-xl font-display text-lg cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed",
									isLastRound
										? "flex-1 bg-rm-accent text-rm-text-on-accent hover:bg-rm-accent-dark rm-stripe"
										: "px-6 bg-rm-surface-1 border border-rm-border text-rm-text-muted hover:border-rm-border-strong",
								].join(" ")}
							>
								{ending ? "Ending…" : "End game"}
							</button>
						</div>
					) : (
						<p className="text-center text-rm-text-muted text-sm font-body py-2">
							Waiting for the host to continue…
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

function AnswerCard({
	answer,
	player,
	playerIndex,
	delay,
}: {
	answer: Answer;
	player: Player | undefined;
	playerIndex: number;
	delay: number;
}) {
	const [showCritique, setShowCritique] = useState(answer.critique !== "");
	const hasScore = answer.score > 0;
	const i = Math.max(0, playerIndex) % CHIP_COUNT;

	useEffect(() => {
		if (hasScore && answer.critique) {
			const t = setTimeout(() => setShowCritique(true), 300);
			return () => clearTimeout(t);
		}
	}, [hasScore, answer.critique]);

	return (
		<div
			className="bg-rm-surface-1 border border-rm-border rounded-xl p-4 flex flex-col gap-3 animate-rm-fade-in"
			style={{ animationDelay: `${delay}s` }}
		>
			{/* player + score row */}
			<div className="flex items-center justify-between gap-2">
				<div
					className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-bold shrink-0"
					style={{
						background: `var(--rm-chip-${i}-bg)`,
						border: `1px solid var(--rm-chip-${i}-border)`,
						color: `var(--rm-chip-${i}-text)`,
					}}
				>
					<div
						className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
						style={{
							background: `var(--rm-chip-${i}-avatar)`,
							color: `var(--rm-chip-${i}-avatar-text, #fff)`,
						}}
					>
						{player?.name.slice(0, 2).toUpperCase() ?? "??"}
					</div>
					<span>{player?.name ?? "Unknown"}</span>
				</div>

				{hasScore && (
					<span className="font-display text-2xl text-rm-accent animate-rm-score-slam shrink-0">
						{answer.score}
						<span className="text-rm-text-muted text-xs font-body">/100</span>
					</span>
				)}
			</div>

			{/* answer text */}
			<p
				className="text-rm-text font-body text-sm leading-relaxed border-l-2 pl-3"
				style={{ borderColor: `var(--rm-chip-${i}-border)` }}
			>
				"{answer.text}"
			</p>

			{/* critique */}
			{showCritique && answer.critique && (
				<p className="text-rm-text-secondary text-xs font-body italic animate-rm-fade-in">
					— {answer.critique}
				</p>
			)}
		</div>
	);
}
