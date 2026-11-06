import { useEffect, useState } from "react";
import { liveText } from "../i18n";
import { aiSignInText } from "../text/aiSignIn";
import type { HistoryEntry } from "./history";

const txt = liveText(aiSignInText);

// An AI provider refusing the person's sign-in (proto-ai-sign-in-expired,
// rounds 1–3, R1 chosen 6.11.2026). The host says which provider refuses
// now (the snapshot's auth.ai_refused) and which failed reply it refused
// (a history entry's refused_by). What the browser adds is the person's own:
// a message waiting in a conversation's field to go by itself once the
// provider takes the person back. It is the field's draft plus a marker in
// session storage, as the draft itself is; the daemon learns of it only as
// the send it becomes.

export type AIProvider =
  | "claude-bridge"
  | "openai-codex"
  | "openai"
  | "anthropic"
  | "deepseek";
const providers: AIProvider[] = [
  "claude-bridge",
  "openai-codex",
  "openai",
  "anthropic",
  "deepseek",
];
export const aiProvider = (value: unknown): AIProvider | undefined =>
  providers.includes(value as AIProvider) ? (value as AIProvider) : undefined;
/** A refused key is replaced; a subscription is signed in again. */
export const keyProvider = (
  p: AIProvider,
): p is "openai" | "anthropic" | "deepseek" =>
  p === "openai" || p === "anthropic" || p === "deepseek";

/** The provider a `provider/model` choice names, when Habitat repairs it. */
export const providerOfModel = (model?: string) =>
  model?.includes("/") ? aiProvider(model.split("/")[0]) : undefined;

/** A conversation's own refusal, from the newest message on its branch: a
 * failed reply naming the provider, with the person's message it failed. */
export function refusedTurn(
  entries: HistoryEntry[],
): { provider: AIProvider; key: string; text: string } | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.kind === "user") return undefined;
    if (e.kind !== "assistant") continue;
    const provider = e.stop_reason === "error" ? e.refused_by : undefined;
    if (!provider) return undefined;
    const at = entries.slice(0, i).findLastIndex((u) => u.kind === "user");
    // Refused after the agent had already worked on it: sending the message
    // again would redo that work, so the person decides (no text to restore).
    const worked = entries
      .slice(at + 1, i)
      .some((w) => w.kind === "assistant" || w.kind === "tool");
    const asked = at < 0 || worked ? "" : entries[at].content.text.trim();
    return { provider, key: e.entry_key, text: asked };
  }
  return undefined;
}

/** A message waiting in a field. `command` is its send's ID, kept until
 * it goes so that a retry, or another tab sending the same restored
 * message, is one message to the daemon. `text` is the field as the wait
 * began, so an edit can be told apart. */
export type Waiting = {
  command: string;
  provider: AIProvider;
  text: string;
  /** The refused reply whose message this is, when restored from one. */
  from?: string;
};
const waitingKey = (identity: string, id: string) =>
  `nah:${identity}:waiting:${id}`;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function readWaiting(identity: string, id: string): Waiting | undefined {
  try {
    const v = JSON.parse(
      sessionStorage.getItem(waitingKey(identity, id)) ?? "null",
    );
    if (
      v &&
      typeof v.command === "string" &&
      uuid.test(v.command) &&
      aiProvider(v.provider) &&
      typeof v.text === "string" &&
      (v.from === undefined || typeof v.from === "string")
    )
      return v as Waiting;
  } catch {
    /* Unreadable: nothing waits. */
  }
  return undefined;
}
export function writeWaiting(identity: string, id: string, w: Waiting) {
  sessionStorage.setItem(waitingKey(identity, id), JSON.stringify(w));
  changes.dispatchEvent(new Event("change"));
}
export function clearWaiting(identity: string, id: string) {
  if (sessionStorage.getItem(waitingKey(identity, id)) === null) return;
  sessionStorage.removeItem(waitingKey(identity, id));
  changes.dispatchEvent(new Event("change"));
}
/** This tab's waiting messages for one provider, with their field's text. */
export function waitingFor(identity: string, provider: AIProvider) {
  const prefix = `nah:${identity}:waiting:`;
  const result: { id: string; waiting: Waiting; draft: string }[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const id = key.slice(prefix.length);
    const waiting = readWaiting(identity, id);
    if (waiting?.provider !== provider) continue;
    result.push({
      id,
      waiting,
      draft: sessionStorage.getItem(`nah:${identity}:draft:${id}`) ?? "",
    });
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
/** Waiting markers change: the window's list reads them again. */
export const changes = new EventTarget();

// A restored message is restored once per failed reply, in this tab.
const restoredKey = (identity: string, id: string) =>
  `nah:${identity}:waiting-from:${id}`;
export const restoredFrom = (identity: string, id: string) =>
  sessionStorage.getItem(restoredKey(identity, id));
export const markRestored = (identity: string, id: string, key: string) =>
  sessionStorage.setItem(restoredKey(identity, id), key);

/** The send ID of a failed reply's message going again, from the text that
 * goes: the same in every tab that sends the same text, so two tabs
 * restoring the same failure send it once (the daemon observes a spent
 * command ID and never replays it, without comparing the text), while an
 * edit in one of them is a message of its own. */
export async function resendCommand(
  agentId: string,
  failedKey: string,
  text: string,
) {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`resend:${agentId}:${failedKey}\n${text}`),
    ),
  ).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The provider takes the person back: signed in again, a key saved, or the
 * host no longer reporting the refusal. Waiting messages go. */
export const signIns = new EventTarget();
export class SignedIn extends Event {
  constructor(readonly provider: AIProvider) {
    super("signed-in");
  }
}
export function announceSignedIn(provider: AIProvider) {
  for (const [id, f] of failuresSeen)
    if (f.provider === provider) signedInFor.add(`${id}:${f.key}`);
  signIns.dispatchEvent(new SignedIn(provider));
}
/** The refused replies this tab has shown, by conversation: a sign-in for
 * their provider ends them even where the conversation is not open. */
export const failuresSeen = new Map<
  string,
  { provider: AIProvider; key: string }
>();

/** What the field says under a waiting message. */
export function waitingLine(provider: AIProvider, edited: boolean) {
  if (keyProvider(provider))
    return edited ? txt.waitingKeyEdited : txt.waitingKey;
  return edited ? txt.waitingEdited : txt.waiting;
}
/** The failed turn's short row. */
export const refusedTurnLine = (provider: AIProvider) =>
  txt.turn(txt.services[provider].title);
/** After the sign-in, above the field. */
export const signedInLine = (provider: AIProvider, went: boolean) =>
  went ? txt.sent(txt.services[provider].done) : txt.services[provider].done;

/** The provider a conversation talks to now: its newest model choice in
 * native history, else the choice it was started with. */
export function conversationProvider(
  entries: HistoryEntry[],
  started?: { provider?: string } | null,
): AIProvider | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.kind === "assistant" && e.refused_by) return e.refused_by;
    if (e.kind === "model_change") return providerOfModel(e.content.text);
  }
  return started ? aiProvider(started.provider ?? "openai-codex") : undefined;
}

/** A conversation's waiting message, read again whenever one changes. */
export function useWaiting(identity: string, id?: string) {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    changes.addEventListener("change", f);
    return () => changes.removeEventListener("change", f);
  }, []);
  return id ? readWaiting(identity, id) : undefined;
}

/** Failed replies this tab has since signed in for: their conversation no
 * longer counts as refused, and its waiting message goes. */
export const signedInFor = new Set<string>();

/** The command ID a waiting message goes with now. */
export const sendCommand = (id: string, w: Waiting, draft: string) =>
  w.from ? resendCommand(id, w.from, draft) : Promise.resolve(w.command);
