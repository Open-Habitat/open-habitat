import type { Meta, StoryObj } from "@storybook/react-vite";
import type { FileOfferItem, FileOfferSummary } from "../app/fileOffers";
import { FileOfferCard, FileShelf } from "./FileOffer";

// Storybook has no host: images and downloads point at routes that are not
// there, so the stories show the cards' text, marks and actions.
const offer: FileOfferSummary = {
  offer_id: "fabcdefghijklmnopqrstuvwxyz",
  title: "q3-raportti.pdf",
  files: 1,
  bytes: 1_258_291,
  created_at: "2026-10-27T10:31:00Z",
  conversation_id: "pi:11111111-1111-4111-8111-111111111111",
};
const ready = (items: FileOfferItem[], summary = offer) => ({
  state: "ready" as const,
  manifest: { offer: summary, items },
});

const meta = {
  title: "Conversation/File offer",
  component: FileOfferCard,
  args: {
    offer,
    state: ready([{ path: "q3-raportti.pdf", bytes: 1_258_291, kind: "pdf" }]),
    onShowFiles: () => {},
  },
} satisfies Meta<typeof FileOfferCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Document: Story = {};
export const Table: Story = {
  args: {
    offer: { ...offer, title: "ilmoittautuneet.csv", bytes: 97_280 },
    state: ready([
      {
        path: "ilmoittautuneet.csv",
        bytes: 97_280,
        kind: "csv",
        lines: 1249,
        columns: 6,
      },
    ]),
  },
};
export const Archive: Story = {
  args: {
    offer: { ...offer, title: "reittikuvat.zip", bytes: 61_000_000 },
    state: ready([
      {
        path: "reittikuvat.zip",
        bytes: 61_000_000,
        kind: "zip",
        archive: { entries: 24, bytes: 61_500_000, names: [] },
      },
    ]),
  },
};
export const UnknownKind: Story = {
  args: {
    offer: { ...offer, title: "osallistujat.parquet", bytes: 412_000 },
    state: ready([
      { path: "osallistujat.parquet", bytes: 412_000, kind: "file" },
    ]),
  },
};
const pack = {
  ...offer,
  title: "Kumppanipaketti",
  folder: "kumppanipaketti",
  files: 4,
  bytes: 9_437_184,
};
const packItems: FileOfferItem[] = [
  { path: "LUE-MINUT.md", bytes: 2048, kind: "markdown", lines: 22 },
  { path: "etappi-1/reitti-1.gpx", bytes: 285_000, kind: "text", lines: 900 },
  { path: "etappi-2/reitti-2.gpx", bytes: 291_000, kind: "text", lines: 910 },
  { path: "logot/saaristo.pdf", bytes: 8_800_000, kind: "pdf" },
];
export const Package: Story = {
  args: { offer: pack, state: ready(packItems, pack) },
};
export const Removed: Story = { args: { state: { state: "removed" } } };
export const Loading: Story = { args: { state: { state: "loading" } } };
export const Phone: Story = {
  args: { offer: pack, state: ready(packItems, pack) },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

export const Shelf: StoryObj<typeof FileShelf> = {
  render: () => (
    <div style={{ display: "flex", height: 640, width: 420 }}>
      <FileShelf
        offers={[
          { offer: pack, state: ready(packItems, pack) },
          {
            offer,
            state: ready([
              { path: "q3-raportti.pdf", bytes: 1_258_291, kind: "pdf" },
            ]),
          },
        ]}
        onClose={() => {}}
      />
    </div>
  ),
};
