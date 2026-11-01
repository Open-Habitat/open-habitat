import type { Meta, StoryObj } from "@storybook/react-vite";
import { ViewOfferCard } from "./ViewOffer";

const view = {
  view_id: "vabcdefghijklmnopqrstuvwxyz",
  title: "Myyntiraportti.html",
  entry: "Myyntiraportti.html",
  files: 1,
  bytes: 24576,
  created_at: "2026-10-25T12:00:00Z",
  conversation_id: "pi:11111111-1111-4111-8111-111111111111",
};

const meta = {
  title: "Conversation/View offer",
  component: ViewOfferCard,
  args: { view, onOpen: () => {}, onOpenTab: () => {} },
} satisfies Meta<typeof ViewOfferCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Offered: Story = {};
export const Prototype: Story = {
  args: {
    view: {
      ...view,
      title: "Myynnin tilannekuva",
      entry: "site/index.html",
      files: 14,
      bytes: 3_400_000,
    },
  },
};
export const Opening: Story = { args: { state: "opening" } };
export const Failed: Story = { args: { state: "failed" } };
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
const visibility = {
  public: false,
  maxDays: 90,
  onPublic: () => {},
  onDuration: () => {},
};
export const Private: Story = { args: { visibility } };
export const Public: Story = {
  args: {
    visibility: {
      ...visibility,
      public: true,
      until: "2026-11-28T12:00:00Z",
      url: `https://app.example.org/n/${"E".repeat(43)}`,
    },
  },
};
export const PublicPhone: Story = {
  ...Public,
  globals: Phone.globals,
};
export const Changing: Story = {
  args: { visibility: { ...visibility, pending: true } },
};
export const Uncertain: Story = {
  args: {
    visibility: { ...visibility, unknown: true },
    problem:
      "Muutoksen tulos jäi epäselväksi. Tila on luettu uudelleen; tarkista se ennen kuin yrität uudelleen.",
  },
};
