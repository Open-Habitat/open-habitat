import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import type { OnboardingDocument, SiteKey } from "../app/onboardingConfig";
import {
  OnboardingSettings,
  type OnboardingStep,
  type ProviderAvailability,
  previewSteps,
} from "./OnboardingSettings";
import type { SiteKeyActions } from "./SiteKeySettings";

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
  availability = { google: true, microsoft: true, dropbox: false },
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

it("adds only ready integrations, in catalog order, marks them required and removes them", () => {
  render(
    <Harness
      initial={{
        ...base,
        integrations: [{ provider: "dropbox", required: false }],
      }}
    />,
  );
  // A configured integration that is not ready stays, hidden from new people.
  const dropbox = screen.getByTestId("onboarding-route-integration:dropbox");
  expect(dropbox.dataset.shown).toBe("false");
  fireEvent.click(dropbox);
  expect(screen.getByTestId("onboarding-step-hidden")).toBeTruthy();
  fireEvent.click(screen.getByTestId("onboarding-route-add-integration"));
  // IMAP's readiness is unknown here, so it is not offered.
  expect(screen.queryByTestId("onboarding-add-imap")).toBeNull();
  expect(screen.getByTestId("onboarding-unready-imap")).toBeTruthy();
  fireEvent.click(screen.getByTestId("onboarding-add-microsoft"));
  fireEvent.click(screen.getByTestId("onboarding-route-add-integration"));
  fireEvent.click(screen.getByTestId("onboarding-add-google"));
  expect(doc().integrations.map((i) => i.provider)).toEqual([
    "google",
    "microsoft",
    "dropbox",
  ]);
  fireEvent.click(screen.getByTestId("onboarding-route-integration:microsoft"));
  expect(
    screen.getByTestId("onboarding-route-integration:microsoft").dataset.shown,
  ).toBe("true");
  fireEvent.click(segment("onboarding-integration-required", "required"));
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
});

// The host as the page sees it: set and remove resolve once it answers, and
// only then does the configuration change.
function KeyHarness({ refuse = false }: { refuse?: boolean }) {
  const [doc, setDoc] = useState<OnboardingDocument>(base);
  const [siteKey, setSiteKey] = useState<SiteKey>();
  const [step, setStep] = useState<OnboardingStep>("ai");
  const actions: SiteKeyActions = {
    set: async (provider, key) => {
      sent.push(`set ${provider} ${key}`);
      if (refuse) return false;
      setSiteKey({
        provider,
        suffix: key.slice(-4),
        set_at: "2026-10-24T09:00:00Z",
      });
      setDoc((d) => ({ ...d, ai_account: { offer: "site_key" } }));
      return true;
    },
    remove: async (offer) => {
      sent.push(`remove ${offer}`);
      setSiteKey(undefined);
      setDoc((d) => ({ ...d, ai_account: { offer } }));
      return true;
    },
  };
  return (
    <MemoryRouter>
      <OnboardingSettings
        doc={doc}
        availability={{ google: true }}
        step={step}
        onStep={setStep}
        onChange={setDoc}
        onAddRepository={() => {}}
        save={{ kind: "idle" }}
        onReload={() => {}}
        preview={false}
        onPreview={() => {}}
        host="habitat.example.test"
        siteKey={siteKey}
        keyActions={actions}
      />
      <output data-testid="doc">{JSON.stringify(doc)}</output>
    </MemoryRouter>
  );
}
let sent: string[] = [];
const anthropic = `sk-ant-${"a".repeat(30)}Wxyz`;

it("Sivuston avain: stores the key by its own action, then leaves it only by removing it", async () => {
  sent = [];
  render(<KeyHarness />);
  // Choosing the way opens the form; the offer does not change until the
  // host has the key.
  fireEvent.click(segment("onboarding-ai-way", "key"));
  expect(doc().ai_account.offer).toBe("all");
  const input = screen.getByTestId("site-key-input");
  const save = () => screen.getByTestId("site-key-save");
  // An OpenAI-shaped key is not Anthropic's, and the reverse.
  fireEvent.click(segment("site-key-provider", "anthropic"));
  fireEvent.change(input, { target: { value: `sk-${"o".repeat(30)}` } });
  expect((save() as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByTestId("site-key-error")).toBeTruthy();
  fireEvent.change(input, { target: { value: anthropic } });
  expect((save() as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(save());
  await screen.findByTestId("site-key-present");
  expect(sent).toEqual([`set anthropic ${anthropic}`]);
  expect(doc().ai_account.offer).toBe("site_key");
  expect(screen.getByTestId("site-key-suffix").textContent).toContain("Wxyz");
  expect(screen.queryByTestId("site-key-input")).toBeNull();
  expect(
    screen.getByTestId("onboarding-route-ai").getAttribute("data-shown"),
  ).toBe("false");

  // Another way asks first; cancelling keeps the key.
  fireEvent.click(segment("onboarding-ai-way", "default"));
  fireEvent.click(await screen.findByTestId("site-key-remove-cancel"));
  expect(sent).toHaveLength(1);
  expect(doc().ai_account.offer).toBe("site_key");
  fireEvent.click(segment("onboarding-ai-way", "all"));
  fireEvent.click(await screen.findByTestId("site-key-remove-confirm"));
  await vi.waitFor(() => expect(doc().ai_account.offer).toBe("all"));
  expect(sent[1]).toBe("remove all");
  expect(screen.queryByTestId("site-key")).toBeNull();
});

it("a refused key leaves the way and the offer as they were", async () => {
  sent = [];
  render(<KeyHarness refuse />);
  fireEvent.click(segment("onboarding-ai-way", "key"));
  fireEvent.change(screen.getByTestId("site-key-input"), {
    target: { value: `sk-${"o".repeat(30)}` },
  });
  fireEvent.click(screen.getByTestId("site-key-save"));
  // The key does not stay in the field after the host answered.
  await vi.waitFor(() =>
    expect(
      (screen.getByTestId("site-key-input") as HTMLInputElement).value,
    ).toBe(""),
  );
  expect(sent).toHaveLength(1);
  expect(doc().ai_account.offer).toBe("all");
  fireEvent.click(screen.getByTestId("site-key-cancel"));
  expect(screen.queryByTestId("site-key")).toBeNull();
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
  // The production route: Dropbox is not ready, so it is not on it.
  expect(
    within(within(preview).getByTestId("onboarding-steps"))
      .getAllByRole("listitem")
      .map((e) => e.dataset.testid),
  ).toEqual([
    "onboarding-step-github",
    "onboarding-step-repositories",
    "onboarding-step-google",
    "onboarding-step-ai",
  ]);
  expect(
    within(preview).getByTestId("onboarding-step-google").dataset.required,
  ).toBe("true");
  expect(screen.getByTestId("onboarding-preview-screen").dataset.at).toBe(
    "repositories",
  );
  fireEvent.click(screen.getByTestId("onboarding-preview-next"));
  // A required integration offers no way past it without connecting.
  expect(screen.queryByText(/Jatka ilman/)).toBeNull();
  fireEvent.click(screen.getByTestId("onboarding-preview-next"));
  // The person's own option list: the site's suggestion alone, open.
  const shown = () =>
    within(screen.getByTestId("onboarding-preview-card"))
      .getAllByRole("listitem")
      .filter((li) => !li.closest("[hidden]"))
      .map((li) => li.dataset.testid);
  expect(shown()).toEqual(["ai-option-claude"]);
  fireEvent.click(screen.getByTestId("ai-others-toggle"));
  expect(shown()).toHaveLength(5);
  fireEvent.click(screen.getByTestId("ai-option-chatgpt-choose"));
  expect(
    screen
      .getByTestId("ai-option-chatgpt-choose")
      .getAttribute("aria-expanded"),
  ).toBe("true");
  // A change in the docked settings restarts the preview at once.
  fireEvent.click(
    within(
      within(preview).getByTestId("onboarding-repository-mode"),
    ).getByTestId("segment-skip"),
  );
  expect(screen.getByTestId("onboarding-preview-screen").dataset.at).toBe(
    "google",
  );
  // The site fetches without a chooser: Repot stays on the route, passed.
  expect(
    within(preview).getByTestId("onboarding-step-repositories").dataset.state,
  ).toBe("done");
  fireEvent.click(screen.getByTestId("onboarding-preview-close"));
  expect(screen.queryByTestId("onboarding-preview")).toBeNull();
});

it("derives the preview route from the configuration", () => {
  const steps = (
    d: OnboardingDocument,
    a: ProviderAvailability = { google: true },
  ) =>
    previewSteps(d, a).map((s) => (s.id === "integration" ? s.provider : s.id));
  expect(steps(base)).toEqual(["repositories", "google", "ai", "done"]);
  expect(
    steps({ ...base, repositories: { mode: "skip", defaults: [] } }),
  ).toEqual(["google", "ai", "done"]);
  // Hidden while not ready, and while readiness is unknown.
  for (const a of [{ google: false }, {}])
    expect(steps(base, a)).toEqual(["repositories", "ai", "done"]);
});
