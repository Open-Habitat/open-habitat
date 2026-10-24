import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  docxFixture,
  markdownFixture,
  pdfFixture,
  pptxFixture,
  xlsxFixture,
} from "../app/documentFixtures";
import { AttachmentPreview } from "./AttachmentPreview";
import { UserMessage } from "./Conversation";

// Production components with synthetic data. Storybook has no host, so an
// attachment URL does not load here; the preview image is an inline drawing
// and a document's bytes are the synthetic fixtures the tests use.
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

function DocumentStory({ name, bytes }: { name: string; bytes: Uint8Array }) {
  return (
    <AttachmentPreview
      attachment={{
        image: false,
        name,
        url: "/api/v1/attachments/6f82a1c4-3333-4333-8333-333333333333",
        source: "",
      }}
      onClose={noop}
      read={async () => bytes}
    />
  );
}

/** A PDF's pages drawn by pdf.js; the document's own script does not run. */
export const PdfPreview: Story = {
  render: () => (
    <DocumentStory
      name="tarjous-2026.pdf"
      bytes={pdfFixture({
        pages: ["Tarjous", "Liite 1"],
        script: "app.alert(1)",
      })}
    />
  ),
};

/** Markdown through the app's sanitising renderer; its HTML stays inert. */
export const MarkdownPreview: Story = {
  render: () => (
    <DocumentStory
      name="muistio.md"
      bytes={new TextEncoder().encode(markdownFixture)}
    />
  ),
};

/** A Word document laid out in a frame without scripts or network. */
export const WordPreview: Story = {
  render: () => <DocumentStory name="raportti.docx" bytes={docxFixture()} />,
};

/** A workbook's visible sheets as tabs of plain tables. */
export const SheetPreview: Story = {
  render: () => <DocumentStory name="mittaukset.xlsx" bytes={xlsxFixture()} />,
};

/** A deck as its slides' text, tables and pictures, not their layout. */
export const SlidesPreview: Story = {
  render: () => <DocumentStory name="kvartaali.pptx" bytes={pptxFixture()} />,
};

/** The same dialog at phone width. */
export const PhoneDocumentPreview: Story = {
  ...PdfPreview,
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
