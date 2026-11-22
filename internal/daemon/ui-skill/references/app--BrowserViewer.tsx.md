# app/BrowserViewer.tsx

Generated from web/src/app/BrowserViewer.tsx; do not edit.

```tsx
import RFB from "@novnc/novnc";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { BrowserClipboard, BrowserFrame } from "../components/ServerBrowser";
import { useText } from "../i18n";
import { serverBrowserText } from "../text/serverBrowser";
import {
  agentMidStep,
  charCount,
  copyWindowMs,
  fitsClipboard,
  idleLeft,
  keystrokes,
  keysymOfKey,
  shortcutKeystrokes,
  shortcutLetter,
  shortcutOf,
  usesCommand,
  XK,
} from "./browserInput";
import { type BrowserStatus, browserViewURL } from "./serverBrowser";

const toastFor = 6000;
// A shortcut paste the browser did not turn into a paste event (Safari
// fires none on a canvas) opens the paste field after this long.
const pasteFallbackMs = 400;
// Keys typed while a takeover is on its way are replayed, up to this many.
const keyBuffer = 16;
const textModifiers: Record<string, number> = {
  ControlLeft: 0xffe3,
  ControlRight: 0xffe4,
  ShiftLeft: 0xffe1,
  ShiftRight: 0xffe2,
};
const modifierKeys = new Set([
  "Shift",
  "Control",
  "Alt",
  "AltGraph",
  "Meta",
  "OS",
  "CapsLock",
  "Tab",
  "Escape",
]);

/** The live view of the person's server browser: noVNC on a WebSocket to
 * the person's daemon through the gateway, inside the frame that says who
 * drives. The first message proves the session's CSRF token, as for the
 * browser shell; after that the socket is RFB.
 *
 * While the agent drives the view is noVNC's view-only mode, which sends no
 * input and no clipboard at all. Clicking or typing on the picture takes
 * control: when the agent is idle the same click or keys reach the page
 * once the host has granted it; when the agent is mid-step the click only
 * asks. While the person drives, ⌘ means Ctrl on the remote Linux browser,
 * their own paste goes to the page, and a remote copy they asked for comes
 * back to their clipboard. Giving control back empties the remote
 * clipboard first, so nothing they pasted outlives their turn there. */
export default function BrowserViewer({
  csrf,
  status,
  busy,
  onTake,
  onGiveBack,
}: {
  csrf: string;
  status: BrowserStatus;
  busy: boolean;
  onTake: () => Promise<boolean>;
  onGiveBack: () => Promise<boolean>;
}) {
  const txt = useText(serverBrowserText);
  const target = useRef<HTMLElement>(null);
  const rfb = useRef<RFB | undefined>(undefined);
  const [phase, setPhase] = useState<"connecting" | "connected" | "lost">(
    "connecting",
  );
  const [attempt, setAttempt] = useState(0);
  const control = status.control === "person" ? "person" : "agent";
  const viewOnly = control !== "person";
  const mid = agentMidStep(status);
  const asked = !!status.request;
  const mac = useMemo(
    () => typeof navigator !== "undefined" && usesCommand(navigator),
    [],
  );
  const touch = useMemo(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches,
    [],
  );

  const [waiting, setWaiting] = useState(false);
  const [midAt, setMidAt] = useState<{ x: number; y: number }>();
  const [clipOpen, setClipOpen] = useState(false);
  const [text, setText] = useState("");
  const [password, setPassword] = useState("");
  const [hidden, setHidden] = useState(true);
  const [enterWarn, setEnterWarn] = useState<number>();
  const [remote, setRemote] = useState<string>();
  const [remoteShown, setRemoteShown] = useState(false);
  const [toast, setToast] = useState<{ text: string; n: number }>();
  const [idle, setIdle] = useState<number>();

  // The listeners read the latest state through refs; they are bound once
  // per connection.
  const live = useRef({ control, mid, waiting, asked });
  live.current = { control, mid, waiting, asked };
  const taking = useRef(false);
  const connection = useRef(0);
  const connected = useRef(false);
  const heldModifiers = useRef(new Set<string>());
  const keys = useRef<number[]>([]);
  const pasted = useRef(false);
  const lastInput = useRef(Date.now());
  const copyAt = useRef(0);
  const pasteWait = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Bumped on every change of control, so a late clipboard result from the
  // previous turn is dropped.
  const turn = useRef(0);
  const returning = useRef(false);

  const say = useCallback((t: string) => {
    setToast((old) => ({ text: t, n: (old?.n ?? 0) + 1 }));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(undefined), toastFor);
    return () => clearTimeout(id);
  }, [toast]);
  const noteInput = useCallback(() => {
    lastInput.current = Date.now();
    setIdle(undefined);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a retry is a new connection
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    setPhase("connecting");
    connection.current++;
    connected.current = false;
    let gone = false;
    const socket = new WebSocket(browserViewURL());
    socket.binaryType = "arraybuffer";
    const lost = () => {
      if (!gone) {
        connection.current++;
        connected.current = false;
        keys.current = [];
        heldModifiers.current.clear();
        clearTimeout(pasteWait.current);
        setPhase("lost");
      }
    };
    socket.onclose = lost;
    socket.onopen = () => {
      if (gone) return;
      socket.send(JSON.stringify({ type: "auth", csrf }));
      const client = new RFB(element, socket, { shared: true });
      client.viewOnly = live.current.control !== "person";
      client.scaleViewport = true;
      client.resizeSession = false;
      client.focusOnClick = true;
      client.background = "transparent";
      client.addEventListener("connect", () => {
        if (!gone) {
          connected.current = true;
          setPhase("connected");
        }
      });
      client.addEventListener("disconnect", lost);
      // noVNC raises this only while it is not view-only, i.e. while the
      // person drives. Only a copy the person asked for a moment ago is
      // offered to them; a page writing the clipboard by itself is not.
      client.addEventListener("clipboard", (event) => {
        const copied = (event as CustomEvent<{ text: string }>).detail?.text;
        if (typeof copied !== "string" || live.current.control !== "person")
          return;
        if (Date.now() - copyAt.current > copyWindowMs) return;
        copyAt.current = 0;
        const mine = turn.current;
        const blocked = () => {
          if (mine !== turn.current) return;
          setRemote(copied);
          setRemoteShown(false);
          setClipOpen(true);
          say(txt.toast.copyBlocked);
        };
        if (!navigator.clipboard?.writeText) return blocked();
        navigator.clipboard.writeText(copied).then(() => {
          if (mine === turn.current) say(txt.toast.copiedLocal);
        }, blocked);
      });
      rfb.current = client;
    };
    return () => {
      gone = true;
      connection.current++;
      connected.current = false;
      keys.current = [];
      heldModifiers.current.clear();
      const client = rfb.current;
      rfb.current = undefined;
      if (client) {
        // Leaving the view while in control empties the remote clipboard
        // too; the give-back from the strip has no viewer to do it.
        if (!client.viewOnly) client.clipboardPasteFrom("");
        client.disconnect();
      } else socket.close(1000);
    };
  }, [csrf, attempt]);

  useEffect(() => {
    turn.current++;
    if (control === "person") {
      lastInput.current = Date.now();
      setWaiting(false);
      setMidAt(undefined);
    } else {
      setClipOpen(false);
      setRemote(undefined);
      setRemoteShown(false);
      setText("");
      setPassword("");
      setEnterWarn(undefined);
      setIdle(undefined);
      pasted.current = false;
    }
  }, [control]);

  useEffect(() => {
    if (rfb.current) {
      rfb.current.viewOnly = viewOnly;
      if (!viewOnly) rfb.current.focus({ preventScroll: true });
    }
  }, [viewOnly]);

  /** Ctrl+key on the remote browser, whatever the person holds. */
  const chord = useCallback((keysym: number, shift = false) => {
    const c = rfb.current;
    if (!c) return;
    c.sendKey(XK.Control_L, "ControlLeft", true);
    if (shift) c.sendKey(XK.Shift_L, "ShiftLeft", true);
    c.sendKey(keysym, null);
    if (shift) c.sendKey(XK.Shift_L, "ShiftLeft", false);
    c.sendKey(XK.Control_L, "ControlLeft", false);
  }, []);

  const take = useCallback(
    async (replay?: (c: RFB) => void, message = txt.toast.took) => {
      if (taking.current || !connected.current) return false;
      const epoch = connection.current;
      const client = rfb.current;
      taking.current = true;
      setMidAt(undefined);
      let ok = false;
      try {
        ok = await onTake();
      } finally {
        taking.current = false;
      }
      if (
        epoch !== connection.current ||
        !connected.current ||
        client !== rfb.current
      )
        return false;
      const c = rfb.current;
      const buffered = keys.current;
      keys.current = [];
      if (!ok || !c) return false;
      // The grant is the host's answer; noVNC follows it now rather than on
      // the next render, so the buffered input goes through.
      c.viewOnly = false;
      c.focus({ preventScroll: true });
      replay?.(c);
      for (const k of buffered) c.sendKey(k, null);
      lastInput.current = Date.now();
      say(message);
      return true;
    },
    [onTake, say, txt.toast.took],
  );

  const giveBack = useCallback(
    async (auto = false) => {
      const c = rfb.current;
      if (c && !c.viewOnly) c.clipboardPasteFrom("");
      const hadPaste = pasted.current;
      const ok = await onGiveBack();
      // Done disappears with control; focus stays on the picture, where
      // typing takes control again.
      if (ok) rfb.current?.focus({ preventScroll: true });
      if (ok)
        say(
          auto
            ? txt.toast.idleBack
            : hadPaste
              ? txt.toast.backCleared
              : txt.toast.back,
        );
      return ok;
    },
    [onGiveBack, say, txt.toast],
  );

  /** The popover's deliberate remote-clipboard route, never a fallback. */
  const paste = useCallback(
    (value: string) => {
      const c = rfb.current;
      if (!c || c.viewOnly) return false;
      if (!value) {
        say(txt.toast.empty);
        return false;
      }
      if (!fitsClipboard(value)) {
        say(txt.toast.tooLong);
        return false;
      }
      c.clipboardPasteFrom(value);
      chord(XK.v);
      pasted.current = true;
      say(txt.toast.pasted(charCount(value)));
      return true;
    },
    [chord, say, txt.toast],
  );

  const openPasteField = useCallback(() => {
    setHidden(true);
    setClipOpen(true);
    requestAnimationFrame(() =>
      document.getElementById("sb-paste-text")?.focus(),
    );
  }, []);

  // Input on the picture: capture phase on noVNC's container, ahead of
  // noVNC's own handlers on the canvas.
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const at = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.width ? (e.clientX - r.left) / r.width : 0.3,
        y: r.height ? (e.clientY - r.top) / r.height : 0.3,
      };
    };
    const onPointerDown = (e: PointerEvent) => {
      noteInput();
      if (live.current.control === "person") return;
      if (live.current.waiting || taking.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (live.current.mid) {
        e.preventDefault();
        e.stopPropagation();
        setMidAt(at(e));
        return;
      }
      // A primary mouse or pen click is replayed where it landed; a touch
      // only takes control, since noVNC reads touches as gestures.
      const { clientX, clientY } = e;
      const replay =
        e.pointerType !== "touch" && e.button === 0
          ? () => {
              const canvas = el.querySelector("canvas");
              if (!canvas) return;
              const init = {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY,
                button: 0,
              };
              canvas.dispatchEvent(
                new MouseEvent("mousedown", { ...init, buttons: 1 }),
              );
              canvas.dispatchEvent(
                new MouseEvent("mouseup", { ...init, buttons: 0 }),
              );
            }
          : undefined;
      void take(replay);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code in textModifiers) heldModifiers.current.add(e.code);
      if (e.isComposing) return;
      noteInput();
      const kind = shortcutOf(e, mac);
      if (kind === "paste") {
        // Preserve the browser default so only its trusted paste event reads
        // the clipboard. Never forward V to noVNC, even during takeover.
        e.stopPropagation();
        clearTimeout(pasteWait.current);
        pasteWait.current = setTimeout(() => {
          say(
            live.current.control === "person"
              ? txt.toast.pasteBlocked
              : txt.toast.pasteBlockedAgent,
          );
          openPasteField();
        }, pasteFallbackMs);
        return;
      }
      if (live.current.control !== "person") {
        if (modifierKeys.has(e.key) || e.ctrlKey || e.metaKey || e.altKey)
          return;
        if (live.current.waiting) return;
        e.preventDefault();
        e.stopPropagation();
        if (live.current.mid && !taking.current) {
          setMidAt({ x: 0.2, y: 0.2 });
          return;
        }
        const k = keysymOfKey(e.key);
        if (k !== undefined && keys.current.length < keyBuffer)
          keys.current.push(k);
        if (!taking.current) void take();
        return;
      }
      if (kind === "meta") {
        // noVNC would send ⌘ as Alt; the remote never gets it.
        e.stopPropagation();
        return;
      }
      if (kind === "copy") copyAt.current = Date.now();
      if (mac && (kind === "copy" || kind === "command")) {
        e.preventDefault();
        e.stopPropagation();
        const letter = shortcutLetter(e);
        const k = letter ? keysymOfKey(letter) : keysymOfKey(e.key);
        if (k !== undefined) chord(k, e.shiftKey);
      }
    };
    // Only ⌘'s own release: other keys' releases must reach noVNC, which
    // ignores those it never saw go down.
    const onKeyUp = (e: KeyboardEvent) => {
      heldModifiers.current.delete(e.code);
      if (mac && (e.key === "Meta" || e.key === "OS")) e.stopPropagation();
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!e.isTrusted) return;
      clearTimeout(pasteWait.current);
      noteInput();
      const value = e.clipboardData?.getData("text/plain") ?? "";
      const result = shortcutKeystrokes(value);
      if (!result.ok) {
        say(txt.toast.shortcutRefused[result.why]);
        return;
      }
      if (live.current.waiting || taking.current) {
        say(txt.toast.shortcutRefused.not_in_control);
        return;
      }
      if (live.current.control !== "person" && live.current.mid) {
        setMidAt({ x: 0.2, y: 0.2 });
        return;
      }
      const epoch = connection.current;
      const client = rfb.current;
      if (!connected.current || !client) {
        say(txt.toast.shortcutRefused.unavailable);
        return;
      }
      const send = async () => {
        if (live.current.control !== "person" && !(await take())) {
          if (epoch === connection.current)
            say(txt.toast.shortcutRefused.not_in_control);
          return;
        }
        if (
          epoch !== connection.current ||
          !connected.current ||
          client !== rfb.current
        )
          return;
        if (client.viewOnly) {
          say(txt.toast.shortcutRefused.not_in_control);
          return;
        }
        // Type literally even while the shortcut's Ctrl/Shift is down.
        // Restore only keys still held now (takeover may have awaited a grant),
        // so Ctrl+C after pasting with Ctrl still down remains a shortcut.
        for (const [code, sym] of Object.entries(textModifiers))
          client.sendKey(sym, code, false);
        for (const k of result.keysyms) client.sendKey(k, null);
        for (const code of heldModifiers.current)
          client.sendKey(textModifiers[code], code, true);
      };
      void send();
    };
    const onBlur = () => heldModifiers.current.clear();
    const onWheel = () => noteInput();
    el.addEventListener("pointerdown", onPointerDown, true);
    el.addEventListener("keydown", onKeyDown, true);
    el.addEventListener("keyup", onKeyUp, true);
    el.addEventListener("blur", onBlur, true);
    el.addEventListener("paste", onPaste, true);
    el.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => {
      clearTimeout(pasteWait.current);
      el.removeEventListener("pointerdown", onPointerDown, true);
      el.removeEventListener("keydown", onKeyDown, true);
      el.removeEventListener("keyup", onKeyUp, true);
      el.removeEventListener("blur", onBlur, true);
      el.removeEventListener("paste", onPaste, true);
      el.removeEventListener("wheel", onWheel, true);
    };
  }, [mac, take, chord, noteInput, openPasteField, say, txt.toast]);

  // "Take when it's done": once the agent's operation ends.
  useEffect(() => {
    if (!waiting || mid || control === "person") return;
    setWaiting(false);
    void take(undefined, txt.toast.tookAfter);
  }, [waiting, mid, control, take, txt.toast.tookAfter]);

  // The idle return: only while the person drives and the agent has not
  // asked for them. A lost connection never returns control.
  const giveBackNow = useRef(giveBack);
  giveBackNow.current = giveBack;
  useEffect(() => {
    if (control !== "person" || phase !== "connected") return;
    // A reconnected view starts its three minutes again.
    lastInput.current = Date.now();
    const id = setInterval(() => {
      const left = idleLeft(Date.now() - lastInput.current, live.current.asked);
      setIdle(left);
      if (left === 0 && !returning.current) {
        returning.current = true;
        void giveBackNow.current(true).finally(() => {
          returning.current = false;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [control, phase]);

  useEffect(() => {
    if (phase !== "connected") setPassword("");
  }, [phase]);

  const sendType = (secret = false) => {
    noteInput();
    const c = rfb.current;
    if (!c || c.viewOnly || phase !== "connected") return;
    const r = keystrokes(secret ? password : text);
    if (!r.ok) {
      say(
        r.why === "long"
          ? txt.toast.tooLong
          : r.why === "empty"
            ? txt.toast.empty
            : txt.toast.unsupported,
      );
      return;
    }
    if (!secret && r.enters > 0 && enterWarn !== r.enters) {
      setEnterWarn(r.enters);
      return;
    }
    for (const k of r.keysyms) c.sendKey(k, null);
    if (secret) setPassword("");
    else {
      setText("");
      setEnterWarn(undefined);
    }
    rfb.current?.focus({ preventScroll: true });
    say(txt.toast.typed(r.keysyms.length));
  };

  const copyLocal = async () => {
    noteInput();
    if (remote === undefined) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(remote);
      setRemote(undefined);
      setRemoteShown(false);
      say(txt.toast.copiedLocal);
    } catch {
      setRemoteShown(true);
      say(txt.toast.copyRefused);
    }
  };

  const agent = mid ? "busy" : asked ? "waits" : "idle";
  return (
    <BrowserFrame
      control={control}
      agent={agent}
      waiting={waiting}
      says={status.request?.text}
      busy={busy}
      clipOpen={clipOpen}
      mid={midAt}
      idle={idle}
      toast={toast?.text}
      onTake={() => void take()}
      onDone={() => void giveBack()}
      onCancelWait={() => setWaiting(false)}
      onClipToggle={() => {
        noteInput();
        setHidden(true);
        setClipOpen((v) => !v);
      }}
      onTakeNow={() => void take()}
      onTakeAfter={() => {
        setMidAt(undefined);
        setWaiting(true);
      }}
      onMidCancel={() => setMidAt(undefined)}
      onKeep={noteInput}
      onClipClose={() => setClipOpen(false)}
      clipboard={
        <BrowserClipboard
          password={password}
          onPassword={(v) => {
            noteInput();
            setPassword(v);
          }}
          onTypePassword={() => sendType(true)}
          text={text}
          hidden={hidden}
          touch={touch}
          enterWarn={enterWarn}
          remote={remote}
          remoteShown={remoteShown}
          canCopy={control === "person" && phase === "connected"}
          onText={(v) => {
            noteInput();
            setText(v);
            setEnterWarn(undefined);
          }}
          onHidden={setHidden}
          onPaste={() => {
            noteInput();
            if (paste(text)) {
              setText("");
              setEnterWarn(undefined);
            }
          }}
          onType={() => sendType()}
          onCopySelection={() => {
            noteInput();
            copyAt.current = Date.now();
            chord(XK.c);
          }}
          onCopyLocal={() => void copyLocal()}
        />
      }
    >
      <section
        ref={target}
        className="sb-viewer"
        data-testid="browser-viewer"
        data-phase={phase}
        data-view-only={viewOnly || undefined}
        aria-label={txt.frame.screen}
        aria-describedby="sb-screen-help"
      />
      <span id="sb-screen-help" hidden>
        {control === "person"
          ? txt.frame.helpYou
          : mid
            ? txt.frame.helpBusy
            : txt.frame.helpAgent}
      </span>
      {phase === "connecting" ? (
        <p className="sb-viewer-note">{txt.sheet.connecting}</p>
      ) : null}
      {phase === "lost" ? (
        <div className="sb-viewer-note" role="alert">
          <p>{txt.sheet.lost}</p>
          <ControlButton
            size="row"
            data-testid="browser-viewer-retry"
            onPress={() => setAttempt((n) => n + 1)}
          >
            {txt.sheet.retry}
          </ControlButton>
        </div>
      ) : null}
    </BrowserFrame>
  );
}

```
