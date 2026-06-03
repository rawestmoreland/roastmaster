import { useEffect, useRef, useState } from "react";

interface RoundTimerProps {
	totalSeconds: number;
	onExpire: () => void;
}

export function RoundTimer({ totalSeconds, onExpire }: RoundTimerProps) {
	const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
	const startTimeRef = useRef<number | null>(null);
	const frameRef = useRef<number | null>(null);
	const expiredRef = useRef(false);
	const onExpireRef = useRef(onExpire);

	useEffect(() => {
		onExpireRef.current = onExpire;
	});

	useEffect(() => {
		const tick = (now: number) => {
			if (!startTimeRef.current) startTimeRef.current = now;
			const elapsed = (now - startTimeRef.current) / 1000;
			const remaining = Math.max(0, totalSeconds - elapsed);
			setSecondsLeft(Math.ceil(remaining));

			if (remaining <= 0) {
				if (!expiredRef.current) {
					expiredRef.current = true;
					onExpireRef.current();
				}
				return;
			}

			frameRef.current = requestAnimationFrame(tick);
		};

		frameRef.current = requestAnimationFrame(tick);
		return () => {
			if (frameRef.current) cancelAnimationFrame(frameRef.current);
		};
	}, [totalSeconds]);

	const radius = 26;
	const circumference = 2 * Math.PI * radius;
	const progress = secondsLeft / totalSeconds;
	const dashOffset = circumference * (1 - progress);
	const isLow = secondsLeft <= 10;

	return (
		<div className="relative w-16 h-16 shrink-0">
			<svg width="64" height="64" className="-rotate-90" aria-hidden="true">
				<circle
					cx="32"
					cy="32"
					r={radius}
					fill="none"
					stroke="var(--rm-border)"
					strokeWidth="4"
				/>
				<circle
					cx="32"
					cy="32"
					r={radius}
					fill="none"
					stroke={isLow ? "var(--rm-state-error)" : "var(--rm-accent-raw)"}
					strokeWidth="4"
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={dashOffset}
					style={{ transition: "stroke 0.5s, stroke-dashoffset 0.05s linear" }}
				/>
			</svg>
			<span
				className={[
					"absolute inset-0 flex items-center justify-center font-mono text-sm font-medium",
					isLow ? "text-rm-error" : "text-rm-text",
				].join(" ")}
			>
				{secondsLeft}
			</span>
		</div>
	);
}
