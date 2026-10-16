// Synthetic lab only: times GET /api/v1/snapshot from a signed-in lab page.
// Usage (repository root, lab running via scripts/lab.sh start):
//   PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright \
//     node issues/fast-snapshot/measure-snapshot.mjs [--runs 10] [--label before]
// Prints one JSON line: warm sequential times, and the slower of two
// overlapping requests, which is the live "2.4 s when two overlap" case.
// Times are the browser's fetch duration through the lab gateway, so they
// include the gateway hop and loopback TLS, like curl on the live socket
// does not; the difference is a few milliseconds.
import { openLab } from "../../web/lab/session.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const runs = Number(opt("runs", "10"));
const label = opt("label", "");

const { browser, page } = await openLab();
await page.waitForURL(/\/workspaces/);
await page.waitForTimeout(1500);
const result = await page.evaluate(async (runs) => {
  const once = async () => {
    const t = performance.now();
    const r = await fetch("/api/v1/snapshot", { cache: "no-store", credentials: "same-origin" });
    await r.arrayBuffer();
    if (!r.ok) throw new Error(`snapshot ${r.status}`);
    return performance.now() - t;
  };
  await once(); // the first read after sign-in fills per-daemon state
  const warm = [];
  for (let i = 0; i < runs; i++) warm.push(await once());
  const pairs = [];
  for (let i = 0; i < Math.max(3, runs / 2); i++) pairs.push(Math.max(...(await Promise.all([once(), once()]))));
  return { warm, pairs };
}, runs);
await browser.close();
const r = (xs) => xs.map((x) => Math.round(x * 10) / 10);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(JSON.stringify({
  label,
  at: new Date().toISOString(),
  warm_ms: r(result.warm),
  warm_median_ms: Math.round(median(result.warm) * 10) / 10,
  overlap_pair_ms: r(result.pairs),
  overlap_median_ms: Math.round(median(result.pairs) * 10) / 10,
}));
