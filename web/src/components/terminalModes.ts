// What the web terminal does between tmux and xterm.js beyond drawing the
// screen. tmux owns the mouse in a browser shell (mouse mode, so the wheel
// scrolls tmux's history); xterm.js owns the local Shift-drag selection.

export type MouseMode = "none" | "x10" | "vt200" | "drag" | "any";

const modeOf: Record<number, MouseMode> = {
  9: "x10",
  1000: "vt200",
  1002: "drag",
  1003: "any",
};
const codeOf: Record<Exclude<MouseMode, "none">, number> = {
  x10: 9,
  vt200: 1000,
  drag: 1002,
  any: 1003,
};

/** Leaves tmux's copy mode before typed input when the person scrolled back
 * with the wheel. internal/daemon/terminal_session_linux.go binds the same
 * bytes; outside copy mode the binding does nothing. */
export const leaveHistoryKey = "\x1b[29999~";

/** Bytes xterm.js reports for the mouse or for focus, not typed input. */
export function isReport(data: string) {
  return (
    data.startsWith("\x1b[<") ||
    data.startsWith("\x1b[M") ||
    data === "\x1b[I" ||
    data === "\x1b[O"
  );
}

/**
 * Private mode changes (DECSET/DECRST) as the program asks for them, applied
 * to xterm.js only when they change something.
 *
 * tmux re-sends its mouse modes, off and then on again, on every full redraw:
 * on attach, after each resize, when another client of the same session
 * resizes it. xterm.js clears its selection whenever a mouse mode is set,
 * even to the mode it already has, so a Shift-drag selection vanished with
 * every redraw. Here the mouse modes the program asks for are only recorded,
 * and xterm.js gets the net result once the burst is over, or nothing when
 * that is the mode it already has.
 *
 * The same place keeps the cursor hidden while the person reads tmux's
 * history after scrolling back: tmux shows its copy-mode cursor there and
 * shows it again with every redraw.
 */
export class TerminalModes {
  /** The program reports the mouse in SGR form (1006). */
  sgr = false;
  private wanted: MouseMode = "none";
  private cursor = true;
  private hidden = false;
  /** What this filter wrote itself, in order; the program's own sequences
   * never match the head by accident for long, and a mismatch is harmless. */
  private pending: string[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private applied: () => MouseMode,
    private write: (sequence: string) => void,
    private delay = 25,
  ) {}

  /** A DECSET (`set`) or DECRST. True when xterm.js must not apply it. */
  handle(set: boolean, params: readonly (number | number[])[]): boolean {
    const ps = params.map((p) => (typeof p === "number" ? p : p[0]));
    const own = `${ps.join(";")}${set ? "h" : "l"}`;
    if (this.pending.length && this.pending[0] === own) {
      this.pending.shift();
      return false;
    }
    for (const p of ps) if (p === 1006) this.sgr = set;
    if (ps.length === 1 && ps[0] === 25) {
      this.cursor = set;
      return set && this.hidden;
    }
    const mouse = ps.filter((p) => p in modeOf);
    if (!mouse.length) return false;
    for (const p of mouse) this.wanted = set ? modeOf[p] : "none";
    // A mode mixed with other modes in one sequence is rare: apply it as
    // asked rather than splitting the sequence.
    if (mouse.length !== ps.length) return false;
    if (this.timer === undefined)
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.sync();
      }, this.delay);
    return true;
  }

  /** Hide the cursor regardless of the program, or give it back. */
  hideCursor(hide: boolean) {
    if (hide === this.hidden) return;
    this.hidden = hide;
    if (hide) this.inject("25l");
    else if (this.cursor) this.inject("25h");
  }

  /** The terminal was reset (RIS): every mode is xterm.js's default again. */
  reset() {
    this.wanted = "none";
    this.cursor = true;
    this.sgr = false;
    this.pending = [];
    if (this.hidden) this.inject("25l");
  }

  dispose() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private sync() {
    if (this.wanted === this.applied()) return;
    this.inject(this.wanted === "none" ? "1000l" : `${codeOf[this.wanted]}h`);
  }

  private inject(own: string) {
    this.pending.push(own);
    this.write(`\x1b[?${own}`);
  }
}

/** Whole lines a wheel event moved, carrying the fraction to the next. A
 * trackpad's pixels become lines one to one, so tmux's history follows the
 * fingers; xterm.js's own report was one report per event, five lines each. */
export function wheelLines(
  event: Pick<WheelEvent, "deltaY" | "deltaMode">,
  cellHeight: number,
  rows: number,
  carried: number,
): { lines: number; carried: number } {
  let amount = event.deltaY;
  if (event.deltaMode === 0) amount /= cellHeight > 0 ? cellHeight : 16;
  else if (event.deltaMode === 2) amount *= rows;
  amount += carried;
  const lines = Math.trunc(amount);
  const cap = rows * 3;
  return {
    lines: Math.max(-cap, Math.min(cap, lines)),
    carried: amount - lines,
  };
}

/** One SGR wheel report at a 1-based cell. */
export function wheelReport(up: boolean, col: number, row: number) {
  return `\x1b[<${up ? 64 : 65};${col};${row}M`;
}
