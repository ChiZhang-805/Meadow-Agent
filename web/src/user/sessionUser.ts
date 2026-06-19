const SESSION_USER_KEY = "meadow_agent_session_user_id";
let memoryUserId: string | undefined;

export function getSessionUserId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_USER_KEY);
    if (existing) return existing;

    const next = `web_${makeRandomId()}`;
    window.sessionStorage.setItem(SESSION_USER_KEY, next);
    return next;
  } catch {
    memoryUserId ??= `web_${makeRandomId()}`;
    return memoryUserId;
  }
}

function makeRandomId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
