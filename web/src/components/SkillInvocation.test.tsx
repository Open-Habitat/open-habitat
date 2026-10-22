import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Entry } from "../app/HistoryView";

// Introductory prose and template markers are instructions, not metadata.
// Exercise the history entry boundary rather than supplying a chip label only.
describe("skill invocation metadata", () => {
  it.each([undefined, "Routes work to the matching sibling."])(
    "never derives a description from the instruction (%s)",
    (description) => {
      const view = render(
        <Entry
          entry={{
            entry_key: "skill",
            kind: "user",
            skill: { name: "worktree", description },
            content: {
              media_type: "text/plain",
              text: "My extra request",
              complete: true,
            },
            blocks: [
              {
                type: "text",
                text: "# worktree\n\nArguments: `$ARGUMENTS`\n\nDo not use this prose as a description.",
              },
            ],
          }}
        />,
      );
      const chip = view.getByTestId("skill-chip");
      expect(chip.textContent).toContain("worktree");
      expect(chip.textContent).not.toContain("$ARGUMENTS");
      expect(chip.textContent).not.toContain("Do not use this prose");
      if (description) expect(chip.textContent).toContain(description);
      expect(view.container.textContent).toContain("My extra request");
    },
  );
});
