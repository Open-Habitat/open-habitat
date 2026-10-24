import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type {
  CopyCheck,
  JoinedPerson,
  SiteKeyCopies,
} from "../app/siteKeyCopies";
import { GiveDialog, JoinedCard } from "./SiteKeyCopies";

// Synthetic states of Palvelimen ylläpito › AI-avain › Jo liittyneet. The
// story stands in for the people's daemons: each answers a check with a
// fixed word and a write with what that word allows.
const siteKey = {
  provider: "anthropic" as const,
  suffix: "7Q2x",
  set_at: "2026-10-24T09:00:00Z",
};
const people: JoinedPerson[] = [
  { id: "1001", login_hint: "kaisa-admin", username: "kaisa" },
  {
    id: "1002",
    login_hint: "aino-v",
    username: "aino",
    copy: {
      provider: "anthropic",
      suffix: "m4Pz",
      at: "2026-10-21T12:00:00Z",
      current: false,
    },
  },
  { id: "1003", login_hint: "mikko-k", username: "mikko" },
  { id: "1005", login_hint: "olli-p", username: "olli" },
  { id: "1007", login_hint: "ville-r", username: "ville" },
];
const words: Record<string, CopyCheck> = {
  "1001": "own",
  "1002": "earlier",
  "1003": "own",
  "1005": "absent",
  "1007": "unknown",
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Card({ open = false }: { open?: boolean }) {
  const copies: SiteKeyCopies = {
    schema_version: 1,
    site_key: siteKey,
    people,
    waiting: 1,
  };
  const [giving, setGiving] = useState<JoinedPerson[] | undefined>(
    open ? people : undefined,
  );
  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <JoinedCard copies={copies} disabled={false} onGive={setGiving} />
      {giving && (
        <GiveDialog
          targets={giving}
          siteKey={siteKey}
          check={async (p) => {
            await wait(300);
            return words[p.id] ?? "unknown";
          }}
          give={async (p) => {
            await wait(300);
            return words[p.id] === "absent" ? "seeded" : "replaced";
          }}
          onClose={() => setGiving(undefined)}
        />
      )}
    </div>
  );
}

const meta = {
  title: "Settings/AI-avain/Jo liittyneet",
  component: Card,
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Joined: Story = {};
export const Giving: Story = { args: { open: true } };
