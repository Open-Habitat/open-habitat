import { describe, expect, it } from "vitest";
import inventory from "../../../contracts/v1/examples/process-inventory.json";
import type { ProcessRecord } from "../app/processes";
import type { Spinoff } from "../app/spinoffs";
import { backgroundFacts } from "./BackgroundStrip";

const base = inventory.processes[0] as ProcessRecord;
const proc = (edit: Partial<ProcessRecord>): ProcessRecord => ({
  ...base,
  ...edit,
});
const run = (edit: Partial<Spinoff>): Spinoff => ({
  run_id: "01m53wnktnxb4w2xgdd79a66de",
  title: "README",
  created_at: "2026-10-16T10:00:00Z",
  state: "working",
  preserved: false,
  branch: "",
  worktree: "",
  source_branch: "main",
  summary: "",
  ...edit,
});
const facts = (runs: Spinoff[], processes: ProcessRecord[], agentIdle = true) =>
  backgroundFacts({
    runs,
    spinoffsStale: false,
    processes,
    interrupted: 0,
    availability: "available",
    reason: null,
    failed: false,
    agentIdle,
  });

describe("background strip facts", () => {
  const wait = proc({
    id: "proc_wait",
    name: "odota",
    process_token: "pt_wait",
    run_ids: ["01m53wnktnxb4w2xgdd79a66de"],
  });
  it("shows a taskfleet wait as its spinoff's bell, never as a process", () => {
    const f = facts([run({})], [wait, proc({ wakes_agent: false })]);
    expect(f.proc.records.map((p) => p.id)).toEqual(["proc_example"]);
    expect(f.spin.live[0].wait?.id).toBe("proc_wait");
    expect(f.spin.bell).toBe(true);
    // The other process does not wake the agent: no process bell.
    expect(f.proc.bell).toBe(false);
  });
  it("rings the bell only after the agent's turn has ended", () => {
    expect(facts([run({})], [wait], false).spin.bell).toBe(false);
  });
  it("keeps a waited spinoff that Taskfleet did not list, as unknown", () => {
    const f = facts([], [wait]);
    expect(f.spin.present).toBe(true);
    expect(f.spin.live[0].run.state).toBe("unknown");
  });
  it("needs the person while a failed spinoff's branch remains, and not after", () => {
    expect(
      facts([run({ state: "unmerged", preserved: true })], []).spin.attention,
    ).toBe(1);
    expect(
      facts([run({ state: "unmerged", preserved: false })], []).spin.attention,
    ).toBe(0);
    expect(
      facts([run({ state: "merged", preserved: true })], []).spin.attention,
    ).toBe(0);
  });
  it("is silent about processes while Pi is stopped, unless a restart cut one off", () => {
    const stopped = (interrupted: number) =>
      backgroundFacts({
        runs: [],
        spinoffsStale: false,
        processes: [],
        interrupted,
        availability: "unavailable",
        reason: "pi_not_running",
        failed: false,
        agentIdle: false,
      }).proc.present;
    expect(stopped(0)).toBe(false);
    expect(stopped(1)).toBe(true);
  });
});
