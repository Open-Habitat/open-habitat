import { describe, expect, it } from "vitest";
import fixture from "../../../contracts/v1/examples/spinoff-work.json";
import { parseSpinoffWork, type WorkerWork } from "./spinoffWork";
import {
  checksWord,
  placeWorkClause,
  workClause,
  workSentence,
} from "./workSentence";

const work = (edit: Partial<WorkerWork>): WorkerWork => ({
  run_id: "01m521vczarx5bkx086n64t1t2",
  git: "available",
  pull_request_state: "none",
  ...edit,
});

describe("worker-row sentence", () => {
  it("never says an unknown as nothing, nor a clean worktree without its comparison as nothing", () => {
    const nothing = workClause(work({ ahead: 0, dirty_count: 0 }));
    const unknown = workClause(work({ git: "unavailable" }));
    expect(nothing?.tone).toBe("muted");
    expect(unknown?.tone).toBe("muted");
    expect(unknown?.text).not.toBe(nothing?.text);
    // Git answered for the worktree but the source branch could not be
    // compared: changes are known, "nothing yet" is not.
    expect(workClause(work({ dirty_count: 0 }))).toBeUndefined();
    expect(workClause(work({ dirty_count: 2 }))?.tone).toBe("work");
    // A kept branch has no worktree to count changes in.
    expect(workClause(work({ ahead: 1 }))?.tone).toBe("work");
  });
  it("lets a failed check outrank a running one, and a running one outrank success", () => {
    const pr = (checks: { passed: number; failed: number; pending: number }) =>
      ({ number: 1, state: "open", url: "", checks }) as const;
    expect(checksWord(pr({ passed: 3, failed: 1, pending: 1 })).tone).toBe(
      "err",
    );
    expect(checksWord(pr({ passed: 3, failed: 0, pending: 1 })).tone).toBe(
      "run",
    );
    expect(checksWord(pr({ passed: 3, failed: 0, pending: 0 })).tone).toBe(
      "ok",
    );
    expect(checksWord(pr({ passed: 0, failed: 0, pending: 0 })).tone).toBe(
      "muted",
    );
    // A merged or closed pull request's old checks no longer matter.
    expect(
      checksWord({
        ...pr({ passed: 0, failed: 2, pending: 0 }),
        state: "merged",
      }).tone,
    ).toBe("ok");
  });
  it("tells a pull request gh could not read apart from none, and says nothing for another forge", () => {
    const none = workSentence(work({ ahead: 0, dirty_count: 0 }), "main");
    const unknown = workSentence(
      work({ ahead: 0, dirty_count: 0, pull_request_state: "unknown" }),
      "main",
    );
    const other = workSentence(
      work({ ahead: 0, dirty_count: 0, pull_request_state: "unsupported" }),
      "main",
    );
    expect(new Set([none, unknown, other]).size).toBe(3);
    expect(other.length).toBeLessThan(none.length);
  });
  it("reads a worktree place's own Git summary for the rail, unknown without one", () => {
    expect(placeWorkClause(undefined)?.tone).toBe("muted");
    expect(
      placeWorkClause({
        branch: "wt/a",
        dirty_count: 0,
        base: {
          name: "main",
          ref: "main",
          source: "recorded",
          ahead: 2,
          behind: 0,
          merged: false,
        },
      })?.tone,
    ).toBe("work");
  });
  it("accepts only the contract's work shape", () => {
    expect(parseSpinoffWork(fixture).runs[0].pull_request?.number).toBe(412);
    const [found] = fixture.runs;
    for (const runs of [
      [{ ...found, pull_request_state: "none" }],
      [
        {
          ...found,
          pull_request: { ...found.pull_request, url: "javascript:x" },
        },
      ],
      [{ ...found, path: "/home/someone/src" }],
    ])
      expect(() => parseSpinoffWork({ ...fixture, runs })).toThrow(
        "spinoff_work_unavailable",
      );
  });
});
