import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { BrowserEditor, type BrowserEditorProps } from "./BrowserEditor";
import type { EditorMergeApi } from "./editorMerge";
import { landing, threeWay } from "./editorMerge";

function Example({
  initialContent = "package main\n\nfunc main() {}\n",
  initialPath = "main.go",
  ...props
}: Partial<BrowserEditorProps> & {
  initialContent?: string;
  initialPath?: string;
}) {
  const [picker, setPicker] = useState(true);
  const [, setContent] = useState(initialContent);
  return (
    <div style={{ display: "flex", height: 620 }}>
      <BrowserEditor
        document={{ path: initialPath, content: initialContent, revision: 0 }}
        directories={{
          "": {
            entries: [
              { name: "src", kind: "directory" },
              { name: "main.go", kind: "file" },
              { name: "image.png", kind: "unsupported" },
            ],
          },
          src: { entries: [{ name: "components", kind: "directory" }] },
          "src/components": {
            entries: [{ name: "editor", kind: "directory" }],
          },
          "src/components/editor": {
            entries: [
              { name: "Tree.tsx", kind: "file" },
              {
                name: "An-extremely-long-file-name-for-testing-ellipsis.ts",
                kind: "file",
              },
            ],
          },
        }}
        onLoadDirectory={() => {}}
        picker={picker}
        dirty
        saving={false}
        loading={false}
        onPicker={() => setPicker(!picker)}
        onOpen={() => setPicker(false)}
        onChange={setContent}
        onSave={() => {}}
        onReload={() => {}}
        onImportNow={() => {}}
        onUndoImport={() => {}}
        onReimport={() => {}}
        {...props}
      />
    </div>
  );
}
export default {
  title: "Production/Browser editor",
  component: BrowserEditor,
} satisfies Meta<typeof BrowserEditor>;
type Story = StoryObj<typeof BrowserEditor>;
export const Editing: Story = { render: () => <Example /> };
export const Saving: Story = { render: () => <Example saving /> };
export const LongFile: Story = {
  render: () => (
    <Example
      initialContent={Array.from(
        { length: 250 },
        (_, i) => `// synthetic line ${i + 1}`,
      ).join("\n")}
    />
  ),
};
export const Problem: Story = {
  render: () => (
    <Example
      saveBlocked
      problem="Tallennuksen tulos ei ole tiedossa. Oma teksti säilyy."
    />
  ),
};

// Synthetic three versions of one file: the version opened, the person's
// unsaved text (lines 3 and 7) and an agent's write (lines 3 and 5).
const opened =
  "# Asennus\n\nAsennetaan yhdelle palvelimelle.\n\n- Ubuntu 24.04\n- Julkinen DNS-nimi\n- 2 Gt muistia";
const mine = opened
  .replace("palvelimelle.", "palvelimelle. Tarvitset sudo-oikeudet.")
  .replace("2 Gt", "4 Gt");
const theirs = opened
  .replace("palvelimelle.", "palvelimelle tai virtuaalikoneelle.")
  .replace("Ubuntu 24.04", "Ubuntu 24.04 tai Debian 13");
/** Drives the engine as the controller would once it has loaded. */
function Merging({
  step,
  ...props
}: Partial<BrowserEditorProps> & { step: (api: EditorMergeApi) => void }) {
  const api = useRef<EditorMergeApi | undefined>(undefined);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!api.current) return;
      window.clearInterval(timer);
      step(api.current);
    }, 50);
    return () => window.clearInterval(timer);
  }, [step]);
  return (
    <Example
      initialPath="docs/asennus.md"
      initialContent={mine}
      mergeApi={api}
      {...props}
    />
  );
}
export const ChangesWaiting: Story = {
  render: () => (
    <Merging
      changes={{ kind: "pending", source: "agent", count: 2 }}
      step={(api) => api.showPending(landing(mine, opened, theirs), "agent")}
    />
  ),
};
export const ImportedWithConflict: Story = {
  render: () => (
    <Merging
      changes={{
        kind: "imported",
        source: "agent",
        count: 2,
        conflicts: 1,
        latest: true,
      }}
      step={(api) => api.bring(threeWay(mine, opened, theirs), "agent")}
    />
  ),
};
export const ImportUndone: Story = {
  render: () => (
    <Example
      initialPath="docs/asennus.md"
      initialContent={mine}
      changes={{ kind: "undone", source: "agent" }}
    />
  ),
};
export const ChangedOutsideTheAgent: Story = {
  render: () => (
    <Merging
      changes={{ kind: "pending", source: "disk", count: 2 }}
      step={(api) => api.showPending(landing(mine, opened, theirs), "disk")}
    />
  ),
};
export const SavedOverAgent: Story = {
  render: () => (
    <Example
      dirty={false}
      notice="Tallennettu. 1 agentin muutos korvattiin sinun tekstilläsi; keskustelussa on siitä merkintä."
    />
  ),
};
export const Empty: Story = {
  render: () => (
    <Example
      document={undefined}
      dirty={false}
      directories={{ "": { truncated: true, entries: [] } }}
    />
  ),
};

export const SyntaxHighlighting: Story = {
  render: () => (
    <Example
      initialPath="Summary.tsx"
      initialContent={
        '// Workspace summary\ninterface Workspace { name: string; agents: number }\n\nexport function Summary({ name, agents }: Workspace) {\n  const active = true;\n  return <section className="summary"><h1>{name}</h1><p>{agents} agents</p><button disabled={!active}>Open</button></section>;\n}\n'
      }
    />
  ),
};
