import type { Meta, StoryObj } from "@storybook/react-vite";
import { ViewLinkDialog } from "./ViewLink";

const view = {
  view_id: "vabcdefghijklmnopqrstuvwxyz",
  title: "Kassavirta 2027",
  entry: "index.html",
  files: 4,
  bytes: 182_000,
  created_at: "2026-10-29T12:00:00Z",
};
const done = (): Promise<unknown> => Promise.resolve();

const meta = {
  title: "Conversation/View link",
  component: ViewLinkDialog,
  args: {
    isOpen: true,
    onClose: () => {},
    view,
    maxDays: 90,
    onCreate: done,
    onExtend: done,
    onRepoint: done,
    onNewAddress: done,
    onRevoke: done,
  },
} satisfies Meta<typeof ViewLinkDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const New: Story = {};
export const Shared: Story = {
  args: {
    link: {
      link_id: "labcdefghijklmnopqrstuvwxyz",
      view_id: view.view_id,
      title: view.title,
      url: `https://oh-view-${"a".repeat(52)}.example.org/${"K".repeat(43)}/`,
      created_at: "2026-10-29T12:00:00Z",
      expires_at: "2026-11-28T12:00:00Z",
    },
    otherViews: [
      view,
      {
        ...view,
        view_id: "vbcdefghijklmnopqrstuvwxyza",
        title: "Kassavirta 2027, versio 2",
        created_at: "2026-10-30T09:00:00Z",
      },
    ],
  },
};
export const Failed: Story = {
  args: {
    onCreate: (): Promise<unknown> =>
      Promise.reject(
        new Error("Näkymää ei enää ole. Agentti on ehkä poistanut sen."),
      ),
  },
};
