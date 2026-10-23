import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { EditorSettingsControl } from "./EditorSettings";
import "./Settings.css";

const meta = {
  title: "Production/Editor settings",
  component: EditorSettingsControl,
  args: {
    choice: "codemirror6",
    disabled: false,
    error: false,
    onChange: () => {},
    onReload: () => {},
  },
  render: function Example(args) {
    const [choice, setChoice] = useState(args.choice);
    return (
      <section className="s-main">
        <h2>Editori</h2>
        <EditorSettingsControl {...args} choice={choice} onChange={setChoice} />
      </section>
    );
  },
} satisfies Meta<typeof EditorSettingsControl>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CodeMirror: Story = {};
export const VSCode: Story = { args: { choice: "vscode" } };
export const Pending: Story = { args: { disabled: true } };
export const Unconfirmed: Story = { args: { error: true } };
