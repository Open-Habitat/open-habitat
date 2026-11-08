import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useConversationActions } from "./ConversationActions";
import * as conversations from "./conversations";

afterEach(() => vi.restoreAllMocks());

it("fences the previous view before handing off and cannot clear the new view's busy state", async () => {
  const alive = { current: true };
  const generation = { current: 1 };
  const setBusy = vi.fn();
  const created = {
    agent_id: "pi:new",
    workspace_id: "ws_test",
    state: "idle",
  };
  vi.spyOn(conversations, "createTracked").mockResolvedValue(created);
  const close = vi
    .spyOn(conversations, "closeEmpty")
    .mockResolvedValue(undefined);
  const onSessionCreated = vi.fn(() => {
    expect(alive.current).toBe(false);
    expect(generation.current).toBeGreaterThan(1);
  });
  const navigate = vi.fn(() => {
    // The next view may already be active when the old close reply arrives.
    alive.current = true;
    generation.current += 2;
  });
  const { result } = renderHook(() =>
    useConversationActions({
      workspace: {
        workspace_id: "ws_test",
        name: "synthetic",
        kind: "directory",
        visibility: "visible",
        mutation_state: "allowed",
        presence: "present",
        facts: [],
      },
      id: "pi:previous",
      csrf: "synthetic-csrf",
      ambiguous: null,
      busy: false,
      entries: [],
      draft: "",
      receipt: "",
      problem: "",
      serverUnavailable: false,
      alive,
      generation,
      submittedKey: "submitted",
      sendKey: "send",
      uncertainKey: "create",
      answeredKey: "answered",
      sentAfterKey: "sent-after",
      resentKey: "resent",
      setBusy,
      setReceipt: vi.fn(),
      setSendObservation: vi.fn(),
      setConfirmStop: vi.fn(),
      changeDraft: vi.fn(),
      onSent: vi.fn(),
      onQueued: vi.fn(),
      refresh: vi.fn(),
      onLogin: vi.fn(),
      onSessionCreated,
      navigate,
    }),
  );
  await act(() => result.current.start({ model: "synthetic-model" }, true));
  expect(onSessionCreated).toHaveBeenCalledWith(created);
  expect(navigate).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledWith("pi:previous", "synthetic-csrf");
  expect(setBusy.mock.calls).toEqual([[true], [false]]);
});

it("keeps a send's history mark only when nothing else could carry its text", async () => {
  const lost = vi
    .spyOn(conversations, "queueMessage")
    .mockRejectedValue(new Error("network"));
  const run = async (steering: string[]) => {
    sessionStorage.clear();
    const { result } = renderHook(() =>
      useConversationActions({
        workspace: {
          workspace_id: "ws_test",
          name: "synthetic",
          kind: "directory",
          visibility: "visible",
          mutation_state: "allowed",
          presence: "present",
          facts: [],
        },
        id: "pi:a",
        csrf: "synthetic-csrf",
        ambiguous: null,
        busy: false,
        current: {
          agent_id: "pi:a",
          workspace_id: "ws_test",
          state: "accepted",
          run_active: true,
          queue: { revision: 1, steering, follow_up: [] },
        } as never,
        entries: [
          {
            entry_key: "u1",
            kind: "user",
            content: {
              media_type: "text/plain",
              text: "jatka",
              complete: true,
            },
          },
        ],
        draft: "",
        receipt: "",
        problem: "",
        serverUnavailable: false,
        alive: { current: true },
        generation: { current: 1 },
        submittedKey: "submitted",
        sendKey: "send",
        uncertainKey: "uncertain",
        answeredKey: "answered",
        sentAfterKey: "sent-after",
        resentKey: "resent",
        setBusy: vi.fn(),
        setReceipt: vi.fn(),
        setSendObservation: vi.fn(),
        setConfirmStop: vi.fn(),
        changeDraft: vi.fn(),
        onSent: vi.fn(),
        onQueued: vi.fn(),
        refresh: vi.fn(),
        onLogin: vi.fn(),
        onSessionCreated: vi.fn(),
        navigate: vi.fn(),
      }),
    );
    await act(() => result.current.submitQueue("steer", "jatka"));
    return sessionStorage.getItem("sent-after");
  };
  expect(await run([])).toBe("u1");
  // An earlier "jatka" still in Pi's queue could be the newer message.
  expect(await run(["jatka"])).toBeNull();
  expect(lost).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem("uncertain")).not.toBeNull();
});
