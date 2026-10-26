import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { SpinoffProvider } from "./SpinoffConversation";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("waits for the native session instead of polling a missing parent", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValue({ status: 404, ok: false });
  vi.stubGlobal("fetch", fetch);
  const parent = "pi:12345678-1234-4123-8123-123456789abc";
  const view = (recheck: string) => (
    <MemoryRouter>
      <SpinoffProvider parent={parent} recheck={recheck}>
        <span />
      </SpinoffProvider>
    </MemoryRouter>
  );
  const { rerender, unmount } = render(view("missing"));
  await act(() => vi.advanceTimersByTimeAsync(30000));
  // Not every 3 s while the daemon has no readable session.
  expect(fetch).toHaveBeenCalledTimes(1);
  rerender(view("present"));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(fetch).toHaveBeenCalledTimes(2);
  unmount();
});

const runID = "01m521vczarx5bkx086n64t1t2";
const parentID = "pi:12345678-1234-4123-8123-123456789abc";
function workerReply(availability: "available" | "unavailable") {
  return {
    schema_version: 1,
    parent_id: parentID,
    availability: "available",
    runs: [
      {
        run_id: runID,
        title: "kello-dst",
        created_at: "2026-10-26T10:00:00Z",
        state: "working",
        summary: "",
        preserved: false,
        branch: "",
        worktree: "",
        source_branch: "main",
        harness: "claude",
        brief: "Lisää testit kesäajalle.",
      },
    ],
    transcripts: [
      {
        node_id: "n-0001",
        harness: "claude",
        availability,
        truncated: false,
        entries:
          availability === "available"
            ? [
                {
                  entry_key: "b1",
                  kind: "user",
                  content: {
                    media_type: "text/plain",
                    text: "Lisää testit kesäajalle.",
                    complete: true,
                  },
                  blocks: [{ type: "text", text: "Lisää testit kesäajalle." }],
                },
                {
                  entry_key: "b2",
                  kind: "assistant",
                  content: {
                    media_type: "text/plain",
                    text: "",
                    complete: true,
                  },
                  blocks: [{ type: "text", text: "Luen testit." }],
                },
              ]
            : [],
      },
    ],
  };
}

// Pääte keskustelussa (Jari 26.10.2026): before a Claude worker's history is
// readable its terminal sits under the task; once readable, the history
// fills in, the terminal folds to the end and the view says it changed.
it("worker view: the brief and terminal before history, the conversation once it arrives, never a composer", async () => {
  vi.useFakeTimers();
  let availability: "available" | "unavailable" = "unavailable";
  const fetch = vi.fn().mockImplementation(async () => {
    const body = new TextEncoder().encode(
      JSON.stringify(workerReply(availability)),
    );
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetch);
  const { timelineItems } = await import("./HistoryView");
  const view = render(
    <MemoryRouter initialEntries={[`/w?spinoff=${runID}`]}>
      <SpinoffProvider
        parent={parentID}
        timeline={timelineItems}
        place={{ parentTitle: "Kellonäkymä", workspaceId: "ws_example123" }}
      >
        <span data-testid="parent-conversation" />
      </SpinoffProvider>
    </MemoryRouter>,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  const q = (id: string) =>
    view.container.querySelector(`[data-testid="${id}"]`);
  expect(q("parent-conversation")).toBeNull();
  expect(q("worker-band")).not.toBeNull();
  expect(q("message-input")).toBeNull();
  expect(q("worker-terminal-card")).not.toBeNull();
  expect(
    view.container.querySelector('[data-voice="brief"]')?.textContent,
  ).toContain("Lisää testit kesäajalle.");
  availability = "available";
  await act(() => vi.advanceTimersByTimeAsync(3100));
  expect(q("worker-terminal-card")).toBeNull();
  expect(view.container.textContent).toContain("Luen testit.");
  // The history's own first message is the brief; it is not shown twice.
  expect(view.container.querySelectorAll('[data-voice="brief"]')).toHaveLength(
    1,
  );
  expect(
    view.container.querySelector('[role="status"].ah-worker-arrived'),
  ).not.toBeNull();
  expect(q("message-input")).toBeNull();
  view.unmount();
});
