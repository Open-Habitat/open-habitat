import type { BrowserContext } from "@playwright/test";

/** Opens Hiljaiset on this device before any page loads, as a person who
 * has opened it once would have it (`nah:rail-quiet-folded`, quietFold.ts).
 *
 * Until the device has chosen, a crowded rail folds Hiljaiset by itself
 * (rail-scroll-region, covered by lab-rail-scroll-region.spec.ts), and the
 * Desktop Chrome rail is short enough to count as crowded with only a few
 * rows. A case about which conversations Hiljaiset holds starts from the
 * open list; a fold the case itself makes is still kept. */
export async function openQuietOnDevice(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      if (localStorage.getItem("nah:rail-quiet-folded") === null)
        localStorage.setItem("nah:rail-quiet-folded", "0");
    } catch {
      // An opaque origin (about:blank) has no storage and no rail.
    }
  });
}
