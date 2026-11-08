import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ConversationWeight } from "./ConversationWeight";

const MiB = 1024 * 1024;

it("says nothing below the warning size", () => {
  render(
    <ConversationWeight
      agentId="pi:a"
      bytes={200 * MiB}
      onNewConversation={vi.fn()}
    />,
  );
  expect(screen.queryByTestId("conversation-weight")).toBeNull();
});

it("warns once near the advised size, and the warning can be put away", () => {
  const start = vi.fn();
  const { rerender } = render(
    <ConversationWeight
      agentId="pi:b"
      bytes={400 * MiB}
      onNewConversation={start}
    />,
  );
  const warning = screen.getByTestId("conversation-weight");
  expect(warning.dataset.state).toBe("near");
  expect(warning.textContent).toContain("400 Mt");
  fireEvent.click(screen.getByTestId("conversation-weight-new"));
  expect(start).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId("conversation-weight-dismiss"));
  expect(screen.queryByTestId("conversation-weight")).toBeNull();
  // Put away it stays away while the conversation grows below the line …
  rerender(
    <ConversationWeight
      agentId="pi:b"
      bytes={450 * MiB}
      onNewConversation={start}
    />,
  );
  expect(screen.queryByTestId("conversation-weight")).toBeNull();
  // … and past it the offer of a new conversation always shows.
  rerender(
    <ConversationWeight
      agentId="pi:b"
      bytes={530 * MiB}
      onNewConversation={start}
    />,
  );
  const heavy = screen.getByTestId("conversation-weight");
  expect(heavy.dataset.state).toBe("heavy");
  expect(heavy.textContent).toContain("530 Mt");
  expect(screen.queryByTestId("conversation-weight-dismiss")).toBeNull();
});
