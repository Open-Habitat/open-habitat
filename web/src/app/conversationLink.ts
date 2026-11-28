import { useSyncExternalStore } from "react";

/**
 * Conversation links (Settings › Vaaralliset toiminnot › Keskustelulinkit):
 * `<origin>/new/<workspace>#n=<length>&draft=<message>` opens a new
 * conversation in the workspace the rail names, with the message in its
 * field and nothing sent. The message rides in the fragment, which the
 * browser never sends to the host, a log or a Referer. This module takes it
 * out of the address bar before anything else runs and keeps it in this
 * tab's memory; it reaches the conversation's draft only once the person has
 * allowed links. `n` is the message's length in Unicode code points, so a
 * link a chat app cut short is refused whole rather than shown in part.
 */

/** The longest message a link may carry, in code points. */
export const linkMessageLimit = 4000;

export type LinkMessage =
  | { kind: "none" }
  | { kind: "text"; text: string }
  /** Too long, or cut short on the way (`n` does not match): nothing of it
   * is used, because part of an instruction can mean something else. */
  | { kind: "dropped"; reason: "long" | "cut"; length?: number };

const count = (text: string) => [...text].length;

/** The message of a link's fragment (without or with its `#`). */
export function parseLinkFragment(fragment: string): LinkMessage {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const draft = params.get("draft");
  const n = params.get("n");
  if (draft === null && n === null) return { kind: "none" };
  const declared = n !== null && /^\d{1,9}$/.test(n) ? Number(n) : undefined;
  const length = draft === null ? undefined : count(draft);
  if ((declared ?? 0) > linkMessageLimit || (length ?? 0) > linkMessageLimit)
    return {
      kind: "dropped",
      reason: "long",
      length: Math.max(declared ?? 0, length ?? 0),
    };
  if (draft === null || declared === undefined || declared !== length)
    return { kind: "dropped", reason: "cut" };
  return draft.trim() ? { kind: "text", text: draft } : { kind: "none" };
}

/** The workspace a `/new/<workspace>` path names, decoded; undefined for
 * any other path. */
export function linkWorkspaceName(pathname: string): string | undefined {
  const segment = /^\/new\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export const isLinkRoute = (pathname: string) => pathname.startsWith("/new/");

/** The rail's name of a workspace first, else its directory name, so an
 * agent that knows only its working directory can make the link too.
 * Only workspaces that are present count. */
export function findLinkWorkspace<
  W extends { name: string; display_name?: string; presence: string },
>(workspaces: readonly W[], name: string): W | undefined {
  const present = workspaces.filter((w) => w.presence === "present");
  return (
    present.find((w) => (w.display_name ?? w.name) === name) ??
    present.find((w) => w.name === name)
  );
}

export type ConversationLink = { path: string; message: LinkMessage };

let pending: ConversationLink | undefined;

/** Kept across a sign-in in this tab only: the sign-in leaves the app, and
 * the provider must not see the message. Taken back on the first load after
 * it, or forgotten when older than this. */
const signInKey = "nah:conversation-link";
const signInLifetime = 15 * 60 * 1000;

/**
 * Runs once before the app renders: a `/new/` address loses its fragment at
 * once (replaceState), so the message is not in history or in a copied
 * address. The first load after a sign-in started from such a link takes the
 * kept link back and returns to its address.
 */
export function takeConversationLink(): void {
  const { pathname, hash } = window.location;
  let kept: { path?: unknown; fragment?: unknown; at?: unknown } | null = null;
  try {
    kept = JSON.parse(sessionStorage.getItem(signInKey) ?? "null");
    sessionStorage.removeItem(signInKey);
  } catch {
    kept = null;
  }
  if (isLinkRoute(pathname)) {
    pending = { path: pathname, message: parseLinkFragment(hash) };
    if (hash) window.history.replaceState(window.history.state, "", pathname);
    return;
  }
  if (
    kept &&
    typeof kept.path === "string" &&
    linkWorkspaceName(kept.path) !== undefined &&
    typeof kept.fragment === "string" &&
    typeof kept.at === "number" &&
    Date.now() - kept.at < signInLifetime &&
    (pathname === "/" || pathname === "/workspaces")
  ) {
    pending = { path: kept.path, message: parseLinkFragment(kept.fragment) };
    window.history.replaceState(null, "", kept.path);
  }
}

/** The link that opened this address, if it is still to be acted on. A
 * `/new/` address without one (a reload, Back) opens a plain new
 * conversation. */
export function conversationLinkAt(pathname: string): ConversationLink {
  return pending?.path === pathname
    ? pending
    : { path: pathname, message: { kind: "none" } };
}

/** The link has been acted on; a later visit to its address opens a new
 * conversation without its message. */
export function forgetConversationLink() {
  pending = undefined;
}

/** The missing-workspace page starts the same link in another workspace. */
export function retargetConversationLink(from: string, to: string) {
  if (pending?.path === from) pending = { ...pending, path: to };
}

/** Called as the person leaves for sign-in from a link's address. */
export function keepConversationLinkForSignIn(pathname: string) {
  if (!pending || pending.path !== pathname) return;
  const message = pending.message;
  const fragment =
    message.kind === "text"
      ? new URLSearchParams({
          n: String(count(message.text)),
          draft: message.text,
        }).toString()
      : message.kind === "dropped"
        ? `n=${message.length ?? ""}`
        : "";
  try {
    sessionStorage.setItem(
      signInKey,
      JSON.stringify({ path: pathname, fragment, at: Date.now() }),
    );
  } catch {
    // Storage refused: after the sign-in the link opens without its message.
  }
}

/**
 * What a link left for a new conversation, by the conversation's guide
 * owner (goalGuide's `new:<workspace>` while it is created, then its ID):
 *
 * - mark: the field holds the link's message; the mark stays until the
 *   field is emptied or sent.
 * - card: the field held the person's own unsent text, so the message waits
 *   above it for Lisää perään / Korvaa / Hylkää.
 * - held: links were not allowed; the message is only here, in memory, and
 *   nothing of it is shown.
 * - released: links were allowed since; the conversation takes it into the
 *   field (or the card) the next time it renders.
 * - dropped: the link's message was too long or cut short.
 *
 * `hidden` says the link pointed at a hidden workspace.
 */
export type LinkArrival = {
  link?:
    | { state: "mark" }
    | { state: "card" | "held" | "released"; text: string }
    | { state: "dropped"; reason: "long" | "cut"; length?: number };
  hidden?: boolean;
};

const arrivals = new Map<string, LinkArrival>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => {
  for (const listener of listeners) listener();
};

export function setLinkArrival(owner: string, arrival: LinkArrival) {
  if (!arrival.link && !arrival.hidden) arrivals.delete(owner);
  else arrivals.set(owner, arrival);
  notify();
}

export function readLinkArrival(owner: string) {
  return arrivals.get(owner);
}

export function useLinkArrival(owner: string | undefined) {
  return useSyncExternalStore(subscribe, () =>
    owner ? arrivals.get(owner) : undefined,
  );
}

/** The created conversation takes over what its link left (adoptGuide). */
export function adoptLinkArrival(from: string, to: string) {
  const arrival = arrivals.get(from);
  if (!arrival) return;
  arrivals.delete(from);
  arrivals.set(to, arrival);
  notify();
}

/** Links are now allowed and Settings is closed: every held message goes
 * to its conversation. */
export function releaseHeldLinks() {
  let changed = false;
  for (const [owner, arrival] of arrivals)
    if (arrival.link?.state === "held") {
      arrivals.set(owner, {
        ...arrival,
        link: { state: "released", text: arrival.link.text },
      });
      changed = true;
    }
  if (changed) notify();
}

export const hasHeldLinks = () =>
  [...arrivals.values()].some((a) => a.link?.state === "held");

/** The field after Lisää viestisi perään: the person's text, then the
 * link's message. */
export const appendLinkMessage = (field: string, text: string) =>
  field.trim() ? `${field.replace(/\s+$/, "")}\n\n${text}` : text;
