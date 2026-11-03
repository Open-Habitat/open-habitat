import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { controlledTransport } from "../test/controlledTransport";
import { BrowserConversation } from "./BrowserConversation";
import type { ConversationPager } from "./conversationPager";
import { ConversationStore } from "./conversationStore";
import type { Status } from "./conversations";
import * as conversations from "./conversations";
import { creationKeys } from "./heldMessages";
import type { Agent, Workspace } from "./snapshot";

// The person's input while the conversation view becomes ready: what they
// type and send in the view of a conversation being created or still
// loading is the same field's, and a message the view cannot act on yet
// waits and goes once it can. The status read that opens the conversation
// answers only when the test delivers it.

const agent = "pi:44444444-1111-4111-8111-111111111111";
const life = "11111111-1111-4111-8111-111111111111";
const workspace = {
  workspace_id: "ws_test",
  name: "synthetic",
  kind: "directory",
  visibility: "visible",
  mutation_state: "allowed",
  presence: "present",
  facts: [],
} as unknown as Workspace;
const status = (fields: Partial<Status> = {}): Status =>
  ({
    agent_id: agent,
    workspace_id: workspace.workspace_id,
    state: "idle",
    run_active: false,
    command_id: "",
    ack: "",
    send_receipt: "",
    event_cursor: 0,
    journal_cursor: `ev1:${life}:1`,
    events: [],
    event_loss: false,
    native_history: "missing",
    continuation: "unproven",
    native_revision: "",
    history_query: `/api/v1/agents/${agent}/history`,
    queue: { revision: 0, steering: [], follow_up: [] },
    ...fields,
  }) as Status;

let transport: ReturnType<typeof controlledTransport>;
let store: ConversationStore;
let sent: string[];
let wakes: number;
beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  transport = controlledTransport();
  sent = [];
  wakes = 0;
  // Everything else the view reads stays on its way.
  vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
  let reads = 0;
  vi.spyOn(conversations, "status").mockImplementation(() =>
    transport.reply(`status ${++reads}`, status()),
  );
  vi.spyOn(conversations, "send").mockImplementation(async (_id, text) => {
    sent.push(text);
    return new Promise(() => {});
  });
  vi.spyOn(conversations, "continueConversation").mockImplementation(
    async () => {
      wakes++;
      return new Promise(() => {});
    },
  );
  const pager = {
    tail: vi.fn(() => new Promise(() => {})),
    older: vi.fn(),
    reconnect: vi.fn(async () => ({ pages: [], met: true })),
    cancelAll: vi.fn(),
  } as unknown as ConversationPager;
  store = new ConversationStore(
    "person",
    pager,
    50,
    () => new Promise(() => {}),
  );
});
afterEach(() => {
  cleanup();
  store.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const conversation = (fields: Partial<Agent>): Agent =>
  ({
    agent_id: agent,
    workspace_id: workspace.workspace_id,
    archive: "active",
    history: "readable",
    process: "",
    control: "",
    title: { display: "" },
    live_tail: [],
    ...fields,
  }) as Agent;

type Props = ComponentProps<typeof BrowserConversation>;
const ignore = () => {};
function view(props: Partial<Props>) {
  return (
    <MemoryRouter initialEntries={[`/workspaces/${workspace.workspace_id}`]}>
      <BrowserConversation
        workspace={workspace}
        identity="person"
        store={store}
        journalOffline={false}
        serverUnavailable={false}
        onStatusEvent={() => ignore}
        csrf="synthetic-csrf"
        onLogin={ignore}
        onSessionCreated={ignore}
        {...props}
      />
    </MemoryRouter>
  );
}
const field = () => screen.getByRole("textbox") as HTMLTextAreaElement;
const frame = () =>
  document.querySelector(".ah-conversation-frame") as HTMLElement;
const waiting = () =>
  [...document.querySelectorAll("[data-testid=waiting-message]")].map(
    (bubble) => bubble.querySelector("[data-testid=user-content]")?.textContent,
  );

describe("the conversation view while it becomes ready", () => {
  it("keeps the field the person types in from creation to the opened conversation", async () => {
    const shown = render(view({ viewKey: "created-here", creation: {} }));
    const typedIn = field();
    expect(frame().dataset.view).toBe("creation");
    expect(document.activeElement).toBe(typedIn);
    fireEvent.change(typedIn, { target: { value: "Kerro, mitä" } });
    // The creation answers: the view takes the conversation's ID and loads.
    shown.rerender(view({ viewKey: "created-here", id: agent }));
    expect(frame().dataset.view).toBe("loading");
    expect(field()).toBe(typedIn);
    expect(document.activeElement).toBe(typedIn);
    expect(typedIn.value).toBe("Kerro, mitä");
    fireEvent.change(typedIn, { target: { value: "Kerro, mitä täällä on" } });
    await act(() => transport.deliver("status 1"));
    expect(frame().dataset.view).toBe("opened");
    expect(field()).toBe(typedIn);
    expect(document.activeElement).toBe(typedIn);
    expect(typedIn.value).toBe("Kerro, mitä täällä on");
    // What was typed into the creation view is this conversation's draft.
    expect(
      sessionStorage.getItem(creationKeys("person", "ws_test").draft),
    ).toBe(null);
  });

  it("keeps messages sent while it loads and sends them in order once it has opened", async () => {
    render(view({ id: agent }));
    expect(frame().dataset.view).toBe("loading");
    for (const text of ["Ensimmäinen", "Toinen"]) {
      fireEvent.change(field(), { target: { value: text } });
      fireEvent.keyDown(field(), { key: "Enter" });
    }
    // The text leaves the field as a sent one does and waits, in order.
    expect(field().value).toBe("");
    expect(waiting()).toEqual(["Ensimmäinen", "Toinen"]);
    expect(sent).toEqual([]);
    await act(() => transport.deliver("status 1"));
    // Pi is idle: the first goes now, the second once the first is answered.
    expect(sent).toEqual(["Ensimmäinen"]);
    expect(waiting()).toEqual(["Toinen"]);
  });

  it("gives kept messages back into the field, saying why, when the opened conversation cannot take them", async () => {
    // The daemon does not know what became of an earlier command.
    let reads = 0;
    vi.mocked(conversations.status).mockImplementation(() =>
      transport.reply(`status ${++reads}`, status({ state: "uncertain" })),
    );
    render(view({ id: agent }));
    fireEvent.change(field(), { target: { value: "Jäänyt" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(waiting()).toEqual(["Jäänyt"]);
    // An uncertain state is read twice before the conversation opens.
    await act(() => transport.deliver("status 1"));
    await act(() => transport.deliver("status 2"));
    expect(sent).toEqual([]);
    expect(waiting()).toEqual([]);
    expect(field().value).toBe("Jäänyt");
    screen.getByTestId("held-message-notice");
  });

  it("gives messages kept by a view that is gone back into the field, not sent later", () => {
    const first = render(view({ id: agent }));
    fireEvent.change(field(), { target: { value: "Kesken jäänyt" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(waiting()).toEqual(["Kesken jäänyt"]);
    // A reload: this document's view is gone without a word.
    first.unmount();
    render(view({ id: agent }));
    expect(waiting()).toEqual([]);
    expect(field().value).toBe("Kesken jäänyt");
    expect(sent).toEqual([]);
  });

  it("wakes a resting agent for what was typed before the view knew it rests", async () => {
    vi.mocked(conversations.status).mockImplementation(() =>
      transport.reply("status", status({ state: "stopped" })),
    );
    const archive = conversation({
      rest: { cause: "idle", at: "2026-11-02T10:00:00Z" },
    });
    render(view({ id: agent, archive }));
    fireEvent.change(field(), { target: { value: "h" } });
    expect(wakes).toBe(0);
    await act(() => transport.deliver("status"));
    expect(wakes).toBe(1);
  });
});
