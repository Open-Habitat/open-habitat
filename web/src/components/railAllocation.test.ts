import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_RAIL,
  allocate,
  type Consts,
  FLOOR,
  type Params,
  rowValue,
  type Step,
} from "./railAllocation";

// The rail-space round 3 measurement, replayed. The constants are what the
// round's page measured from the production rail at 1280 px wide (296 px
// rail for A and B, 356 px for C), in its three worlds: ordinary (4 / 2 / 12
// conversations, 18 workspaces), little content (3 / 0 / 5, 6) and crowded
// (6 / 4 / 30, 40). The expected allocations are what the round's own
// allocate() gave on that page (its data-alloc), and `seen` is the rows
// its check counted wholly in sight (result.md's table, rows.json). C+B
// is the accepted direction: C's constants under B's priority, which the
// round's page gives with the bounds drawer's "keskustelut ensin".

type World = "ordinary" | "like" | "crowded";
const LISTS: Record<World, Pick<Consts, "conv" | "ws">> = {
  ordinary: {
    conv: { over: 128.546875, pitch: 33, n: 18, cue: 26 },
    ws: { over: 76, pitch: 31, n: 18, cue: 22 },
  },
  like: {
    conv: { over: 113.515625, pitch: 33, n: 8, cue: 26 },
    ws: { over: 40, pitch: 31, n: 6, cue: 22 },
  },
  crowded: {
    conv: { over: 143.578125, pitch: 33, n: 40, cue: 26 },
    ws: { over: 76, pitch: 31, n: 40, cue: 22 },
  },
};
/** The rail's fixed part, which the page measured one px lower at the
 * tallest heights (sub-pixel rounding of the regions). */
const fixedAt = (world: World, h: number) =>
  h >= 1440 || (world === "like" && h >= 1080) ? 134 : 135;

/** C, the wider rail: the filter sits on Työtilat's heading row (its
 * overhead loses the filter's row) and the tiles fit one row. */
function consts(world: World, wide: boolean, h: number): Consts {
  const lists = LISTS[world];
  return {
    fixed: fixedAt(world, h),
    head: wide ? [34, 106, 186] : [34, 130, 186],
    conv: lists.conv,
    ws: wide && world !== "like" ? { ...lists.ws, over: 40 } : lists.ws,
  };
}

const share: Params = { ...ADAPTIVE_RAIL, priority: "share" };
const DIRECTIONS = {
  A: { p: share, wide: false },
  B: { p: ADAPTIVE_RAIL, wide: false },
  C: { p: share, wide: true },
  "C+B": { p: ADAPTIVE_RAIL, wide: true },
} as const;
type Direction = keyof typeof DIRECTIONS;

/** [height, world, step, conv, ws, seen conv, seen ws] per direction. */
type Row = [number, World, Step, number, number, number?, number?];
const TABLE: Record<Direction, Row[]> = {
  A: [
    [720, "ordinary", 0, 4, 5, 6, 5],
    [800, "ordinary", 0, 5, 6, 6, 6],
    [900, "ordinary", 0, 7, 7, 8, 7],
    [1080, "ordinary", 0, 11, 9, 11, 9],
    [1440, "ordinary", 2, 15, 12, 15, 12],
    [720, "like", 0, 5, 5, 5, 5],
    [800, "like", 0, 8, 6, 8, 6],
    [900, "like", 1, 8, 6, 8, 6],
    [1080, "like", 2, 8, 6, 8, 6],
    [1440, "like", 2, 8, 6, 8, 6],
    [720, "crowded", 0, 4, 4, 7, 4],
    [800, "crowded", 0, 5, 6, 7, 6],
    [900, "crowded", 0, 7, 7, 9, 7],
    [1080, "crowded", 0, 11, 9, 11, 9],
    [1440, "crowded", 2, 15, 11, 16, 11],
  ],
  B: [
    [720, "ordinary", 0, 6, 3, 6, 3],
    [800, "ordinary", 0, 7, 4, 8, 4],
    [900, "ordinary", 0, 7, 7, 8, 7],
    [1080, "ordinary", 0, 11, 9, 11, 9],
    [1440, "ordinary", 2, 15, 12, 15, 12],
    [720, "like", 0, 7, 3, 7, 3],
    [800, "like", 0, 8, 6, 8, 5],
    [900, "like", 1, 8, 6, 8, 6],
    [1080, "like", 2, 8, 6, 8, 6],
    [1440, "like", 2, 8, 6, 8, 6],
    [720, "crowded", 0, 5, 3, 7, 3],
    [800, "crowded", 0, 7, 4, 9, 4],
    [900, "crowded", 0, 7, 7, 9, 7],
    [1080, "crowded", 0, 11, 9, 11, 9],
    [1440, "crowded", 2, 15, 11, 16, 11],
  ],
  C: [
    [720, "ordinary", 0, 5, 5, 6, 5],
    [800, "ordinary", 0, 6, 6, 7, 6],
    [900, "ordinary", 0, 8, 8, 8, 8],
    [1080, "ordinary", 0, 11, 10, 11, 10],
    [1440, "ordinary", 2, 16, 12, 16, 12],
    [720, "like", 0, 5, 5, 5, 5],
    [800, "like", 0, 8, 6, 8, 6],
    [900, "like", 1, 8, 6, 8, 6],
    [1080, "like", 2, 8, 6, 8, 6],
    [1440, "like", 2, 8, 6, 8, 6],
    [720, "crowded", 0, 4, 6, 7, 6],
    [800, "crowded", 0, 6, 6, 8, 6],
    [900, "crowded", 0, 8, 7, 10, 7],
    [1080, "crowded", 0, 11, 10, 11, 10],
    [1440, "crowded", 2, 16, 11, 17, 11],
  ],
  "C+B": [
    [720, "ordinary", 0, 7, 3],
    [800, "ordinary", 0, 7, 5],
    [900, "ordinary", 0, 8, 8],
    [1080, "ordinary", 0, 11, 10],
    [1440, "ordinary", 2, 16, 12],
    [720, "like", 0, 7, 3],
    [800, "like", 0, 8, 6],
    [900, "like", 1, 8, 6],
    [1080, "like", 2, 8, 6],
    [1440, "like", 2, 8, 6],
    [720, "crowded", 0, 6, 3],
    [800, "crowded", 0, 7, 5],
    [900, "crowded", 0, 8, 7],
    [1080, "crowded", 0, 11, 10],
    [1440, "crowded", 2, 16, 11],
  ],
};

describe("the round 3 measurement table", () => {
  for (const [direction, rows] of Object.entries(TABLE) as [Direction, Row[]][])
    for (const [h, world, step, conv, ws, seenConv, seenWs] of rows)
      it(`${direction}, ${world} at ${h} px`, () => {
        const { p, wide } = DIRECTIONS[direction];
        const a = allocate(p, consts(world, wide, h), h);
        expect({ step: a.step, conv: a.conv, ws: a.ws }).toEqual({
          step,
          conv,
          ws,
        });
        // What the round's check saw on screen agrees with the rule: the
        // conversations' count is a floor (it pays for every heading, and
        // a list scrolled to the open row hides some), Työtilat's exact.
        if (seenConv !== undefined && seenWs !== undefined) {
          expect(seenConv).toBeGreaterThanOrEqual(a.conv - 1);
          expect(seenConv).toBeLessThanOrEqual(a.conv + 3);
          expect(Math.abs(seenWs - a.ws)).toBeLessThanOrEqual(1);
        }
      });
});

/** The heights from lo to hi at which the step changes. */
function changes(p: Params, world: World, wide: boolean) {
  const out: [number, Step][] = [];
  let last = allocate(p, consts(world, wide, 600), 600).step;
  for (let h = 601; h <= 1600; h++) {
    const s = allocate(p, consts(world, wide, h), h).step;
    if (s !== last) out.push([h, s]);
    last = s;
  }
  return out;
}

describe("where the step changes", () => {
  // result.md, "Missä askel vaihtuu": A and B / C, tiles / rows. The
  // little-content row there is 28 px later than the round's own page
  // computes from the constants it measures (its 900 px allocation is
  // tiles, as here and in the table above), so these are the page's.
  const where: [World, boolean, number, number][] = [
    ["ordinary", false, 1290, 1346],
    ["like", false, 895, 951],
    ["crowded", false, 1305, 1361],
    ["ordinary", true, 1230, 1310],
    ["like", true, 871, 951],
    ["crowded", true, 1245, 1325],
  ];
  for (const [world, wide, tiles, rows] of where)
    it(`${wide ? "C" : "A and B"}, ${world}: tiles at ${tiles}, rows at ${rows}`, () => {
      for (const p of [share, ADAPTIVE_RAIL]) {
        const seen = changes(p, world, wide);
        // Only ever upwards, once each: the head grows with the window.
        expect(seen.map(([, s]) => s)).toEqual([1, 2]);
        expect(Math.abs(seen[0][0] - tiles)).toBeLessThanOrEqual(1);
        expect(Math.abs(seen[1][0] - rows)).toBeLessThanOrEqual(1);
      }
    });
});

describe("the accepted rule (C+B)", () => {
  const c = consts("ordinary", true, 720);
  it("keeps the conversations' minimum while both do not fit, and Työtilat its floor", () => {
    for (let h = 640; h <= 820; h += 10) {
      const a = allocate(ADAPTIVE_RAIL, c, h);
      expect(a.ws).toBeGreaterThanOrEqual(FLOOR);
      // Työtilat gets a row beyond its floor only once the conversations
      // are at their minimum.
      if (a.ws > FLOOR) expect(a.conv).toBeGreaterThanOrEqual(7);
    }
  });
  it("never grows the head before both lists reach enough or show everything", () => {
    for (const world of ["ordinary", "like", "crowded"] as const)
      for (let h = 600; h <= 1600; h += 7) {
        const k = consts(world, true, h);
        const a = allocate(ADAPTIVE_RAIL, k, h);
        if (a.step === 0) continue;
        expect(a.conv).toBeGreaterThanOrEqual(Math.min(14, k.conv.n));
        expect(a.ws).toBeGreaterThanOrEqual(Math.min(10, k.ws.n));
      }
  });
  it("fills the rail exactly: the regions and what is left add up to the room", () => {
    for (const world of ["ordinary", "like", "crowded"] as const)
      for (let h = 600; h <= 1600; h += 13) {
        const k = consts(world, true, h);
        const a = allocate(ADAPTIVE_RAIL, k, h);
        const used = k.fixed + k.head[a.step] + a.convPx + a.wsPx + a.spare;
        expect(used).toBeCloseTo(h, 6);
        // The leftover is less than a row and lands where rows hide.
        expect(a.spare).toBeGreaterThanOrEqual(0);
        if (a.conv < k.conv.n || a.ws < k.ws.n) expect(a.spare).toBe(0);
      }
  });
  it("pays an edge chip only for a list that does not show everything", () => {
    const k = consts("like", true, 1440);
    const a = allocate(ADAPTIVE_RAIL, k, 1440);
    expect([a.conv, a.ws]).toEqual([k.conv.n, k.ws.n]);
    expect(a.convPx).toBe(k.conv.over + k.conv.n * k.conv.pitch);
    expect(a.wsPx).toBe(k.ws.over + k.ws.n * k.ws.pitch);
    expect(a.spare).toBeGreaterThan(0);
    const short = allocate(ADAPTIVE_RAIL, consts("crowded", true, 720), 720);
    expect(short.wsPx).toBe(40 + short.ws * 31 + 22);
  });
  it("frees a folded section's room for Työtilat", () => {
    // Hiljaiset folded: its rows are not drawn, so the list has fewer.
    const open = allocate(ADAPTIVE_RAIL, c, 900);
    const folded = allocate(
      ADAPTIVE_RAIL,
      { ...c, conv: { ...c.conv, n: 6, over: c.conv.over - 20 } },
      900,
    );
    expect(folded.conv).toBe(6);
    expect(folded.ws).toBeGreaterThan(open.ws);
  });
  it("survives a rail too short for anything, and lists with no rows", () => {
    const a = allocate(ADAPTIVE_RAIL, c, 100);
    expect([a.step, a.conv, a.ws]).toEqual([0, 0, 0]);
    const empty = allocate(
      ADAPTIVE_RAIL,
      {
        ...c,
        conv: { ...c.conv, n: 0 },
        ws: { over: 0, pitch: 31, n: 0, cue: 22 },
      },
      900,
    );
    expect([empty.conv, empty.ws, empty.step]).toEqual([0, 0, 2]);
    expect(empty.wsPx).toBe(0);
  });
});

describe("a row's value", () => {
  it("falls through the bands, and is nothing once the rows run out", () => {
    const v = (r: number) => rowValue(ADAPTIVE_RAIL, "ws", r, 40);
    for (let r = 1; r < 30; r++) expect(v(r)).toBeLessThanOrEqual(v(r - 1));
    expect(rowValue(ADAPTIVE_RAIL, "ws", 5, 5)).toBe(0);
    // Past enough the conversations' value halves twice as slowly (2 : 1).
    expect(rowValue(share, "conv", 14 + 2, 40)).toBeCloseTo(
      rowValue(share, "ws", 10 + 1, 40),
    );
  });
  it("puts the head between the bands", () => {
    const head = ADAPTIVE_RAIL.button;
    expect(rowValue(share, "conv", 13, 40)).toBeGreaterThan(head);
    expect(rowValue(share, "conv", 14, 40)).toBeLessThan(head);
  });
});
