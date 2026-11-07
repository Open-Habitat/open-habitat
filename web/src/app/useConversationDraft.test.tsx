import { act, fireEvent, render, renderHook } from "@testing-library/react";
import { type ReactNode, Suspense, startTransition, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Composer } from "../components/composer/Composer";
import { uploadAttachment } from "./attachments";
import { NotAdmitted, send } from "./conversations";
import {
  adoptCreation,
  creationKeys,
  readHeld,
  useHeldMessages,
} from "./heldMessages";
import { useConversationDraft } from "./useConversationDraft";

vi.mock("./attachments", async (actual) => ({
  ...(await actual<typeof import("./attachments")>()),
  uploadAttachment: vi.fn(),
}));
vi.mock("./conversations", async (actual) => ({
  ...(await actual<typeof import("./conversations")>()),
  send: vi.fn(),
}));
const noop = () => {};
afterEach(() => sessionStorage.clear());

it("does not carry a draft to another workspace, identity or existing conversation", () => {
  const { result, rerender } = renderHook(
    ({ identity, workspace, id }) =>
      useConversationDraft(identity, workspace, id),
    {
      initialProps: {
        identity: "person",
        workspace: "one",
        id: undefined as string | undefined,
      },
    },
  );
  act(() => result.current.changeDraft("private creation"));
  rerender({ identity: "other", workspace: "one", id: "created" });
  expect(result.current.draft).toBe("");
  rerender({ identity: "person", workspace: "two", id: undefined });
  expect(result.current.draft).toBe("");
  rerender({ identity: "person", workspace: "one", id: undefined });
  expect(result.current.draft).toBe("private creation");
  rerender({ identity: "person", workspace: "one", id: "created" });
  expect(result.current.draft).toBe("private creation");
  sessionStorage.setItem("nah:person:draft:existing", "existing draft");
  rerender({ identity: "person", workspace: "one", id: "existing" });
  expect(result.current.draft).toBe("existing draft");
});

it.each([
  ["before", "workspace"],
  ["during", "workspace"],
  ["after", "workspace"],
  ["before", "worktree"],
  ["during", "worktree"],
  ["after", "worktree"],
])(
  "keeps all six uploads when the first answers %s handover to %s",
  async (order, destination) => {
    const id = "pi:11111111-1111-4111-8111-111111111111";
    const references = Array.from(
      { length: 6 },
      (_, i) =>
        `[file-${i}.txt](/api/v1/attachments/22222222-2222-4222-8222-22222222222${i})`,
    );
    const replies: (() => void)[] = [];
    vi.mocked(uploadAttachment).mockImplementation(
      () =>
        new Promise((resolve) => {
          const reference = references[replies.length];
          replies.push(() =>
            resolve({ reference } as Awaited<
              ReturnType<typeof uploadAttachment>
            >),
          );
        }),
    );
    let created = (_id: string) => {};
    let release = () => {};
    let ready = false;
    let attempted = false;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    function Gate({
      agent,
      children,
    }: {
      agent?: string;
      children: ReactNode;
    }) {
      if (agent && !ready) {
        attempted = true;
        throw pending;
      }
      return children;
    }
    function View({ agent }: { agent?: string }) {
      const { draft, changeDraft } = useConversationDraft(
        "person",
        agent ? destination : "workspace",
        agent,
      );
      return (
        <Gate agent={agent}>
          <Composer
            value={draft}
            onChange={changeDraft}
            csrf="csrf"
            activity="idle"
            selectedWorkingMode="steer"
            onSendNow={noop}
            onSteer={noop}
            onFollowUp={noop}
            onModeChange={noop}
          />
        </Gate>
      );
    }
    function App() {
      const [agent, setAgent] = useState<string>();
      created = setAgent;
      return (
        <Suspense fallback={null}>
          <View agent={agent} />
        </Suspense>
      );
    }
    const view = render(<App />);
    const field = view.getByRole("textbox");
    fireEvent.drop(document, {
      dataTransfer: {
        files: references.map(
          (_, i) => new File(["synthetic"], `file-${i}.txt`),
        ),
        types: ["Files"],
      },
    });
    expect(replies).toHaveLength(1);
    if (order === "before") await act(async () => replies[0]());
    // App receives creation while upload is held, then React renders the ID
    // view but cannot commit it yet. No timing or CPU-load assumption.
    await act(async () => {
      adoptCreation("person", "workspace", id);
      startTransition(() => created(id));
    });
    expect(attempted).toBe(true);
    if (order === "during") await act(async () => replies[0]());
    await act(async () => {
      ready = true;
      release();
    });
    if (order === "after") await act(async () => replies[0]());
    for (let i = 1; i < 6; i++) {
      expect(replies).toHaveLength(i + 1);
      await act(async () => replies[i]());
    }
    expect(field.isConnected).toBe(true);
    expect(view.getAllByTestId("attachment-chip")).toHaveLength(6);
    expect(sessionStorage.getItem(`nah:person:draft:${id}`)).toBe(
      references.join("\n"),
    );
    expect(
      sessionStorage.getItem(creationKeys("person", "workspace").draft),
    ).toBeNull();
    view.unmount();
  },
);

it("waits for committed worktree handover before posting held messages and returning a refusal", async () => {
  const id = "created";
  let created = (_id: string) => {};
  let release = () => {};
  let ready = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(send).mockReset();
  vi.mocked(send).mockRejectedValueOnce(new NotAdmitted());
  vi.mocked(send).mockResolvedValue({} as Awaited<ReturnType<typeof send>>);
  const entries: never[] = [];
  const refresh = async () => {};
  function Gate({ agent, children }: { agent?: string; children: ReactNode }) {
    if (agent && !ready) throw pending;
    return children;
  }
  function View({ agent }: { agent?: string }) {
    const workspaceId = agent ? "worktree" : "workspace";
    const { draft, changeDraft } = useConversationDraft(
      "person",
      workspaceId,
      agent,
    );
    const held = useHeldMessages({
      identity: "person",
      workspaceId,
      id: agent,
      csrf: "csrf",
      entries,
      draft,
      changeDraft,
      refresh,
      onLogin: noop,
    });
    return (
      <Gate agent={agent}>
        <button
          type="button"
          data-testid="first"
          onClick={() => held.submit("first")}
        />
        <button
          type="button"
          data-testid="second"
          onClick={() => held.submit("second")}
        />
        <output data-testid="draft">{draft}</output>
      </Gate>
    );
  }
  function App() {
    const [agent, setAgent] = useState<string>();
    created = setAgent;
    return (
      <Suspense fallback={null}>
        <View agent={agent} />
      </Suspense>
    );
  }
  const view = render(<App />);
  fireEvent.click(view.getByTestId("first"));
  await act(async () => {
    adoptCreation("person", "workspace", id);
    startTransition(() => created(id));
  });
  await act(async () => fireEvent.click(view.getByTestId("second")));
  expect(send).not.toHaveBeenCalled();
  await act(async () => {
    ready = true;
    release();
  });
  expect(vi.mocked(send).mock.calls.map((call) => call[1])).toEqual([
    "first",
    "second",
  ]);
  expect(view.getByTestId("draft").textContent).toBe("first");
  expect(sessionStorage.getItem(`nah:person:draft:${id}`)).toBe("first");
  expect(
    readHeld(`nah:person:held:${id}`).map((message) => message.text),
  ).toEqual(["second"]);
  expect(readHeld(creationKeys("person", "workspace").held)).toEqual([]);
});
