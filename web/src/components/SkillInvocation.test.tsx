import { describe, expect, it } from "vitest";
import { skillDescription } from "./SkillInvocation";

describe("recorded skill description", () => {
  it("uses recorded prose, not a heading, markup, list or command", () => {
    expect(
      skillDescription(
        "# Review\n\nReview **the** [interface](https://example.invalid).\n\n## Steps",
      ),
    ).toBe("Review the interface.");
    expect(skillDescription("# Review\n\n- Read the diff")).toBeUndefined();
    expect(skillDescription("# Review")).toBeUndefined();
    expect(skillDescription("```sh\nrun\n```")).toBeUndefined();
    expect(skillDescription("<b>Review</b> the change.")).toBe(
      "Review the change.",
    );
  });
});
