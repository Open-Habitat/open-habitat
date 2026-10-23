import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  progressLabel,
  UnpresentedEvents,
  WorkingProgress,
} from "./WorkingProgress";

describe("working progress", () => {
  it("keeps bookkeeping silent and logs unknown events without leaking payloads", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bookkeeping = [
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
      "entry_appended",
      "compaction_start",
      "compaction_end",
      "auto_compaction_start",
      "auto_compaction_end",
      "auto_retry_start",
      "auto_retry_end",
      "summarization_retry_scheduled",
      "summarization_retry_attempt_start",
      "summarization_retry_finished",
      "bash_execution_update",
      "extension_ui_request",
    ].map((type) => ({ type, payload: "private control payload" }));
    const { container, rerender } = render(
      <UnpresentedEvents events={bookkeeping} />,
    );
    expect(container.innerHTML).toBe("");
    expect(warn).not.toHaveBeenCalled();
    const unknown = {
      type: "future_event",
      payload: "<img src=x onerror=alert(1)>",
    };
    const events = [...bookkeeping, unknown];
    rerender(<UnpresentedEvents events={events} />);
    rerender(<UnpresentedEvents events={[...events]} />);
    expect(container.innerHTML).toBe("");
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "Unsupported native Pi event omitted from conversation",
    );
    // Even the type may contain private or attacker-controlled text.
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(
      /future_event|payload|onerror/,
    );
    const liveEvents = [
      { kind: "unknown.native", payload: "private-live-sentinel" },
    ];
    rerender(<UnpresentedEvents events={events} liveEvents={liveEvents} />);
    rerender(
      <UnpresentedEvents events={events} liveEvents={[...liveEvents]} />,
    );
    expect(warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      "private-live-sentinel",
    );
    expect(container.innerHTML).toBe("");
    warn.mockRestore();
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
    ).not.toMatch(/secret|credential|script/);
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

    expect(screen.queryByText("private")).toBeNull();
  });
  it("announces uncertain work through a status region", () => {
    render(<WorkingProgress state="uncertain" events={[]} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
