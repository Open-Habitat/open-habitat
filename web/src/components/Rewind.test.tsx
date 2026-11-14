import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RewindPreview } from "../app/rewind";
import { resetLanguageForTests } from "../i18n";
import { ConversationFrame } from "./ConversationFrame";
import { RewindRow, RewindSheet } from "./Rewind";

afterEach(() => resetLanguageForTests("fi"));

const preview: RewindPreview = {
  schema_version: 1,
  agent_id: "pi:11111111-1111-4111-8111-111111111111",
  entry_key: "u2",
  own: 2,
  replies: 2,
  checkpoint: true,
  files: [
    { path: "src/shadow.py", change: "modified", additions: 10, deletions: 3 },
    {
      path: "tests/test_shadow.py",
      change: "created",
      additions: 12,
      deletions: 0,
    },
  ],
  files_more: 0,
  file_errors: 0,
  commands: ["python scripts/taulukko.py"],
  commands_more: 0,
};

const toggle = (testId: string) =>
  fireEvent.click(within(screen.getByTestId(testId)).getByRole("checkbox"));

const sheet = (props: Partial<Parameters<typeof RewindSheet>[0]> = {}) => {
  const go = vi.fn();
  render(
    <ConversationFrame>
      <RewindSheet
        time="9.20"
        preview={preview}
        previewState="ready"
        busy={false}
        onCancel={() => {}}
        onGo={go}
        {...props}
      />
    </ConversationFrame>,
  );
  return go;
};

it("offers the conversation and the files together by default and says what each leaves", () => {
  const go = sheet();
  expect(
    screen.getByRole("dialog", { name: "Palaa tähän" }).textContent,
  ).toContain("Palaa ennen viestiäsi klo 9.20");
  expect(screen.getByTestId("rewind-conversation").textContent).toContain(
    "2 viestiäsi ja 2 vastausta sivuun",
  );
  expect(screen.getByTestId("rewind-files").textContent).toContain(
    "2 tiedostoa palautuu",
  );
  expect(
    screen.getByText("Vain komennoilla muutetut tiedostot jäävät ennalleen."),
  ).toBeTruthy();
  fireEvent.click(screen.getByTestId("rewind-go"));
  expect(go).toHaveBeenCalledWith("both");
  expect(screen.getByTestId("rewind-go").textContent).toContain(
    "Palaa ja palauta",
  );
});

it.each([
  [
    "fi",
    "Näiden tiedostojen kaikki myöhemmät muutokset korvataan, myös omasi. Nykyinen sisältö tallennetaan ensin, jotta voit perua palautuksen.",
  ],
  [
    "en-US",
    "All later changes to these files are replaced, including your own. The current contents are saved first so you can undo the restore.",
  ],
  [
    "en-GB",
    "All later changes to these files are replaced, including your own. The current contents are saved first so you can undo the restore.",
  ],
] as const)(
  "explains replacement and undo before restoring files (%s)",
  (language, warning) => {
    resetLanguageForTests(language);
    sheet();
    expect(screen.getByText(warning)).toBeTruthy();
    toggle("rewind-conversation");
    expect(screen.getByText(warning)).toBeTruthy();
    toggle("rewind-files");
    expect(screen.queryByText(warning)).toBeNull();
  },
);

it("names the already committed files before the restore and says their commits stay", () => {
  sheet({
    preview: {
      ...preview,
      files: [{ ...preview.files[0], committed: true }, preview.files[1]],
    },
  });
  const note = screen.getByTestId("rewind-committed");
  expect(note.textContent).toBe(
    "Jo commitoitu: src/shadow.py. Palautus ei kumoa committeja, joten nämä tiedostot näkyvät palautuksen jälkeen commitoimattomina muutoksina.",
  );
  fireEvent.click(screen.getByTestId("rewind-files-toggle"));
  expect(screen.getByTestId("rewind-file-list").textContent).toContain(
    "commitoitu +10 −3",
  );
  // The conversation alone touches no file, so nothing is said of commits.
  toggle("rewind-files");
  expect(screen.queryByTestId("rewind-committed")).toBeNull();
});

it("says nothing of commits when none were made after the message", () => {
  sheet();
  expect(screen.queryByTestId("rewind-committed")).toBeNull();
});

it("expresses the three choices with two checkboxes and refuses neither", () => {
  const go = sheet();
  toggle("rewind-files");
  expect(screen.getByTestId("rewind-go").textContent).toContain("Palaa tähän");
  expect(screen.getByTestId("rewind-files").textContent).toContain(
    "2 tiedostoa jää ennalleen",
  );
  toggle("rewind-files");
  toggle("rewind-conversation");
  expect(screen.getByTestId("rewind-go").textContent).toContain(
    "Palauta tiedostot",
  );
  expect(screen.getByTestId("rewind-conversation").textContent).toContain(
    "Jatkuu ennallaan",
  );
  toggle("rewind-files");
  expect(screen.getByTestId("rewind-sheet").getAttribute("data-what")).toBe(
    "none",
  );
  expect(screen.getByText("Valitse ainakin toinen")).toBeTruthy();
  fireEvent.click(screen.getByTestId("rewind-go"));
  expect(go).not.toHaveBeenCalled();
});

it("lists the files behind Näytä tiedostot with the commands whose changes stay", () => {
  sheet();
  expect(screen.queryByTestId("rewind-file-list")).toBeNull();
  fireEvent.click(screen.getByTestId("rewind-files-toggle"));
  const list = screen.getByTestId("rewind-file-list");
  expect(list.textContent).toContain("src/shadow.py");
  expect(list.textContent).toContain("+10 −3");
  expect(list.textContent).toContain("tests/test_shadow.py");
  expect(list.textContent).toContain("uusi +12 −0");
  expect(list.textContent).toContain("python scripts/taulukko.py");
  expect(list.textContent).toContain("jää");
});

it("says a running agent is stopped first and names the stop on the button", () => {
  sheet({ busy: true });
  expect(
    screen.getByText("Agentti on työssä; se pysäytetään ensin."),
  ).toBeTruthy();
  expect(screen.getByTestId("rewind-go").textContent).toContain(
    "Pysäytä ja palaa",
  );
});

it("offers only the conversation when no copies exist for the message", () => {
  const go = sheet({ preview: { ...preview, checkpoint: false, files: [] } });
  expect(screen.getByTestId("rewind-files").textContent).toContain(
    "Tästä viestistä ei ole kopioita",
  );
  expect(screen.getByTestId("rewind-go").textContent).toContain("Palaa tähän");
  fireEvent.click(screen.getByTestId("rewind-go"));
  expect(go).toHaveBeenCalledWith("conversation");
});

it("shows the replaced continuation on request and continues it with its files", () => {
  const onSwitch = vi.fn();
  const toggle = vi.fn();
  const marker = {
    action: "rewind" as const,
    own: 1,
    replies: 1,
    files_restored: 3,
    switchable: true,
    files_return: true,
  };
  const { rerender } = render(
    <RewindRow marker={marker} onToggle={toggle} onSwitch={onSwitch} />,
  );
  expect(screen.getByTestId("rewind-branch").textContent).toContain(
    "Aiempi jatko · 1 viestisi ja 1 vastaus · 3 tiedostoa palautettu",
  );
  fireEvent.click(screen.getByTestId("rewind-branch-toggle"));
  expect(toggle).toHaveBeenCalled();
  rerender(
    <RewindRow
      marker={marker}
      open
      onToggle={toggle}
      onSwitch={onSwitch}
      continuation={<p>jatko</p>}
    />,
  );
  expect(screen.getByTestId("rewind-branch-body").textContent).toContain(
    "Agentti ei näe tätä jatkoa.",
  );
  fireEvent.click(screen.getByTestId("rewind-switch"));
  expect(onSwitch).not.toHaveBeenCalled();
  expect(screen.getByTestId("rewind-swap-files").textContent).toContain(
    "Palauta myös sen tiedostot",
  );
  fireEvent.click(screen.getByTestId("rewind-swap-go"));
  expect(onSwitch).toHaveBeenCalledWith(true);
});

it("offers to undo a files-only restore until a later row undid it", () => {
  const onUndo = vi.fn();
  const marker = {
    action: "files" as const,
    own: 1,
    replies: 1,
    files_restored: 2,
    switchable: false,
    files_return: true,
  };
  const { rerender } = render(
    <RewindRow marker={marker} time="9.20" onUndo={onUndo} />,
  );
  expect(screen.getByTestId("rewind-files-row").textContent).toContain(
    "2 tiedostoa palautettu tilaan ennen viestiäsi klo 9.20.",
  );
  fireEvent.click(screen.getByTestId("rewind-undo"));
  expect(onUndo).toHaveBeenCalled();
  rerender(<RewindRow marker={marker} undone onUndo={onUndo} />);
  expect(screen.queryByTestId("rewind-undo")).toBeNull();
});
