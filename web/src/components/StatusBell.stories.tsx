import type { Meta, StoryObj } from "@storybook/react";
import { StatusBell, type StatusItem } from "./StatusBell";

// The top bar's bell (proto-notification-bell, Tila), with the production
// copy of each condition.
const nearFull: StatusItem = {
  key: "storage",
  tone: "warning",
  icon: "disk",
  group: "own",
  short: "Tila lähes täynnä",
  title: "Tallennustilasi on lähes täynnä",
  meta: "9,2 GiB / 10 GiB",
  body: "Vapauta tilaa roskakorista tai pyydä agenttia siivoamaan tarpeettomia tiedostoja. Roskakoriin siirtäminen ei vapauta tilaa ennen sen tyhjentämistä.",
  actions: [
    { label: "Tallennustila ja roskakori", primary: true },
    { label: "Tarkista vapautettu tila", keepOpen: true },
  ],
};
const full: StatusItem = {
  ...nearFull,
  tone: "danger",
  short: "Tila täynnä",
  title: "Tallennustilasi on täynnä",
  meta: "10 GiB / 10 GiB",
};
const version: StatusItem = {
  key: "version",
  tone: "info",
  icon: "refresh",
  group: "own",
  short: "Uusi versio",
  title: "Uusi versio on saatavilla",
  meta: "Luonnokset säilyvät",
  body: "Lataa sivu uudelleen, niin saat uusimmat korjaukset. Luonnokset säilyvät.",
  actions: [
    { label: "Lataa uudelleen", primary: true },
    { label: "Myöhemmin", keepOpen: true },
  ],
};
const overcommit: StatusItem = {
  key: "server-storage",
  tone: "warning",
  icon: "server",
  group: "server",
  short: "Kiintiöt yli levyn",
  title: "Kiintiöt ylittävät palvelimen levyn",
  meta: "160 GiB kiintiöitä · 120 GiB levyä",
  body: "Jos kaikki käyttävät kiintiönsä, levy täyttyy ennen kiintiöitä. Silloin kenenkään tallennus ei onnistu.",
  actions: [{ label: "Palvelin › Levytila", primary: true }],
};

const meta = {
  title: "Production/Status bell",
  component: StatusBell,
  decorators: [
    (Story) => (
      <div style={{ display: "flex", justifyContent: "flex-end", padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatusBell>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing holds: there is no bell. */
export const Nothing: Story = { args: { items: [] } };
/** One warning: a quiet bell with its count. */
export const NearFull: Story = { args: { items: [nearFull] } };
/** Serious: the bell says it in words. */
export const Full: Story = { args: { items: [full] } };
/** Several, an administrator's server group among them. */
export const Several: Story = {
  args: { items: [nearFull, version, overcommit] },
};
