import { useEffect, useState } from "react";
import type { RecordSubscription } from "pocketbase";
import { usePocketBase } from "@/contexts/pocketbase";
import type { Answer } from "#/types/game";
import type { GameScreenProps } from "@/routes/game/$gameId";

export function JudgingScreen({ round, players }: GameScreenProps) {
	if (!round) return null;

	const pb = usePocketBase();
	const [scored, setScored] = useState(0);

	const totalPlayers = players.filter((p) => p.status === "active").length;

	useEffect(() => {
		// Seed count from any answers already scored before we mounted
		pb.collection("answers")
			.getFullList<Answer>({ filter: `round = "${round.id}"` })
			.then((answers) => {
				setScored(answers.filter((a) => a.score > 0).length);
			})
			.catch(console.error);

		const unsub = pb
			.collection("answers")
			.subscribe<Answer>("*", (e: RecordSubscription<Answer>) => {
				if (e.record.round !== round.id) return;
				if (e.action === "update" && e.record.score > 0) {
					setScored((prev) => prev + 1);
				}
			});

		return () => {
			unsub.then((fn) => fn());
		};
	}, [round.id, pb]);

	return (
		<div className="min-h-screen bg-rm-bg flex flex-col items-center justify-center gap-8 p-6">
			<div className="flex flex-col items-center gap-6 text-center">
				<div className="flex gap-2.5">
					{[0, 1, 2].map((i) => (
						<span
							key={i}
							className="w-3 h-3 rounded-full bg-rm-judging animate-rm-dot-bounce"
							style={{ animationDelay: `${i * 0.2}s` }}
						/>
					))}
				</div>

				<h2 className="font-display text-4xl md:text-5xl text-rm-text">
					Roasting your answers…
				</h2>

				{scored > 0 && (
					<p className="text-rm-text-muted text-sm font-body animate-rm-fade-in">
						{scored} / {totalPlayers} scored
					</p>
				)}

				<p className="text-rm-text-disabled text-xs font-body">The AI has no mercy</p>
			</div>
		</div>
	);
}
