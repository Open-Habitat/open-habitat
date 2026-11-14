import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CommandList,
  readCommands,
  readStartPage,
  type StartPage,
} from "./composerReads";
import { ConversationStore } from "./conversationStore";
import { StartPageRead } from "./StartPageRead";

vi.mock("./composerReads", () => ({
  readStartPage: vi.fn(),
  readCommands: vi.fn(),
}));
const authored: StartPage = {
  title: "Repository title",
  body: "Repository introduction",
  goals: [
    {
      title: "Goal",
      what: "A concrete result",
      steps: ["Read the context", "Check the result"],
      when: "",
      prompt: "Native prompt",
    },
  ],
};
beforeEach(() => {
  vi.mocked(readStartPage).mockReset();
  vi.mocked(readCommands).mockReset();
});

describe("start page lifetime", () => {
  it.each([authored, null, { state: "needs_update" } as const])(
    "retains an empty conversation's page across route remounts (%j)",
    async (page) => {
      vi.mocked(readStartPage).mockResolvedValue(page);
      const store = new ConversationStore("person");
      store.view("pi:first", true);
      const onChange = vi.fn();
      const props = {
        workspaceId: "workspace",
        agentId: "pi:first",
        store,
        draft: "Draft",
        onChange,
      };
      const first = render(<StartPageRead {...props} />);
      const ready = !page
        ? "start-page-create"
        : "state" in page
          ? "start-page-needs-update"
          : "starting-goal";
      await waitFor(() => expect(screen.queryByTestId(ready)).not.toBeNull());
      first.unmount();
      render(<StartPageRead {...props} />);
      await waitFor(() => expect(screen.queryByTestId(ready)).not.toBeNull());
      expect(readStartPage).toHaveBeenCalledTimes(1);
      if (page && !("state" in page)) {
        fireEvent.click(screen.getByTestId("starting-goal"));
        await waitFor(() =>
          expect(onChange).toHaveBeenCalledWith("Native prompt\n\nDraft\n\n"),
        );
      }
    },
  );

  it("finishes an in-flight page read after navigating away", async () => {
    let finish!: (value: Awaited<ReturnType<typeof readStartPage>>) => void;
    vi.mocked(readStartPage).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const store = new ConversationStore("person");
    store.view("pi:first", true);
    const props = {
      workspaceId: "workspace",
      agentId: "pi:first",
      store,
      draft: "",
      onChange: vi.fn(),
    };
    const first = render(<StartPageRead {...props} />);
    first.unmount();
    const signal = vi.mocked(readStartPage).mock.calls[0][1];
    expect(signal?.aborted).toBe(false);
    render(<StartPageRead {...props} />);
    finish(authored);
    await waitFor(() =>
      expect(screen.queryByTestId("starting-goal")).not.toBeNull(),
    );
    expect(readStartPage).toHaveBeenCalledTimes(1);
  });

  it("does not retain failed reads and cancels on identity disposal", async () => {
    const store = new ConversationStore("person");
    store.view("pi:first", true);
    vi.mocked(readStartPage).mockRejectedValueOnce(new Error("offline"));
    await expect(store.startPage("pi:first", "workspace")).rejects.toThrow(
      "offline",
    );
    vi.mocked(readStartPage).mockResolvedValueOnce(authored);
    await expect(store.startPage("pi:first", "workspace")).resolves.toEqual(
      authored,
    );
    expect(readStartPage).toHaveBeenCalledTimes(2);
    store.dispose();
    expect(vi.mocked(readStartPage).mock.calls[1][1]?.aborted).toBe(true);
  });

  it("reads again for another conversation, evicted window, or identity", async () => {
    vi.mocked(readStartPage).mockResolvedValue(null);
    const store = new ConversationStore("person", undefined, 1);
    const show = async (store: ConversationStore, agentId: string) => {
      store.view(agentId, true);
      const view = render(
        <StartPageRead
          workspaceId="workspace"
          agentId={agentId}
          store={store}
          draft=""
          onChange={vi.fn()}
        />,
      );
      await waitFor(() =>
        expect(screen.queryByTestId("start-page-create")).not.toBeNull(),
      );
      view.unmount();
    };
    await show(store, "pi:first");
    await show(store, "pi:second");
    await show(store, "pi:first");
    store.dispose();
    await show(new ConversationStore("other-person"), "pi:first");
    expect(readStartPage).toHaveBeenCalledTimes(4);
  });
});

it("focuses and selects the prepared draft after a delayed controlled-input commit", async () => {
  if (!("goals" in authored)) throw new Error("fixture");
  vi.mocked(readStartPage).mockResolvedValue({
    ...authored,
    goals: [{ ...authored.goals[0], prompt: "Investigate [observation]" }],
  });
  const onChange = vi.fn();
  const content = (draft: string) => (
    <div className="ah-conversation-frame">
      <StartPageRead
        workspaceId="workspace"
        draft={draft}
        onChange={onChange}
      />
      <textarea data-testid="draft" value={draft} onChange={() => {}} />
    </div>
  );
  const view = render(content("Original"));
  await waitFor(() =>
    expect(screen.queryByTestId("starting-goal")).not.toBeNull(),
  );
  // Let any frame callback run before the parent commits the controlled value,
  // as can happen under load. A single-frame focus attempt loses the intent.
  const frame = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  const prepared = "Investigate\n\nOriginal\n\n[observation]";
  try {
    fireEvent.click(screen.getByTestId("starting-goal"));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(prepared));
  } finally {
    frame.mockRestore();
  }
  const field = screen.getByTestId("draft") as HTMLTextAreaElement;
  expect(document.activeElement).not.toBe(field);
  expect(field.value).toBe("Original");
  view.rerender(content(prepared));
  expect(document.activeElement).toBe(field);
  expect(field.value.slice(field.selectionStart, field.selectionEnd)).toBe(
    "[observation]",
  );
  // Later typing must not reapply the selection or steal focus back.
  screen.getByTestId("starting-goal").focus();
  view.rerender(content("Edited"));
  expect(document.activeElement).not.toBe(field);
});

it("reads prose without Pi and resolves an authored skill only when preparing a draft", async () => {
  if (!("goals" in authored)) throw new Error("fixture");
  vi.mocked(readStartPage).mockResolvedValue({
    ...authored,
    goals: [{ ...authored.goals[0], skill: "native" }],
  });
  let finish!: (list: CommandList) => void;
  vi.mocked(readCommands).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const onChange = vi.fn();
  const props = { workspaceId: "workspace", draft: "Original", onChange };
  const view = render(<StartPageRead {...props} />);
  await waitFor(() =>
    expect(screen.queryByTestId("starting-goal")).not.toBeNull(),
  );
  expect(readCommands).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("starting-goal"));
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(<StartPageRead {...props} draft="Edited during lookup" />);
  finish({ answered_by: "helper", commands: [] });
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      "Native prompt\n\nEdited during lookup\n\n",
    ),
  );
  expect(screen.queryByTestId("goal-guide")).toBeNull();
});

it("leaves the request to the goal's own skill and selects the placeholder after the chip", async () => {
  if (!("goals" in authored)) throw new Error("fixture");
  const goal = {
    ...authored.goals[0],
    prompt: "Native prompt\n\n[observation]",
    skill: "native",
  };
  vi.mocked(readStartPage).mockResolvedValue({ ...authored, goals: [goal] });
  const skill = (description: string): CommandList => ({
    answered_by: "helper",
    commands: [
      {
        name: "skill:native",
        source: "skill",
        scope: "project",
        description,
        terminal_only: false,
      },
    ],
  });
  const onChange = vi.fn();
  const onStarted = vi.fn();
  // The composer shows the skill call as a chip and the field the rest.
  const content = (draft: string) => (
    <div className="ah-conversation-frame">
      <StartPageRead
        workspaceId="workspace"
        draft={draft}
        onChange={onChange}
        onStarted={onStarted}
      />
      <textarea
        data-testid="draft"
        value={draft.replace(/^\/skill:native /, "")}
        onChange={() => {}}
      />
    </div>
  );
  vi.mocked(readCommands).mockResolvedValue(skill(" Goal "));
  const view = render(content(""));
  await waitFor(() =>
    expect(screen.queryByTestId("starting-goal")).not.toBeNull(),
  );
  fireEvent.click(screen.getByTestId("starting-goal"));
  const prepared = "/skill:native [observation]";
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(prepared));
  expect(onStarted).toHaveBeenCalledWith(
    goal,
    "Repository title",
    {
      text: prepared,
      selectionStart: "/skill:native ".length,
      selectionEnd: prepared.length,
    },
    false,
  );
  view.rerender(content(prepared));
  const field = screen.getByTestId("draft") as HTMLTextAreaElement;
  expect(document.activeElement).toBe(field);
  expect(field.value.slice(field.selectionStart, field.selectionEnd)).toBe(
    "[observation]",
  );

  // A general skill the goal borrows does not hold its request.
  vi.mocked(readCommands).mockResolvedValue(skill("Some general skill"));
  view.rerender(content(""));
  fireEvent.click(screen.getByTestId("starting-goal"));
  await waitFor(() =>
    expect(onChange).toHaveBeenLastCalledWith(
      "/skill:native Native prompt\n\n[observation]",
    ),
  );
});
