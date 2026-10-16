// Medians per action and emulated latency from measure-actions.mjs output.
//   node issues/ui-responsiveness-review/summarize.mjs lab-actions.jsonl
import { readFileSync } from "node:fs";

const rows = readFileSync(process.argv[2], "utf8")
  .split("\n")
  .filter((l) => l.startsWith("{"))
  .map((l) => JSON.parse(l));
const median = (xs) => {
  const s = xs.filter((x) => x !== undefined && x !== null).sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : "—";
};
const groups = new Map();
for (const r of rows) {
  if (r.error) {
    console.log(`error latency=${r.latency} run=${r.run} ${r.scenario}: ${r.error.split("\n")[0].slice(0, 120)}`);
    continue;
  }
  if (!r.hits) continue; // a step that did not run (e.g. no restore offer)
  const key = `${r.action}\t${r.latency}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}
console.log("action\tlatency_ms\tn\tmilestones (median ms after pointerdown)\trequests_before_last_milestone (median)");
for (const [key, rs] of groups) {
  const names = [...new Set(rs.flatMap((r) => Object.keys(r.hits)))];
  const ms = names.map((n) => `${n}=${median(rs.map((r) => r.hits[n]))}`).join(" ");
  const last = (r) => Math.max(...Object.values(r.hits));
  const before = rs.map((r) => r.requests.filter((q) => q.end <= last(r) + 1).length);
  const missing = rs.filter((r) => Object.keys(r.hits).length < names.length).length;
  console.log(`${key}\t${rs.length}\t${ms}${missing ? ` (${missing} run(s) missed a milestone)` : ""}\t${median(before)}`);
}
