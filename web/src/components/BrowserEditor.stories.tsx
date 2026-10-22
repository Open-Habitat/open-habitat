import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { BrowserEditor, type BrowserEditorProps } from "./BrowserEditor";

function Example({
  initialContent = "package main\n\nfunc main() {}\n",
  ...props
}: Partial<BrowserEditorProps> & { initialContent?: string }) {
  const [picker, setPicker] = useState(true);
  const [content, setContent] = useState(initialContent);
  return (
    <div style={{ display: "flex", height: 620 }}>
      <BrowserEditor
        document={{ path: "main.go", content, revision: 0 }}
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
        onCompare={() => {}}
        onReload={() => {}}
        onReconcile={() => {}}
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
export const Conflict: Story = {
  render: () => (
    <Example
      saveBlocked
      problem="Tiedosto on muuttunut. Oma teksti säilyy."
      remote="Palvelimen teksti\n"
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
