import { useEffect, useSyncExternalStore } from "react";
import schema from "../../../contracts/v1/browser.schema.json";
import { LazyAjv } from "./lazyAjv";
import { jsonWrite, mutationFetch, writeOutcome } from "./mutations";

/** The person's server browser as their daemon reads it (experimental). The
 * browser is a viewer here: the host owns the windows, who drives, the
 * agent's pointer and its request. Titles and the request text are the
 * page's and the agent's own words, shown only as text. */
export type BrowserWindow = {
  id: string;
  title: string;
  origin: string;
  agent: boolean;
};
export type BrowserPointer = {
  window: string;
  x: number;
  y: number;
  age_ms: number;
  clicks: { x: number; y: number; age_ms: number }[];
};
export type BrowserRequest = { window: string; text: string; age_ms: number };
export type BrowserStatus = {
  schema_version: 1;
  state: "unavailable" | "stopped" | "running";
  survives_restart: boolean;
  control?: "agent" | "person";
  agent_connected: boolean;
  windows: BrowserWindow[];
  pointer?: BrowserPointer;
  request?: BrowserRequest;
};

const valid = new LazyAjv({ strict: false }).compile<BrowserStatus>({
  ...schema,
  $ref: `${schema.$id}#/$defs/status`,
});

export const browserPath = "/api/v1/browser";

/** The viewer's address: the gateway relays it to the person's daemon. */
export function browserViewURL(origin = window.location.origin) {
  return `${origin.replace(/^http/, "ws")}/api/v1/browser/view`;
}

/** One window's picture: the gateway accepts only this exact query. */
export function browserWindowURL(id: string) {
  return `/api/v1/browser/window?id=${encodeURIComponent(id)}`;
}

/** How the sheet shows the browser: looking never takes control. */
export type SheetMode = "view" | "control";

type State = {
  key?: string;
  csrf?: string;
  status?: BrowserStatus;
  /** The last read failed; the previous status stays shown. */
  failed: boolean;
  busy?: "start" | "stop" | "control";
  error?: "start" | "stop" | "control";
  sheet?: SheetMode;
};

let state: State = { failed: false };
const listeners = new Set<() => void>();
let subscribers = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let reading = false;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Running: often enough that the pointer and a request feel live. */
const runningEvery = 1500;
const idleEvery = 8000;

async function read() {
  if (reading || !state.key) return;
  reading = true;
  const key = state.key;
  try {
    const response = await fetch(browserPath, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("browser unavailable");
    const data: unknown = await response.json();
    if (!valid(data)) throw new Error("contract");
    if (state.key === key) set({ status: data, failed: false });
  } catch {
    if (state.key === key) set({ failed: true });
  } finally {
    reading = false;
  }
}

function schedule() {
  clearTimeout(timer);
  if (subscribers === 0 || !state.key) return;
  const every =
    state.status?.state === "running" || state.sheet ? runningEvery : idleEvery;
  timer = setTimeout(async () => {
    if (typeof document === "undefined" || !document.hidden) await read();
    schedule();
  }, every);
}

/** Keeps the browser read while a view shows it. `on` is the experiment's
 * switch: off, nothing is read. A new session starts from nothing, so one
 * person's browser never shows to another. */
export function useServerBrowser(
  identity: string | undefined,
  csrf: string | undefined,
  on: boolean,
): State {
  const key = on && identity && csrf ? `${identity}\u0000${csrf}` : undefined;
  useEffect(() => {
    if (!key) return;
    if (state.key !== key) {
      clearTimeout(timer);
      state = { failed: false, key, csrf };
      set({});
    }
    subscribers++;
    void read().then(schedule);
    return () => {
      subscribers--;
      if (subscribers === 0) clearTimeout(timer);
    };
  }, [key, csrf]);
  const s = useSyncExternalStore(subscribe, () => state);
  return key && s.key === key ? s : { failed: false };
}

export function openBrowserSheet(mode: SheetMode) {
  set({ sheet: mode });
  void read().then(schedule);
}

export function closeBrowserSheet() {
  set({ sheet: undefined });
}

async function write(
  kind: "start" | "stop" | "control",
  send: (csrf: string) => Promise<Response>,
): Promise<boolean> {
  const { csrf, key } = state;
  if (!csrf || state.busy) return false;
  set({ busy: kind, error: undefined });
  let response: Response | undefined;
  try {
    response = await send(csrf);
  } catch {
    response = undefined;
  }
  const outcome = await writeOutcome(response);
  let status: BrowserStatus | undefined;
  if (outcome.kind === "ok" && response) {
    try {
      const data: unknown = await response.json();
      if (valid(data)) status = data;
    } catch {
      /* The next read says how it went. */
    }
  }
  if (state.key !== key) return false;
  set({
    busy: undefined,
    error: outcome.kind === "ok" ? undefined : kind,
    ...(status ? { status } : {}),
  });
  if (!status) void read();
  schedule();
  return outcome.kind === "ok";
}

export function startBrowser() {
  return write("start", (csrf) =>
    mutationFetch("browser.start", "/api/v1/browser/start", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Agent-Host-CSRF": csrf },
    }),
  );
}

export function stopBrowser() {
  return write("stop", (csrf) =>
    mutationFetch("browser.stop", "/api/v1/browser/stop", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Agent-Host-CSRF": csrf },
    }),
  );
}

/** Take control of the whole browser (the agent waits), for one window when
 * a request named it, or give it back. */
export function setBrowserControl(
  control: "person" | "agent",
  window?: string,
) {
  return write("control", (csrf) =>
    jsonWrite(
      "browser.control",
      "/api/v1/browser/control",
      control === "person" && window ? { control, window } : { control },
      csrf,
    ),
  );
}

/** What the browser is doing, for the chip, the rail and the strip. */
export type BrowserSummary =
  | { kind: "off" }
  | { kind: "stopped" }
  | { kind: "ask"; window?: BrowserWindow; text: string }
  | { kind: "person" }
  | { kind: "agent" }
  | { kind: "idle" };

export function summarize(status?: BrowserStatus): BrowserSummary {
  if (!status || status.state === "unavailable") return { kind: "off" };
  if (status.state === "stopped") return { kind: "stopped" };
  if (status.control === "person") return { kind: "person" };
  if (status.request) {
    const request = status.request;
    return {
      kind: "ask",
      window: status.windows.find((w) => w.id === request.window),
      text: request.text,
    };
  }
  return status.agent_connected ? { kind: "agent" } : { kind: "idle" };
}
