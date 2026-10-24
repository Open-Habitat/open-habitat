import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { OnboardingDocument, SiteKey } from "../app/onboardingConfig";
import {
  OnboardingSettings,
  type OnboardingStep,
  type ProviderAvailability,
  type SaveState,
} from "./OnboardingSettings";
import type { SiteKeyActions } from "./SiteKeySettings";

// Synthetic states of the production Asetukset › Käyttöönotto tab
// (proto-admin-server-onboarding rounds 2–5). Dropbox is not ready here, so
// it is not offered for adding and its configured step is hidden. The document lives in the
// story; the save state is fixed per story and no host is involved.
const saved: OnboardingDocument = {
  repositories: {
    mode: "preselected",
    defaults: [
      "example-org/product",
      "example-org/design-system",
      "example-org/infra",
    ],
  },
  integrations: [
    { provider: "google", required: false },
    { provider: "microsoft", required: true },
    { provider: "dropbox", required: false },
  ],
  ai_account: { offer: "chatgpt" },
};
const availability: ProviderAvailability = {
  google: true,
  microsoft: true,
  imap: true,
  caldav: true,
  carddav: true,
  dropbox: false,
};
const facts = (name: string) =>
  name === "example-org/product"
    ? { private: true, description: "Synteettinen tuotekehitysrepo" }
    : name === "example-org/infra"
      ? { private: true, description: "Palvelinten asetukset" }
      : undefined;

function Tab({
  initial,
  step: firstStep,
  save = { kind: "idle" },
  preview: initialPreview = false,
  siteKey: initialKey,
}: {
  initial: OnboardingDocument;
  step: OnboardingStep;
  save?: SaveState;
  preview?: boolean;
  siteKey?: SiteKey;
}) {
  const [doc, setDoc] = useState(initial);
  // The story stands in for the host; the key itself is set on AI-avain.
  const [siteKey, setSiteKey] = useState(initialKey);
  const keyActions: Pick<SiteKeyActions, "remove"> = {
    remove: async (offer) => {
      setSiteKey(undefined);
      setDoc((d) => ({ ...d, ai_account: { offer } }));
      return true;
    },
  };
  const [step, setStep] = useState(firstStep);
  const [preview, setPreview] = useState(initialPreview);
  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <OnboardingSettings
        doc={doc}
        availability={availability}
        step={step}
        onStep={setStep}
        onChange={setDoc}
        onAddRepository={() => {}}
        facts={facts}
        save={save}
        disabled={save.kind === "conflict" || save.kind === "uncertain"}
        onReload={() => {}}
        preview={preview}
        onPreview={setPreview}
        host="habitat.example.test"
        siteKey={siteKey}
        keyActions={keyActions}
        keyLink={{ href: "#ai-avain" }}
      />
    </div>
  );
}

const meta = {
  title: "Settings/Käyttöönotto",
  component: Tab,
  args: { initial: saved, step: "repositories" },
} satisfies Meta<typeof Tab>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Repositories: Story = {};
export const SkipWithoutDefaults: Story = {
  args: {
    initial: {
      ...saved,
      repositories: { mode: "skip", defaults: [] },
    },
  },
};
export const RequiredIntegration: Story = {
  args: { step: "integration:microsoft" },
};
/** Configured, but the installation does not have Dropbox ready: the step
 * stays in the configuration, hidden from new people. */
export const HiddenIntegration: Story = {
  args: { step: "integration:dropbox" },
};
export const AddIntegration: Story = { args: { step: "add-integration" } };
export const AIAccountDefault: Story = { args: { step: "ai" } };
export const AIAccountPersonChooses: Story = {
  args: { step: "ai", initial: { ...saved, ai_account: { offer: "all" } } },
};
export const AIAccountSiteKey: Story = {
  args: {
    step: "ai",
    initial: { ...saved, ai_account: { offer: "site_key" } },
    siteKey: {
      provider: "anthropic",
      suffix: "Xa1b",
      set_at: "2026-10-24T09:00:00Z",
    },
  },
};
export const Saving: Story = { args: { save: { kind: "saving" } } };
export const Saved: Story = { args: { save: { kind: "saved" } } };
export const Refused: Story = {
  args: {
    save: { kind: "refused", text: "Ylläpito-oikeutesi on poistettu." },
  },
};
export const Conflict: Story = { args: { save: { kind: "conflict" } } };
export const Uncertain: Story = { args: { save: { kind: "uncertain" } } };
export const Preview: Story = { args: { preview: true } };
export const PreviewAuto: Story = {
  args: {
    preview: true,
    initial: {
      ...saved,
      repositories: { ...saved.repositories, mode: "auto" },
    },
  },
};
