import type { ReactNode } from "react";
import type { SoundId, Strike } from "../app/soundSynth";
import "./SoundEmblem.css";

// Each attention sound's emblem: B Väreilyn muoto (Jari 21.11.2026), no
// picture, the rings' own geometry says the object. The variants are those
// Jari chose in emblem round 7: Kalimba Koko soitin, Marimba Laatat,
// Vibrafoni Värinä, Lasit Lasin reuna, Kulho Huojunta, Jääpuikot Helähdys;
// Tunnus puu, Pisara, Tuulikello and Kuplat as round 6 drew them. Drawn in
// a 64-unit box around the centre, readable at tile size and at 32 px; while
// the sound plays each strike spreads from its own origin in that origin's
// shape.

/** Where a strike's ripple starts and the shape it spreads in (`rot` in degrees). */
type Origin = { x: number; y: number; d: string; rot?: number };
type Emblem = { still: ReactNode; origins: Origin[] };

const f = (v: number) => +v.toFixed(2);
const circle = (r: number, x = 0, y = 0) =>
  `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ellipse = (rx: number, ry: number, x = 0, y = 0) =>
  `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
/** A horizontal stadium (a bar's outline) w × h centred on (x, y). */
const stadium = (w: number, h: number, x = 0, y = 0) => {
  const r = h / 2;
  const s = w / 2 - r;
  return `M${f(x - s)} ${f(y - r)}H${f(x + s)}a${f(r)} ${f(r)} 0 0 1 0 ${f(h)}H${f(x - s)}a${f(r)} ${f(r)} 0 0 1 0 ${f(-h)}Z`;
};
/** A vertical stadium (a tine) w × h centred on (x, y). */
const vstadium = (w: number, h: number, x = 0, y = 0) => {
  const r = w / 2;
  const s = h / 2 - r;
  return `M${f(x - r)} ${f(y + s)}V${f(y - s)}a${f(r)} ${f(r)} 0 0 1 ${f(w)} 0V${f(y + s)}a${f(r)} ${f(r)} 0 0 1 ${f(-w)} 0Z`;
};
const roundRect = (w: number, h: number, r: number) =>
  `M${f(-w / 2 + r)} ${f(-h / 2)}H${f(w / 2 - r)}q${r} 0 ${r} ${r}V${f(h / 2 - r)}q0 ${r} ${-r} ${r}H${f(-w / 2 + r)}q${-r} 0 ${-r} ${-r}V${f(-h / 2 + r)}q0 ${-r} ${r} ${-r}Z`;
const hexagon = (r: number, x = 0, y = 0, rot = 0) =>
  `${Array.from({ length: 6 }, (_, k) => {
    const a = -Math.PI / 2 + rot + (k * Math.PI) / 3;
    return `${k ? "L" : "M"}${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`;
  }).join("")}Z`;
const arch = (r: number, x: number, y: number) =>
  `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 0 1 ${f(2 * r)} 0`;
/** A closed curve r(θ) = R·g(θ). */
const polar = (R: number, g: (th: number) => number, steps = 120) =>
  `${Array.from({ length: steps }, (_, k) => {
    const th = (k / steps) * 2 * Math.PI;
    const r = R * g(th);
    return `${k ? "L" : "M"}${f(r * Math.cos(th))} ${f(r * Math.sin(th))}`;
  }).join("")}Z`;

const P = (
  d: string,
  cls = "se-ring",
  key?: string | number,
  rule?: "evenodd",
) => <path key={key} className={cls} d={d} fillRule={rule} />;
const Dot = ({
  x = 0,
  y = 0,
  r = 2.6,
}: {
  x?: number;
  y?: number;
  r?: number;
}) => <circle className="se-dot" cx={x} cy={y} r={r} />;

const emblems: Record<SoundId, () => Emblem> = {
  // Koko soitin: five tines in a V on the box, the three that sound strong.
  kalimba: () => {
    const x = [-16, -8, 0, 8, 16];
    const len = [20, 27, 34, 27, 20];
    const top = (k: number) => 12 - len[k];
    return {
      still: (
        <>
          <g transform="translate(0 19)">
            {P(roundRect(46, 14, 5), "se-ring se-soft")}
          </g>
          {x.map((cx, k) =>
            P(
              vstadium(5, len[k], cx, top(k) + len[k] / 2),
              k === 0 || k === 4 ? "se-ring se-soft" : "se-ring se-strong",
              k,
            ),
          )}
          <Dot y={19} r={2.4} />
        </>
      ),
      origins: [1, 2, 3].map((k) => ({
        x: x[k],
        y: top(k) + len[k] / 2,
        d: vstadium(16, len[k] + 12),
      })),
    };
  },
  // Laatat: three wooden bars graded by length, E5 G5 C6.
  marimba: () => {
    const b: [number, number][] = [
      [46, 13],
      [36, 0],
      [26, -13],
    ];
    return {
      still: (
        <>
          {b.map(([wd, y]) => (
            <g key={y}>
              {P(stadium(wd, 8, 0, y))}
              <Dot x={-wd / 2 + 6} y={y} r={1.6} />
            </g>
          ))}
        </>
      ),
      origins: b.map(([wd, y]) => ({ x: 0, y, d: stadium(wd + 14, 20) })),
    };
  },
  // Värinä: the middle ring undulates like the vibrato's pitch.
  vibrafoni: () => ({
    still: (
      <>
        {P(circle(9))}
        {P(
          polar(17, (th) => 1 + 0.04 * Math.sin(9 * th)),
          "se-ring se-strong",
        )}
        {P(circle(25), "se-ring se-soft")}
        <Dot r={3} />
      </>
    ),
    origins: [
      { x: 0, y: 0, d: polar(30, (th) => 1 + 0.04 * Math.sin(9 * th)) },
    ],
  }),
  // The Habitat mark built from ring arches and a sun.
  "tunnus-puu": () => ({
    still: (
      <>
        {P(arch(7, -7, 9))}
        {P(arch(13, -7, 9), "se-ring se-soft")}
        {P(arch(7, 7, 9))}
        {P(arch(13, 7, 9), "se-ring se-soft")}
        {P(circle(5.5, 0, -14))}
        <Dot y={-14} r={2.4} />
      </>
    ),
    origins: [
      { x: -7, y: 9, d: circle(14) },
      { x: 7, y: 9, d: circle(14) },
      { x: 0, y: -14, d: circle(10) },
    ],
  }),
  // Oval water rings below a falling drop.
  pisara: () => ({
    still: (
      <>
        {P(ellipse(8, 2.6, 0, 10))}
        {P(ellipse(16, 5.2, 0, 10))}
        {P(ellipse(25, 8.2, 0, 10), "se-ring se-soft")}
        {P(
          "M0 -12.5C1.6 -10 3 -8.3 3 -6.5a3 3 0 0 1 -6 0C-3 -8.3 -1.6 -10 0 -12.5Z",
          "se-dot",
        )}
      </>
    ),
    origins: [{ x: 0, y: 10, d: ellipse(30, 10) }],
  }),
  // Lasin reuna: two glass mouths at an angle, leaning together.
  lasit: () => ({
    still: (
      <>
        {(
          [
            [-10, 25],
            [10, -25],
          ] as const
        ).map(([x, a]) => (
          <g key={x} transform={`translate(${x} 0) rotate(${a})`}>
            {P(ellipse(10, 4.5))}
            {P(ellipse(16, 7.5), "se-ring se-soft")}
          </g>
        ))}
        <Dot r={2} />
      </>
    ),
    origins: [
      { x: -10, y: 0, d: ellipse(22, 10), rot: 25 },
      { x: 10, y: 0, d: ellipse(22, 10), rot: -25 },
    ],
  }),
  // Five small rings on a swinging arc.
  tuulikello: () => {
    const c = [-2, -1, 0, 1, 2].map((k) => [k * 9.5, 8 - k * k * 2.2]);
    return {
      still: (
        <>
          {P("M-22 -12Q0 -2 22 -12", "se-ring se-soft")}
          {c.map(([x, y]) => (
            <g key={x}>
              {P(circle(5.4, x, y))}
              <Dot x={x} y={y} r={1.9} />
            </g>
          ))}
        </>
      ),
      origins: c.map(([x, y]) => ({ x, y, d: circle(11) })),
    };
  },
  // Free circles shrinking upward.
  kuplat: () => {
    const c: [number, number, number][] = [
      [-9, 13, 7.5],
      [7, 5, 5.2],
      [-4, -6, 3.8],
      [8, -14, 2.6],
      [-10, -19, 1.7],
    ];
    return {
      still: (
        <>
          {c.map(([x, y, r]) => P(circle(r, x, y), "se-ring", `${x},${y}`))}
          {P("M-13.5 11a5 5 0 0 1 3 -3.6", "se-line")}
        </>
      ),
      origins: c.map(([x, y, r]) => ({ x, y, d: circle(r + 8) })),
    };
  },
  // Huojunta: one heavy ring that thickens and thins, the slow beating.
  kulho: () => {
    const outer = polar(21, (th) => 1 + 0.11 * Math.cos(2 * th) + 0.02);
    return {
      still: (
        <>
          {P(`${outer}${circle(15.5)}`, "se-fill", undefined, "evenodd")}
          {P(circle(27), "se-ring se-soft se-dash")}
          <Dot r={3.2} />
        </>
      ),
      origins: [
        { x: 0, y: 0, d: polar(30, (th) => 1 + 0.1 * Math.cos(2 * th)) },
      ],
    };
  },
  // Helähdys: three taps descend, each small hexagon lower than the last.
  jaapuikot: () => {
    const c: [number, number][] = [
      [-14, -11],
      [0, 0],
      [14, 11],
    ];
    return {
      still: (
        <>
          {c.map(([x, y]) => (
            <g key={x}>
              {P(hexagon(5, x, y))}
              {P(hexagon(9.5, x, y), "se-ring se-soft")}
              <Dot x={x} y={y} r={1.8} />
            </g>
          ))}
        </>
      ),
      origins: c.map(([x, y]) => ({ x, y, d: hexagon(15) })),
    };
  },
};

/** The emblem of a sound. `play` is the strikes of the length playing, with
 * a key that restarts the ripples on every play; null at rest. */
export function SoundEmblem({
  id,
  play = null,
  size = "tile",
}: {
  id: SoundId;
  play?: { key: number; strikes: Strike[] } | null;
  /** tile: Settings and the picker (76 px); strip: the workspace strip
   * (52 px); small: rows (32 px), the smallest it is drawn. */
  size?: "tile" | "strip" | "small";
}) {
  const e = emblems[id]();
  return (
    <svg
      className="se-emblem"
      data-size={size}
      viewBox="-32 -32 64 64"
      aria-hidden="true"
      data-emblem={id}
      data-active={play ? "" : undefined}
    >
      <g>{e.still}</g>
      {play ? (
        <g key={play.key}>
          {play.strikes.map((s, i) => {
            const o = e.origins[i % e.origins.length];
            return (
              <g
                // biome-ignore lint/suspicious/noArrayIndexKey: strikes are a fixed list per play
                key={i}
                transform={`translate(${o.x} ${o.y}) rotate(${o.rot ?? 0})`}
              >
                <path
                  className="se-ripple"
                  d={o.d}
                  style={{
                    animationDelay: `${s.at.toFixed(3)}s`,
                    animationDuration: `${Math.min(1.4, Math.max(0.5, s.ring)).toFixed(2)}s`,
                    ["--amp" as string]: String(
                      0.45 + Math.min(1, s.amp) * 0.55,
                    ),
                  }}
                />
              </g>
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}
