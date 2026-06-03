import type { Player } from "#/types/game";

const CHIP_COUNT = 6;

export function chipStyle(index: number): React.CSSProperties {
	const i = index % CHIP_COUNT;
	return {
		background: `var(--rm-chip-${i}-bg)`,
		border: `1px solid var(--rm-chip-${i}-border)`,
		color: `var(--rm-chip-${i}-text)`,
	} as React.CSSProperties;
}

interface PlayerChipProps {
	player: Player;
	index: number;
	submitted?: boolean;
	showScore?: boolean;
	score?: number;
}

export function PlayerChip({
	player,
	index,
	submitted = false,
	showScore = false,
	score,
}: PlayerChipProps) {
	const i = index % CHIP_COUNT;
	const initials = player.name.slice(0, 2).toUpperCase();
	const isDisconnected = player.status === "disconnected";

	return (
		<div
			className={[
				"flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-bold transition-opacity animate-rm-chip-in",
				isDisconnected ? "opacity-40" : "",
			]
				.join(" ")
				.trim()}
			style={chipStyle(index)}
		>
			<div
				className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
				style={{
					background: `var(--rm-chip-${i}-avatar)`,
					color: `var(--rm-chip-${i}-avatar-text, #fff)`,
				}}
			>
				{initials}
			</div>

			<span className={isDisconnected ? "line-through" : ""}>{player.name}</span>

			{showScore && score !== undefined && (
				<span className="ml-1 font-mono text-xs opacity-80">{score}</span>
			)}

			{submitted && !isDisconnected && (
				<span className="ml-1 text-[10px] opacity-80">✓</span>
			)}
		</div>
	);
}
