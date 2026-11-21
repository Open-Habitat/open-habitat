import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  type Permission,
  PermissionLine,
  PermissionQuestion,
} from "./PermissionQuestion";

// The agent asks permission before an account action (round
// 2026-11-21-account-action-permission, direction 2 Kenttä). The account and
// names are synthetic.
const noop = () => {};
const permission: Permission = {
  action: "Poista postikansio ’Laskut 2024’",
  consequence: "Kansio ja sen 37 viestiä poistetaan postilaatikosta.",
  account: { provider: "Microsoft", address: "aino.virtanen@contoso.test" },
  call: {
    area: "ms-admin",
    tool: "delete-mail-folder",
    arguments: '{"mailFolderId":"AAMkAGQ5…Laskut2024"}',
  },
};
const meta = { title: "Production/Permission question" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const states = (narrow = false) => (
  <main style={{ maxWidth: narrow ? 390 : 780, display: "grid", gap: 16 }}>
    <PermissionLine action={permission.action} />
    <PermissionLine action={permission.action} decision="allow" />
    <PermissionLine
      action="Jaa kalenteri ’Perhe’ henkilölle Ville Virtanen"
      decision="deny"
    />
    <PermissionQuestion
      requestId="story-1"
      permission={permission}
      available
      onAnswer={noop}
      onStop={noop}
    />
    <PermissionQuestion
      requestId="story-2"
      permission={{ ...permission, account: undefined }}
      available={false}
      onAnswer={noop}
    />
  </main>
);
export const Light: Story = {
  render: () => states(),
  globals: { theme: "light" },
};
export const Dark: Story = {
  render: () => states(),
  globals: { theme: "dark" },
};
export const PhoneLight: Story = {
  render: () => states(true),
  globals: { theme: "light" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
