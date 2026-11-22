// The allocation rule of round 3, kept free of the DOM so the page, the
// allocation chart and check.mjs all run the same function, and so an
// implementation can follow it line by line.
//
// Jari 22.11.2026 on round 2: each list has a lower bound (below it the list
// is impractical) and an "enough" bound (beyond it more rows add little).
// Room goes first to both lists' minimum, then to both lists' "enough",
// then to the place buttons (icons → tiles → rows), and once those are at
// full size, to both lists in a ratio. In effect each area has a marginal
// utility, and each extra pixel goes where it is worth most.
//
// The rule, in full:
//  1. Measure the constants (Consts): the rail's height outside the head
//     and the two lists' regions, the head's height at each step, and for
//     each list its fixed overhead (headings, filter), its row pitch and its
//     row count.
//  2. For each head step s (0 icons, 1 tiles, 2 rows): the room for rows is
//     H − fixed − head[s] − both overheads. Fill it row by row: the next row
//     goes to the list whose next row is worth most per pixel (value(r) /
//     pitch), while a row still fits and the list has rows left.
//  3. Take the largest step at which, after filling, neither list's next
//     row is worth more per pixel than a head pixel (button / conversation
//     pitch), or the list shows every row. Step 0 always qualifies. (Taking
//     the step with the largest total value instead flickers between steps
//     over a range of heights, since rows come whole; this test is
//     monotonic in the height, so the head only grows as the window does.)
//     A list that will show fewer than all its rows also pays for its edge
//     chip ("↓ Hiljaiset 8", "↓ 8 työtilaa"), which covers the edge row.
//  4. Leftover pixels, less than a row, go to the conversation region if it
//     has rows out of sight, else to Työtilat, else stay empty below.
//
// The value of a list's (r+1)th row, in "rows at the minimum" (1 = a row of
// a list that has just reached its "enough" bound in "knees"):
//  knees (A, C):  below min 3…4, between min and enough 1.5…2, past enough
//                 1 / (1 + (r − enough) / weight), where the conversation
//                 list's weight is the ratio and Työtilat's 1, so past
//                 "enough" the two grow in that ratio. Within each band the
//                 value falls linearly, so a shortage is shared in
//                 proportion to the bands.
//  soft (B):      2 · 2^(−(r − min) / (enough − min)): halves across each
//                 list's band, no corners.
//  Either: 0 once the list has no more rows.
//  priority "conv" (B): below its minimum a conversation row is worth 5…6,
//                 so the conversation list reaches its minimum first, except
//                 that Työtilat's first FLOOR rows are worth 7.
// The buttons' value per pixel (default 1.25) sits between the knees'
// bands: below the 1.5 of min…enough and above the 1 of past-enough, which
// is what puts the buttons after "enough" and before the ratio.

export type Bounds = { min: number; enough: number };
export type Shape = "knees" | "soft";
/** Who gives way while both minimums do not fit: share (both lists short by
 * the same fraction of their minimum) or conv (the conversation list
 * reaches its minimum first; Työtilat keeps a floor of FLOOR rows). */
export type Priority = "share" | "conv";
/** Työtilat's floor under "conv": production's 11rem, about three rows. */
export const FLOOR = 3;
export type Params = {
  shape: Shape;
  priority: Priority;
  conv: Bounds;
  ws: Bounds;
  /** Past "enough", conversation rows per Työtilat row (knees). */
  ratio: number;
  /** A bigger head's value per pixel, in conversation-row units. */
  button: number;
};
/** over: px the list takes with no rows (headings, filter); pitch: one
 * row and its gap; n: rows it has; cue: px its edge chip covers while it
 * shows fewer than all rows. */
export type ListConsts = { over: number; pitch: number; n: number; cue: number };
export type Consts = {
  /** Rail px that are neither the head's destinations nor the two lists. */
  fixed: number;
  /** The head's height at each step. */
  head: [number, number, number];
  conv: ListConsts;
  ws: ListConsts;
};
export type Step = 0 | 1 | 2;
export type Alloc = {
  step: Step;
  conv: number;
  ws: number;
  /** Region heights to set: overhead + rows + leftover. */
  convPx: number;
  wsPx: number;
  /** Empty px below Työtilat (both lists show everything). */
  spare: number;
  worth: number;
  /** The rule's band for each list: 0 below min, 1 to enough, 2 past. */
  band: { conv: 0 | 1 | 2; ws: 0 | 1 | 2 };
};

export function value(p: Params, b: Bounds, r: number, n: number, weight: number, list: "conv" | "ws"): number {
  if (r >= n) return 0;
  const min = Math.max(1, b.min);
  const enough = Math.max(min + 1, b.enough);
  if (p.priority === "conv" && r < min) {
    if (list === "conv") return 5 + (1 - r / min);
    if (r < Math.min(FLOOR, min)) return 7;
  }
  if (p.shape === "soft") return 2 * 2 ** (-(r - min) / (enough - min));
  if (r < min) return 3 + (1 - r / min);
  if (r < enough) return 1.5 + 0.5 * (1 - (r - min) / (enough - min));
  return 1 / (1 + (r - enough) / weight);
}

const band = (b: Bounds, r: number, n: number): 0 | 1 | 2 =>
  r >= Math.min(b.enough, n) ? 2 : r >= Math.min(b.min, n) ? 1 : 0;

/** Fill a room of px with rows, the next row to the list worth most per px. */
function fill(p: Params, c: Consts, room: number) {
  let conv = 0;
  let ws = 0;
  let worth = 0;
  for (;;) {
    const vc = c.conv.pitch <= room ? value(p, p.conv, conv, c.conv.n, p.ratio, "conv") / c.conv.pitch : 0;
    const vw = c.ws.pitch <= room ? value(p, p.ws, ws, c.ws.n, 1, "ws") / c.ws.pitch : 0;
    if (vc <= 0 && vw <= 0) break;
    if (vc >= vw) {
      worth += vc * c.conv.pitch;
      room -= c.conv.pitch;
      conv++;
    } else {
      worth += vw * c.ws.pitch;
      room -= c.ws.pitch;
      ws++;
    }
  }
  return { conv, ws, worth, left: room, convCue: 0, wsCue: 0 };
}

export function allocate(p: Params, c: Consts, h: number): Alloc {
  let best: (ReturnType<typeof fill> & { step: Step; total: number; room: number }) | undefined;
  const bar = p.button / c.conv.pitch;
  for (const step of [0, 1, 2] as Step[]) {
    const room = Math.max(0, h - c.fixed - c.head[step] - c.conv.over - c.ws.over);
    // A list that will scroll pays for its edge chip. Reserve both, then
    // give back the chip of a list that turns out to show every row.
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
    f = { ...f, convCue: f.conv < c.conv.n ? c.conv.cue : 0, wsCue: f.ws < c.ws.n ? c.ws.cue : 0, left: f.left + (cueC + cueW) - ((f.conv < c.conv.n ? c.conv.cue : 0) + (f.ws < c.ws.n ? c.ws.cue : 0)) };
    const total = f.worth + (p.button * (c.head[step] - c.head[0])) / c.conv.pitch;
    const nextC = value(p, p.conv, f.conv, c.conv.n, p.ratio, "conv") / c.conv.pitch;
    const nextW = value(p, p.ws, f.ws, c.ws.n, 1, "ws") / c.ws.pitch;
    if (!best || (nextC <= bar + 1e-9 && nextW <= bar + 1e-9)) best = { ...f, step, total, room };
  }
  const b = best!;
  let convPx = c.conv.over + b.conv * c.conv.pitch + b.convCue;
  let wsPx = c.ws.over + b.ws * c.ws.pitch + b.wsCue;
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
    worth: b.total,
    band: { conv: band(p.conv, b.conv, c.conv.n), ws: band(p.ws, b.ws, c.ws.n) },
  };
}

/** The heights (from lo to hi) at which the step changes. */
export function stepChanges(p: Params, c: Consts, lo: number, hi: number): { h: number; step: Step }[] {
  const out: { h: number; step: Step }[] = [];
  let last = allocate(p, c, lo).step;
  for (let h = lo + 1; h <= hi; h++) {
    const s = allocate(p, c, h).step;
    if (s !== last) out.push({ h, step: s });
    last = s;
  }
  return out;
}
