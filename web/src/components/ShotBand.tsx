import { type ReactNode, useEffect, useState } from "react";
import "./ShotBand.css";

// A band cut from a console screenshot, with the thing to press lit: the
// guides show it where a person must find a control in someone else's UI
// (Microsoft's levels guide, Google's setup guide and connect help). A crop
// is the image's box in the capture's pixels and its named targets; the
// band shows the full width on a desktop and the target's neighbourhood on
// a phone, so the lit control stays readable at 390 px.

export type Box = readonly [number, number, number, number];
export type Crop = {
  readonly box: Box;
  readonly targets: Readonly<Record<string, Box>>;
};

/** The slice of a crop the band shows: the full width on a desktop, the
 * target's neighbourhood on a phone, and the target's middle at mid
 * height, so every sub-item of a step has the same band height. */
export function bandOf(
  crop: Crop,
  t: string,
  aspect: number,
  narrow: boolean,
): Box {
  const c = crop.box;
  const tg = crop.targets[t];
  const cw = c[2] - c[0];
  const ch = c[3] - c[1];
  let wide = narrow
    ? Math.max(720, tg[2] - tg[0] + 120)
    : Math.max(1500, tg[2] + 120);
  wide = Math.max(wide, (tg[3] - tg[1] + 80) * aspect);
  wide = Math.min(cw, wide, ch * aspect);
  const tall = Math.round(wide / aspect);
  const left = narrow
    ? Math.max(c[0], Math.min(c[2] - wide, tg[0] - 60))
    : c[0];
  const mid = (tg[1] + tg[3]) / 2;
  const top = Math.max(c[1], Math.min(c[3] - tall, Math.round(mid - tall / 2)));
  return [left, top, left + wide, top + tall];
}

export function ShotBand({
  testId,
  name,
  src,
  alt,
  crop,
  t,
  aspect,
  narrow,
  children,
}: {
  testId: string;
  /** The crop's name, for data-crop and the lit target's data-target. */
  name: string;
  src: string;
  alt: string;
  crop: Crop;
  t: string;
  aspect: number;
  narrow: boolean;
  /** A caption under the band, such as a gap nobody has captured yet. */
  children?: ReactNode;
}) {
  const v = bandOf(crop, t, aspect, narrow);
  const w = v[2] - v[0];
  const h = v[3] - v[1];
  const pct = (b: Box) => ({
    left: `${((b[0] - v[0]) / w) * 100}%`,
    top: `${((b[1] - v[1]) / h) * 100}%`,
    width: `${((b[2] - b[0]) / w) * 100}%`,
    height: `${((b[3] - b[1]) / h) * 100}%`,
  });
  return (
    <figure className="shot" data-testid={testId} data-crop={name}>
      <div className="shot-frame" style={{ aspectRatio: `${aspect}` }}>
        <img src={src} alt={alt} draggable={false} style={pct(crop.box)} />
        <span
          className="shot-mark"
          data-target={`${name}.${t}`}
          style={pct(crop.targets[t])}
        />
      </div>
      {children}
    </figure>
  );
}

export function useNarrow() {
  const q = "(max-width: 640px)";
  const [narrow, setNarrow] = useState(
    () => window.matchMedia?.(q).matches ?? false,
  );
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}
