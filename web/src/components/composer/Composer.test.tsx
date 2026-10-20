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
  view.getByRole("textbox", { name: "Viesti Pi:lle" }) as HTMLTextAreaElement;

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
  it("swaps the mode from its chip and names the send by the mode", () => {
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
    view
      .getByRole("button", {
        name: "Viestin tapa: Työn jälkeen. Vaihda: Ohjaa",
      })
      .click();
    expect(mode).toHaveBeenCalledWith("steer");
    expect(view.getByRole("button", { name: "Työn jälkeen" })).toBeTruthy();
    expect(field(view).placeholder).toBe(
      "Kirjoita, mitä Pi tekee työn jälkeen… · Alt+Enter: ohjaa",
    );
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
    view.getByRole("button", { name: "Pysäytä Pi" }).click();
    expect(pi).toHaveBeenCalledTimes(2);
    view.rerender(
      <Composer {...base} value="" activity="idle" shell={shell} />,
    );
    fireEvent.keyDown(field(view), { key: "Escape" });
    expect(cmd).toHaveBeenCalledTimes(1);
    expect(
      view.getByRole("button", { name: "Pysäytä komento make serve" }),
    ).toBeTruthy();
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
    expect(view.getByRole("button", { name: "Aja" })).toBeTruthy();
    expect(view.getByText("vain sinulle, ei Pi:lle")).toBeTruthy();
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
    expect(view.getByRole("status").textContent).toContain("Edellinen komento");
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
    const card = view.getByRole("region", { name: "Odottaa Pi:tä" });
    expect(card.textContent).toContain("Ohjaus");
    expect(card.textContent).toContain("seuraavassa välivaiheessa");
    expect(card.textContent).toContain("kun vuoro päättyy");
    view.getByRole("button", { name: "Palauta kenttään" }).click();
    expect(restore).toHaveBeenCalledTimes(1);
    view.rerender(
      <Composer {...base} value="" activity="working" queueKnown={false} />,
    );
    expect(view.getByText("Jonon tila ei tiedossa")).toBeTruthy();
    expect(view.queryByText("0")).toBeNull();
  });
  it("keeps an empty or unavailable send from sending and a rejected draft visible", () => {
    const send = vi.fn();
    const view = render(<Composer {...base} value="" onSendNow={send} />);
    view.getByRole("button", { name: "Lähetä" }).click();
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
    view.getByRole("button", { name: "Lähetä" }).click();
    expect(send).not.toHaveBeenCalled();
    expect(field(view).value).toBe("Säilyy");
    expect(view.getByText("Viesti hylättiin")).toBeTruthy();
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
  it("completes `/` at the caret and lists terminal-only commands without running them", async () => {
    const src = sources();
    const view = render(<Controlled initial="" src={src} />);
    const el = field(view);
    el.focus();
    fireEvent.change(el, {
      target: { value: "/", selectionStart: 1, selectionEnd: 1 },
    });
    await waitFor(() =>
      expect(
        view
          .getByRole("option", { name: /\/mcp/ })
          .getAttribute("aria-disabled"),
      ).toBe("true"),
    );
    fireEvent.change(el, {
      target: { value: "/rev", selectionStart: 4, selectionEnd: 4 },
    });
    await waitFor(() =>
      expect(view.getByRole("option", { name: /\/review/ })).toBeTruthy(),
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
      expect(
        view.getByRole("option", { name: /status_rows\.py/ }),
      ).toBeTruthy(),
    );
    expect(src.files).toHaveBeenLastCalledWith("status", expect.anything());
    fireEvent.keyDown(el, { key: "Escape" });
    expect(view.queryByRole("listbox")).toBeNull();
    expect(field(view).value).toBe("@status");
  });
});
