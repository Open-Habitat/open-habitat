// The attention sound only on the device the person is using
// (sounds-active-device, experimental; Jari 23.11.2026). Each open tab tells
// the person's own daemon whether it is visible and how long ago it last had
// keyboard, pointer or touch input; when a sound is due, the tab asks the
// daemon whether it is the one to play. The daemon picks the freshest input
// within five minutes, and every tab plays when nobody has touched any of
// them for that long. A tab that cannot get an answer plays: a missed sound
// is worse than one too many.
import { useEffect } from "react";
import schema from "../../../contracts/v1/active-device.schema.json";
import { LazyAjv } from "./lazyAjv";
import { jsonWrite } from "./mutations";
import { readJSON } from "./readJSON";

const url = "/api/v1/account/active-device";
const validate = new LazyAjv({ strict: false }).compile<{
  schema_version: 1;
  play: boolean;
}>(schema);

/** Input reports at most this often while the person keeps working; the
 * first input after a pause goes at once, so switching devices is heard
 * immediately. */
export const inputReportMs = 10_000;
/** An open tab says it is still there this often; the daemon forgets a tab
 * after 150 seconds of silence. */
export const heartbeatMs = 60_000;
/** How long a due sound waits for the daemon's answer before playing. */
export const answerWaitMs = 1500;

function newTab(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Outside a secure context: the same shape from random bytes.
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
}

/** This tab's identity: random, and kept in the tab's own session storage
 * so that a reload or a navigation takes over the entry the page before it
 * left, instead of leaving a ghost with fresh input behind when its last
 * word does not get out. */
const tabKey = "nah:active-device-tab";
const tab = (() => {
  const shape =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  try {
    const kept = window.sessionStorage.getItem(tabKey);
    if (kept && shape.test(kept)) return kept;
    const made = newTab();
    window.sessionStorage.setItem(tabKey, made);
    return made;
  } catch {
    return newTab();
  }
})();

type Running = {
  csrf: string;
  /** performance.now() of the latest input, undefined before any. */
  input?: number;
  /** The latest input a report was sent for, by when it was sent: the
   * throttle counts from sending, not from an answer that may be slow. */
  reported?: number;
  trailing?: ReturnType<typeof setTimeout>;
  /** A background report waits in the queue; it reads the state when its
   * turn comes, so another one adds nothing. */
  waiting: boolean;
  /** Reports go one at a time so the daemon hears them in order. */
  queue: Promise<unknown>;
};
let running: Running | undefined;

function body(r: Running, left = false) {
  const idle =
    r.input === undefined
      ? undefined
      : Math.min(
          86_400_000,
          Math.max(0, Math.round(performance.now() - r.input)),
        );
  return {
    tab,
    visible: document.visibilityState === "visible",
    ...(idle === undefined ? {} : { idle_ms: idle }),
    ...(left ? { left: true as const } : {}),
  };
}

/** A report that has not been answered in this long is given up. */
const reportWaitMs = 10_000;

function send(r: Running, background = false): Promise<boolean> {
  if (background) r.waiting = true;
  const next = r.queue.then(async () => {
    if (background) r.waiting = false;
    if (running !== r) throw new Error("stopped");
    const value = body(r);
    const response = await jsonWrite(
      "account.active_device",
      url,
      value,
      r.csrf,
      { method: "PUT", signal: AbortSignal.timeout(reportWaitMs) },
    );
    if (!response.ok) throw new Error("active device unavailable");
    const reply = await readJSON(response, 1024);
    if (!validate(reply)) throw new Error("active device unavailable");
    return reply.play;
  });
  r.queue = next.catch(() => undefined);
  return next;
}

function report(r: Running) {
  clearTimeout(r.trailing);
  r.trailing = undefined;
  if (r.input !== undefined) r.reported = r.input;
  if (r.waiting) return;
  void send(r, true).catch(() => undefined);
}

function onInput() {
  const r = running;
  if (!r) return;
  const now = performance.now();
  r.input = now;
  // Leading edge after a pause, then at most one report per interval that
  // carries the latest input.
  if (r.reported === undefined || now - r.reported >= inputReportMs) report(r);
  else
    r.trailing ??= setTimeout(
      () => report(r),
      Math.max(0, r.reported + inputReportMs - now),
    );
}

const inputs = ["keydown", "pointerdown", "touchstart", "wheel"] as const;

/** Starts this tab's reports for the session; returns their stop. */
export function startActiveDevice(csrf: string): () => void {
  const r: Running = { csrf, queue: Promise.resolve(), waiting: false };
  running = r;
  const visibility = () => report(r);
  const leave = () => {
    // keepalive lets the last word outlive the page; it is only a speed-up,
    // since the daemon forgets a silent tab anyway.
    void jsonWrite("account.active_device", url, body(r, true), csrf, {
      method: "PUT",
      keepalive: true,
    }).catch(() => undefined);
  };
  const show = (event: PageTransitionEvent) => {
    if (event.persisted) report(r);
  };
  for (const name of inputs)
    window.addEventListener(name, onInput, { capture: true, passive: true });
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", leave);
  window.addEventListener("pageshow", show);
  const heartbeat = setInterval(() => report(r), heartbeatMs);
  report(r);
  return () => {
    for (const name of inputs)
      window.removeEventListener(name, onInput, { capture: true });
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("pagehide", leave);
    window.removeEventListener("pageshow", show);
    clearInterval(heartbeat);
    clearTimeout(r.trailing);
    if (running === r) {
      running = undefined;
      leave();
    }
  };
}

/** Reports this tab while the feature is on and a session is known. */
export function useActiveDeviceReports(csrf: string | undefined, on: boolean) {
  useEffect(() => {
    if (!on || !csrf) return;
    return startActiveDevice(csrf);
  }, [csrf, on]);
}

/** Whether a sound due now plays in this tab. Without the feature every tab
 * plays; without an answer in time this one does. */
export async function activeDevicePlays(): Promise<boolean> {
  const r = running;
  if (!r) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      send(r),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(true), answerWaitMs);
      }),
    ]);
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}
