import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AccountKey } from "../app/accountKeys";
import { AccountKeysTable } from "./AccountKeys";
import "./Settings.css";

const ssh: AccountKey = {
  kind: "ssh",
  file: "~/.ssh/id_ed25519",
  algorithm: "ssh-ed25519",
  public_key:
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA5z57WK3YdjUW1MXsznOK5TK+boh4e44zSqBbUNtPg/ person@habitat.example.org",
  fingerprint: "SHA256:bNw5ZRoVQKPlioaoebVpQwvX1asbAwOlF35b5hzAAe4",
  comment: "person@habitat.example.org",
  modified_at: "2026-10-12T09:30:00Z",
};
const deploy: AccountKey = {
  ...ssh,
  file: "~/.ssh/deploy_ed25519",
  public_key:
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO8VzrWjoq9bhDhZ7HkL5rvRQPTiLEfHfjpfr16AhM2y deploy@habitat.example.org",
  fingerprint: "SHA256:RVzWv3xY7asVSAxuhOSMRSMFqJXLteFX054TCGbj/Bo",
  comment: "deploy@habitat.example.org",
  modified_at: new Date().toISOString(),
};
const age: AccountKey = {
  kind: "age",
  file: "~/.config/sops/age/keys.txt",
  algorithm: "X25519",
  public_key: "age1zgxd79sw3jvcsj2c2tlr7stegtxpd9kcq2zjwpkuylg6yrlwvegsv5juss",
  modified_at: "2026-10-12T09:31:00Z",
};

const meta = {
  title: "Production/Account keys",
  component: AccountKeysTable,
  args: {
    keys: [ssh, age],
    missing: [],
    unseen: new Set<string>(),
    created: new Set<string>(),
    onCopy: async () => true,
    onCreate: () => {},
    onSeen: () => {},
  },
  render: (args) => (
    <section className="s-main">
      <h2>Avaimet</h2>
      <AccountKeysTable {...args} />
    </section>
  ),
} satisfies Meta<typeof AccountKeysTable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Both: Story = {};
export const NoKeys: Story = {
  args: {
    keys: [],
    missing: [
      { kind: "ssh", file: "~/.ssh/id_ed25519", can_create: true },
      { kind: "age", file: "~/.config/sops/age/keys.txt", can_create: true },
    ],
  },
};
export const Creating: Story = {
  args: { ...NoKeys.args, creating: "ssh" },
};
export const OnlySSHWithoutAgeTool: Story = {
  args: {
    keys: [ssh],
    missing: [
      { kind: "age", file: "~/.config/sops/age/keys.txt", can_create: false },
    ],
    created: new Set([ssh.kind === "ssh" ? ssh.fingerprint : ""]),
  },
};
export const AgentKeyUnseen: Story = {
  args: {
    keys: [ssh, deploy, age],
    unseen: new Set([deploy.kind === "ssh" ? deploy.fingerprint : ""]),
  },
};
