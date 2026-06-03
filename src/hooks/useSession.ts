const SESSION_KEY = "roastmaster_session";

export interface StoredSession {
	gameId: string;
	playerId: string;
	token: string;
}

export function saveSession(session: StoredSession): void {
	localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): StoredSession | null {
	const raw = localStorage.getItem(SESSION_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as StoredSession;
	} catch {
		return null;
	}
}

export function clearSession(): void {
	localStorage.removeItem(SESSION_KEY);
}
