import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";
import { type TerminalHandle, TerminalSurface } from "./Terminal";
import { TerminalPanel } from "./TerminalPanel";

// Synthetic terminal output, written once into the real xterm surface.
const prompt =
  "\x1b[1;32malice@open-habitat-lab\x1b[0m:\x1b[1;34m~/src/aurinkokello\x1b[0m$ ";
const sample = [
  `${prompt}git log --oneline -3`,
  "\x1b[33m1a193564\x1b[0m idle-pi-holds-slots: result, KOKEILTAVAA; issue closed",
  "\x1b[33mf46502d0\x1b[0m daemon: deletion keeps its fence when a stopped Pi is reaped late",
  "\x1b[33m6ea2b5b9\x1b[0m web: name busy conversations in deletion",
  `${prompt}go test ./internal/gateway/...`,
  "\x1b[32mok\x1b[0m  example.invalid/aurinkokello/internal/gateway  \x1b[2m2.914s\x1b[0m",
  prompt,
].join("\r\n");

function Surface({ readOnly = false }: { readOnly?: boolean }) {
  const ref = useRef<TerminalHandle>(null);
  return (
    <TerminalSurface
      ref={ref}
      label="Pääte bash"
      readOnly={readOnly}
      onOpen={() => ref.current?.write(sample)}
      onData={() => {}}
      onResize={() => {}}
      onSelection={() => {}}
      onPasteRequest={() => {}}
    />
  );
}

const noop = () => {};
const meta = {
  title: "Production/Browser shell",
  component: TerminalPanel,
  render: (args) => (
    <section
      className="ah-conversation-frame"
      style={{ height: 520, display: "flex", flexDirection: "column" }}
    >
      <div style={{ flex: 1 }} />
      <TerminalPanel {...args} />
    </section>
  ),
  args: {
    workspaceLabel: "aurinkokello",
    tabs: [
      { key: "s:1", name: "bash", busy: false },
      { key: "s:2", name: "node", busy: true, command: "node" },
    ],
    activeKey: "s:1",
    height: 300,
    maximized: false,
    children: <Surface />,
    onSelectTab: noop,
    onCloseTab: noop,
    onNew: noop,
    onAttach: noop,
    onToggleMax: noop,
    onHide: noop,
    onResize: noop,
    onKey: noop,
    onClipboardPaste: noop,
    onPasteAnswer: noop,
    onCopySelection: noop,
    onSendSelection: noop,
    onFocusTerminal: noop,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Paneeli: työtilan päätteet keskustelun alla. Synteettiset näyttötilat; pääte ei ole yhteydessä palvelimeen.",
      },
    },
  },
} satisfies Meta<typeof TerminalPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tabs: Story = {};
export const Empty: Story = { args: { tabs: [], activeKey: undefined } };
export const TaskfleetReadOnly: Story = {
  args: {
    tabs: [
      { key: "s:1", name: "bash", busy: false },
      {
        key: "t:77f5c84c2248fcc06660-12",
        name: "wt-browser-shell",
        busy: true,
        command: "pi",
        readOnly: true,
        session: "agents",
      },
    ],
    activeKey: "t:77f5c84c2248fcc06660-12",
    children: <Surface readOnly />,
    attachable: [
      {
        token: "fake-process-13",
        name: "wt-file-viewing",
        session: "agents",
        busy: false,
      },
    ],
  },
};
export const PasteConfirmation: Story = {
  args: {
    paste: ["cd web", "npm ci", "npm run test -- PersonalStorage"],
  },
};
export const Selection: Story = {
  args: {
    selection: {
      text: "ok  example.invalid/aurinkokello",
      at: { top: 110, left: 14 },
    },
  },
};
export const SelectionCopied: Story = {
  args: {
    selection: {
      text: "ok  example.invalid/aurinkokello",
      at: { top: 110, left: 14 },
    },
    selectionCopied: true,
  },
};
export const AddressOffer: Story = {
  args: {
    urlOffer: "https://example.invalid/login/device?code=ABCD-1234",
  },
};
export const ConnectionLost: Story = { args: { offline: true } };
export const NotSurvivingRestart: Story = { args: { volatile: true } };
export const Phone: Story = {
  args: { sticky: { ctrl: true, alt: false } },
  globals: { viewport: { value: "mobile1" } },
};
