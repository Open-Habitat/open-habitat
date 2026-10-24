import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GitHubOnboarding } from "./GitHubOnboarding";
import type { IntegrationList, ProviderId } from "./integrations";
import { readIntegrations } from "./integrations";
import type { OnboardingIntegration } from "./onboardingConfig";
import { readSiteOnboarding } from "./onboardingConfig";

// The route's integration steps against the person's two reads: the site's
// configuration and their own catalog. The native steps around them (Git
// identity, the AI sign-in, the Settings view) are stand-ins here; the
// browser spec walks the real ones.

vi.mock("./pi", () => ({
  sessionCSRF: vi.fn(async () => "c".repeat(43)),
}));
vi.mock("./github", async (actual) => ({
  ...(await actual<typeof import("./github")>()),
  catalog: vi.fn(async () => ({
    repositories: [],
    complete: true,
    login: "person",
  })),
  observe: vi.fn(),
}));
vi.mock("./onboardingConfig", async (actual) => ({
  ...(await actual<typeof import("./onboardingConfig")>()),
  readSiteOnboarding: vi.fn(),
}));
vi.mock("./integrations", async (actual) => ({
  ...(await actual<typeof import("./integrations")>()),
  readIntegrations: vi.fn(),
}));
vi.mock("./GitIdentity", () => ({
  GitIdentity: ({ onContinue }: { onContinue: () => void }) => (
    <button type="button" data-testid="identity-stub" onClick={onContinue}>
      ok
    </button>
  ),
}));
vi.mock("./PiOnboarding", async () => {
  const { OnboardingFrame } = await import("../components/OnboardingFrame");
  return {
    PiOnboarding: () => (
      <OnboardingFrame step="ai">
        <h1 id="pi-sign-in-title" data-testid="pi-stub" tabIndex={-1}>
          AI
        </h1>
      </OnboardingFrame>
    ),
  };
});
// The Settings view limited to the step's provider; "connect" stands for a
// finished sign-in, which hands the new list up.
vi.mock("./IntegrationsSettings", () => ({
  IntegrationsSettings: ({
    only,
    initial,
    onList,
  }: {
    only: ProviderId[];
    initial: IntegrationList;
    onList: (l: IntegrationList) => void;
  }) => (
    <button
      type="button"
      data-testid={`connect-${only.join()}`}
      onClick={() =>
        onList({
          ...initial,
          accounts: [
            {
              provider: only[0],
              address: "person@example.test",
              services: [],
              checked_at: "2026-10-24T08:00:00Z",
            },
          ],
        })
      }
    >
      connect
    </button>
  ),
}));

const catalogOf = (ready: Partial<Record<ProviderId, boolean>>) =>
  ({
    schema_version: 1,
    providers: (Object.keys(ready) as ProviderId[]).map((id) => ({
      id,
      available: ready[id] as boolean,
      login: "pasted_redirect",
      services: ["mail"],
    })),
    accounts: [],
    skill: "none",
  }) as IntegrationList;

function start(
  integrations: OnboardingIntegration[],
  ready: Partial<Record<ProviderId, boolean>> = {
    google: true,
    microsoft: true,
    dropbox: false,
  },
) {
  vi.mocked(readSiteOnboarding).mockResolvedValue({
    schema_version: 1,
    repositories: { mode: "preselected" },
    integrations,
    ai_account: { offer: "all" },
  });
  vi.mocked(readIntegrations).mockResolvedValue(catalogOf(ready));
  render(
    <GitHubOnboarding
      onUsable={() => {}}
      onLogin={() => {}}
      onLogout={async () => {}}
      onSessionChanged={() => {}}
    />,
  );
}
const route = () =>
  screen
    .getAllByTestId(/^onboarding-step-/)
    .map((li) => `${li.dataset.testid?.slice(16)}:${li.dataset.state}`);
/** Through the Git identity and the chooser, without repositories. */
async function passRepositories() {
  fireEvent.click(await screen.findByTestId("identity-stub"));
  fireEvent.click(await screen.findByTestId("repository-proceed"));
}

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("without configured integrations goes from the repositories to the AI account", async () => {
  start([]);
  await passRepositories();
  // The AI step's heading takes focus straight from the chooser.
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByTestId("pi-stub")),
  );
  expect(screen.queryByTestId("integration-onboarding")).toBeNull();
});

it("an optional integration is its own step that can be passed without connecting", async () => {
  start([{ provider: "google", required: false }]);
  await passRepositories();
  const step = await screen.findByTestId("integration-onboarding");
  expect(step.dataset.provider).toBe("google");
  expect(route()).toEqual([
    "github:done",
    "repositories:skipped",
    "google:current",
    "ai:next",
  ]);
  fireEvent.click(screen.getByTestId("integration-onboarding-continue"));
  await screen.findByTestId("pi-stub");
});

it("a required integration has no skip action; once connected the person goes on", async () => {
  start([
    { provider: "google", required: true },
    { provider: "microsoft", required: false },
  ]);
  await passRepositories();
  await screen.findByTestId("integration-onboarding");
  expect(screen.getByTestId("onboarding-step-google").dataset.required).toBe(
    "true",
  );
  expect(screen.queryByTestId("integration-onboarding-continue")).toBeNull();
  fireEvent.click(screen.getByTestId("connect-google"));
  fireEvent.click(await screen.findByTestId("integration-onboarding-continue"));
  // The next configured step, in the catalog's order, and back again.
  await waitFor(() =>
    expect(screen.getByTestId("integration-onboarding").dataset.provider).toBe(
      "microsoft",
    ),
  );
  expect(route()).toEqual([
    "github:done",
    "repositories:skipped",
    "google:done",
    "microsoft:current",
    "ai:next",
  ]);
  fireEvent.click(screen.getByTestId("integration-onboarding-back"));
  await waitFor(() =>
    expect(screen.getByTestId("integration-onboarding").dataset.provider).toBe(
      "google",
    ),
  );
});

it("an integration that is not ready, or whose readiness is unknown, is left off the route", async () => {
  start(
    [
      { provider: "dropbox", required: true },
      { provider: "imap", required: true },
    ],
    { dropbox: false },
  );
  await passRepositories();
  await screen.findByTestId("pi-stub");
  expect(screen.queryByTestId("integration-onboarding")).toBeNull();
  expect(route()).toEqual([
    "github:done",
    "repositories:skipped",
    "ai:current",
  ]);
});
