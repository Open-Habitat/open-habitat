# components/Terminal.tsx

Generated from web/src/components/Terminal.tsx; do not edit.

```tsx
import { FitAddon } from "@xterm/addon-fit";
import { type ITheme, Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import {
  isReport,
  leaveHistoryKey,
  TerminalModes,
  wheelLines,
  wheelReport,
} from "./terminalModes";
import { isTerminalShortcut } from "./terminalShortcut";
import { offerableUrl, readTitle } from "./terminalTitle";

/** What the owner of a terminal can do to it. */
export type TerminalHandle = {
  write: (data: Uint8Array | string) => void;
  focus: () => void;
  /** Types text as a paste: bracketed when the program asked for it. */
  paste: (text: string) => void;
  clearSelection: () => void;
  reset: () => void;
};

export type TerminalSelection = {
  text: string;
  /** Where the selection starts, relative to the surface; absent for a copy
   * that tmux reported (OSC 52) after its own mouse selection. */
  at?: { top: number; left: number };
};

// The terminal follows the theme: its colours are the design tokens, read
// from the page, never fixed values (design-system/AGENTS.md).
function tokenTheme(el: Element): ITheme {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const ink = v("--ah-ink");
  return {
    background: v("--ah-sunken"),
    foreground: ink,
    cursor: ink,
    cursorAccent: v("--ah-sunken"),
    selectionBackground: v("--ah-accent-soft"),
    selectionForeground: ink,
    black: ink,
    red: v("--ah-err"),
    green: v("--ah-ok"),
    yellow: v("--ah-syntax-number"),
    blue: v("--ah-accent-ink"),
    magenta: v("--ah-syntax-keyword"),
    cyan: v("--ah-syntax-string"),
    white: v("--ah-muted"),
    brightBlack: v("--ah-muted"),
    brightRed: v("--ah-err"),
    brightGreen: v("--ah-ok"),
    brightYellow: v("--ah-syntax-number"),
    brightBlue: v("--ah-accent-ink"),
    brightMagenta: v("--ah-syntax-keyword"),
    brightCyan: v("--ah-syntax-string"),
    brightWhite: v("--ah-ink-2"),
  };
}

function decodeOsc52(data: string): string | undefined {
  const at = data.indexOf(";");
  const payload = at < 0 ? "" : data.slice(at + 1);
  if (!payload || payload === "?" || payload.length > 1_400_000) return;
  try {
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return;
  }
}

/**
 * xterm.js on the design tokens. It reports what the person typed, pasted
 * and selected; the owner decides what reaches the host. Tab and Esc belong
 * to the shell; Ctrl+Shift+Enter is left to the surroundings.
 */
export function TerminalSurface({
  label,
  readOnly = false,
  offline = false,
  fixedSize,
  onData,
  onResize,
  onSelection,
  onPasteRequest,
  onOpen,
  copyOnSelect = false,
  onCopied,
  onOpenUrl,
  ref,
}: {
  label: string;
  readOnly?: boolean;
  offline?: boolean;
  /** A read-only view adopts the watched window's own size. */
  fixedSize?: { cols: number; rows: number };
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onSelection: (selection: TerminalSelection | undefined) => void;
  onPasteRequest: (text: string) => void;
  /** The surface is ready for output: anything held back can be written. */
  onOpen?: () => void;
  /** A finished selection goes to the clipboard (experimental). */
  copyOnSelect?: boolean;
  /** The selection with this text is on the clipboard. */
  onCopied?: (text: string) => void;
  /** A program asked to open an http(s) address; absent when the person has
   * not turned the offer on. Nothing is opened here. */
  onOpenUrl?: (url: string) => void;
  ref?: Ref<TerminalHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<XTerm>(undefined);
  const handlers = useRef({
    onData,
    onResize,
    onSelection,
    onPasteRequest,
    onOpen,
    copyOnSelect,
    onCopied,
    onOpenUrl,
  });
  handlers.current = {
    onData,
    onResize,
    onSelection,
    onPasteRequest,
    onOpen,
    copyOnSelect,
    onCopied,
    onOpenUrl,
  };
  // What clearSelection and reset must also forget or restore.
  const surface = useRef<{ forget: () => void; reset: () => void }>(undefined);
  const fixed = useRef(fixedSize);
  fixed.current = fixedSize;

  useImperativeHandle(ref, () => ({
    write: (data) => term.current?.write(data),
    focus: () => term.current?.focus(),
    paste: (text) => term.current?.paste(text),
    clearSelection: () => {
      surface.current?.forget();
      term.current?.clearSelection();
    },
    reset: () => {
      term.current?.reset();
      surface.current?.reset();
    },
  }));

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const narrow = window.matchMedia("(max-width: 760px)").matches;
    const css = getComputedStyle(el);
    const xterm = new XTerm({
      allowProposedApi: true,
      cursorBlink: true,
      fontFamily: css.getPropertyValue("--ah-mono").trim() || "monospace",
      fontSize: narrow ? 12 : 12.5,
      lineHeight: 1.25,
      scrollback: 1000,
      macOptionClickForcesSelection: true,
      theme: tokenTheme(el),
    });
    term.current = xterm;
    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xterm.open(el);
    // xterm forces local selection with Shift on Linux/Windows, but only
    // Option on macOS. There Shift-drag otherwise reaches tmux, whose default
    // copy-and-cancel removes the highlight on release. Translate just the
    // start of that gesture to xterm's supported Option-selection path; leave
    // ordinary application mouse events, wheel scrolling and Option untouched.
    const shiftSelect = (event: MouseEvent) => {
      if (
        !/Mac/.test(navigator.platform) ||
        event.button !== 0 ||
        !event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      event.target?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: event.view,
          detail: event.detail,
          screenX: event.screenX,
          screenY: event.screenY,
          clientX: event.clientX,
          clientY: event.clientY,
          button: event.button,
          buttons: event.buttons,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: true,
          altKey: true,
        }),
      );
    };
    el.addEventListener("mousedown", shiftSelect, true);
    const sizeToHost = () => {
      if (fixed.current) {
        xterm.resize(fixed.current.cols, fixed.current.rows);
        return;
      }
      try {
        fit.fit();
      } catch {
        // A hidden host has no size; the next observation fits it.
      }
    };
    const resized = xterm.onResize(({ cols, rows }) =>
      handlers.current.onResize(cols, rows),
    );
    sizeToHost();
    // A fit that keeps xterm's default size fires no resize event.
    handlers.current.onResize(xterm.cols, xterm.rows);
    handlers.current.onOpen?.();
    // tmux's mouse modes reach xterm.js only when they change something:
    // its redraws re-send them, and each re-send cleared the selection.
    const modes = new TerminalModes(
      () => xterm.modes.mouseTrackingMode,
      (sequence) => xterm.write(sequence),
    );
    const decset = xterm.parser.registerCsiHandler(
      { prefix: "?", final: "h" },
      (params) => modes.handle(true, params),
    );
    const decrst = xterm.parser.registerCsiHandler(
      { prefix: "?", final: "l" },
      (params) => modes.handle(false, params),
    );
    const ris = xterm.parser.registerEscHandler({ final: "c" }, () => {
      modes.reset();
      return false;
    });
    // Scrolled back with the wheel, the person reads tmux's history (copy
    // mode): no cursor in it, and typing first returns to the prompt.
    let inMode = false;
    let history = false;
    let wheelUpAt = Number.NEGATIVE_INFINITY;
    // Already in a mode when this surface attached (scrolled back before a
    // tab switch or reconnect): how it was entered is unknown, so the next
    // wheel scroll counts as reading history.
    let adopted = false;
    const setHistory = (on: boolean) => {
      if (on === history) return;
      history = on;
      modes.hideCursor(on);
      if (on) el.dataset.history = "";
      else delete el.dataset.history;
    };
    // The first title after attaching repeats the last request; only a
    // request made while this surface is open is offered.
    let seenOffer: string | undefined;
    let titled = false;
    const title = xterm.onTitleChange((raw) => {
      const t = readTitle(raw);
      if (!t) return;
      if (t.mode !== inMode) {
        inMode = t.mode;
        adopted = inMode && !titled;
        setHistory(inMode && performance.now() - wheelUpAt < 1500);
      }
      const nonce = t.offer?.nonce;
      if (!titled) {
        titled = true;
        seenOffer = nonce;
        return;
      }
      if (!t.offer || nonce === seenOffer) return;
      seenOffer = nonce;
      const url = offerableUrl(t.offer.url);
      if (url) handlers.current.onOpenUrl?.(url.href);
    });
    const typed = xterm.onData((data) => {
      if (history && !isReport(data)) {
        setHistory(false);
        handlers.current.onData(leaveHistoryKey + data);
        return;
      }
      handlers.current.onData(data);
    });
    // One wheel report per line moved: tmux scrolls one line a report
    // (internal/daemon/terminal_session_linux.go), so a trackpad follows the
    // fingers instead of jumping five lines an event.
    let carried = 0;
    xterm.attachCustomWheelEventHandler((event) => {
      if (
        xterm.modes.mouseTrackingMode === "none" ||
        !modes.sgr ||
        event.ctrlKey ||
        event.shiftKey ||
        event.deltaY === 0
      )
        return true;
      const screen = el.querySelector(".xterm-screen");
      if (!screen) return true;
      const box = screen.getBoundingClientRect();
      const cellH = box.height / xterm.rows;
      const cellW = box.width / xterm.cols;
      const step = wheelLines(event, cellH, xterm.rows, carried);
      carried = step.carried;
      if (step.lines) {
        const col = Math.min(
          xterm.cols,
          Math.max(1, Math.floor((event.clientX - box.left) / cellW) + 1),
        );
        const row = Math.min(
          xterm.rows,
          Math.max(1, Math.floor((event.clientY - box.top) / cellH) + 1),
        );
        if (step.lines < 0) {
          wheelUpAt = performance.now();
          if (adopted) setHistory(true);
        }
        xterm.input(
          wheelReport(step.lines < 0, col, row).repeat(Math.abs(step.lines)),
          true,
        );
      }
      return false;
    });
    const selectionText = () => xterm.getSelection().replace(/[ \t]+$/gm, "");
    // The text tmux last reported (OSC 52) after its own mouse selection:
    // the copy shortcut copies it when xterm.js has no selection of its own.
    let reported: string | undefined;
    // tmux's copy is put on the clipboard only right after the person
    // dragged in this terminal, once: a program's OSC 52 after a keypress or
    // a click (possible when a person's tmux sets set-clipboard on) only
    // offers its text.
    let pressedHere = false;
    let dragged = false;
    let dragEndedAt = Number.NEGATIVE_INFINITY;
    const dragging = (event: MouseEvent) => {
      if (pressedHere && event.buttons) dragged = true;
    };
    const copy = (text: string) => {
      if (!handlers.current.copyOnSelect || !navigator.clipboard) return;
      void navigator.clipboard.writeText(text).then(
        () => handlers.current.onCopied?.(text),
        () => {},
      );
    };
    const reportSelection = () => {
      const text = selectionText();
      if (!text.trim()) {
        if (!reported) handlers.current.onSelection(undefined);
        return;
      }
      reported = undefined;
      const pos = xterm.getSelectionPosition();
      const screen = el.querySelector(".xterm-screen");
      const cellH = screen ? screen.clientHeight / xterm.rows : 16;
      const cellW = screen ? screen.clientWidth / xterm.cols : 8;
      handlers.current.onSelection({
        text,
        at: pos
          ? {
              top: (pos.start.y - xterm.buffer.active.viewportY) * cellH,
              left: pos.start.x * cellW,
            }
          : undefined,
      });
    };
    const selected = xterm.onSelectionChange(reportSelection);
    // xterm 6 deduplicates the range on mouseup even after clearSelection().
    // Reselecting the identical text after Copy must offer its actions again.
    let selectionFrame = 0;
    const startPress = () => {
      pressedHere = true;
      dragged = false;
    };
    el.addEventListener("mousedown", startPress, true);
    window.addEventListener("mousemove", dragging, true);
    const finishSelection = () => {
      if (!pressedHere) return;
      pressedHere = false;
      if (dragged) dragEndedAt = performance.now();
      // Inside the release itself, which browsers count as the person's
      // gesture for the clipboard.
      if (xterm.hasSelection()) {
        const text = selectionText();
        if (text.trim()) copy(text);
      }
      cancelAnimationFrame(selectionFrame);
      selectionFrame = requestAnimationFrame(() => {
        if (xterm.hasSelection()) reportSelection();
      });
    };
    // A drag may end outside the terminal.
    window.addEventListener("mouseup", finishSelection, true);
    // tmux's own mouse selection reaches the browser as an OSC 52 copy.
    const osc = xterm.parser.registerOscHandler(52, (data) => {
      const text = decodeOsc52(data);
      if (text?.trim()) {
        reported = text;
        handlers.current.onSelection({ text });
        if (performance.now() - dragEndedAt < 2000) {
          dragEndedAt = Number.NEGATIVE_INFINITY;
          copy(text);
        }
      }
      return true;
    });
    // Cmd+C is the browser's own copy; with no selection of xterm.js's it
    // copies what tmux reported.
    const copyEvent = (event: ClipboardEvent) => {
      if (xterm.hasSelection() || !reported || !event.clipboardData) return;
      event.clipboardData.setData("text/plain", reported);
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    el.addEventListener("copy", copyEvent, true);
    surface.current = {
      forget: () => {
        reported = undefined;
      },
      reset: () => {
        modes.reset();
        setHistory(false);
        inMode = false;
        adopted = false;
      },
    };
    xterm.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      if (isTerminalShortcut(event)) return false;
      // Cmd+C and Cmd+V stay with the browser on a Mac.
      if (event.metaKey) return false;
      const key = event.key.toLowerCase();
      // Ctrl+Shift+C always copies; Ctrl+C only with a selection of
      // xterm.js's, otherwise it interrupts the program.
      const copy =
        event.ctrlKey &&
        key === "c" &&
        (event.shiftKey || xterm.hasSelection());
      if (copy) {
        event.preventDefault();
        const text = xterm.hasSelection() ? selectionText() : reported;
        if (text) void navigator.clipboard?.writeText(text).catch(() => {});
        xterm.clearSelection();
        return false;
      }
      // Ctrl+V and Ctrl+Shift+V paste through the browser's paste event.
      if (event.ctrlKey && key === "v") return false;
      return true;
    });
    const paste = (event: ClipboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (text) handlers.current.onPasteRequest(text);
    };
    el.addEventListener("paste", paste, true);
    const observer = new ResizeObserver(() => sizeToHost());
    observer.observe(el);
    const retheme = () => {
      xterm.options.theme = tokenTheme(el);
    };
    const themeObserver = new MutationObserver(retheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", retheme);
    // The bundled mono font may load after the first measurement.
    void document.fonts?.ready.then(() => {
      if (term.current !== xterm) return;
      xterm.options.fontFamily = `${xterm.options.fontFamily}`;
      sizeToHost();
      xterm.refresh(0, xterm.rows - 1);
    });
    return () => {
      cancelAnimationFrame(selectionFrame);
      window.removeEventListener("mouseup", finishSelection, true);
      el.removeEventListener("mousedown", startPress, true);
      window.removeEventListener("mousemove", dragging, true);
      el.removeEventListener("copy", copyEvent, true);
      surface.current = undefined;
      modes.dispose();
      decset.dispose();
      decrst.dispose();
      ris.dispose();
      title.dispose();
      el.removeEventListener("mousedown", shiftSelect, true);
      el.removeEventListener("paste", paste, true);
      observer.disconnect();
      themeObserver.disconnect();
      scheme.removeEventListener("change", retheme);
      osc.dispose();
      resized.dispose();
      typed.dispose();
      selected.dispose();
      term.current = undefined;
      xterm.dispose();
    };
  }, []);

  useEffect(() => {
    term.current?.textarea?.setAttribute("aria-label", label);
  }, [label]);

  useEffect(() => {
    const xterm = term.current;
    if (!xterm) return;
    xterm.options.disableStdin = readOnly || offline;
    xterm.options.cursorBlink = !readOnly && !offline;
  }, [readOnly, offline]);

  useEffect(() => {
    const xterm = term.current;
    if (xterm && fixedSize) xterm.resize(fixedSize.cols, fixedSize.rows);
  }, [fixedSize?.cols, fixedSize?.rows, fixedSize]);

  return (
    <div
      className="ah-terminal-surface"
      data-offline={offline || undefined}
      data-fixed={fixedSize ? true : undefined}
      ref={host}
    />
  );
}

```
