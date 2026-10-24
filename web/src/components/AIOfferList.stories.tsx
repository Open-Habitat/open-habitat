import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { AIOffer } from "../app/onboardingConfig";
import { type AIOption, AIOfferList, suggestionOf } from "./AIOfferList";
import { Button } from "./Primitives";

// The onboarding AI step's option list for each site offer
// (proto-admin-server-onboarding r3–r4, "Ehdotus ja lista"). Each open row
// holds a stand-in button instead of a real sign-in; no host is involved.
function Offer({ offer }: { offer: AIOffer }) {
  const [choice, setChoice] = useState<AIOption>(
    suggestionOf(offer)?.id ?? "chatgpt",
  );
  return (
    <div style={{ maxWidth: 560 }}>
      <AIOfferList
        offer={offer}
        choice={choice}
        onChoose={setChoice}
        body={(o) => (
          <Button
            size="row"
            variant="secondary"
            label={o.key ? "Tallenna avain" : "Kirjaudu…"}
            onPress={() => {}}
          />
        )}
      />
    </div>
  );
}

const meta = {
  title: "Production/Onboarding AI offer",
  component: Offer,
  parameters: {
    docs: {
      description: {
        component:
          "Käyttöönoton AI-vaiheen vaihtoehdot sivuston tarjouksen mukaan: kaikki rinnakkain, tai sivuston ehdotus ja › Käytä muuta AI-palvelua.",
      },
    },
  },
} satisfies Meta<typeof Offer>;
export default meta;
type Story = StoryObj<typeof meta>;

const reveal: Story["play"] = async ({ canvasElement }) => {
  canvasElement
    .querySelector<HTMLButtonElement>('[data-testid="ai-others-toggle"]')
    ?.click();
};

export const All: Story = { args: { offer: "all" } };
export const ChatGPT: Story = { args: { offer: "chatgpt" } };
export const Claude: Story = { args: { offer: "claude" } };
export const OpenAIKey: Story = { args: { offer: "openai_key" } };
export const AnthropicKey: Story = { args: { offer: "anthropic_key" } };
export const DeepSeekKey: Story = { args: { offer: "deepseek_key" } };
export const ChatGPTOthersRevealed: Story = {
  args: { offer: "chatgpt" },
  play: reveal,
};
export const DeepSeekKeyOthersRevealed: Story = {
  args: { offer: "deepseek_key" },
  play: reveal,
};
export const ClaudeOthersRevealedNarrow: Story = {
  args: { offer: "claude" },
  play: reveal,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
