import type { Meta, StoryObj } from "@storybook/react-vite";
import type { WorkspaceIconModel } from "./WorkspaceIcon";
import { WorkspaceIconPicker } from "./WorkspaceIconPicker";

// The workspace page's icon picker (workspace-icons, experimental): the
// heading's icon opens it; a choice is the page's to write and commit.
const meta = {
  title: "Production/Workspace icon picker",
  component: WorkspaceIconPicker,
  parameters: { layout: "padded" },
} satisfies Meta<typeof WorkspaceIconPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const logo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="2.5" y="2.5" width="43" height="43" rx="12" fill="#e6f1f3" stroke="#cfe3e6"/><path d="M14 36V23a10 10 0 0 1 20 0v13" fill="none" stroke="#2b7f8c" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="28.5" r="3.2" fill="#2b7f8c"/></svg>')}`;
const base: WorkspaceIconModel = {
  name: "open-habitat",
  glyph: { letters: "OH", hue: 0 },
  show: { kind: "emoji", value: "🦔" },
  source: "Repon asetus",
  where: ".open-habitat.yaml",
};
const logoIcon: WorkspaceIconModel = {
  ...base,
  show: { kind: "image", src: logo },
};

export const ChosenEmoji: Story = {
  args: {
    model: {
      icon: base,
      setting: "🦔",
      auto: logoIcon,
      logo: { path: "design-system/favicon.svg", icon: logoIcon },
      letters: "OH",
    },
    onChoose: () => {},
  },
};

export const WithoutLogo: Story = {
  args: {
    model: {
      icon: { ...base, show: { kind: "glyph" } },
      auto: { ...base, show: { kind: "glyph" } },
      letters: "OH",
    },
    onChoose: () => {},
  },
};

export const Unavailable: Story = {
  args: {
    model: {
      icon: base,
      setting: "🦔",
      auto: logoIcon,
      letters: "OH",
    },
    onChoose: () => {},
    isDisabled: true,
    disabledReason: "Kuvaketta voi vaihtaa, kun työtilan tila on vahvistettu.",
  },
};
