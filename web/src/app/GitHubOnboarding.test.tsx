import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { finishFirstRoute } from "./firstRoute";
import { GitHubOnboarding } from "./GitHubOnboarding";
import type { IntegrationList, ProviderId } from "./integrations";
import { readIntegrations } from "./integrations";
import type { OnboardingIntegration } from "./onboardingConfig";
import { readSiteOnboarding } from "./onboardingConfig";
import { piStatus } from "./pi";

// The route's integration steps against the person's two reads: the site's
// configuration and their own catalog. The native steps around them (Git
// identity, the AI sign-in, the Settings view) are stand-ins here; the
// browser spec walks the real ones.

vi.mock("./pi", () => ({
  sessionCSRF: vi.fn(async () => "c".repeat(43)),
  piStatus: vi.fn(async () => "usable"),
}));
vi.mock("./firstRoute", () => ({ finishFirstRoute: vi.fn(async () => {}) }));
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
  { seeded = false, onUsable = () => {} } = {},
) {
  vi.mocked(readSiteOnboarding).mockResolvedValue({
    schema_version: 1,
    repositories: { mode: "preselected" },
    integrations,
    ai_account: { offer: "all" },
    ...(seeded ? { ai_key_seeded: true as const } : {}),
  });
  vi.mocked(readIntegrations).mockResolvedValue(catalogOf(ready));
  render(
    <GitHubOnboarding
      onUsable={onUsable}
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

it("a person seeded with the site key ends the route after its last step, in their own state", async () => {
  const onUsable = vi.fn();
  start([{ provider: "google", required: false }], undefined, {
    seeded: true,
    onUsable,
  });
  await passRepositories();
  await screen.findByTestId("integration-onboarding");
  expect(route()).toEqual([
    "github:done",
    "repositories:skipped",
    "google:current",
  ]);
  fireEvent.click(screen.getByTestId("integration-onboarding-continue"));
  await waitFor(() => expect(onUsable).toHaveBeenCalledOnce());
  // The mark was asked for before the route ended.
  expect(finishFirstRoute).toHaveBeenCalledWith("c".repeat(43));
  expect(screen.queryByTestId("pi-stub")).toBeNull();
});

it("a lost first-route mark still ends the route", async () => {
  vi.mocked(finishFirstRoute).mockRejectedValueOnce(new Error("lost"));
  const onUsable = vi.fn();
  start([], undefined, { seeded: true, onUsable });
  await passRepositories();
  await waitFor(() => expect(onUsable).toHaveBeenCalledOnce());
});

it("a seeded Pi that is no longer usable brings the AI step back", async () => {
  vi.mocked(piStatus).mockResolvedValueOnce("missing");
  const onUsable = vi.fn();
  start([], undefined, { seeded: true, onUsable });
  await passRepositories();
  await screen.findByTestId("pi-stub");
  expect(route()).toEqual([
    "github:done",
    "repositories:skipped",
    "ai:current",
  ]);
  expect(onUsable).not.toHaveBeenCalled();
  expect(finishFirstRoute).not.toHaveBeenCalled();
});

it("a mark still being written when the session ends does not end the next person's route", async () => {
  let settle = () => {};
  vi.mocked(finishFirstRoute).mockImplementationOnce(
    () => new Promise<void>((done) => (settle = done)),
  );
  const onUsable = vi.fn();
  start([], undefined, { seeded: true, onUsable });
  await passRepositories();
  await waitFor(() => expect(finishFirstRoute).toHaveBeenCalled());
  cleanup();
  settle();
  await new Promise((r) => setTimeout(r, 0));
  expect(onUsable).not.toHaveBeenCalled();
});
