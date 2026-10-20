import type { Meta, StoryObj } from "@storybook/react";
import { RecapCard } from "./RecapCard";

const meta = {
  title: "Production/Conversation recap",
  component: RecapCard,
} satisfies Meta<typeof RecapCard>;
export default meta;
type Story = StoryObj<typeof meta>;
const recap = {
  recap:
    "Keskustelussa selvitettiin kirjautumisen paluureitti. Testit läpäisivät paikallisen ajon.",
  next: "Tarkista toiminta selaimessa",
  through: "synthetic_entry",
  generated_at: 1750000000000,
};
export const Current: Story = {
  args: {
    recap,
    stale: false,
    pending: false,
    error: false,
    unavailable: false,
    onRequest: () => {},
  },
};
export const Automatic: Story = {
  args: {
    ...Current.args,
    recap: { ...recap, trigger: "automatic" },
    onDismiss: () => {},
  },
};
export const Stale: Story = {
  args: { ...Current.args, stale: true, onDismiss: () => {} },
};
export const Working: Story = {
  args: {
    ...Automatic.args,
    unavailable: true,
    unavailableReason: "Odota agentin vuoron päättymistä.",
  },
};
export const Generating: Story = {
  args: { ...Current.args, recap: null, pending: true },
};
export const Failure: Story = { args: { ...Current.args, error: true } };
