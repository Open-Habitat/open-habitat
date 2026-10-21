import type { Meta, StoryObj } from "@storybook/react-vite";
import { AttachmentMenu } from "./composer/AttachmentMenu";
import {
  LocalFolder,
  LocalFolderContext,
  type LocalFolderView,
} from "./LocalFolder";

const base: LocalFolderView = {
  supported: true,
  onChoose: () => {},
  onStop: () => {},
};
const meta = {
  title: "Production/Local folder",
  component: LocalFolder,
  args: { view: base },
} satisfies Meta<typeof LocalFolder>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Shared: Story = { args: { view: { ...base, name: "agentille" } } };
export const RefusedReplacement: Story = {
  args: { view: { ...base, name: "agentille", issue: "aborted" } },
};
export const Unavailable: Story = {
  args: { view: { ...base, supported: false } },
};
export const Attachments: Story = {
  render: () => (
    <LocalFolderContext.Provider value={base}>
      <div style={{ paddingTop: 420 }}>
        <AttachmentMenu disabled={false} onAttach={() => {}} />
      </div>
    </LocalFolderContext.Provider>
  ),
};
