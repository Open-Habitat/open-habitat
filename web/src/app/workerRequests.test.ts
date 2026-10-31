import { afterEach, describe, expect, it } from "vitest";
import { resetLanguageForTests } from "../i18n";
import type { HistoryEntry } from "./history";
import type { Spinoff } from "./spinoffs";
import { requestPhases, requestText } from "./workerRequests";

const run = (edit: Partial<Spinoff> = {}): Spinoff => ({
  run_id: "01m5yq1t6wkd3r8n2c4h7pqa0e",
  title: "Worker-näkymän koe",
  created_at: "2026-10-28T06:00:00Z",
  ended_at: "2026-10-28T07:36:00Z",
  state: "unmerged",
  preserved: true,
  branch: "wt/5yq1-koe",
  worktree: "/home/example/src/kasvimaa__worktrees/wt-5yq1-koe",
  source_branch: "main",
  summary: "",
  ...edit,
});
const other = run({
  run_id: "01m5b5q3ndz4k7c1p8v6h2tm9r",
  title: "Lomake",
  state: "failed",
});
let n = 0;
const entry = (
  kind: HistoryEntry["kind"],
  text: string,
  timestamp = "2026-10-28T08:00:00Z",
): HistoryEntry => ({
  entry_key: `e${++n}`,
  kind,
  timestamp,
  content: { media_type: "text/plain", text, complete: true },
});
const phases = (
  entries: HistoryEntry[],
  working = false,
  extra: Partial<Parameters<typeof requestPhases>[0]> = {},
) => requestPhases({ runs: [run(), other], entries, working, ...extra });

describe("an ended worker's request phase is read from the conversation", () => {
  const ask = requestText([run()]);
  it("follows the request from the queue through the answer", () => {
    expect(phases([], true, { queued: [ask] })).toEqual({
      [run().run_id]: "queued",
    });
    expect(phases([], false, { sent: [ask] })).toEqual({
      [run().run_id]: "sent",
    });
    // Accepted but the turn has not started: still on its way.
    expect(phases([entry("user", ask)])).toEqual({ [run().run_id]: "sent" });
    expect(phases([entry("user", ask)], true)).toEqual({
      [run().run_id]: "checking",
    });
    const recommended = [entry("user", ask), entry("assistant", "Mergeänkö?")];
    expect(phases(recommended)).toEqual({ [run().run_id]: "answer" });
    const answered = [...recommended, entry("user", "kyllä")];
    expect(phases(answered, true)).toEqual({ [run().run_id]: "acting" });
    // The agent's turn on the answer is over and the work is still on
    // disk ("jätä toistaiseksi"): the row waits for a request again.
    const deferred = [...answered, entry("assistant", "Jätän sen.")];
    expect(phases(deferred, false)).toEqual({});
    // An unrelated later turn does not take the row back.
    expect(phases([...deferred, entry("user", "muuta työtä")], true)).toEqual(
      {},
    );
  });
  it("covers every row of one Käsittele kaikki request", () => {
    const all = requestText([run(), other]);
    expect(phases([entry("user", all)], true)).toEqual({
      [run().run_id]: "checking",
      [other.run_id]: "checking",
    });
  });
  it("recognises a request written while the interface was in the other language", () => {
    resetLanguageForTests("en");
    const english = requestText([run()]);
    expect(english).not.toContain(ask);
    resetLanguageForTests("fi");
    expect(phases([entry("user", english)], true)).toEqual({
      [run().run_id]: "checking",
    });
  });
  afterEach(() => resetLanguageForTests("fi"));
  it("does not take an earlier mention of the run for a request", () => {
    const before = entry("user", ask, "2026-10-28T07:00:00Z");
    expect(phases([before, entry("assistant", "…")])).toEqual({});
  });
  it("asks nothing about a row without work on disk or still running", () => {
    const rows = [
      run({ preserved: false }),
      run({ run_id: other.run_id, state: "working" }),
    ];
    const text = requestText(rows);
    expect(
      requestPhases({
        runs: rows,
        entries: [entry("user", text)],
        working: true,
      }),
    ).toEqual({});
  });
});

describe("the request text", () => {
  it("carries the native facts unchanged so any agent can find the work", () => {
    const text = requestText([run()], "Iltakierros");
    for (const fact of [
      run().run_id,
      run().branch,
      run().worktree,
      run().title,
      "Iltakierros",
    ])
      expect(text).toContain(fact);
  });
});
