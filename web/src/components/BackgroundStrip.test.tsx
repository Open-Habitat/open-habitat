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
  it("shows a taskfleet wait on its spinoff, never as a process", () => {
    const f = facts([run({})], [wait, proc({ wakes_agent: false })]);
    expect(f.proc.records.map((p) => p.id)).toEqual(["proc_example"]);
    expect(f.spin.live[0].wait?.id).toBe("proc_wait");
    expect(f.spin.marks.map((i) => i.waited)).toEqual([true]);
    // The other process does not wake the agent: no process bell.
    expect(f.proc.bell).toBe(false);
  });
  it("marks a working spinoff nobody waits on, waited ones first", () => {
    const other = run({ run_id: "01m53wnje1f3ybcw17qsx2sysd", title: "B" });
    const f = facts([other, run({})], [wait]);
    expect(f.spin.marks.map((i) => [i.run.title, i.waited])).toEqual([
      ["README", true],
      ["B", false],
    ]);
  });
  it("keeps the wait mark while the agent works; the turn has not ended yet", () => {
    expect(facts([run({})], [wait], false).spin.marks[0].waited).toBe(true);
  });
  it("counts a wait whose end does not wake the agent as no wait, but keeps it on the row", () => {
    for (const wakes_agent of [false, null] as const) {
      const f = facts([run({})], [{ ...wait, wakes_agent } as ProcessRecord]);
      expect(f.spin.marks[0].waited).toBe(false);
      expect(f.spin.live[0].wait?.id).toBe("proc_wait");
    }
  });
  it("marks a waited run in another state, but not an unwaited one", () => {
    const parent = run({
      run_id: "01m53wnje1f3ybcw17qsx2syse",
      state: "waiting_parent",
    });
    expect(facts([parent], []).spin.marks).toHaveLength(0);
    // Taskfleet did not list the waited run: it is unknown, still waited.
    expect(facts([], [wait]).spin.marks.map((i) => i.waited)).toEqual([true]);
  });
  it("leaves a settled spinoff's wait unmarked", () => {
    expect(facts([run({ state: "merged" })], [wait]).spin.marks).toHaveLength(
      0,
    );
  });
  it("counts only working spinoffs as working; unknown and parent-waiting stay listed", () => {
    const f = facts(
      [
        run({}),
        run({ run_id: "01m53wnje1f3ybcw17qsx2sysd", state: "unknown" }),
        run({ run_id: "01m53wnje1f3ybcw17qsx2syse", state: "waiting_parent" }),
      ],
      [],
    );
    expect(f.spin.working).toBe(1);
    expect(f.spin.live).toHaveLength(3);
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
  it("is silent while Pi starts for a held message, before its bridge answers", () => {
    const starting = (failed: boolean, piNotRunning: boolean) =>
      backgroundFacts({
        runs: [],
        spinoffsStale: false,
        processes: [],
        interrupted: 0,
        availability: failed ? undefined : "unavailable",
        reason: failed ? undefined : "bridge_unavailable",
        failed,
        agentIdle: false,
        piNotRunning,
      }).proc.present;
    expect(starting(false, true)).toBe(false);
    expect(starting(true, true)).toBe(false);
    // A running Pi whose bridge is missing is still worth saying.
    expect(starting(false, false)).toBe(true);
  });
});
