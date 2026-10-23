import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CommandList, FileList } from "../../app/composerReads";
import { Composer, type ComposerSources } from "./Composer";
import {
  caretToken,
  fileInsertion,
  fuzzyScore,
  shellCommand,
  shellExcluded,
  withLeadingCommand,
} from "./completion";

const noop = () => {};
const base = {
  activity: "idle" as const,
  selectedWorkingMode: "steer" as const,
  onChange: noop,
  onSendNow: noop,
  onSteer: noop,
  onFollowUp: noop,
  onModeChange: noop,
};
const field = (view: ReturnType<typeof render>) =>
  view.getByRole("textbox") as HTMLTextAreaElement;

describe("composer text rules", () => {
  it("opens `/` only at a word start and `@` anywhere, never inside a shell command", () => {
    expect(caretToken("/rev", 4)).toMatchObject({
      kind: "cmd",
      query: "rev",
      atStart: true,
    });
    expect(caretToken("katso /rev", 10)).toMatchObject({
      kind: "cmd",
      atStart: false,
    });
    // A path closes the list: the second slash is not a name character.
    expect(caretToken("/tmp/notes.md", 13)).toBeNull();
    expect(caretToken("lue @scr", 8)).toMatchObject({
      kind: "file",
      query: "scr",
      start: 4,
    });
    expect(caretToken("a/b", 3)).toBeNull();
    expect(caretToken("!git diff @x", 12)).toBeNull();
  });
  it("reads `!` and `!!` as Pi's TUI does", () => {
    expect(shellCommand("!  make serve ")).toBe("make serve");
    expect(shellExcluded("!!ls")).toBe(true);
    expect(shellExcluded("!ls")).toBe(false);
    expect(shellCommand("!!ls")).toBe("ls");
  });
  it("quotes paths for a shell and marks them with @ in a message", () => {
    expect(fileInsertion(["a b.md", "c.md"], true)).toBe("'a b.md' c.md ");
    expect(fileInsertion(["it's.md"], true)).toBe(`'it'\\''s.md' `);
    expect(fileInsertion(["docs/x.md"], false)).toBe("@docs/x.md ");
  });
  it("puts a chosen command at the start, replacing one already there", () => {
    expect(withLeadingCommand("/review korjaa", "skill:git-commit")).toEqual({
      start: 0,
      end: 8,
      insert: "/skill:git-commit ",
    });
    expect(withLeadingCommand("korjaa", "review")).toEqual({
      start: 0,
      end: 0,
      insert: "/review ",
    });
  });
  it("ranks substring and word-start matches above scattered ones", () => {
    expect(fuzzyScore("scripts/status_rows.py", "status")).toBeGreaterThan(
      fuzzyScore("tests/sat_tau_us.py", "status"),
    );
    expect(fuzzyScore("README.md", "zz")).toBe(0);
  });
});

describe("composer keys and controls", () => {
  it("sends with Enter, steers while Pi works, and Alt+Enter goes once the other way", () => {
    const now = vi.fn();
    const steer = vi.fn();
    const follow = vi.fn();
    const props = {
      ...base,
      value: "Ohje",
      onSendNow: now,
      onSteer: steer,
      onFollowUp: follow,
    };
    const view = render(<Composer {...props} />);
    fireEvent.keyDown(field(view), { key: "Enter" });
    expect(now).toHaveBeenCalledTimes(1);
    view.rerender(<Composer {...props} activity="working" />);
    fireEvent.keyDown(field(view), { key: "Enter" });
    expect(steer).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(field(view), { key: "Enter", altKey: true });
    expect(follow).toHaveBeenCalledTimes(1);
    // Shift+Enter is a new line, and IME composition owns Enter.
    fireEvent.keyDown(field(view), { key: "Enter", shiftKey: true });
    fireEvent.keyDown(field(view), { key: "Enter", isComposing: true });
    expect(steer).toHaveBeenCalledTimes(1);
  });
  it("swaps the working mode from its chip", () => {
    const mode = vi.fn();
    const view = render(
      <Composer
        {...base}
        value="x"
        activity="working"
        selectedWorkingMode="follow_up"
        onModeChange={mode}
      />,
    );
    view.getByTestId("composer-mode").click();
    expect(mode).toHaveBeenCalledWith("steer");
    expect(view.getByTestId("send")).toBeTruthy();
  });
  it("stops Pi first with Esc and Stop, then a running command", () => {
    const pi = vi.fn();
    const cmd = vi.fn();
    const shell = {
      workspaceLabel: "~/src/x",
      running: {
        command: "make serve",
        excludeFromContext: false,
        state: "running" as const,
        startedAt: Date.now(),
      },
      onRun: noop,
      onStop: cmd,
    };
    const view = render(
      <Composer
        {...base}
        value=""
        activity="working"
        onInterrupt={pi}
        shell={shell}
      />,
    );
    fireEvent.keyDown(field(view), { key: "Escape" });
    expect(pi).toHaveBeenCalledTimes(1);
    view.getByTestId("composer-stop").click();
    expect(pi).toHaveBeenCalledTimes(2);
    view.rerender(
      <Composer {...base} value="" activity="idle" shell={shell} />,
    );
    fireEvent.keyDown(field(view), { key: "Escape" });
    expect(cmd).toHaveBeenCalledTimes(1);
    expect(view.getByTestId("composer-stop")).toBeTruthy();
    expect(pi).toHaveBeenCalledTimes(2);
  });
  it("runs `!` and `!!` instead of sending and refuses a second command", () => {
    const run = vi.fn();
    const send = vi.fn();
    const shell = { workspaceLabel: "~/src/x", onRun: run, onStop: noop };
    const view = render(
      <Composer
        {...base}
        value="!!git status"
        onSendNow={send}
        shell={shell}
      />,
    );
    expect(view.getByTestId("send")).toBeTruthy();

    fireEvent.keyDown(field(view), { key: "Enter" });
    expect(run).toHaveBeenCalledWith("git status", true);
    expect(send).not.toHaveBeenCalled();
    view.rerender(
      <Composer
        {...base}
        value="!ls"
        onSendNow={send}
        shell={{
          ...shell,
          running: {
            command: "make serve",
            excludeFromContext: false,
            state: "running",
          },
        }}
      />,
    );
    fireEvent.keyDown(field(view), { key: "Enter" });
    expect(run).toHaveBeenCalledTimes(1);
    expect(view.getByRole("status")).toBeTruthy();
  });
  it("keeps pending interruption visible, blocks repeat stops and preserves the draft until host confirmation", () => {
    const stop = vi.fn();
    const shell = {
      workspaceLabel: "test",
      running: {
        command: "make serve",
        excludeFromContext: false,
        state: "running" as const,
      },
      onRun: noop,
      onStop: stop,
      stopState: "pending" as const,
    };
    const view = render(<Composer {...base} value="!ls" shell={shell} />);
    expect(view.getByTestId("composer-stop")).toHaveProperty("disabled", true);
    view.getByTestId("composer-stop").click();
    fireEvent.keyDown(field(view), { key: "Escape" });
    expect(stop).not.toHaveBeenCalled();
    expect(field(view).value).toBe("!ls");
    view.rerender(
      <Composer
        {...base}
        value="!ls"
        shell={{ ...shell, stopState: "uncertain" }}
      />,
    );
    expect(view.getByTestId("composer-stop")).toHaveProperty("disabled", true);
    view.rerender(
      <Composer
        {...base}
        value="!ls"
        shell={{ ...shell, running: undefined, stopState: undefined }}
      />,
    );
    expect(view.queryByRole("status")).toBeNull();
  });
  it("shows Pi's queue as a card and restores it from one button; an unknown queue is never zero", () => {
    const restore = vi.fn();
    const view = render(
      <Composer
        {...base}
        value=""
        activity="working"
        queue={{ steering: ["Älä muuta testejä"], followUp: ["Aja testit"] }}
        onRestoreQueue={restore}
      />,
    );
    const card = view.getByTestId("composer-queue");
    expect(card.textContent).toContain("Älä muuta testejä");
    expect(card.textContent).toContain("Aja testit");

    view.getByTestId("composer-restore-queue").click();
    expect(restore).toHaveBeenCalledTimes(1);
    view.rerender(
      <Composer {...base} value="" activity="working" queueKnown={false} />,
    );
    expect(
      view.getByTestId("composer-queue").querySelector(".ah-cq-n"),
    ).toBeNull();
    expect(view.queryByTestId("composer-restore-queue")).toBeNull();
  });
  it("keeps an empty or unavailable send from sending and a rejected draft visible", () => {
    const send = vi.fn();
    const view = render(<Composer {...base} value="" onSendNow={send} />);
    view.getByTestId("send").click();
    fireEvent.keyDown(field(view), { key: "Enter" });
    view.rerender(
      <Composer
        {...base}
        value="Säilyy"
        sendState="rejected"
        availability={{ state: "disabled", reason: "Yhteys katkesi." }}
        onSendNow={send}
      />,
    );
    view.getByTestId("send").click();
    expect(send).not.toHaveBeenCalled();
    expect(field(view).value).toBe("Säilyy");
  });
});

const commands: CommandList = {
  answered_by: "helper",
  commands: [
    {
      name: "review",
      description: "Review the diff",
      source: "prompt",
      scope: "user",
      terminal_only: false,
    },
    {
      name: "mcp",
      description: "Manage MCP servers",
      source: "extension",
      scope: "builtin",
      terminal_only: false,
    },
    {
      name: "llama",
      description: "Manage llama.cpp router models",
      source: "extension",
      scope: "builtin",
      terminal_only: true,
    },
  ],
};
const files: FileList = {
  files: [
    { path: "scripts/status_rows.py", git: "modified" },
    { path: "README.md" },
  ],
  truncated: false,
};
function sources(): ComposerSources {
  return {
    commands: vi.fn(async () => commands),
    files: vi.fn(async (q: string) => ({
      ...files,
      files: files.files.filter((f) => fuzzyScore(f.path, q) > 0),
    })),
    workspaceName: "aurinkokello",
  };
}

function Controlled({
  initial,
  src,
}: {
  initial: string;
  src: ComposerSources;
}) {
  const [value, setValue] = useState(initial);
  return <Composer {...base} value={value} onChange={setValue} sources={src} />;
}

describe("composer lists", () => {
  it("opens all files in source rank order, keeping Git marks without a separate group", async () => {
    const src = sources();
    src.files = vi.fn(async () => ({
      files: [
        { path: "README.md" },
        { path: "src/main.go", git: "modified" as const },
      ],
      truncated: false,
    }));
    const view = render(<Controlled initial="" src={src} />);
    field(view).focus();
    fireEvent.keyDown(document, { key: "p", code: "KeyP", ctrlKey: true });
    await waitFor(() => expect(view.getAllByRole("option")).toHaveLength(2));
    expect(view.getAllByRole("option")[0].textContent).toContain("README.md");
    expect(
      view.getByTestId("palette-tab-all").getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      view.container.ownerDocument.querySelector(".ah-choice-git-changed"),
    ).toBeTruthy();
    expect(
      view.container.ownerDocument.querySelectorAll(".ah-choice-group"),
    ).toHaveLength(1);
    fireEvent.click(view.getByTestId("palette-tab-changed"));
    await waitFor(() => expect(view.getAllByRole("option")).toHaveLength(1));
    expect(view.getByRole("option").textContent).toContain("src/main.go");
  });

  it("completes `/` at the caret without offering terminal-only commands", async () => {
    const src = sources();
    const view = render(<Controlled initial="" src={src} />);
    const el = field(view);
    el.focus();
    fireEvent.change(el, {
      target: { value: "/", selectionStart: 1, selectionEnd: 1 },
    });
    await waitFor(() =>
      expect(view.getByTestId("composer-command-review")).toBeTruthy(),
    );
    expect(
      view.getByTestId("composer-command-mcp").getAttribute("aria-disabled"),
    ).toBeNull();
    expect(view.queryByTestId("composer-command-llama")).toBeNull();
    fireEvent.change(el, {
      target: { value: "/llama", selectionStart: 6, selectionEnd: 6 },
    });
    expect(view.queryByTestId("composer-command-llama")).toBeNull();
    // Filtering an unavailable command must not let Enter pick a hidden row.
    expect(el.getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.change(el, {
      target: { value: "/rev", selectionStart: 4, selectionEnd: 4 },
    });
    await waitFor(() =>
      expect(view.getByTestId("composer-command-review")).toBeTruthy(),
    );
    expect(src.commands).toHaveBeenCalledTimes(1);
    expect(el.getAttribute("aria-activedescendant")).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(el, { key: "Enter" });
    });
    await waitFor(() => expect(field(view).value).toBe("/review "));
  });
  it("leaves a mid-line `/` unselected so Enter still sends the text", async () => {
    const send = vi.fn();
    const src = sources();
    const view = render(
      <Composer {...base} value="katso /re" onSendNow={send} sources={src} />,
    );
    const el = field(view);
    el.setSelectionRange(9, 9);
    fireEvent.click(el);
    await waitFor(() => expect(view.getByRole("listbox")).toBeTruthy());
    expect(el.getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.keyDown(el, { key: "Enter" });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("asks the workspace for files as `@` is typed and closes with Esc keeping the text", async () => {
    const src = sources();
    const view = render(<Controlled initial="" src={src} />);
    const el = field(view);
    el.focus();
    fireEvent.change(el, {
      target: { value: "@status", selectionStart: 7, selectionEnd: 7 },
    });
    await waitFor(() =>
      expect(view.getByRole("option").textContent).toContain(
        "scripts/status_rows.py",
      ),
    );
    expect(src.files).toHaveBeenLastCalledWith("status", expect.anything());
    fireEvent.keyDown(el, { key: "Escape" });
    expect(view.queryByRole("listbox")).toBeNull();
    expect(field(view).value).toBe("@status");
  });
});

it("sends a leading screenshot as a message, never as a shell command", () => {
  const send = vi.fn();
  const run = vi.fn();
  const view = render(
    <Composer
      {...base}
      value="![shot](/api/v1/attachments/11111111-1111-4111-8111-111111111111)"
      onSendNow={send}
      shell={{ workspaceLabel: "synthetic", onRun: run, onStop: noop }}
    />,
  );
  fireEvent.keyDown(field(view), { key: "Enter", code: "Enter" });
  expect(send).toHaveBeenCalledOnce();
  expect(run).not.toHaveBeenCalled();
});

describe("installed skill aliases at send", () => {
  const skill: CommandList = {
    answered_by: "helper",
    commands: [
      {
        name: "skill:demo",
        source: "skill",
        scope: "project",
        description: "Synthetic skill",
        terminal_only: false,
      },
    ],
  };
  const sources = (commands: ComposerSources["commands"]): ComposerSources => ({
    commands,
    files: async () => ({ files: [], truncated: false }),
    preview: vi.fn(),
    workspaceName: "Synthetic",
  });
  it.each(["idle", "working"] as const)(
    "resolves a short skill before a %s send",
    async (activity) => {
      const now = vi.fn(),
        steer = vi.fn();
      const view = render(
        <Composer
          {...base}
          value={"/demo Explain this\n\n"}
          activity={activity}
          sources={sources(async () => skill)}
          onSendNow={now}
          onSteer={steer}
        />,
      );
      fireEvent.click(view.getByTestId("send"));
      await waitFor(() =>
        expect(activity === "idle" ? now : steer).toHaveBeenCalledWith(
          "/skill:demo Explain this\n\n",
        ),
      );
    },
  );
  it("does not send a stale edited draft or duplicate an in-flight lookup", async () => {
    let finish!: (v: CommandList) => void;
    const commands = vi.fn(
      () =>
        new Promise<CommandList>((resolve) => {
          finish = resolve;
        }),
    );
    const send = vi.fn();
    const source = sources(commands);
    const view = render(
      <Composer
        {...base}
        value="/demo Original"
        sources={source}
        onSendNow={send}
      />,
    );
    fireEvent.click(view.getByTestId("send"));
    fireEvent.click(view.getByTestId("send"));
    view.rerender(
      <Composer {...base} value="Edited" sources={source} onSendNow={send} />,
    );
    await act(async () => finish(skill));
    expect(commands).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    expect(field(view).value).toBe("Edited");
  });
  it("keeps the draft and sends nothing when native lookup fails", async () => {
    const send = vi.fn();
    const view = render(
      <Composer
        {...base}
        value="/demo Original"
        sources={sources(async () => {
          throw new Error("offline");
        })}
        onSendNow={send}
      />,
    );
    fireEvent.click(view.getByTestId("send"));
    await waitFor(() =>
      expect(view.getByTestId("send").getAttribute("aria-busy")).toBeNull(),
    );
    expect(send).not.toHaveBeenCalled();
    expect(field(view).value).toBe("/demo Original");
  });
});
