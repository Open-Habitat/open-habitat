import { describe, expect, it } from "vitest";
import fixture from "../../../contracts/v1/examples/spinoffs.json";
import { parseSpinoffs, splitBrief } from "./spinoffs";

describe("native spinoff wire boundary", () => {
  it("rejects ambiguous identity, unexpected native fields and nonliteral run ids", () => {
    expect(parseSpinoffs(fixture).runs[0].state).toBe("merged");
    for (const value of [
      { ...fixture, runs: [{ ...fixture.runs[0], run_id: "../outside" }] },
      {
        ...fixture,
        transcripts: [
          {
            ...fixture.transcripts[0],
            entries: [
              {
                ...fixture.transcripts[0].entries[0],
                raw: { secret: "native metadata" },
              },
            ],
          },
        ],
      },
      // The window pointer is the terminal route's token form, never a path.
      {
        ...fixture,
        runs: [{ ...fixture.runs[0], terminal: "/run/user/1/taskfleet" }],
      },
      { ...fixture, runs: [{ ...fixture.runs[0], state: "finished-ish" }] },
      { ...fixture, runs: [{ ...fixture.runs[0], preserved: undefined }] },
    ])
      expect(() => parseSpinoffs(value)).toThrow("spinoffs_unavailable");
  });
});

describe("worker brief", () => {
  const context =
    "# Taskfleet run context (read first)\n\nYou are working inside taskfleet run `x`.\n\n---\n\nAn earlier rule.";
  it("puts the main agent's task first and keeps Taskfleet's context aside", () => {
    expect(
      splitBrief(
        `${context}\n\n---\n\nThe original task brief follows.\n\n\n# worker-presentation\n\nDo it.`,
      ),
    ).toEqual({
      task: "# worker-presentation\n\nDo it.",
      context,
    });
  });
  it("leaves a brief without Taskfleet's context as it is", () => {
    expect(splitBrief("# Tehtävä\n\nLisää testit.")).toEqual({
      task: "# Tehtävä\n\nLisää testit.",
    });
    // A context without its end line, or with no task after it, is shown whole.
    expect(splitBrief(context)).toEqual({ task: context });
    expect(
      splitBrief(`${context}\n---\nThe original task brief follows.\n`),
    ).toEqual({
      task: `${context}\n---\nThe original task brief follows.\n`,
    });
  });
});
