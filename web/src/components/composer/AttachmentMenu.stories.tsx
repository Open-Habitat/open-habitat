import type { Meta, StoryObj } from "@storybook/react-vite";
import { AttachmentMenu } from "./AttachmentMenu";

const meta = {
  title: "Production/Attachment button",
  component: AttachmentMenu,
  args: { disabled: false, onAttach: () => {} },
  decorators: [
    (Story) => (
      <div className="ah-crow">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AttachmentMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
