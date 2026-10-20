// Closed fields only: never log URLs with query strings, cursors, identities,
// response bodies or exception text. Console lifetime follows the browser tab.
type Diagnostic =
  | { event: "manual-retry" | "retry-stopped" | "recover" }
  | {
      event: "stream";
      outcome: "connecting" | "open" | "error" | "timeout";
      path: "/api/v1/events";
    }
  | {
      event: "cursor";
      outcome: "older" | "equal" | "newer" | "new-instance";
      recovering: boolean;
    }
  | {
      event: "request";
      path: "/api/v1/events" | "/api/v1/snapshot";
      outcome: "started" | "response" | "aborted" | "network-error";
      status?: number;
      durationMs: number;
    };

export function reconnectDiagnostic(value: Diagnostic) {
  // Per-tab opt-in, also usable on a production build from DevTools:
  // sessionStorage.setItem("oh:debug-reconnect", "true"); reload to trace startup.
  try {
    if (sessionStorage.getItem("oh:debug-reconnect") !== "true") return;
  } catch {
    // Disabled storage must never break recovery.
    return;
  }
  console.info(
    "[reconnect]",
    JSON.stringify({ at: new Date().toISOString(), ...value }),
  );
}

export async function reconnectFetch(
  path: "/api/v1/events" | "/api/v1/snapshot",
  url: string,
  init: RequestInit,
) {
  const started = performance.now();
  reconnectDiagnostic({
    event: "request",
    path,
    outcome: "started",
    durationMs: 0,
  });
  try {
    const response = await fetch(url, init);
    reconnectDiagnostic({
      event: "request",
      path,
      outcome: "response",
      status: response.status,
      durationMs: Math.round(performance.now() - started),
    });
    return response;
  } catch (error) {
    reconnectDiagnostic({
      event: "request",
      path,
      outcome: init.signal?.aborted ? "aborted" : "network-error",
      durationMs: Math.round(performance.now() - started),
    });
    throw error;
  }
}
