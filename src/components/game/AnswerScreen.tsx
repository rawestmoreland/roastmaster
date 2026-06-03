import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordSubscription } from "pocketbase";
import { usePocketBase } from "@/contexts/pocketbase";
import type { Answer } from "#/types/game";
import type { GameScreenProps } from "@/routes/game/$gameId";
import { PlayerChip } from "./PlayerChip";
import { RoundTimer } from "./RoundTimer";

export function AnswerScreen({
	game,
	round,
	players,
	myPlayerId,
	myToken,
	isHost,
}: GameScreenProps) {
	if (!round) return null;

	const pb = usePocketBase();
	const [text, setText] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [submittedPlayerIds, setSubmittedPlayerIds] = useState<Set<string>>(new Set());
	const closingRef = useRef(false);

	const activePlayers = players.filter((p) => p.status === "active");

	// Fetch existing answers on mount (handles reconnect mid-round)
	useEffect(() => {
		pb.collection("answers")
			.getFullList<Answer>({ filter: `round = "${round.id}"` })
			.then((answers) => {
				const ids = new Set(answers.map((a) => a.player));
				setSubmittedPlayerIds(ids);
				if (ids.has(myPlayerId)) setSubmitted(true);
			})
			.catch(console.error);
	}, [round.id, myPlayerId, pb]);

	// Track submissions in realtime
	useEffect(() => {
		const unsub = pb
			.collection("answers")
			.subscribe<Answer>("*", (e: RecordSubscription<Answer>) => {
				if (e.record.round !== round.id) return;
				if (e.action === "create" || e.action === "update") {
					setSubmittedPlayerIds((prev) => new Set([...prev, e.record.player]));
				}
			});
		return () => {
			unsub.then((fn) => fn());
		};
	}, [round.id, pb]);

	const closeRound = useCallback(async () => {
		if (closingRef.current || !isHost) return;
		closingRef.current = true;
		try {
			await pb.collection("rounds").update(round.id, { status: "judging" });
		} catch (err) {
			console.error("[answer] close round failed:", err);
			closingRef.current = false;
		}
	}, [isHost, round.id, pb]);

	// Auto-close when all active players have answered (host only)
	useEffect(() => {
		if (!isHost) return;
		const activeIds = activePlayers.map((p) => p.id);
		if (activeIds.length > 0 && activeIds.every((id) => submittedPlayerIds.has(id))) {
			closeRound();
		}
	}, [submittedPlayerIds, activePlayers, isHost, closeRound]);

	const handleSubmit = async () => {
		if (submitted || submitting || !text.trim()) return;
		setSubmitting(true);
		try {
			await pb.collection("answers").create<Answer>({
				round: round.id,
				player: myPlayerId,
				text: text.trim(),
				score: 0,
			});
			setSubmitted(true);
		} catch (err) {
			console.error("[answer] submit failed:", err);
		} finally {
			setSubmitting(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
	};

	return (
		<div className="min-h-screen bg-rm-bg flex flex-col">
			{/* header */}
			<div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-6 pt-5 pb-4 border-b border-rm-border gap-3 md:gap-0">
				<div className="flex items-center gap-2">
					<span className="text-rm-text-muted text-xs uppercase tracking-widest font-body">
						Round
					</span>
					<span className="font-display text-2xl text-rm-text">{round.index + 1}</span>
					<span className="text-rm-text-disabled text-sm">/ {game.total_rounds}</span>
				</div>

				<div className="flex justify-center md:justify-end">
					<RoundTimer
						totalSeconds={60}
						onExpire={() => {
							if (isHost) closeRound();
						}}
					/>
				</div>
			</div>

			{/* prompt */}
			<div className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-6 md:py-8 max-w-2xl mx-auto w-full gap-5">
				<div className="rm-dash-rule w-full" />
				<h2 className="font-display text-2xl md:text-4xl text-rm-text text-center leading-snug">
					{round.prompt}
				</h2>
				<div className="rm-dash-rule w-full" />

				<div className="w-full flex flex-col gap-3">
					<textarea
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={handleKeyDown}
						readOnly={submitted}
						placeholder={submitted ? "Answer locked in!" : "Type your answer…"}
						maxLength={280}
						rows={3}
						className={[
							"w-full px-4 py-3 rounded-xl bg-rm-surface-1 border font-body text-rm-text",
							"placeholder:text-rm-text-disabled resize-none outline-none transition-colors",
							submitted
								? "border-rm-accent text-rm-text-secondary cursor-default"
								: "border-rm-border focus:border-rm-accent",
						].join(" ")}
					/>

					{!submitted ? (
						<button
							type="button"
							onClick={handleSubmit}
							disabled={!text.trim() || submitting}
							className="w-full py-3.5 rounded-xl bg-rm-accent text-rm-text-on-accent font-display text-xl tracking-wide cursor-pointer hover:bg-rm-accent-dark active:scale-[0.99] transition-all rm-stripe disabled:opacity-40 disabled:cursor-not-allowed"
						>
							{submitting ? "Submitting…" : "Submit answer"}
						</button>
					) : (
						<p className="text-center text-rm-text-muted text-sm font-body py-1">
							{isHost
								? `${submittedPlayerIds.size} / ${activePlayers.length} submitted — closing when all done`
								: "Waiting for the host to close the round…"}
						</p>
					)}
				</div>
			</div>

			{/* player chips */}
			<div className="border-t border-rm-border px-4 md:px-6 py-4">
				<div className="max-w-2xl mx-auto">
					<span className="text-rm-text-disabled text-[10px] uppercase tracking-widest font-body">
						Players
					</span>
					<div className="flex flex-wrap gap-2 mt-2">
						{activePlayers.map((p, i) => (
							<PlayerChip
								key={p.id}
								player={p}
								index={i}
								submitted={submittedPlayerIds.has(p.id)}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
