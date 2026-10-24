import type { Meta, StoryObj } from "@storybook/react-vite";
import { AttachmentPreview } from "./AttachmentChips";
import { UserMessage } from "./Conversation";

// Production components with synthetic data. Storybook has no host, so an
// attachment URL does not load here; the preview image is an inline drawing.
const meta = { title: "Production/Attachments" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const drawing = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#dfe7e4"/><rect x="80" y="80" width="1440" height="120" rx="16" fill="#9fb8b0"/><rect x="80" y="260" width="900" height="660" rx="16" fill="#fff"/></svg>',
)}`;

/** A sent message: the text as written, its attachments as chips below. */
export const SentMessage: Story = {
  render: () => (
    <main style={{ maxWidth: 780, padding: 24 }}>
      <UserMessage
        sourceText={[
          "Mikä tässä on vialla?",
          "![CleanShot 2026-10-24 at 08.53.52@2x.png](/api/v1/attachments/6f82a1c4-1111-4111-8111-111111111111)",
          "[mittaukset-lokakuu.csv](/api/v1/attachments/6f82a1c4-2222-4222-8222-222222222222)",
          "Attachment path: /home/alice/attachments/6f82a1c4-1111-4111-8111-111111111111",
          "Attachment path: /home/alice/attachments/6f82a1c4-2222-4222-8222-222222222222",
        ].join("\n")}
        onCopy={noop}
      />
    </main>
  ),
};

/** An image at a size that fits, with its name and the original as a link. */
export const ImagePreview: Story = {
  render: () => (
    <AttachmentPreview
      attachment={{
        image: true,
        name: "CleanShot 2026-10-24 at 08.53.52@2x.png",
        url: drawing,
        source: "",
      }}
      onClose={noop}
    />
  ),
};

/** Another file by name, type and size; without a host the size is unknown. */
export const FilePreview: Story = {
  render: () => (
    <AttachmentPreview
      attachment={{
        image: false,
        name: "mittaukset-lokakuu.csv",
        url: "/api/v1/attachments/6f82a1c4-2222-4222-8222-222222222222",
        source: "",
      }}
      onClose={noop}
    />
  ),
};
