import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  progressLabel,
  UnpresentedEvents,
  WorkingProgress,
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
  it("consumes repeated Pi lifecycle/control frames without hiding future content", () => {
    const turn = [
      "agent_start",
      "turn_start",
      "message_start",
      "message_update",
      "tool_execution_start",
      "tool_execution_update",
      "tool_execution_end",
      "message_end",
      "turn_end",
      "agent_end",
      "agent_settled",
      "queue_update",
      "session_info_changed",
      "thinking_level_changed",
      "response",
    ].map((type) => ({ type, payload: "private control payload" }));
    render(
      <UnpresentedEvents
        events={[
          ...Array.from({ length: 12 }, () => turn).flat(),
          { type: "future_event", payload: "<img src=x onerror=alert(1)>" },
        ]}
      />,
    );
    expect(screen.getAllByText("Muu Pi:n viesti")).toHaveLength(1);
    expect(screen.queryByText(/private control payload/)).toBeNull();
    expect(screen.getByText(/future_event/)).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
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
    ).toBe("Käyttää työkalua");
    render(
      <WorkingProgress
        state="accepted"
        events={[
          {
            type: "tool_execution_start",
            toolName: "bash",
            arguments: "private",
          },
        ]}
      />,
    );
    expect(screen.getAllByText("Käyttää työkalua bash")[0]).toBeTruthy();
    expect(screen.queryByText("private")).toBeNull();
  });
  it("does not imply that a crashed child or its tools finished", () => {
    render(<WorkingProgress state="uncertain" events={[]} />);
    expect(screen.getByRole("status").textContent).toMatch(
      /ei voida vahvistaa/,
    );
  });
});
