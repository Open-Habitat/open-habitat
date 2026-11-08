import { describe, expect, it } from "vitest";
import { helpersArchiveDetail } from "./helpersArchive";
import type { Spinoff } from "./spinoffs";

const run = (edit: Partial<Spinoff>): Spinoff => ({
  run_id: "01m53wnktnxb4w2xgdd79a66de",
  title: "README",
  created_at: "2026-10-16T10:00:00Z",
  state: "waiting_parent",
  preserved: false,
  branch: "",
  worktree: "",
  source_branch: "main",
  summary: "",
  ...edit,
});

describe("the archive notice's helpers", () => {
  it("says nothing without live named workers", () => {
    expect(helpersArchiveDetail([run({})])).toBeUndefined();
    expect(
      helpersArchiveDetail([
        run({
          state: "merged",
          resident: { name: "proto-a", round_state: "waiting", rounds: 2 },
        }),
      ]),
    ).toBeUndefined();
  });
  it("names the helpers that go with it, a round under way, and work not yet landed", () => {
    const detail = helpersArchiveDetail([
      run({
        resident: {
          name: "proto-a",
          round_state: "waiting",
          rounds: 2,
          landed_round: 2,
        },
      }),
      run({
        run_id: "01m53wnktnxb4w2xgdd79a66df",
        resident: { name: "review-b", round_state: "waiting", rounds: 1 },
      }),
      run({
        run_id: "01m53wnktnxb4w2xgdd79a66dg",
        state: "working",
        resident: { name: "fix-c", round_state: "working", rounds: 0 },
      }),
    ]);
    expect(detail).toBe(
      "Avustajat arkistoitiin mukana (proto-a, review-b, fix-c): ne odottavat ja palaavat keskustelun mukana käynnistämättä. Kierros on vielä kesken (fix-c); sen raportti ei herätä arkistoitua keskustelua. Viimeisimmän kierroksen yhdistämistä ei ole kirjattu (review-b); jos siinä oli muutoksia, ne ovat avustajan haarassa.",
    );
  });
  it("trusts Taskfleet's word on kept work, and a dormant helper's proof that all landed", () => {
    const detail = helpersArchiveDetail([
      run({
        resident: {
          name: "kept-a",
          round_state: "waiting",
          rounds: 3,
          unlanded: true,
        },
      }),
      run({
        run_id: "01m53wnktnxb4w2xgdd79a66df",
        resident: { name: "sleep-b", round_state: "dormant", rounds: 2 },
      }),
    ]);
    expect(detail).toContain(
      "Yhdistämätön työ säilyy avustajan haarassa (kept-a).",
    );
    expect(detail).not.toContain("haarassa (kept-a, sleep-b)");
    expect(detail).not.toContain("ei ole kirjattu");
  });
});
