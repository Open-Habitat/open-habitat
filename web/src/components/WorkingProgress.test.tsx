import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  UnpresentedEvents,
  WorkingProgress,
  progressLabel,
} from "./WorkingProgress";

describe("working progress", () => {
  it("shows pending questions and unknown events as inert text", () => {
    render(
      <UnpresentedEvents
        events={[
          { type: "question.requested", prompt: "Jatketaanko?" },
          { type: "future_event", payload: "<img src=x onerror=alert(1)>" },
        ]}
      />,
    );
    expect(screen.getByText("Pi odottaa vastausta")).toBeTruthy();
    expect(screen.getByText("Muu Pi:n viesti")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText(/Jatketaanko/)).toBeTruthy();
  });
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
