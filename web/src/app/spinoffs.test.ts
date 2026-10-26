import { describe, expect, it } from "vitest";
import fixture from "../../../contracts/v1/examples/spinoffs.json";
import { parseSpinoffs } from "./spinoffs";

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
