import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { SiteKey } from "../app/onboardingConfig";
import { SiteKeyPage } from "./SiteKeySettings";

// Synthetic states of the production Palvelimen ylläpito › AI-avain tab. The
// story stands in for the host: a key is accepted as given and only its
// suffix is kept.
function Tab({ siteKey: initial }: { siteKey?: SiteKey }) {
  const [siteKey, setSiteKey] = useState(initial);
  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <SiteKeyPage
        siteKey={siteKey}
        actions={{
          set: async (provider, key) => {
            setSiteKey({
              provider,
              suffix: key.slice(-4),
              set_at: "2026-10-24T09:00:00Z",
            });
            return true;
          },
          remove: async () => {
            setSiteKey(undefined);
            return true;
          },
        }}
      />
    </div>
  );
}

const meta = {
  title: "Settings/AI-avain",
  component: Tab,
} satisfies Meta<typeof Tab>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoKey: Story = {};
export const Stored: Story = {
  args: {
    siteKey: {
      provider: "anthropic",
      suffix: "Xa1b",
      set_at: "2026-10-24T09:00:00Z",
    },
  },
};
