import type { Meta, StoryObj } from "@storybook/react";
import type { RewindPreview } from "../app/rewind";
import { ConversationFrame } from "./ConversationFrame";
import { RewindRow, RewindSheet } from "./Rewind";

// Palaa tähän (experimental): the confirmation sheet above the composer and
// the rows a return leaves in the history.
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
      path: "src/timezones.py",
      change: "modified",
      additions: 3,
      deletions: 0,
    },
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

const meta = {
  title: "Production/Palaa tähän",
  component: RewindSheet,
  decorators: [
    (Story) => (
      <div style={{ height: 420, position: "relative" }}>
        <ConversationFrame>
          <Story />
        </ConversationFrame>
      </div>
    ),
  ],
  args: {
    time: "9.20",
    preview,
    previewState: "ready",
    busy: false,
    onCancel: () => {},
    onGo: () => {},
  },
} satisfies Meta<typeof RewindSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sheet: Story = {};
export const FilesOffByDefault: Story = { args: { filesByDefault: false } };
export const AgentWorking: Story = { args: { busy: true } };
export const AlreadyCommitted: Story = {
  args: {
    preview: {
      ...preview,
      files: preview.files.map((f, i) =>
        i < 2 ? { ...f, committed: true } : f,
      ),
    },
  },
};
export const NoCopies: Story = {
  args: { preview: { ...preview, checkpoint: false, files: [], commands: [] } },
};
export const Reading: Story = {
  args: { preview: undefined, previewState: "loading" },
};

export const ReplacedContinuation: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 12, maxWidth: 760 }}>
      <RewindRow
        marker={{
          action: "rewind",
          own: 2,
          replies: 2,
          files_restored: 3,
          switchable: true,
          files_return: true,
        }}
        onToggle={() => {}}
        onSwitch={() => {}}
      />
      <RewindRow
        marker={{
          action: "rewind",
          own: 1,
          replies: 1,
          files_restored: 3,
          switchable: true,
          files_return: true,
        }}
        open
        onToggle={() => {}}
        onSwitch={() => {}}
        continuation={
          <p>Korjaa myös lokakuu samalla tavalla ja päivitä taulukko.</p>
        }
      />
      <RewindRow
        marker={{
          action: "files",
          own: 2,
          replies: 2,
          files_restored: 3,
          switchable: false,
          files_return: true,
        }}
        time="9.20"
        onUndo={() => {}}
      />
      <RewindRow
        marker={{
          action: "undo",
          own: 0,
          replies: 0,
          files_restored: 3,
          switchable: false,
          files_return: false,
        }}
      />
    </div>
  ),
};
