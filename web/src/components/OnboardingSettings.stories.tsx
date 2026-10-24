import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { OnboardingDocument } from "../app/onboardingConfig";
import {
  OnboardingSettings,
  type OnboardingStep,
  type ProviderAvailability,
  type SaveState,
} from "./OnboardingSettings";

// Synthetic states of the production Asetukset › Käyttöönotto tab
// (proto-admin-server-onboarding rounds 2–5). The document lives in the
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
    { provider: "dropbox", required: true },
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
}: {
  initial: OnboardingDocument;
  step: OnboardingStep;
  save?: SaveState;
  preview?: boolean;
}) {
  const [doc, setDoc] = useState(initial);
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
  args: { step: "integration:dropbox" },
};
export const AddIntegration: Story = { args: { step: "add-integration" } };
export const AIAccountDefault: Story = { args: { step: "ai" } };
export const AIAccountPersonChooses: Story = {
  args: { step: "ai", initial: { ...saved, ai_account: { offer: "all" } } },
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
