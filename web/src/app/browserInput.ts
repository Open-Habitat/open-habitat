import keysyms from "./browserKeysyms";
import type { BrowserStatus } from "./serverBrowser";

// The pure part of the server browser viewer's input handling
// (BrowserViewer.tsx): which keys are shortcuts, how text becomes X
// keysyms, and when the agent counts as being in the middle of a step.
// The remote browser is Linux Chrome, so the person's ⌘ on a Mac means Ctrl
// there.

/** X keysyms the viewer sends itself. */
export const XK = {
  Control_L: 0xffe3,
  Return: 0xff0d,
  Tab: 0xff09,
  BackSpace: 0xff08,
  Escape: 0xff1b,
  Delete: 0xffff,
  Home: 0xff50,
  Left: 0xff51,
  Up: 0xff52,
  Right: 0xff53,
  Down: 0xff54,
  End: 0xff57,
  Shift_L: 0xffe1,
  v: 0x76,
  c: 0x63,
} as const;

const named: Record<string, number> = {
  Enter: XK.Return,
  Tab: XK.Tab,
  Backspace: XK.BackSpace,
  Escape: XK.Escape,
  Delete: XK.Delete,
  Home: XK.Home,
  End: XK.End,
  ArrowLeft: XK.Left,
  ArrowUp: XK.Up,
  ArrowRight: XK.Right,
  ArrowDown: XK.Down,
};

/** Use the same canonical X11 symbols as noVNC's keyboard and the host's
 * startup keymap (older characters have legacy, not Unicode, keysyms).
 * Control characters have none. */
export function keysymOfChar(ch: string): number | undefined {
  const cp = ch.codePointAt(0);
  if (cp === undefined || [...ch].length !== 1) return undefined;
  if (ch === "\n") return XK.Return;
  if (ch === "\t") return XK.Tab;
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return undefined;
  return keysyms.lookup(cp);
}

/** The keysym of a KeyboardEvent's `key`, for the few keys the viewer
 * replays itself after taking control. */
export function keysymOfKey(key: string): number | undefined {
  return named[key] ?? keysymOfChar(key);
}

/** At most this many characters are typed as keystrokes, and at most this
 * many bytes go to the remote clipboard: enough for a password, a code or a
 * paragraph, not a way to stream files. */
export const typeLimit = 1000;
export const pasteLimit = 64 * 1024;

/** The keysyms that type `text`, or why it cannot be typed. Carriage
 * returns are dropped so a pasted Windows line ending is one Enter.
 *
 * The host preloads Latin-1, Latin Extended A/B and the euro sign before
 * Chrome starts. Other scripts and combining marks still need paste. */
export function keystrokes(
  text: string,
):
  | { ok: true; keysyms: number[]; enters: number }
  | { ok: false; why: "empty" | "long" | "unsupported" } {
  const chars = [...text.replace(/\r\n?/g, "\n")];
  if (chars.length === 0) return { ok: false, why: "empty" };
  if (chars.length > typeLimit) return { ok: false, why: "long" };
  const keysyms: number[] = [];
  let enters = 0;
  for (const ch of chars) {
    const k = keysymOfChar(ch);
    const cp = ch.codePointAt(0);
    if (k === undefined || cp === undefined || (cp > 0x24f && cp !== 0x20ac))
      return { ok: false, why: "unsupported" };
    if (k === XK.Return) enters++;
    keysyms.push(k);
  }
  return { ok: true, keysyms, enters };
}

/** Shortcut paste is atomic validation: never turn pasted layout/control
 * characters into Enter, Tab or commands, and never fall back to clipboard. */
export function shortcutKeystrokes(text: string):
  | { ok: true; keysyms: number[] }
  | {
      ok: false;
      why: "empty" | "long" | "unsupported" | "multiline" | "invalid_text";
    } {
  if (/[\r\n]/.test(text)) return { ok: false, why: "multiline" };
  // biome-ignore lint/suspicious/noControlCharactersInRegex: pasted control bytes must be refused
  if (/[\x00-\x1f\x7f-\x9f]/.test(text))
    return { ok: false, why: "invalid_text" };
  return keystrokes(text);
}

/** Characters as a person counts them, for "pasted · N characters". */
export function charCount(text: string) {
  return [...text].length;
}

/** The text fits the remote clipboard. */
export function fitsClipboard(text: string) {
  return new TextEncoder().encode(text).length <= pasteLimit;
}

/** Whether the person's machine uses ⌘ for shortcuts. */
export function usesCommand(nav: {
  platform?: string;
  userAgent?: string;
}): boolean {
  return /Mac|iPhone|iPad|iPod/.test(
    `${nav.platform ?? ""} ${nav.userAgent ?? ""}`,
  );
}

type Keyish = Pick<
  KeyboardEvent,
  "key" | "code" | "ctrlKey" | "metaKey" | "altKey"
>;

/** What a key press in the controlled view means beyond a plain key:
 * - `paste`: the shortcut that should paste the person's own clipboard;
 * - `copy`: a remote copy or cut whose result may come back to them;
 * - `command`: any other ⌘ shortcut on a Mac, sent as Ctrl;
 * - `meta`: the ⌘ key itself on a Mac, which the remote never gets.
 * The letter is read from `code` when `key` is not a Latin letter, so a
 * non-Latin layout still pastes. */
export function shortcutOf(
  e: Keyish,
  mac: boolean,
): "paste" | "copy" | "command" | "meta" | undefined {
  if (mac && (e.key === "Meta" || e.key === "OS")) return "meta";
  const mod = mac ? e.metaKey : e.ctrlKey && !e.metaKey;
  if (!mod || e.altKey) return undefined;
  const letter = shortcutLetter(e);
  if (letter === "v") return "paste";
  if (letter === "c" || letter === "x") return "copy";
  return mac ? "command" : undefined;
}

/** The Latin letter a shortcut names, from `key`, or from `code` on a
 * layout whose letters are not Latin; empty when it names none. */
export function shortcutLetter(e: Pick<KeyboardEvent, "key" | "code">) {
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  return "";
}

/** A remote clipboard change counts as the person's own copy only this
 * soon after they pressed copy. */
export const copyWindowMs = 2000;

/** The agent is in the middle of a step: an operation holds its connection,
 * or it pressed something a moment ago. The host knows one operation, not
 * the agent's plan, so between two steps the agent looks idle. */
export function agentMidStep(status?: BrowserStatus): boolean {
  if (!status || status.control === "person") return false;
  if (status.agent_connected) return true;
  return !!status.pointer?.clicks.some((c) => c.age_ms < 2000);
}

/** The person's control goes back to the agent after this long without
 * input, when the agent has not asked for them; the last
 * `idleCountdownMs` of it show a countdown the person can stop. */
export const idleReturnMs = 3 * 60 * 1000;
export const idleCountdownMs = 30 * 1000;

/** Seconds left before an idle return, or undefined while no countdown
 * shows. Zero means return now. */
export function idleLeft(idleMs: number, asked: boolean): number | undefined {
  if (asked || idleMs < idleReturnMs - idleCountdownMs) return undefined;
  return Math.max(0, Math.ceil((idleReturnMs - idleMs) / 1000));
}
