import { useSyncExternalStore } from "react";
import {
  type BrowserStatus,
  readServerBrowser,
  subscribeServerBrowser,
} from "./serverBrowser";

// Which conversation the person's server browser works for, as this tab
// learns it from the conversations' own command results: a targeted
// command's `tab` and `agent browser request`'s window
// (server-browser-entry-points round 2). The host's status names windows,
// never a conversation, and nothing here guesses one: a window no
// conversation's command named stays the rail's Oma selain's alone.
//
// This is view state of this tab, like the editor's notes: nothing is
// written to the host or the browser's storage, so after a reload a
// conversation is linked again when its history is read or its agent's next
// command arrives.

/** The browser in a conversation's row in the rail. */
export type BrowserRowState = "working" | "ask" | "control";

/** A span the person controlled the browser; `window` is the one a request
 * named when they took it. */
export type ControlSpan = { window?: string; from: number; to?: number };

let session: string | undefined;
/** Window → the conversation whose command named it last. */
let owners = new Map<string, string>();
/** Conversations seen using the browser in their current run. */
let using = new Set<string>();
let spans: ControlSpan[] = [];
let version = 0;
let watching = false;
let last: BrowserStatus | undefined;
const listeners = new Set<() => void>();

function changed() {
  version++;
  for (const l of listeners) l();
}

/** A new session starts from nothing, so one person's links never show to
 * another. Follows the browser store's session key. */
function sameSession() {
  const key = readServerBrowser().key;
  if (key === session) return;
  session = key;
  owners = new Map();
  using = new Set();
  spans = [];
  last = undefined;
}

/** Control changes are read from the browser's state as it is read, so a
 * give-back from the sheet, the card or the host's idle return all count. */
function watch() {
  if (watching) return;
  watching = true;
  subscribeServerBrowser(() => {
    sameSession();
    const status = readServerBrowser().status;
    const was = last?.state === "running" ? last.control : undefined;
    const now = status?.state === "running" ? status.control : undefined;
    last = status;
    if (was !== "person" && now === "person") {
      spans = [
        ...spans.slice(-19),
        { window: status?.request?.window, from: Date.now() },
      ];
      changed();
    } else if (was === "person" && now !== "person") {
      const open = spans.at(-1);
      if (open && open.to === undefined) {
        spans = [...spans.slice(0, -1), { ...open, to: Date.now() }];
        changed();
      }
    }
  });
}

/** The windows a conversation's commands acted in. */
export function noteBrowserWindows(
  agentId: string,
  windows: readonly string[],
) {
  watch();
  sameSession();
  let moved = false;
  for (const w of windows) {
    if (owners.get(w) === agentId) continue;
    owners.delete(w);
    owners.set(w, agentId);
    moved = true;
  }
  // Bounded: windows come and go for as long as the tab stays open.
  while (owners.size > 200) owners.delete(owners.keys().next().value as string);
  if (moved) changed();
}

/** A conversation's agent ran a browser command in the run going on now. */
export function noteBrowserUse(agentId: string) {
  watch();
  sameSession();
  if (using.has(agentId)) return;
  using = new Set(using).add(agentId);
  changed();
}

/** Conversations no longer running stop counting as using the browser. */
export function settleBrowserUse(running: ReadonlySet<string>) {
  const still = [...using].filter((id) => running.has(id));
  if (still.length === using.size) return;
  using = new Set(still);
  changed();
}

export function ownerOfWindow(window: string): string | undefined {
  sameSession();
  return owners.get(window);
}

/** The spans the person controlled the browser for a window, in order. */
export function controlSpans(window: string): ControlSpan[] {
  sameSession();
  return spans.filter((s) => s.window === window);
}

function subscribe(l: () => void) {
  watch();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Rerenders on a new link or control span. */
export function useBrowserConversations(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/** Each conversation's browser state for its row in the rail: waiting for
 * the person (or controlled by them) when the open request names a window
 * its commands acted in, working while its running agent uses the browser. */
export function browserRowStates(
  status: BrowserStatus | undefined,
  running: ReadonlySet<string>,
): Map<string, BrowserRowState> {
  sameSession();
  const marks = new Map<string, BrowserRowState>();
  if (status?.state !== "running") return marks;
  for (const id of using) if (running.has(id)) marks.set(id, "working");
  const asked = status.request?.window;
  const owner = asked ? owners.get(asked) : undefined;
  if (owner) marks.set(owner, status.control === "person" ? "control" : "ask");
  return marks;
}

/** For tests: forget everything. */
export function resetBrowserConversations() {
  session = readServerBrowser().key;
  owners = new Map();
  using = new Set();
  spans = [];
  last = undefined;
  changed();
}
