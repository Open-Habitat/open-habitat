import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkingProgress, progressLabel } from "./WorkingProgress";

describe("working progress", () => {
  it("shows allowlisted work without exposing host arguments or unknown payload", () => {
    expect(
      progressLabel([
        {
          type: "tool_execution_start",
          toolName: "<script>secret</script>",
          arguments: "credential",
        },
      ]),
    ).toBe("Käyttää työkalua: työkalua");
    render(
      <WorkingProgress
        state="accepted"
        elapsed={65}
        events={[
          {
            type: "tool_execution_start",
            toolName: "bash",
            arguments: "private",
          },
        ]}
      />,
    );
    expect(screen.getByText(/1 min 5 s/)).toBeTruthy();
    expect(screen.getAllByText("Käyttää työkalua: bash")[0]).toBeTruthy();
    expect(screen.queryByText("private")).toBeNull();
  });
  it("does not imply that a crashed child or its tools finished", () => {
    render(<WorkingProgress state="uncertain" elapsed={0} events={[]} />);
    expect(screen.getByRole("status").textContent).toMatch(
      /ei voida vahvistaa/,
    );
  });
});
