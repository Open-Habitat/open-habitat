import type { Meta, StoryObj } from "@storybook/react";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { WarningBanner } from "./WarningBanner";

// The common warning (proto-github-connection-warning round 2). The GitHub
// connection is the first user; the copy below is its own.
const reconnect = (label: string) => (
  <ControlButton size="row" variant="primary">
    <Icon name="github" width={14} height={14} />
    {label}
  </ControlButton>
);

const meta = {
  title: "Production/Warning banner",
  component: WarningBanner,
  args: {
    tone: "danger",
    icon: "warning",
    title: "GitHub-yhteys on vanhentunut tai peruttu",
    children:
      "GitHub ei enää hyväksy palvelimen valtuutusta, eikä palvelin voi uusia sitä itse. Yhdistä uudelleen: GitHub palauttaa sinut tänne, yleensä kysymättä mitään.",
    short: "Push ja gh eivät toimi. Palvelin ei voi uusia valtuutusta itse.",
    actions: reconnect("Yhdistä uudelleen"),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, margin: "24px auto" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WarningBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A fault the person repairs, above the composer. */
export const Danger: Story = {};
/** Not urgent: nothing is lost, and the repair is optional. */
export const Neutral: Story = {
  args: {
    tone: "neutral",
    title: "GitHubia ei ole yhdistetty",
    children:
      "Palvelimella ei ole GitHub-kirjautumistasi, joten push, kloonaus ja gh eivät toimi. Paikallinen työ ja keskustelut toimivat.",
    short: "Push ja gh eivät toimi ennen yhdistämistä.",
    actions: reconnect("Yhdistä GitHub"),
  },
};
/** The host is trying by itself: one quiet line, nothing asked. */
export const Progress: Story = {
  args: {
    tone: "progress",
    title: undefined,
    icon: undefined,
    short: undefined,
    actions: undefined,
    children: "GitHub ei vastannut · yritetään uudelleen…",
  },
};
/** The fault went away; shown for a moment. */
export const Success: Story = {
  args: {
    tone: "success",
    title: undefined,
    icon: undefined,
    short: undefined,
    actions: undefined,
    children:
      "GitHub yhdistetty käyttäjänä octo. Pyydä agenttia yrittämään uudelleen.",
  },
};
/** The app-wide strip under the top bar, in views without their own place. */
export const Page: Story = {
  args: { placement: "page" },
};
