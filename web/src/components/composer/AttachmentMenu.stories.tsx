import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect } from "react";
import { AttachmentMenu } from "./AttachmentMenu";

function PortalTheme({
  theme,
  children,
}: {
  theme: string;
  children: ReactNode;
}) {
  useEffect(() => {
    // The global decorator themes an in-flow wrapper, not the body portal.
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = theme;
    return () => {
      if (previous === undefined) delete root.dataset.theme;
      else root.dataset.theme = previous;
    };
  }, [theme]);
  return children;
}

const meta = {
  title: "Production/Attachment menu",
  component: AttachmentMenu,
  args: { disabled: false, onAttach: () => {} },
  decorators: [
    (Story, context) => (
      <PortalTheme theme={context.globals.theme}>
        <div className="ah-crow" style={{ paddingTop: 240 }}>
          <Story />
        </div>
      </PortalTheme>
    ),
  ],
} satisfies Meta<typeof AttachmentMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

// Opens the production trigger, including its portal, positioning and focus.
// Use the theme toolbar and phone viewport to inspect the same surface.
export const Open: Story = {
  play: async ({ canvasElement }) => {
    canvasElement
      .querySelector<HTMLButtonElement>('[data-testid="attach-file"]')
      ?.click();
  },
};
export const Disabled: Story = { args: { disabled: true } };
