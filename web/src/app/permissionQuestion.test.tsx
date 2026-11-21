import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Status } from "./conversations";
import { usePermissionQuestion } from "./permissionQuestion";

const respond = vi.hoisted(() => vi.fn());
vi.mock("./conversations", async (original) => ({
  ...(await original<typeof import("./conversations")>()),
  respondQuestion: respond,
}));

const agent = "pi:11111111-1111-4111-8111-111111111111";
const question = (id: string): NonNullable<Status["pending_question"]> => ({
  request_id: id,
  question_kind: "permission",
  prompt: `Poista ${id}`,
  choices: [],
  permission: {
    action: `Poista ${id}`,
    consequence: "Poistuu.",
    call: { area: "ms-admin", tool: "delete-mail-folder", arguments: "" },
  },
});
const props = (
  q: Status["pending_question"] | undefined,
  runActive: boolean | undefined = true,
) => ({
  question: q,
  agentId: agent,
  identity: "person",
  csrf: "csrf",
  runActive,
  refresh: vi.fn(async () => {}),
  onLogin: vi.fn(),
  onOutcome: vi.fn(),
});

beforeEach(() => {
  sessionStorage.clear();
  respond.mockReset();
  respond.mockResolvedValue(undefined);
});

it("answers once, keeps the decision line and shows the next question", async () => {
  const { result, rerender } = renderHook((p) => usePermissionQuestion(p), {
    initialProps: props(question("q1")),
  });
  expect(result.current.open?.action).toBe("Poista q1");
  expect(result.current.lines).toEqual([
    { requestId: "q1", action: "Poista q1", decision: undefined },
  ]);
  await act(() => result.current.answer("allow"));
  expect(respond).toHaveBeenCalledWith(agent, "q1", "answer", "csrf", true);
  // The status still shows q1 until it refreshes: answered, not open.
  expect(result.current.open).toBeUndefined();
  await act(() => result.current.answer("deny"));
  expect(respond).toHaveBeenCalledTimes(1);
  rerender(props(question("q2")));
  await act(() => result.current.answer("deny"));
  expect(respond).toHaveBeenLastCalledWith(
    agent,
    "q2",
    "answer",
    "csrf",
    false,
  );
  rerender(props(null));
  expect(result.current.lines.map((l) => [l.requestId, l.decision])).toEqual([
    ["q1", "allow"],
    ["q2", "deny"],
  ]);
  // The turn ended: Pi's history holds the calls from here on.
  rerender(props(null, false));
  expect(result.current.lines).toEqual([]);
});

it("a reload neither reopens nor resends an answered question", () => {
  sessionStorage.setItem(`nah:person:question:${agent}:q1`, "deny");
  const { result } = renderHook((p) => usePermissionQuestion(p), {
    initialProps: props(question("q1")),
  });
  expect(result.current.open).toBeUndefined();
  expect(result.current.lines[0].decision).toBe("deny");
});

it("a generic question is not a permission question", () => {
  const { result } = renderHook((p) => usePermissionQuestion(p), {
    initialProps: props({
      request_id: "c1",
      question_kind: "confirm",
      prompt: "Jatketaanko?",
      choices: [],
    }),
  });
  expect(result.current.open).toBeUndefined();
  expect(result.current.lines).toEqual([]);
});
