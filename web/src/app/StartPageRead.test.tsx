import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readCommands, type StartPage } from "./composerReads";
import { ConversationStore } from "./conversationStore";
import { StartPageRead } from "./StartPageRead";

vi.mock("./composerReads", () => ({ readCommands: vi.fn() }));
const authored: StartPage = {
  title: "Repository title",
  body: "Repository introduction",
  goals: [{ title: "Goal", when: "", prompt: "Native prompt" }],
};
beforeEach(() => {
  vi.mocked(readCommands).mockReset();
});

describe("start page lifetime", () => {
  it.each([authored, null])(
    "retains an empty conversation's page across route remounts (%j)",
    async (page) => {
      vi.mocked(readCommands).mockResolvedValue({
        answered_by: "running",
        commands: [],
        start_page: page,
      });
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
      const ready = page ? "starting-goal" : "start-page-hint";
      await waitFor(() => expect(screen.queryByTestId(ready)).not.toBeNull());
      first.unmount();
      render(<StartPageRead {...props} />);
      await waitFor(() => expect(screen.queryByTestId(ready)).not.toBeNull());
      expect(readCommands).toHaveBeenCalledTimes(1);
      if (page) {
        fireEvent.click(screen.getByTestId("starting-goal"));
        expect(onChange).toHaveBeenCalledWith("Native prompt\n\nDraft");
      }
    },
  );

  it("finishes an in-flight page read after navigating away", async () => {
    let finish!: (value: Awaited<ReturnType<typeof readCommands>>) => void;
    vi.mocked(readCommands).mockImplementation(
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
    const signal = vi.mocked(readCommands).mock.calls[0][1];
    expect(signal?.aborted).toBe(false);
    render(<StartPageRead {...props} />);
    finish({ answered_by: "running", commands: [], start_page: authored });
    await waitFor(() =>
      expect(screen.queryByTestId("starting-goal")).not.toBeNull(),
    );
    expect(readCommands).toHaveBeenCalledTimes(1);
  });

  it("does not retain failed reads and cancels on identity disposal", async () => {
    const store = new ConversationStore("person");
    store.view("pi:first", true);
    vi.mocked(readCommands).mockRejectedValueOnce(new Error("offline"));
    await expect(store.startPage("pi:first")).rejects.toThrow("offline");
    vi.mocked(readCommands).mockResolvedValueOnce({
      answered_by: "running",
      commands: [],
      start_page: authored,
    });
    await expect(store.startPage("pi:first")).resolves.toEqual(authored);
    expect(readCommands).toHaveBeenCalledTimes(2);
    store.dispose();
    expect(vi.mocked(readCommands).mock.calls[1][1]?.aborted).toBe(true);
  });

  it("reads again for another conversation, evicted window, or identity", async () => {
    vi.mocked(readCommands).mockResolvedValue({
      answered_by: "helper",
      commands: [],
      start_page: null,
    });
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
        expect(screen.queryByTestId("start-page-hint")).not.toBeNull(),
      );
      view.unmount();
    };
    await show(store, "pi:first");
    await show(store, "pi:second");
    await show(store, "pi:first");
    store.dispose();
    await show(new ConversationStore("other-person"), "pi:first");
    expect(readCommands).toHaveBeenCalledTimes(4);
  });
});
