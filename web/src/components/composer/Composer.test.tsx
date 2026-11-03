import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadAttachment } from "../../app/attachments";
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

vi.mock("../../app/attachments", async (actual) => ({
  ...(await actual<typeof import("../../app/attachments")>()),
  uploadAttachment: vi.fn(),
}));

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
  it("lets a refused agent stop be tried again, by Stop and by Esc, but not a pending one", () => {
    const interrupt = vi.fn();
    const view = render(
      <Composer
        {...base}
        value=""
        activity="working"
        onInterrupt={interrupt}
        stopState="pending"
      />,
    );
    view.getByTestId("composer-stop").click();
    fireEvent.keyDown(field(view), { key: "Escape" });
    expect(interrupt).not.toHaveBeenCalled();
    view.rerender(
      <Composer
        {...base}
        value=""
        activity="working"
        onInterrupt={interrupt}
        stopState="rejected"
      />,
    );
    view.getByTestId("composer-stop").click();
    fireEvent.keyDown(field(view), { key: "Escape" });
    expect(interrupt).toHaveBeenCalledTimes(2);
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
  it("keeps an empty or unavailable send from sending, says why, and keeps a rejected draft visible", () => {
    const send = vi.fn();
    const view = render(<Composer {...base} value="" onSendNow={send} />);
    view.getByTestId("send").click();
    fireEvent.keyDown(field(view), { key: "Enter" });
    expect(view.queryByTestId("composer-notice")).toBeNull();
    view.rerender(
      <Composer
        {...base}
        value="Säilyy"
        sendState="rejected"
        availability={{ state: "disabled", reason: "Yhteys katkesi." }}
        onSendNow={send}
      />,
    );
    fireEvent.click(view.getByTestId("send"));
    expect(send).not.toHaveBeenCalled();
    expect(field(view).value).toBe("Säilyy");
    // A refused send is not silent.
    view.getByTestId("composer-notice");
    // A view that keeps what it cannot send yet takes the send itself.
    view.rerender(
      <Composer
        {...base}
        value="Säilyy"
        sendState="pending"
        sendWhenReady
        availability={{ state: "unknown", reason: "Ladataan." }}
        onSendNow={send}
      />,
    );
    fireEvent.keyDown(field(view), { key: "Enter" });
    expect(send).toHaveBeenCalledWith("Säilyy");
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
  expect(field(view).value).toBe("");
  fireEvent.keyDown(field(view), { key: "Enter", code: "Enter" });
  expect(send).toHaveBeenCalledWith(
    "![shot](/api/v1/attachments/11111111-1111-4111-8111-111111111111)",
  );
  expect(run).not.toHaveBeenCalled();
});

it("keeps attachments out of the field and sends their references unchanged", () => {
  const shot =
    "![shot.png](/api/v1/attachments/11111111-1111-4111-8111-111111111111)";
  const notes =
    "[notes.txt](/api/v1/attachments/22222222-2222-4222-8222-222222222222)";
  const send = vi.fn();
  const drafts: string[] = [];
  function Draft() {
    const [value, setValue] = useState(`Katso tätä\n${shot}\n${notes}`);
    return (
      <Composer
        {...base}
        value={value}
        onChange={(next) => {
          drafts.push(next);
          setValue(next);
        }}
        onSendNow={send}
      />
    );
  }
  const view = render(<Draft />);
  expect(field(view).value).toBe("Katso tätä");
  expect(view.getAllByTestId("attachment-chip")).toHaveLength(2);

  fireEvent.change(field(view), { target: { value: "Katso tätä!\n" } });
  expect(field(view).value).toBe("Katso tätä!\n");
  expect(drafts.at(-1)).toBe(`Katso tätä!\n\n${shot}\n${notes}`);

  fireEvent.click(view.getAllByTestId("attachment-remove")[0]);
  expect(view.getAllByTestId("attachment-chip")).toHaveLength(1);
  expect(field(view).value).toBe("Katso tätä!\n");

  fireEvent.keyDown(field(view), { key: "Enter", code: "Enter" });
  expect(send).toHaveBeenCalledWith(`Katso tätä!\n\n${notes}`);
});

it("shows a start-page goal's skill call as a chip and sends Pi's invocation unchanged", async () => {
  const shot =
    "![shot.png](/api/v1/attachments/11111111-1111-4111-8111-111111111111)";
  const goals = [
    { skill: "korjaa", title: "Korjaa ongelma", request: "Selvitä syy." },
  ];
  const send = vi.fn();
  const drafts: string[] = [];
  function Draft({ initial }: { initial: string }) {
    const [value, setValue] = useState(initial);
    return (
      <Composer
        {...base}
        goals={goals}
        value={value}
        onChange={(next) => {
          drafts.push(next);
          setValue(next);
        }}
        onSendNow={send}
      />
    );
  }
  const view = render(<Draft initial={`/skill:korjaa [havainto]\n${shot}`} />);
  expect(field(view).value).toBe("[havainto]");
  expect(view.getByTestId("goal-chip")).toBeTruthy();
  fireEvent.change(field(view), { target: { value: "Virhe X" } });
  expect(drafts.at(-1)).toBe(`/skill:korjaa Virhe X\n${shot}`);
  // Emptied, the field still sends the skill call itself.
  fireEvent.change(field(view), { target: { value: "" } });
  expect(drafts.at(-1)).toBe(`/skill:korjaa \n${shot}`);
  fireEvent.change(field(view), { target: { value: "Virhe X" } });
  fireEvent.keyDown(field(view), { key: "Enter", code: "Enter" });
  expect(send).toHaveBeenCalledWith(`/skill:korjaa Virhe X\n${shot}`);

  fireEvent.click(view.getByTestId("goal-chip-open"));
  fireEvent.click(await view.findByTestId("goal-chip-unwrap"));
  expect(drafts.at(-1)).toBe(`Selvitä syy.\n\nVirhe X\n${shot}`);
  expect(view.queryByTestId("goal-chip")).toBeNull();
  view.unmount();

  // Another skill, or a goal's name still being typed, stays text.
  for (const initial of ["/skill:muu teksti", "/skill:korjaa"]) {
    const other = render(<Draft initial={initial} />);
    expect(field(other).value).toBe(initial);
    expect(other.queryByTestId("goal-chip")).toBeNull();
    other.unmount();
  }

  // The goal's text is part of the skill call, never a shell command.
  const run = vi.fn();
  const shellSend = vi.fn();
  const shelled = render(
    <Composer
      {...base}
      goals={goals}
      value="/skill:korjaa !npm test"
      onSendNow={shellSend}
      shell={{ workspaceLabel: "w", onRun: run, onStop: noop }}
    />,
  );
  fireEvent.keyDown(field(shelled), { key: "Enter", code: "Enter" });
  expect(run).not.toHaveBeenCalled();
  expect(shellSend).toHaveBeenCalledWith("/skill:korjaa !npm test");
  shelled.unmount();

  const removed = render(<Draft initial="/skill:korjaa Oma teksti" />);
  fireEvent.click(removed.getByTestId("goal-chip-remove"));
  expect(drafts.at(-1)).toBe("Oma teksti");
  expect(field(removed).value).toBe("Oma teksti");
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

describe("composer speech input", () => {
  type Socket = {
    protocols: string[];
    sent: unknown[];
    onopen: (() => void) | null;
    onmessage: ((e: { data: string }) => void) | null;
    onclose: (() => void) | null;
  };
  function fakeSpeech() {
    const sockets: Socket[] = [];
    const deps = {
      mint: async () => ({
        schema_version: 1 as const,
        api_key: "snx_temp_1",
        expires_at: "2026-10-28T09:01:00Z",
        websocket_url: "wss://stt-rt.eu.soniox.com/transcribe-websocket",
        max_session_seconds: 600 as const,
      }),
      microphone: async () =>
        ({ getTracks: () => [] }) as unknown as MediaStream,
      capture: async () => ({ sampleRate: 16_000, close: noop }),
      socket: (_url: string, protocols: string[]) => {
        const s: Socket = {
          protocols,
          sent: [],
          onopen: null,
          onmessage: null,
          onclose: null,
        };
        Object.assign(s, {
          readyState: 1,
          send: (d: unknown) => s.sent.push(d),
          close: () => s.onclose?.(),
        });
        sockets.push(s);
        return s as unknown as WebSocket;
      },
      now: () => Date.now(),
      setInterval: () => 0,
      clearInterval: noop,
    };
    return { deps, sockets };
  }
  function Stateful(props: {
    deps: ReturnType<typeof fakeSpeech>["deps"];
    onSendNow: (text?: string) => void;
    initial?: string;
  }) {
    const [value, setValue] = useState(props.initial ?? "Alku");
    return (
      <Composer
        {...base}
        csrf="csrf"
        value={value}
        onChange={setValue}
        onSendNow={props.onSendNow}
        speech={{ onOpenSettings: noop, deps: props.deps }}
      />
    );
  }
  async function dictate(view: ReturnType<typeof render>, sockets: Socket[]) {
    fireEvent.click(view.getByTestId("dictation-mic"));
    await waitFor(() => expect(sockets).toHaveLength(1));
    await act(async () => sockets[0]?.onopen?.());
    await act(async () =>
      sockets[0]?.onmessage?.({
        data: JSON.stringify({ tokens: [{ text: " sanelu", is_final: true }] }),
      }),
    );
  }

  it("dictates after what was written and Send ends the dictation and sends it", async () => {
    const { deps, sockets } = fakeSpeech();
    const sent = vi.fn();
    const view = render(<Stateful deps={deps} onSendNow={sent} />);
    const mic = view.getByTestId("dictation-mic");
    fireEvent.pointerDown(mic, { button: 0 });
    fireEvent.pointerUp(window);
    fireEvent.click(mic);
    await waitFor(() => expect(sockets).toHaveLength(1));
    await act(async () => sockets[0]?.onopen?.());
    expect(view.getByTestId("dictation-live")).toBeTruthy();
    await act(async () =>
      sockets[0]?.onmessage?.({
        data: JSON.stringify({
          tokens: [
            { text: " sanelu", is_final: true },
            { text: " jatkuu", is_final: false },
          ],
        }),
      }),
    );
    expect(view.getByTestId("dictation-final").textContent).toBe("sanelu");
    expect(view.getByTestId("dictation-interim").textContent).toBe(" jatkuu");
    fireEvent.click(view.getByTestId("send"));
    // The end of the stream is an empty text frame; Soniox then finishes.
    await waitFor(() => expect(sockets[0]?.sent.at(-1)).toBe(""));
    await act(async () =>
      sockets[0]?.onmessage?.({
        data: JSON.stringify({
          tokens: [{ text: " jatkuu.", is_final: true }],
          finished: true,
        }),
      }),
    );
    await waitFor(() =>
      expect(sent).toHaveBeenCalledWith("Alku sanelu jatkuu."),
    );
    expect(field(view).value).toBe("Alku sanelu jatkuu.");
  });

  it("dictates at the caret or over the selection, shows the guess there and leaves the caret after it", async () => {
    // "Alku POIS loppu" with a caret, a selection, a caret before a space
    // and one at the start; a word follows what was said with a space.
    for (const [at, live, done, caret] of [
      [[5, 5], "Alku sanelu jatkuu| POIS loppu", "Alku sanelu POIS loppu", 11],
      [[5, 9], "Alku sanelu jatkuu| loppu", "Alku sanelu loppu", 11],
      [[4, 4], "Alku sanelu jatkuu| POIS loppu", "Alku sanelu POIS loppu", 11],
      [[0, 0], "sanelu jatkuu| Alku POIS loppu", "sanelu Alku POIS loppu", 6],
    ] as const) {
      const { deps, sockets } = fakeSpeech();
      const view = render(
        <Stateful deps={deps} onSendNow={noop} initial="Alku POIS loppu" />,
      );
      const input = field(view);
      input.focus();
      input.setSelectionRange(at[0], at[1]);
      const mic = view.getByTestId("dictation-mic");
      fireEvent.pointerDown(mic, { button: 0 });
      fireEvent.pointerUp(window);
      fireEvent.click(mic);
      await waitFor(() => expect(sockets).toHaveLength(1));
      await act(async () => sockets[0]?.onopen?.());
      await act(async () =>
        sockets[0]?.onmessage?.({
          data: JSON.stringify({
            tokens: [
              { text: " sanelu", is_final: true },
              { text: " jatkuu", is_final: false },
            ],
          }),
        }),
      );
      const shown = view.getByTestId("dictation-live");
      const caretMark = shown.querySelector(".ah-dictation-caret");
      expect(
        Array.from(shown.childNodes)
          .map((n) => (n === caretMark ? "|" : n.textContent))
          .join(""),
      ).toBe(live);
      fireEvent.click(view.getByTestId("dictation-stop"));
      await waitFor(() => expect(sockets[0]?.sent.at(-1)).toBe(""));
      await act(async () =>
        sockets[0]?.onmessage?.({
          data: JSON.stringify({ tokens: [], finished: true }),
        }),
      );
      await waitFor(() => expect(field(view).value).toBe(done));
      await waitFor(() => expect(document.activeElement).toBe(field(view)));
      expect(field(view).selectionStart).toBe(caret);
      expect(field(view).selectionEnd).toBe(caret);
      view.unmount();
    }
  });

  it("× and Esc discard dictation silently and leave the original field unchanged", async () => {
    for (const end of ["cancel", "Escape"] as const) {
      const { deps, sockets } = fakeSpeech();
      const view = render(<Stateful deps={deps} onSendNow={noop} />);
      await dictate(view, sockets);
      expect(view.getByTestId("dictation-bar")).toBeTruthy();
      // Valmis takes Sanele's place in the same slot.
      expect(
        view.getByTestId("dictation-stop").closest(".ah-crow-mslot"),
      ).toBeTruthy();
      if (end === "cancel")
        fireEvent.click(view.getByTestId("dictation-cancel"));
      else fireEvent.keyDown(document.body, { key: "Escape" });
      await waitFor(() =>
        expect(view.queryByTestId("dictation-bar")).toBeNull(),
      );
      expect(field(view).value).toBe("Alku");
      // Soniox is not asked for its last words.
      expect(sockets[0]?.sent).not.toContain("");
      expect(view.queryByTestId("dictation-notice")).toBeNull();
      view.unmount();
    }
  });

  it("a cancel that heard nothing leaves no notice", async () => {
    const { deps, sockets } = fakeSpeech();
    const view = render(<Stateful deps={deps} onSendNow={noop} />);
    fireEvent.click(view.getByTestId("dictation-mic"));
    await waitFor(() => expect(sockets).toHaveLength(1));
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(view.queryByTestId("dictation-bar")).toBeNull());
    expect(field(view).value).toBe("Alku");
    expect(view.queryByTestId("dictation-notice")).toBeNull();
  });

  it("Valmis keeps what was said in the field, even past an Esc while Soniox finishes", async () => {
    const { deps, sockets } = fakeSpeech();
    const view = render(<Stateful deps={deps} onSendNow={noop} />);
    await dictate(view, sockets);
    fireEvent.click(view.getByTestId("dictation-stop"));
    await waitFor(() => expect(sockets[0]?.sent.at(-1)).toBe(""));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(view.getByTestId("dictation-bar")).toBeTruthy();
    await act(async () =>
      sockets[0]?.onmessage?.({
        data: JSON.stringify({ tokens: [], finished: true }),
      }),
    );
    await waitFor(() => expect(field(view).value).toBe("Alku sanelu"));
  });
});

describe("focus after an attachment", () => {
  const reference =
    "[notes.txt](/api/v1/attachments/33333333-3333-4333-8333-333333333333)";
  // The upload answers only when the test says so, so the focus cannot come
  // from the drop or the picker itself.
  function pendingUpload() {
    let answer = () => {};
    vi.mocked(uploadAttachment).mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = () =>
            resolve({ reference } as Awaited<
              ReturnType<typeof uploadAttachment>
            >);
        }),
    );
    return () => act(async () => answer());
  }
  function Draft() {
    const [value, setValue] = useState("Katso tätä");
    return (
      <>
        <button type="button" data-testid="elsewhere" />
        <Composer {...base} csrf="csrf" value={value} onChange={setValue} />
      </>
    );
  }
  const file = new File(["synthetic"], "notes.txt", { type: "text/plain" });
  const pick = (view: ReturnType<typeof render>) =>
    fireEvent.change(
      view.container.querySelector('input[type="file"]') as HTMLInputElement,
      { target: { files: [file] } },
    );
  const touch = (coarse: boolean) =>
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: coarse && query === "(pointer: coarse)",
        }) as MediaQueryList,
    );
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a drop puts the focus in the field with the caret after the draft once the chip shows", async () => {
    const answer = pendingUpload();
    const view = render(<Draft />);
    view.getByTestId("elsewhere").focus();
    fireEvent.drop(document, {
      dataTransfer: { files: [file], types: ["Files"] },
    });
    expect(document.activeElement).not.toBe(field(view));
    await answer();
    expect(view.getAllByTestId("attachment-chip")).toHaveLength(1);
    expect(document.activeElement).toBe(field(view));
    expect(field(view).selectionStart).toBe("Katso tätä".length);
    expect(field(view).selectionEnd).toBe("Katso tätä".length);
  });

  it("the picker returns the focus to the field after the file dialog", async () => {
    const answer = pendingUpload();
    const view = render(<Draft />);
    field(view).focus();
    field(view).setSelectionRange(0, 0);
    const input = view.container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const openPicker = vi.spyOn(input, "click");
    const clip = view.getByTestId("attach-file");
    fireEvent.pointerDown(clip);
    clip.focus();
    fireEvent.click(clip);
    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId("attachment-panel")).toBeNull();
    pick(view);
    await answer();
    expect(document.activeElement).toBe(field(view));
    expect(field(view).selectionStart).toBe("Katso tätä".length);
  });

  it("on a touch screen the picker opens no keyboard unless the field had the focus", async () => {
    touch(true);
    let answer = pendingUpload();
    const view = render(<Draft />);
    const clip = view.getByTestId("attach-file");
    fireEvent.pointerDown(clip);
    clip.focus();
    pick(view);
    await answer();
    expect(view.getAllByTestId("attachment-chip")).toHaveLength(1);
    expect(document.activeElement).not.toBe(field(view));

    answer = pendingUpload();
    field(view).focus();
    fireEvent.pointerDown(clip);
    clip.focus();
    pick(view);
    await answer();
    expect(document.activeElement).toBe(field(view));
  });

  it("a field the person moved to during the upload keeps the focus", async () => {
    const answer = pendingUpload();
    const view = render(
      <>
        <input data-testid="other-field" />
        <Draft />
      </>,
    );
    fireEvent.drop(document, {
      dataTransfer: { files: [file], types: ["Files"] },
    });
    const other = view.getByTestId("other-field");
    other.focus();
    await answer();
    expect(view.getAllByTestId("attachment-chip")).toHaveLength(1);
    expect(document.activeElement).toBe(other);
  });
});
