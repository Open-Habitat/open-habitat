import { jsonWrite } from "./mutations";

export type LoadRead = "session" | "snapshot" | "onboarding" | "identity_pair";
export type LoadReason =
  | "network"
  | "http"
  | "invalid"
  | "timeout"
  | "identity_mismatch"
  | "other";
export class LoadReadError extends Error {
  constructor(
    public read: LoadRead,
    public reason: LoadReason,
    public status = 0,
    cause?: unknown,
  ) {
    super("load read failed", { cause });
  }
}
export async function observeLoadRead<T>(
  read: LoadRead,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof LoadReadError) throw error;
    throw new LoadReadError(
      read,
      error instanceof TypeError ? "network" : "invalid",
      0,
      error,
    );
  }
}
const bounded = (n: number, max: number) =>
  Math.min(max, Math.max(0, Math.round(n)));
interface Episode {
  read: LoadRead;
  reason: LoadReason;
  status: number;
  phase: "landing" | "stale";
  online: boolean;
  read_duration_ms: number;
  started: number;
  attempts: number;
}
/** One volatile, content-free episode. A lost diagnostic is never resent. */
export class LoadDiagnostic {
  private episode?: Episode;
  attempt() {
    if (this.episode) this.episode.attempts++;
  }
  failed(
    read: LoadRead,
    reason: LoadReason,
    status: number,
    phase: Episode["phase"],
    duration: number,
  ) {
    this.episode ??= {
      read,
      reason,
      status,
      phase,
      online: navigator.onLine,
      read_duration_ms: bounded(duration, 86400000),
      started: performance.now(),
      attempts: 1,
    };
  }
  clear() {
    this.episode = undefined;
  }
  recovered(csrf: string) {
    const episode = this.episode;
    this.clear();
    if (!episode) return;
    const { started, attempts, ...facts } = episode;
    void jsonWrite(
      "client.load_failure",
      "/api/v1/client/load-failure",
      {
        schema_version: 1,
        ...facts,
        attempts: bounded(attempts, 10000),
        episode_duration_ms: bounded(performance.now() - started, 86400000),
      },
      csrf,
      { signal: AbortSignal.timeout(10000) },
    ).catch(() => {});
  }
}
