import { useSyncExternalStore } from "react";

// Whether this tab runs the web bundle the server now serves. Vite's
// index.html names content-hashed entry assets, so the tags of the document
// this tab loaded identify its bundle exactly. A release that changes only Go
// code or documentation keeps the bundle and asks for no reload.

export type BundleState = {
  /** "unknown" until a check succeeds; a failed check keeps the last answer. */
  status: "unknown" | "current" | "newer";
  /** The person chose "Myöhemmin" for this served bundle. */
  dismissed: boolean;
};

const CHECK_INTERVAL_MS = 2 * 60 * 1000;
const MAX_INDEX_BYTES = 256 * 1024;

/** Entry asset references of a parsed index document, as one comparable key. */
export function bundleKey(doc: Document): string {
  const refs: string[] = [];
  for (const node of doc.querySelectorAll("script[type=module][src]"))
    refs.push(`script ${node.getAttribute("src")}`);
  for (const node of doc.querySelectorAll(
    "link[rel=stylesheet][href], link[rel=modulepreload][href]",
  ))
    refs.push(`${node.getAttribute("rel")} ${node.getAttribute("href")}`);
  return refs.sort().join("\n");
}

// Captured at module load, before lazily loaded chunks add their own links.
const ownKey = typeof document === "undefined" ? "" : bundleKey(document);
let state: BundleState = { status: "unknown", dismissed: false };
let servedKey = "";
let dismissedKey = "";
const listeners = new Set<() => void>();
/** Fires "checked" after every successful check, so open views can re-read the server version. */
export const bundleChecks = new EventTarget();

function publish(next: BundleState) {
  if (next.status === state.status && next.dismissed === state.dismissed)
    return;
  state = next;
  for (const listener of listeners) listener();
}

async function servedIndexKey(): Promise<string> {
  // "/" is the shell route; Go's file server redirects "/index.html" to it.
  const r = await fetch("/", {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "manual",
    // Covers the body read too; a stalled request must not block later checks.
    signal: AbortSignal.timeout(10_000),
  });
  if (r.status !== 200 || !r.body) throw new Error("index unavailable");
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_INDEX_BYTES) throw new Error("oversize index");
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  // DOMParser runs no scripts; only attributes are read.
  const doc = new DOMParser().parseFromString(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    "text/html",
  );
  const key = bundleKey(doc);
  if (!key) throw new Error("index without entry assets");
  return key;
}

let inFlight: Promise<"current" | "newer" | undefined> | undefined;

/**
 * Compare the served bundle with this tab's; a failed read changes nothing.
 * Resolves to what this check found, or undefined when it could not read the
 * served index, so a caller can tell a reachable newer release from an outage.
 */
export function checkBundle(): Promise<"current" | "newer" | undefined> {
  if (!ownKey) return Promise.resolve(undefined);
  inFlight ??= servedIndexKey()
    .then((key) => {
      servedKey = key;
      bundleChecks.dispatchEvent(new Event("checked"));
      const status = key === ownKey ? "current" : "newer";
      publish({ status, dismissed: key === dismissedKey });
      return status;
    })
    .catch(() => undefined)
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}

/**
 * Says why a reload notice appeared, so that a notice nobody expected
 * classifies itself from the console: which path raised it (a lazy part that
 * failed to load, or a failed snapshot read), the asset that failed, and what
 * the served index said. Closed fields only, and an asset path without its
 * origin or query.
 */
export function bundleDiagnostic(value: {
  path: "chunk-load" | "snapshot-failed";
  asset?: string;
  release: "newer" | "current" | "unknown";
}) {
  console.warn(
    "[bundle]",
    JSON.stringify({ at: new Date().toISOString(), ...value }),
  );
}

/** Hide the prompt until the server serves yet another bundle. */
export function dismissBundlePrompt() {
  dismissedKey = servedKey;
  publish({ ...state, dismissed: true });
}

export function reloadForNewBundle() {
  window.location.reload();
}

let started = false;
/** Check when the tab becomes visible, focused or online, and periodically while visible. */
export function watchBundle() {
  if (started || typeof window === "undefined") return;
  started = true;
  const visibleCheck = () => {
    if (document.visibilityState === "visible") void checkBundle();
  };
  document.addEventListener("visibilitychange", visibleCheck);
  window.addEventListener("focus", visibleCheck);
  window.addEventListener("online", visibleCheck);
  window.setInterval(visibleCheck, CHECK_INTERVAL_MS);
  visibleCheck();
}

export function useBundleState(): BundleState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
