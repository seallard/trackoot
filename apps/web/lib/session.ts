const SESSION_KEY = "trackoot:session";

export interface Session {
  userId: string;
  displayName: string;
  role: "host" | "player";
}

export function saveSession(session: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
