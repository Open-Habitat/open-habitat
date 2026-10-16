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
      draft: "",
      receipt: "",
      problem: "",
      serverUnavailable: false,
      alive,
      generation,
      submittedKey: "submitted",
      sendKey: "send",
      uncertainKey: "create",
      inFlightSend: { current: undefined },
      setBusy,
      setReceipt: vi.fn(),
      setSendObservation: vi.fn(),
      setConfirmStop: vi.fn(),
      changeDraft: vi.fn(),
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
