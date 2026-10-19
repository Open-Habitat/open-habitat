import { FitAddon } from "@xterm/addon-fit";
import { type ITheme, Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { type Ref, useEffect, useImperativeHandle, useRef } from "react";

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
 * to the shell; Ctrl+` is left to the surroundings.
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
  });
  handlers.current = { onData, onResize, onSelection, onPasteRequest, onOpen };
  const fixed = useRef(fixedSize);
  fixed.current = fixedSize;

  useImperativeHandle(ref, () => ({
    write: (data) => term.current?.write(data),
    focus: () => term.current?.focus(),
    paste: (text) => term.current?.paste(text),
    clearSelection: () => term.current?.clearSelection(),
    reset: () => term.current?.reset(),
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
    xterm.textarea?.setAttribute("aria-label", label);
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
    const typed = xterm.onData((data) => handlers.current.onData(data));
    const selected = xterm.onSelectionChange(() => {
      const text = xterm.getSelection().replace(/[ \t]+$/gm, "");
      if (!text.trim()) {
        handlers.current.onSelection(undefined);
        return;
      }
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
    });
    // tmux's own mouse selection reaches the browser as an OSC 52 copy.
    const osc = xterm.parser.registerOscHandler(52, (data) => {
      const text = decodeOsc52(data);
      if (text?.trim()) handlers.current.onSelection({ text });
      return true;
    });
    xterm.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      if (event.ctrlKey && (event.key === "`" || event.code === "Backquote"))
        return false;
      // Cmd+C and Cmd+V stay with the browser on a Mac.
      if (event.metaKey) return false;
      const key = event.key.toLowerCase();
      const copy =
        event.ctrlKey &&
        key === "c" &&
        (event.shiftKey || xterm.hasSelection());
      if (copy) {
        event.preventDefault();
        const text = xterm.getSelection();
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
