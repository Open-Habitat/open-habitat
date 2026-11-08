import { describe, expect, it } from "vitest";
import inventory from "../../../contracts/v1/examples/process-inventory.json";
import type { ProcessRecord } from "../app/processes";
import type { Spinoff } from "../app/spinoffs";
import { backgroundFacts, helperWord, stateWord } from "./BackgroundStrip";

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
  it("marks foreground tool waits without offering a background process stop", () => {
    const own = run({});
    const other = run({ run_id: "01m53wnje1f3ybcw17qsx2sysd" });
    const f = backgroundFacts({
      runs: [own, other],
      spinoffsStale: false,
      processes: [],
      foregroundRunIDs: [own.run_id],
      interrupted: 0,
      failed: false,
      agentIdle: false,
    });
    expect(f.spin.marks.map((i) => [i.run.run_id, i.waited])).toEqual([
      [own.run_id, true],
      [other.run_id, false],
    ]);
    expect(f.spin.marks[0].wait).toBeUndefined();
    expect(f.proc.records).toEqual([]);
    expect(facts([own], [], false).spin.marks[0].waited).toBe(false);
    expect(
      backgroundFacts({
        runs: [run({ state: "merged" })],
        spinoffsStale: false,
        processes: [],
        foregroundRunIDs: [own.run_id],
        interrupted: 0,
        failed: false,
        agentIdle: false,
      }).spin.marks.every((i) => !i.waited),
    ).toBe(true);
  });
  it("shows a taskfleet wait on its spinoff, never as a process", () => {
    const f = facts([run({})], [wait, proc({ wakes_agent: false })]);
    expect(f.proc.records.map((p) => p.id)).toEqual(["proc_example"]);
    expect(f.spin.live[0].wait?.id).toBe("proc_wait");
    expect(f.spin.marks.map((i) => i.waited)).toEqual([true]);
    // The other process does not wake the agent: nothing waited on.
    expect(f.proc.waited).toBe(false);
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
  it("marks a live run in another state, waited or not", () => {
    const parent = run({
      run_id: "01m53wnje1f3ybcw17qsx2syse",
      state: "waiting_parent",
    });
    expect(facts([parent], []).spin.marks.map((i) => i.waited)).toEqual([
      false,
    ]);
    // Taskfleet did not list the waited run: it is unknown, still waited.
    expect(facts([], [wait]).spin.marks.map((i) => i.waited)).toEqual([true]);
  });
  it("marks a live run whose supervisor Taskfleet doubts, after the restart cut its wait", () => {
    // Birch pilot.12: a conversation's cross-repository run, pending with
    // a live worker, read as supervisor dead; the restart cut the wait.
    const f = facts([run({ state: "unknown" })], []);
    expect(f.spin.working).toBe(0);
    expect(f.spin.marks.map((i) => [i.run.state, i.waited])).toEqual([
      ["unknown", false],
    ]);
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
    // A failed run with work left is the same call to the person.
    expect(
      facts([run({ state: "failed", preserved: true })], []).spin.attention,
    ).toBe(1);
    expect(
      facts([run({ state: "failed", preserved: false })], []).spin.attention,
    ).toBe(0);
  });
  it("tones each row's own word: the wait, not waiting, and how it ended", () => {
    const tone = (r: Spinoff, processes: ProcessRecord[] = []) =>
      stateWord(facts([r], processes).spin.items[0]).tone;
    expect(tone(run({}), [wait])).toBe("wait");
    // A wait whose end does not wake the agent is no wait.
    expect(tone(run({}), [{ ...wait, wakes_agent: false }])).toBe("muted");
    expect(tone(run({}))).toBe("muted");
    expect(tone(run({ state: "waiting_parent" }), [wait])).toBe("wait");
    expect(tone(run({ state: "merged" }))).toBe("ok");
    expect(tone(run({ state: "failed" }))).toBe("err");
    expect(tone(run({ state: "unmerged", preserved: true }))).toBe("err");
    // Ended without a merge and nothing kept: nothing for the person to do.
    expect(tone(run({ state: "unmerged" }))).toBe("muted");
    // A settled run's lingering wait is not the agent waiting.
    expect(tone(run({ state: "merged" }), [wait])).toBe("ok");
  });
  it("says a worker waiting at its own prompt waits for the person, not works", () => {
    const f = facts([run({ state: "idle" })], []);
    expect(f.spin.live).toHaveLength(1);
    expect(f.spin.working).toBe(0);
    expect(stateWord(f.spin.items[0])).toEqual({
      text: "odottaa sinua",
      tone: "wait",
    });
    const asked = facts([run({ state: "idle", awaiting_input: true })], []);
    expect(stateWord(asked.spin.items[0]).text).toBe(
      "odottaa vastausta päätteessä",
    );
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

describe("named workers (Avustajat)", () => {
  const helper = (
    round_state: "working" | "waiting" | "dormant",
    edit: Partial<Spinoff> = {},
  ) =>
    run({
      run_id: "01m53wnje1f3ybcw17qsx2syhh",
      title: "M365-asetusvirta",
      state: round_state === "working" ? "working" : "waiting_parent",
      resident: {
        name: "proto-m365",
        round_state,
        rounds: 2,
        report: "Kolme riffiä A:sta.\nSuositus A1.",
      },
      ...edit,
    });
  const withHelpers = (
    runs: Spinoff[],
    seen?: ReadonlyMap<string, number>,
    processes: ProcessRecord[] = [],
  ) =>
    backgroundFacts({
      runs,
      spinoffsStale: false,
      processes,
      interrupted: 0,
      availability: "available",
      reason: null,
      failed: false,
      agentIdle: true,
      helpers: true,
      seen,
    });
  it("moves live named workers to their own chip only while the feature is on", () => {
    const runs = [run({}), helper("waiting")];
    const on = withHelpers(runs);
    expect(on.spin.items.map((i) => i.run.title)).toEqual(["README"]);
    expect(on.help.items.map((i) => i.run.resident?.name)).toEqual([
      "proto-m365",
    ]);
    const off = facts(runs, []);
    expect(off.help.present).toBe(false);
    expect(off.spin.items).toHaveLength(2);
    // Off, a waiting helper is a worker waiting for the main agent, not one
    // waiting at its terminal.
    expect(stateWord(off.spin.items[1]).text).toBe("odottaa pääagenttia");
  });
  it("leaves an ended named worker to the Workers pill and its requests", () => {
    const ended = helper("waiting", { state: "unmerged", preserved: true });
    const f = withHelpers([ended]);
    expect(f.help.present).toBe(false);
    expect(f.spin.attention).toBe(1);
  });
  it("says where each round stands, and marks a report not yet opened", () => {
    const word = (r: Spinoff, seen?: ReadonlyMap<string, number>) =>
      helperWord(withHelpers([r], seen).help.items[0]);
    expect(word(helper("working")).text).toBe("kierros 3 työn alla");
    expect(word(helper("waiting")).text).toBe("kierros 2 raportoitu");
    expect(word(helper("waiting")).tone).toBe("wait");
    const seen = new Map([["01m53wnje1f3ybcw17qsx2syhh", 2]]);
    expect(word(helper("waiting"), seen).text).toBe("odottaa pääagenttia");
    expect(word(helper("dormant"), seen).text).toBe(
      "lepää · herää pääagentin viestistä",
    );
    const kept = helper("waiting", {
      resident: {
        name: "proto-m365",
        round_state: "waiting",
        rounds: 2,
        unlanded: true,
      },
    });
    expect(word(kept, seen).text).toBe(
      "odottaa pääagenttia · keskeneräinen työ haarassa",
    );
    const f = withHelpers(
      [
        helper("waiting"),
        helper("working", { run_id: "01m53wnje1f3ybcw17qsx2syhj" }),
      ],
      seen,
    );
    expect(f.help.unseen).toBe(0);
    expect(f.help.working).toBe(1);
    // Every helper waiting with nothing new: the chip is quiet.
    expect(withHelpers([helper("waiting")], seen).help.busy).toBe(0);
  });
  it("keeps the main agent's wait on a helper as the wait ring", () => {
    const wait = proc({
      id: "proc_wait",
      name: "odota",
      process_token: "pt_wait",
      run_ids: ["01m53wnje1f3ybcw17qsx2syhh"],
    });
    const f = withHelpers([helper("working")], undefined, [wait]);
    expect(f.help.items[0].waited).toBe(true);
    expect(helperWord(f.help.items[0]).text).toBe(
      "agentti odottaa · kierros 3 työn alla",
    );
  });
});
