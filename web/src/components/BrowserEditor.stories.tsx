import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { BrowserEditor, type BrowserEditorProps } from "./BrowserEditor";

function Example(props: Partial<BrowserEditorProps>) {
  const [picker, setPicker] = useState(true);
  const [content, setContent] = useState("package main\n\nfunc main() {}\n");
  return (
    <div style={{ height: 620 }}>
      <BrowserEditor
        document={{ path: "main.go", content, revision: 0 }}
        directory=""
        entries={[
          { name: "main.go", kind: "file" },
          { name: "docs", kind: "directory" },
          { name: "image.png", kind: "unsupported" },
        ]}
        truncated={false}
        picker={picker}
        dirty
        saving={false}
        loading={false}
        onPicker={() => setPicker(!picker)}
        onParent={() => {}}
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
  render: () => <Example document={undefined} dirty={false} truncated />,
};
