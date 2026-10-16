import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { showMissedEvents } from "./BrowserConversation";
import { ConversationStore } from "./conversationStore";
import { HistoryView } from "./HistoryView";
import type { HistoryEntry } from "./history";
import type { Agent } from "./snapshot";
import {
  useReadingPosition,
  useReadingPositionLayout,
} from "./useReadingPosition";

const entry = (key: string): HistoryEntry => ({
  entry_key: key,
  kind: "assistant",
  content: { media_type: "text/plain", text: key, complete: true },
});

function Reader({
  id,
  entries,
  store,
}: {
  id: string;
  entries: HistoryEntry[];
  store: ConversationStore;
}) {
  const position = useReadingPosition(entries, undefined, id, store);
  useReadingPositionLayout({
    entries,
    live: undefined,
    queueOpen: false,
    receipt: "",
    problem: "",
    details: false,
    confirmStop: false,
    currentState: undefined,
    events: [],
    feed: position.feed,
    wasAtBottom: position.wasAtBottom,
    readingAnchor: position.readingAnchor,
    restoreAnchor: position.restoreAnchor,
    setUnseen: position.setUnseen,
  });
  return (
    <div
      ref={position.feed as React.Ref<HTMLDivElement>}
      className="viewport"
      onScroll={() => {
        const viewport = position.feed.current;
        if (!viewport) return;
        position.wasAtBottom.current =
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
          60;
        if (position.wasAtBottom.current) {
          position.readingAnchor.current = undefined;
          store.savePosition(id);
        } else position.captureAnchor();
      }}
    >
      <ul className="ah-feed">
        {entries.map((e) => (
          <li key={e.entry_key} data-key={e.entry_key}>
            {e.entry_key}
          </li>
        ))}
      </ul>
    </div>
  );
}

// jsdom has no layout; each row occupies 100 px, relative to the scroll container.
function geometry() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    const row = this.matches(".ah-feed > li");
    const keys = [...document.querySelectorAll(".ah-feed > li")];
    const top = row
      ? keys.indexOf(this as HTMLLIElement) * 100 -
        (this.closest(".viewport, .ah-conversation-stream")?.scrollTop ?? 0)
      : 0;
    return {
      top,
      bottom: top + (row ? 100 : 300),
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  };
  const height = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "scrollHeight",
  );
  const client = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientHeight",
  );
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return this.querySelectorAll(".ah-feed > li").length * 100;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 300,
  });
  return () => {
    vi.unstubAllGlobals();
    HTMLElement.prototype.getBoundingClientRect = original;
    if (height)
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", height);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
    if (client)
      Object.defineProperty(HTMLElement.prototype, "clientHeight", client);
    else Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  };
}

for (const { row, offset } of [
  { row: 0, offset: 0 },
  { row: 12, offset: 47 },
]) {
  it(`keeps older-page reply ${row + 1} at viewport offset ${offset} while paging, but opens latest on return`, () => {
    const restore = geometry();
    try {
      const store = new ConversationStore("reader");
      const tail = Array.from({ length: 25 }, (_, n) =>
        entry(`reply-${n + 26}`),
      );
      const older = Array.from({ length: 25 }, (_, n) =>
        entry(`reply-${n + 1}`),
      );
      const view = render(
        <Reader id="controlled" entries={tail} store={store} />,
      );
      const viewport = view.container.querySelector<HTMLElement>(".viewport");
      if (!viewport) throw new Error("missing viewport");
      viewport.scrollTop = 50;
      fireEvent.scroll(viewport); // capture before the older page joins
      view.rerender(
        <Reader id="controlled" entries={[...older, ...tail]} store={store} />,
      );
      viewport.scrollTop = row * 100 + offset;
      fireEvent.scroll(viewport);
      expect(store.position("controlled")).toEqual({
        key: `reply-${row + 1}`,
        offset: offset ? -offset : 0,
      });
      view.unmount(); // Home removes the controlled route entirely
      const returned = render(
        <Reader id="controlled" entries={[...older, ...tail]} store={store} />,
      );
      const feed = returned.container.querySelector<HTMLElement>(".viewport");
      if (!feed) throw new Error("missing viewport");
      expect(feed.scrollTop).toBe(feed.scrollHeight);
      expect(feed.querySelector(".ah-feed > li")?.textContent).toBe("reply-1");
      returned.unmount();
    } finally {
      restore();
    }
  });
}

it("opens latest rather than a stored anchor on a read-only history return", () => {
  const restore = geometry();
  try {
    const store = new ConversationStore("reader");
    const agent: Agent = {
      agent_id: "pi:readonly",
      workspace_id: "ws",
      history: "readable",
      process: "unknown",
      control: "none",
      title: { display: "Archive" },
      live_tail: [],
    };
    store.view(agent.agent_id, true);
    store.applyPage(agent.agent_id, {
      schema_version: 1,
      agent_id: agent.agent_id,
      native_revision: "r1",
      entries: Array.from({ length: 40 }, (_, n) => entry(`reply-${n + 1}`)),
      older_complete: true,
    });
    const renderArchive = () =>
      render(
        <MemoryRouter>
          <HistoryView
            agent={agent}
            workspaceId="ws"
            workspaceName="Archive"
            onLogin={() => {}}
            store={store}
          />
        </MemoryRouter>,
      );
    const first = renderArchive();
    const viewport = first.container.querySelector<HTMLElement>(
      ".ah-conversation-stream",
    );
    if (!viewport) throw new Error("missing read-only stream");
    fireEvent.wheel(viewport, { deltaY: -100 });
    viewport.scrollTop = 47;
    fireEvent.scroll(viewport);
    expect(store.position(agent.agent_id)).toEqual({
      key: "reply-1",
      offset: -47,
    });
    first.unmount();
    const returned = renderArchive();
    const feed = returned.container.querySelector<HTMLElement>(
      ".ah-conversation-stream",
    );
    expect(feed?.scrollTop).toBe(feed?.scrollHeight);
    returned.unmount();
  } finally {
    restore();
  }
});

it("does not call the bounded status diagnostic tail a live-stream gap", () => {
  const status = {
    event_loss: true,
    native_history: "present",
  } as import("./conversations").Status;
  expect(showMissedEvents(false, status)).toBe(false);
  expect(showMissedEvents(true, status)).toBe(true);
  expect(
    showMissedEvents(false, { ...status, native_history: "missing" }),
  ).toBe(true);
});

it("counts new native replies, not tool results, and does not recount older pages", () => {
  const store = new ConversationStore("reader");
  store.savePosition("one", { key: "a", offset: 0 });
  function Counter({ entries }: { entries: HistoryEntry[] }) {
    const reading = useReadingPosition(entries, undefined, "one", store);
    reading.wasAtBottom.current = false; // reader has moved away during this visit
    return <span data-testid="unread">{reading.unseen}</span>;
  }
  const view = render(<Counter entries={[entry("a")]} />);
  const tool: HistoryEntry = { ...entry("tool"), kind: "tool" };
  view.rerender(
    <Counter entries={[entry("a"), tool, entry("b"), entry("c")]} />,
  );
  expect(view.getByTestId("unread").textContent).toBe("2");
  view.rerender(
    <Counter
      entries={[entry("older"), entry("a"), tool, entry("b"), entry("c")]}
    />,
  );
  expect(view.getByTestId("unread").textContent).toBe("2");
});
