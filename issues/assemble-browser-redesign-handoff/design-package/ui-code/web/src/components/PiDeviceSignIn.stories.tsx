import type { Meta, StoryObj } from "@storybook/react-vite";
import { PiDeviceSignIn } from "./PiDeviceSignIn";
import { Button } from "./Primitives";

const meta = {
  title: "Production/Pi first-use presentation",
  component: PiDeviceSignIn,
  parameters: {
    docs: {
      description: {
        component:
          "Synteettiset tilakuvat oikeasta tuotantokomponentista. Ei Pi-yhteyttä, yrityksen aloitusta eikä toimivaa kirjautumista. 'Yhdistetty' on vain annettu näyttötila.",
      },
    },
  },
} satisfies Meta<typeof PiDeviceSignIn>;
export default meta;
type Story = StoryObj<typeof meta>;

const instructions = {
  verificationUri: "https://auth.openai.com/codex/device",
  userCode: "DEMO-KOODI",
};
// Buttons demonstrate intent/keyboard behavior only; stories never start an attempt.
const onIntent = () => {};
export const Ready: Story = {
  args: { view: { phase: "ready", ...instructions }, onCancel: onIntent },
};
export const Pending: Story = {
  args: { view: { phase: "pending", ...instructions }, onCancel: onIntent },
};
export const Connected: Story = { args: { view: { phase: "connected" } } };
export const Expired: Story = {
  args: { view: { phase: "expired" }, onRetry: onIntent },
};
export const Interrupted: Story = {
  args: { view: { phase: "interrupted" }, onRefresh: onIntent },
};
export const Failed: Story = {
  args: { view: { phase: "failed" }, onRetry: onIntent },
};
export const Unavailable: Story = {
  args: { view: { phase: "unavailable" }, onRefresh: onIntent },
};
export const FirstUseExitDanger: Story = {
  args: Ready.args,
  render: (args) => (
    <main>
      <PiDeviceSignIn {...args} />
      <Button
        label="Keskeytä käyttöönotto ja kirjaudu ulos"
        variant="danger"
        onPress={onIntent}
      />
    </main>
  ),
};
export const FirstUseExitDangerNarrow: Story = {
  ...FirstUseExitDanger,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 390 }}>
        <Story />
      </div>
    ),
  ],
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
