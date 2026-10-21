import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ControlButton } from "./ControlElements";
import { EditorHeader } from "./EditorHeader";
import { EditorSplit } from "./EditorSplit";
import { Icon } from "./Icon";

function EditorExample({
  initiallyCollapsed = false,
}: {
  initiallyCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const [width, setWidth] = useState(460);
  return (
    <div style={{ height: 700 }}>
      <EditorSplit
        open={open}
        collapsed={collapsed}
        width={width}
        min={300}
        max={600}
        editor={
          <>
            <EditorHeader
              collapsed={collapsed}
              onToggleCollapsed={() => setCollapsed(!collapsed)}
              onClose={() => {
                setOpen(false);
                setCollapsed(false);
              }}
            />
            <div className="ah-editor-frame">
              <p>Synteettinen editorin sisältö</p>
            </div>
          </>
        }
        strip={{ label: "Valmis", working: false, unread: false }}
        onResize={setWidth}
        onCollapse={setCollapsed}
        onReset={() => setWidth(460)}
        onShowConversation={() => setCollapsed(false)}
      >
        <header className="ah-editor-header">
          <span>Aurinkokello</span>
          <ControlButton
            size="row"
            variant="quiet"
            aria-label="Editori"
            title="Avaa editori"
            aria-pressed={open}
            onPress={() => setOpen(!open)}
          >
            <Icon name="editor" />
          </ControlButton>
        </header>
        <div style={{ flex: 1 }}>Synteettinen keskustelu</div>
        <label>
          Viesti
          <textarea defaultValue="Luonnos säilyy näkymää vaihtaessa." />
        </label>
      </EditorSplit>
    </div>
  );
}

const meta = {
  title: "Production/Editor header",
  component: EditorHeader,
  args: { collapsed: false, onToggleCollapsed: () => {}, onClose: () => {} },
  render: () => <EditorExample />,
} satisfies Meta<typeof EditorHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BesideConversation: Story = {};
export const FullWindow: Story = {
  render: () => <EditorExample initiallyCollapsed />,
};
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
