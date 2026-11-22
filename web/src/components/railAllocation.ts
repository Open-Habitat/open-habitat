// The adaptive rail's allocation rule (adaptive-rail, experimental; the
// rail-space round 3 rule, Jari 22.11.2026: C Leveämpi with B's logic). Pure
// and free of the DOM: AdaptiveRail.tsx measures the rail into Consts and
// sets the result as the regions' heights.
//
// Each list has a minimum (below it the list is awkward) and an "enough"
// bound (beyond it more rows add little). Room goes first to the minimums,
// then to both lists' "enough", then to the place buttons (icons → tiles →
// rows), and once those are at full size, to both lists in a ratio. While
// both minimums do not fit, the conversation list keeps its full minimum and
// Työtilat gives way, down to a floor of FLOOR rows.
//
//  1. Consts: the rail's height outside the head and the two lists'
//     regions, the head's height at each step, and per list its fixed
//     overhead (headings, filter), its row pitch, its row count and the
//     height of its edge chip. None depends on the allocation, so the
//     measurement never feeds back into itself.
//  2. For each head step s: the room for rows is H − fixed − head[s] − both
//     overheads. Fill it row by row: the next row goes to the list whose
//     next row is worth most per pixel, while a row still fits and the list
//     has rows left. A list that shows fewer than all its rows also pays for
//     its edge chip, which covers its edge row.
//  3. Take the largest step at which, after filling, neither list's next
//     row is worth more per pixel than a head pixel, or the list shows every
//     row. Step 0 always qualifies. The test is monotonic in the height, so
//     the head only grows as the window does (the largest total value
//     flickered between steps, since rows come whole).
//  4. Leftover pixels, less than a row, go to the conversation region if it
//     has rows out of sight, else to Työtilat, else stay empty below.

export type Bounds = { min: number; enough: number };
/** Who gives way while both minimums do not fit: "share" (both lists short
 * by the same fraction of their minimum) or "conv" (the conversation list
 * reaches its minimum first; Työtilat keeps FLOOR rows). */
export type Priority = "share" | "conv";
export type Params = {
  priority: Priority;
  conv: Bounds;
  ws: Bounds;
  /** Past "enough", conversation rows per Työtilat row. */
  ratio: number;
  /** A bigger head's value per pixel, in conversation-row units. It sits
   * between the bands (below min…enough's 1.5, above past-enough's 1),
   * which puts the buttons after "enough" and before the ratio. */
  button: number;
};
/** over: px the list takes with no rows (headings, filter); pitch: one row
 * and its gap; n: rows it has; cue: px its edge chip covers while it shows
 * fewer than all rows. */
export type ListConsts = {
  over: number;
  pitch: number;
  n: number;
  cue: number;
};
export type Step = 0 | 1 | 2;
export type Consts = {
  /** Rail px that are neither the head nor the two lists' regions. */
  fixed: number;
  /** The head's height at each step (0 icons, 1 tiles, 2 rows). */
  head: readonly [number, number, number];
  conv: ListConsts;
  ws: ListConsts;
};
/** The rule's band for a list: 0 below its minimum, 1 up to enough, 2 at
 * enough or showing every row. */
export type Band = 0 | 1 | 2;
export type Alloc = {
  step: Step;
  /** Rows the rule gives each list. */
  conv: number;
  ws: number;
  /** The regions' heights: overhead + rows + edge chip + leftover. */
  convPx: number;
  wsPx: number;
  /** Empty px below Työtilat (both lists show everything). */
  spare: number;
  band: { conv: Band; ws: Band };
};

/** Työtilat's floor under "conv": the fixed rail's 11rem, about three rows. */
export const FLOOR = 3;

/** The accepted defaults (round 3's table, Jari 22.11.2026): conversations
 * 7 / 14 rows, Työtilat 6 / 10 (Jari's own example), 2 : 1 past enough, a
 * head pixel worth 1.25, and the conversations first while short. */
export const ADAPTIVE_RAIL: Params = {
  priority: "conv",
  conv: { min: 7, enough: 14 },
  ws: { min: 6, enough: 10 },
  ratio: 2,
  button: 1.25,
};

/** The value of a list's (r+1)th row when it has n, in rows of a list that
 * has just reached its "enough": 3…4 below the minimum, 1.5…2 up to enough,
 * then 1 / (1 + (r − enough) / weight), falling linearly within each band so
 * a shortage is shared in proportion to the bands. Under "conv" a
 * conversation row below its minimum is worth 5…6, except that Työtilat's
 * first FLOOR rows are worth 7. Nothing once the rows run out. */
export function rowValue(
  p: Params,
  list: "conv" | "ws",
  r: number,
  n: number,
): number {
  if (r >= n) return 0;
  const b = p[list];
  const min = Math.max(1, b.min);
  const enough = Math.max(min + 1, b.enough);
  if (p.priority === "conv" && r < min) {
    if (list === "conv") return 5 + (1 - r / min);
    if (r < Math.min(FLOOR, min)) return 7;
  }
  if (r < min) return 3 + (1 - r / min);
  if (r < enough) return 1.5 + 0.5 * (1 - (r - min) / (enough - min));
  return 1 / (1 + (r - enough) / (list === "conv" ? p.ratio : 1));
}

const bandOf = (b: Bounds, r: number, n: number): Band =>
  r >= Math.min(b.enough, n) ? 2 : r >= Math.min(b.min, n) ? 1 : 0;

/** Fills room px with rows, the next to the list worth most per pixel. */
function fill(p: Params, c: Consts, room: number) {
  let conv = 0;
  let ws = 0;
  let left = room;
  for (;;) {
    const vc =
      c.conv.pitch <= left
        ? rowValue(p, "conv", conv, c.conv.n) / c.conv.pitch
        : 0;
    const vw =
      c.ws.pitch <= left ? rowValue(p, "ws", ws, c.ws.n) / c.ws.pitch : 0;
    if (vc <= 0 && vw <= 0) break;
    if (vc >= vw) {
      left -= c.conv.pitch;
      conv++;
    } else {
      left -= c.ws.pitch;
      ws++;
    }
  }
  return { conv, ws, left };
}

/** The rule for a rail h px high. */
export function allocate(p: Params, c: Consts, h: number): Alloc {
  const bar = p.button / c.conv.pitch + 1e-9;
  let best: { step: Step; conv: number; ws: number; left: number } | undefined;
  for (const step of [0, 1, 2] as const) {
    const room = Math.max(
      0,
      h - c.fixed - c.head[step] - c.conv.over - c.ws.over,
    );
    // Reserve both edge chips, then give back the chip of a list that turns
    // out to show every row, and fill again.
    let cueC = c.conv.cue;
    let cueW = c.ws.cue;
    let f = fill(p, c, Math.max(0, room - cueC - cueW));
    for (let i = 0; i < 2; i++) {
      const nc = f.conv >= c.conv.n ? 0 : c.conv.cue;
      const nw = f.ws >= c.ws.n ? 0 : c.ws.cue;
      if (nc === cueC && nw === cueW) break;
      cueC = nc;
      cueW = nw;
      f = fill(p, c, Math.max(0, room - cueC - cueW));
    }
    // What is left once the chips the result actually needs are paid.
    const paid =
      (f.conv < c.conv.n ? c.conv.cue : 0) + (f.ws < c.ws.n ? c.ws.cue : 0);
    const left = f.left + cueC + cueW - paid;
    const nextC = rowValue(p, "conv", f.conv, c.conv.n) / c.conv.pitch;
    const nextW = rowValue(p, "ws", f.ws, c.ws.n) / c.ws.pitch;
    if (!best || (nextC <= bar && nextW <= bar))
      best = { step, conv: f.conv, ws: f.ws, left };
  }
  const b = best as NonNullable<typeof best>;
  let convPx =
    c.conv.over + b.conv * c.conv.pitch + (b.conv < c.conv.n ? c.conv.cue : 0);
  let wsPx = c.ws.over + b.ws * c.ws.pitch + (b.ws < c.ws.n ? c.ws.cue : 0);
  let spare = b.left;
  if (b.conv < c.conv.n) {
    convPx += spare;
    spare = 0;
  } else if (b.ws < c.ws.n) {
    wsPx += spare;
    spare = 0;
  }
  return {
    step: b.step,
    conv: b.conv,
    ws: b.ws,
    convPx,
    wsPx,
    spare,
    band: {
      conv: bandOf(p.conv, b.conv, c.conv.n),
      ws: bandOf(p.ws, b.ws, c.ws.n),
    },
  };
}
