import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConversationActions } from "./ConversationActions";
import type { ConversationPager } from "./conversationPager";
import { ConversationStore } from "./conversationStore";
import type { Status } from "./conversations";
import * as conversations from "./conversations";
import { useSentMessages } from "./sentMessages";
import type { Workspace } from "./snapshot";
import { useConversation } from "./useConversation";

// The person's own command, driven through the real hooks with a transport
// this test steps: each read and write answers only when the test says so,
// in the order a slow link produces.

const agent = "pi:33333333-1111-4111-8111-111111111111";
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
const status = (sequence: number, fields: Partial<Status> = {}): Status =>
  ({
    agent_id: agent,
    workspace_id: workspace.workspace_id,
    state: "accepted",
    run_active: true,
    command_id: "",
    ack: "",
    send_receipt: "",
    event_cursor: 0,
    journal_cursor: `ev1:${life}:${sequence}`,
    events: [],
    event_loss: false,
    native_history: "missing",
    continuation: "unproven",
    native_revision: "",
    history_query: `/api/v1/agents/${agent}/history`,
    queue: { revision: 0, steering: [], follow_up: [] },
    ...fields,
  }) as Status;
/** A reply the test releases. */
function later<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

let reads: ReturnType<typeof later<Status>>[];
let store: ConversationStore;
let listeners: Set<(id: string, kind: string) => void>;
beforeEach(() => {
  sessionStorage.clear();
  reads = [];
  vi.spyOn(conversations, "status").mockImplementation(() => {
    const read = later<Status>();
    reads.push(read);
    return read.promise;
  });
  vi.spyOn(conversations, "sendReceipt").mockResolvedValue(undefined);
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
  listeners = new Set();
});
afterEach(() => {
  cleanup();
  store.dispose();
  vi.restoreAllMocks();
});

const onStatusEvent = (listener: (id: string, kind: string) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const ignore = () => {};
/** The conversation view's command parts, wired as BrowserConversation
 * wires them. */
function useView(id: string | undefined) {
  const view = useConversation({
    workspace,
    id,
    identity: "person",
    store,
    journalOffline: false,
    onStatusEvent,
    onLogin: ignore,
  });
  const sent = useSentMessages({
    scope: `person/${id}`,
    entries: view.entries,
    queue: view.current?.queue,
    sendObservation: view.sendObservation,
    draft: view.draft,
    changeDraft: view.changeDraft,
  });
  const actions = useConversationActions({
    workspace,
    id,
    csrf: "synthetic-csrf",
    ambiguous: view.ambiguous,
    busy: view.busy,
    current: view.current,
    entries: view.entries,
    draft: view.draft,
    receipt: view.receipt,
    sendObservation: view.sendObservation,
    problem: view.problem,
    serverUnavailable: false,
    alive: view.alive,
    generation: view.generation,
    submittedKey: view.submittedKey,
    sendKey: view.sendKey,
    uncertainKey: view.uncertainKey,
    answeredKey: view.answeredKey,
    setBusy: view.setBusy,
    setReceipt: view.setReceipt,
    setSendObservation: view.setSendObservation,
    setConfirmStop: view.setConfirmStop,
    changeDraft: view.changeDraft,
    onSent: sent.onSent,
    onQueued: sent.onQueued,
    refresh: view.refresh,
    onLogin: ignore,
    onSessionCreated: ignore,
    navigate: view.navigate,
  });
  return { view, sent, actions };
}
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);
/** Answers the oldest unanswered status read. */
async function answer(value: Status) {
  const read = reads.shift();
  if (!read) throw new Error("no status read in flight");
  await act(async () => read.release(value));
}
const event = (kind: string) =>
  act(() => {
    for (const listener of listeners) listener(agent, kind);
  });

describe("the person's own command over a slow link", () => {
  it("keeps a steering message on its way out of the field, and Stop waits for it", async () => {
    const queued = later<void>();
    vi.spyOn(conversations, "queueMessage").mockReturnValue(queued.promise);
    const clear = vi.spyOn(conversations, "clearQueue").mockResolvedValue({
      steering: ["ohjaus"],
      follow_up: [],
      unanswered: [],
    });
    vi.spyOn(conversations, "abortTurn").mockResolvedValue(undefined);
    const { result } = renderHook(() => useView(agent), { wrapper });
    await answer(
      status(5, { command_id: crypto.randomUUID(), ack: "accepted" }),
    );
    expect(result.current.view.current?.state).toBe("accepted");

    act(() => result.current.view.changeDraft("ohjaus"));
    let sending!: Promise<void>;
    act(() => {
      sending = result.current.actions.submitQueue("steer");
    });
    // An event starts a read that the daemon answers from before the
    // message reached it: neither the status nor a receipt names it.
    await event("process.progress");
    await answer(status(6));
    expect(result.current.view.sendObservation?.state).toBe("pending");
    expect(result.current.view.draft).toBe("");
    expect(result.current.sent.queued.map((m) => m.text)).toEqual(["ohjaus"]);

    // Stop now would clear Pi's queue before the message is in it.
    act(() => result.current.actions.stopNow());
    expect(clear).not.toHaveBeenCalled();

    const command = sessionStorage.getItem(result.current.view.sendKey);
    await act(async () => queued.release());
    await answer(
      status(8, {
        command_id: command ?? "",
        ack: "accepted",
        queue: { revision: 1, steering: ["ohjaus"], follow_up: [] },
      }),
    );
    await act(() => sending);
    await waitFor(() => expect(clear).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.view.draft).toBe("ohjaus"));
  });

  it("resumes a send answered while the person was away as pending, keeping their new draft", async () => {
    const sent = later<"pending">();
    vi.spyOn(conversations, "send").mockReturnValue(sent.promise);
    const first = renderHook(() => useView(agent), { wrapper });
    await answer(status(5, { state: "idle", run_active: false }));
    act(() => first.result.current.view.changeDraft("hidas ensimmäinen vuoro"));
    let sending!: Promise<void>;
    act(() => {
      sending = first.result.current.actions.submit();
    });
    const { sendKey } = first.result.current.view;
    const command = sessionStorage.getItem(sendKey);
    expect(command).toBeTruthy();
    act(() => first.result.current.view.changeDraft("oma luonnos"));
    // The person opens another view; the send's reply arrives meanwhile.
    first.unmount();
    await act(async () => sent.release("pending"));
    await act(() => sending);
    const { result } = renderHook(() => useView(agent), { wrapper });
    // Not an unknown outcome: the host has the message.
    expect(result.current.view.sendObservation?.state).toBe("pending");
    expect(result.current.view.draft).toBe("oma luonnos");
    // The return reads its outcome from the record of its command.
    await answer(
      status(9, {
        state: "idle",
        run_active: false,
        command_id: command ?? "",
        ack: "accepted",
        send_receipt: "accepted",
      }),
    );
    await waitFor(() =>
      expect(result.current.view.sendObservation?.state).toBe("accepted"),
    );
    expect(result.current.view.draft).toBe("oma luonnos");
    expect(sessionStorage.getItem(sendKey)).toBeNull();
  });
});
