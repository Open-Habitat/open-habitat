import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import type { OnboardingDocument } from "../app/onboardingConfig";
import {
  OnboardingSettings,
  type OnboardingStep,
  type ProviderAvailability,
  previewSteps,
} from "./OnboardingSettings";

const base: OnboardingDocument = {
  repositories: {
    mode: "preselected",
    defaults: ["example-org/product", "example-org/infra"],
  },
  integrations: [{ provider: "google", required: false }],
  ai_account: { offer: "all" },
};

function Harness({
  initial = base,
  availability = { google: true, dropbox: false },
  onAdd = () => {},
  first = "repositories",
}: {
  initial?: OnboardingDocument;
  availability?: ProviderAvailability;
  onAdd?: () => void;
  first?: OnboardingStep;
}) {
  const [doc, setDoc] = useState(initial);
  const [step, setStep] = useState<OnboardingStep>(first);
  const [preview, setPreview] = useState(false);
  return (
    <MemoryRouter>
      <OnboardingSettings
        doc={doc}
        availability={availability}
        step={step}
        onStep={setStep}
        onChange={setDoc}
        onAddRepository={onAdd}
        save={{ kind: "idle" }}
        onReload={() => {}}
        preview={preview}
        onPreview={setPreview}
        host="habitat.example.test"
      />
      <output data-testid="doc">{JSON.stringify(doc)}</output>
    </MemoryRouter>
  );
}
const doc = () =>
  JSON.parse(screen.getByTestId("doc").textContent ?? "") as OnboardingDocument;
const segment = (group: string, id: string) =>
  within(screen.getByTestId(group)).getByTestId(`segment-${id}`);

it("edits the repository mode and the default list; the route follows", () => {
  render(<Harness />);
  expect(
    screen.getByTestId("onboarding-route-repositories-hint").textContent,
  ).toBe("2 esivalittuna");
  fireEvent.click(segment("onboarding-repository-mode", "auto"));
  expect(screen.getByTestId("onboarding-list-label").textContent).toBe(
    "Automaattisesti haettavat repot",
  );
  expect(
    screen.getByTestId("onboarding-route-repositories-hint").textContent,
  ).toBe("2 haetaan automaattisesti");
  fireEvent.click(screen.getByTestId("onboarding-remove-example-org/infra"));
  expect(doc().repositories).toEqual({
    mode: "auto",
    defaults: ["example-org/product"],
  });
  fireEvent.click(screen.getByTestId("onboarding-remove-example-org/product"));
  fireEvent.click(segment("onboarding-repository-mode", "skip"));
  expect(screen.getByTestId("onboarding-no-defaults")).toBeTruthy();
  expect(screen.getByTestId("onboarding-effect").textContent).toContain(
    "Repovaihetta ei näytetä eikä mitään haeta",
  );
});

it("stops adding defaults at twenty", () => {
  const onAdd = vi.fn();
  const full = {
    ...base,
    repositories: {
      mode: "auto" as const,
      defaults: Array.from({ length: 20 }, (_, i) => `example-org/r${i}`),
    },
  };
  const { unmount } = render(<Harness initial={full} onAdd={onAdd} />);
  fireEvent.click(screen.getByTestId("onboarding-add-repository"));
  expect(onAdd).not.toHaveBeenCalled();
  unmount();
  render(<Harness onAdd={onAdd} />);
  fireEvent.click(screen.getByTestId("onboarding-add-repository"));
  expect(onAdd).toHaveBeenCalledOnce();
});

it("adds integrations in catalog order, marks them required and removes them", () => {
  render(<Harness />);
  fireEvent.click(screen.getByTestId("onboarding-route-add-integration"));
  fireEvent.click(screen.getByTestId("onboarding-add-dropbox"));
  // An integration this installation does not offer is shown as not installed.
  expect(screen.getByTestId("onboarding-not-installed")).toBeTruthy();
  expect(
    screen.getByTestId("onboarding-route-integration:dropbox-hint").textContent,
  ).toBe("Ei asennettu · jätetään pois");
  fireEvent.click(screen.getByTestId("onboarding-route-add-integration"));
  fireEvent.click(screen.getByTestId("onboarding-add-microsoft"));
  expect(doc().integrations.map((i) => i.provider)).toEqual([
    "google",
    "microsoft",
    "dropbox",
  ]);
  fireEvent.click(segment("onboarding-integration-required", "required"));
  expect(
    screen.getByTestId("onboarding-route-integration:microsoft-hint")
      .textContent,
  ).toBe("Pakollinen");
  expect(doc().integrations[1]).toEqual({
    provider: "microsoft",
    required: true,
  });
  fireEvent.click(screen.getByTestId("onboarding-integration-remove"));
  expect(doc().integrations.map((i) => i.provider)).toEqual([
    "google",
    "dropbox",
  ]);
});

it("chooses between the person choosing and one default AI option", () => {
  render(<Harness first="ai" />);
  expect(screen.queryByTestId("onboarding-ai-default")).toBeNull();
  fireEvent.click(segment("onboarding-ai-way", "default"));
  expect(doc().ai_account.offer).toBe("chatgpt");
  fireEvent.click(screen.getByLabelText(/DeepSeek API-avain/));
  expect(doc().ai_account.offer).toBe("deepseek_key");
  expect(screen.getByTestId("onboarding-route-ai-hint").textContent).toBe(
    "Oletus: DeepSeek API-avain",
  );
  fireEvent.click(segment("onboarding-ai-way", "all"));
  fireEvent.click(segment("onboarding-ai-way", "default"));
  // The last default comes back when the way is flipped back.
  expect(doc().ai_account.offer).toBe("deepseek_key");
  // site_key is not offered until the site holds a key.
  expect(screen.queryByText(/Sivuston avain/)).toBeNull();
});

it("previews the person's route with the settings docked beside it", () => {
  render(
    <Harness
      initial={{
        ...base,
        integrations: [
          { provider: "google", required: true },
          { provider: "dropbox", required: false },
        ],
        ai_account: { offer: "claude" },
      }}
    />,
  );
  fireEvent.click(screen.getByTestId("onboarding-preview-open"));
  const preview = screen.getByTestId("onboarding-preview");
  // Dropbox is not installed: it is not on the person's route.
  expect(
    within(preview)
      .getAllByTestId(/^onboarding-preview-step-/)
      .map((e) => e.dataset.testid),
  ).toEqual([
    "onboarding-preview-step-github",
    "onboarding-preview-step-repositories",
    "onboarding-preview-step-google",
    "onboarding-preview-step-ai",
  ]);
  expect(screen.getByTestId("onboarding-preview-screen").dataset.at).toBe(
    "repositories",
  );
  fireEvent.click(screen.getByTestId("onboarding-preview-next"));
  // A required integration offers no way past it without connecting.
  expect(screen.queryByText(/Jatka ilman/)).toBeNull();
  fireEvent.click(screen.getByTestId("onboarding-preview-next"));
  expect(screen.getByTestId("onboarding-preview-ai").textContent).toContain(
    "Claude-tilaus",
  );
  expect(screen.getByTestId("onboarding-preview-ai").textContent).not.toContain(
    "ChatGPT",
  );
  fireEvent.click(screen.getByTestId("onboarding-preview-ai-others"));
  expect(preview.textContent).toContain("ChatGPT-tilaus");
  // A change in the docked settings restarts the preview at once.
  fireEvent.click(
    within(
      within(preview).getByTestId("onboarding-repository-mode"),
    ).getByTestId("segment-skip"),
  );
  expect(screen.getByTestId("onboarding-preview-screen").dataset.at).toBe(
    "google",
  );
  expect(
    screen.getByTestId("onboarding-preview-step-repositories-auto").textContent,
  ).toContain("Sivusto hakee 2 repoa");
  fireEvent.click(screen.getByTestId("onboarding-preview-close"));
  expect(screen.queryByTestId("onboarding-preview")).toBeNull();
});

it("derives the preview route from the configuration", () => {
  const steps = (d: OnboardingDocument, a: ProviderAvailability = {}) =>
    previewSteps(d, a).map((s) => (s.id === "integration" ? s.provider : s.id));
  expect(steps(base)).toEqual(["repositories", "google", "ai", "done"]);
  expect(
    steps({ ...base, repositories: { mode: "skip", defaults: [] } }),
  ).toEqual(["google", "ai", "done"]);
  expect(steps(base, { google: false })).toEqual([
    "repositories",
    "ai",
    "done",
  ]);
});
