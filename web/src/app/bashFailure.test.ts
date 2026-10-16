import { describe, expect, it } from "vitest";
import { bashOutput, failureLabel } from "./bashFailure";

describe("bash failure presentation", () => {
  it("removes only the recognized terminal line and preserves earlier identical output", () => {
    const cause = {
      kind: "exit" as const,
      amount: 2,
      status_line: "Command exited with code 2",
    };
    expect(
      bashOutput(
        "Command exited with code 2\nusage error\n\nCommand exited with code 2\n",
        cause,
      ),
    ).toBe("Command exited with code 2\nusage error");
    expect(bashOutput("unrecognized output", cause)).toBe(
      "unrecognized output",
    );
    expect(bashOutput("Command aborted")).toBe("Command aborted");
    expect(failureLabel(cause)).toBe("paluuarvo 2");
    expect(failureLabel()).toBe("epäonnistui");
  });
});
