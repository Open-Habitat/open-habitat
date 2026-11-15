// This tab remembers only the intent to reopen a dialog, never authority to
// disconnect. The gateway still proves freshness and the daemon issues a new
// observation token; a person must press Disconnect after returning.
const key = "oh.github-disconnect-return";
export const disconnectReturnPath = "/settings/code-hosts";
export function markDisconnectReturn(identity: string) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ identity, at: Date.now() }));
  } catch {
    // Without storage the person can open the dialog again after sign-in.
  }
}
export function clearDisconnectReturn() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Storage may be unavailable.
  }
}
export function takeDisconnectReturn(identity: string): boolean {
  try {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    const mark: unknown = JSON.parse(raw ?? "null");
    if (!mark || typeof mark !== "object") return false;
    const value = mark as Record<string, unknown>;
    return (
      window.location.pathname === disconnectReturnPath &&
      value.identity === identity &&
      typeof value.at === "number" &&
      Date.now() >= value.at &&
      Date.now() - value.at < 5 * 60_000
    );
  } catch {
    return false;
  }
}
export function confirmDisconnectSignIn(identity: string) {
  markDisconnectReturn(identity);
  // Ordinary sign-in preserves the existing gh token. Reconnect would replace
  // it immediately before the person decides whether to delete it.
  window.location.assign(
    `/auth/github/start?return_to=${encodeURIComponent(disconnectReturnPath)}`,
  );
}
