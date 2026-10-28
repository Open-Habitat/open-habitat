import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { NativeState } from "./CodeHostSettings";
import {
  concerns,
  githubFault,
  githubOrgFault,
  githubProgress,
  lookupView,
  markReconnect,
  takeReturnRoute,
  useGitHubRecovery,
} from "./githubConnection";

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

const recovery = (initial?: NativeState, login?: string) =>
  renderHook(
    ({
      identity,
      state,
      login,
    }: {
      identity?: string;
      state?: NativeState;
      login?: string;
    }) => useGitHubRecovery(identity, state, login, 1000),
    {
      initialProps: { identity: "wid_alice", state: initial, login } as {
        identity?: string;
        state?: NativeState;
        login?: string;
      },
    },
  );

it("warns only for a fault the person repairs; an unclassified state is not one", () => {
  expect(githubFault("expired")?.fault).toBe("expired");
  expect(githubFault("disconnected")?.fault).toBe("disconnected");
  for (const state of ["unknown", "pending", "partial", "connected"] as const)
    expect(githubFault(state)).toBeUndefined();
});

const retry = (attempt: number) => ({
  attempt,
  attempts: 4,
  since: "2026-10-28T10:00:00Z",
  next_at: "2026-10-28T10:01:00Z",
});

it("shows the host's own retry of an outage as progress, and a warning only once it is over", () => {
  for (const attempt of [1, 3]) {
    expect(githubProgress("unreachable", retry(attempt))).toEqual({
      kind: "retrying",
      attempt,
      attempts: 4,
    });
    expect(githubFault("unreachable", retry(attempt))).toBeUndefined();
  }
  for (const attempt of [4, 9]) {
    expect(githubProgress("unreachable", retry(attempt))).toBeUndefined();
    const warning = githubFault("unreachable", retry(attempt));
    // Nothing for the person to press: the host repairs it by itself.
    expect(warning?.fault).toBe("unreachable");
    expect(warning?.fix).toBeUndefined();
  }
  // Without the retry's facts an outage is not claimed.
  expect(githubFault("unreachable")).toBeUndefined();
  expect(githubProgress("unreachable")).toBeUndefined();
  // A first rejection is being verified, not yet a fault.
  expect(githubProgress("verifying")).toEqual({ kind: "verifying" });
  expect(githubFault("verifying")).toBeUndefined();
  // An outage concerns a Google user too: it has a gh login that waits.
  expect(
    concerns(githubFault("unreachable", retry(4)), { provider: "google" }),
  ).toBe(true);
});

it("names an organisation's restriction only for its own repositories, case aside", () => {
  const restricted = [
    { owner: "Example-Org", restriction: "oauth_app" as const },
    { owner: "sso-org", restriction: "saml" as const },
  ];
  const oauth = githubOrgFault(restricted, "example-org/app");
  expect(oauth?.fault).toBe("org_oauth_app");
  // An owner's approval is asked on GitHub, not by reconnecting.
  expect(oauth?.href).toMatch(/^https:\/\/github\.com\//);
  const saml = githubOrgFault(restricted, "sso-org/app");
  expect(saml?.fault).toBe("org_saml");
  expect(saml?.href).toBeUndefined();
  expect(saml?.fix).toBeDefined();
  expect(githubOrgFault(restricted, "other-org/app")).toBeUndefined();
  expect(githubOrgFault(restricted, undefined)).toBeUndefined();
  expect(githubOrgFault(undefined, "example-org/app")).toBeUndefined();
});

it("turns a restricted lookup into a refusal that says why, and a refusal into not found", () => {
  const restricted = lookupView("example-org/app", {
    schema_version: 1,
    full_name: "example-org/app",
    state: "restricted",
    restriction: "saml",
  });
  expect(restricted.state).toBe("restricted");
  expect(
    lookupView("example-org/app", {
      schema_version: 1,
      full_name: "example-org/app",
      state: "not_found",
    }),
  ).toEqual({ state: "not_found", name: "example-org/app" });
});

it("tells a Google user about a missing GitHub only where GitHub is used", () => {
  const disconnected = githubFault("disconnected");
  expect(concerns(disconnected, { provider: "github" })).toBe(true);
  expect(concerns(disconnected, { provider: "google" })).toBe(false);
  expect(
    concerns(disconnected, { provider: "google", githubWorkspace: true }),
  ).toBe(true);
  // A rejected token is a gh login that every push still tries.
  expect(concerns(githubFault("expired"), { provider: "google" })).toBe(true);
});

it("confirms a fault that cleared in this tab, across an unknown moment, then lets it go", () => {
  vi.useFakeTimers();
  const hook = recovery("expired");
  hook.rerender({ identity: "wid_alice", state: "unknown" });
  expect(hook.result.current).toBeUndefined();
  hook.rerender({ identity: "wid_alice", state: "connected" });
  expect(hook.result.current).toEqual({ kind: "recovered" });
  act(() => vi.advanceTimersByTime(1001));
  expect(hook.result.current).toBeUndefined();
});

it("confirms an outage that ended, but not the end of a verification", () => {
  vi.useFakeTimers();
  const hook = recovery("unreachable");
  hook.rerender({ identity: "wid_alice", state: "connected" });
  expect(hook.result.current).toEqual({ kind: "recovered" });
  const verified = recovery("connected");
  verified.rerender({ identity: "wid_alice", state: "verifying" });
  verified.rerender({ identity: "wid_alice", state: "connected" });
  expect(verified.result.current).toBeUndefined();
});

it("says nothing for a connection that simply works", () => {
  const hook = recovery("unknown");
  hook.rerender({ identity: "wid_alice", state: "connected" });
  expect(hook.result.current).toBeUndefined();
});

it("confirms the reconnect round trip once, with the login", () => {
  markReconnect("/workspaces/ws_abcdefgh?conversation=pi:1", "/");
  const hook = recovery(undefined);
  hook.rerender({ identity: "wid_alice", state: "connected", login: "octo" });
  expect(hook.result.current).toEqual({ kind: "reconnected", login: "octo" });
  const again = recovery("connected", "octo");
  expect(again.result.current).toBeUndefined();
});

it("keeps the warning when the round trip did not repair it", () => {
  markReconnect("/", "/");
  const hook = recovery("expired");
  hook.rerender({ identity: "wid_alice", state: "connected" });
  // The mark was spent on the still-broken return, so this is an in-tab
  // recovery, not the reconnect.
  expect(hook.result.current).toEqual({ kind: "recovered" });
});

it("never shows one person's confirmation to the next one on the tab", () => {
  markReconnect("/", "/");
  const hook = recovery(undefined);
  hook.rerender({ identity: "wid_alice", state: "connected", login: "alice" });
  expect(hook.result.current).toEqual({ kind: "reconnected", login: "alice" });
  hook.rerender({ identity: "wid_bob", state: "connected", login: "bob" });
  expect(hook.result.current).toBeUndefined();
});

it("restores the route once, onto the path the gateway returned to", () => {
  const conversation = "/workspaces/ws_abcdefgh?conversation=pi:1";
  markReconnect(conversation, "/workspaces/ws_abcdefgh");
  expect(takeReturnRoute("/workspaces", "")).toBeUndefined();
  expect(takeReturnRoute("/workspaces/ws_abcdefgh", "")).toBe(conversation);
  // The person then goes to the workspace itself: it stays there.
  expect(takeReturnRoute("/workspaces/ws_abcdefgh", "")).toBeUndefined();
});

it("brings a page that is not a return path back, such as Uusi työtila", () => {
  markReconnect("/workspaces/new", "/workspaces");
  expect(takeReturnRoute("/workspaces", "")).toBe("/workspaces/new");
});

it("restores nothing after the browser went back from GitHub, or after a stale trip", () => {
  const conversation = "/workspaces/ws_abcdefgh?conversation=pi:1";
  markReconnect(conversation, "/workspaces/ws_abcdefgh");
  expect(
    takeReturnRoute("/workspaces/ws_abcdefgh", "?conversation=pi:1"),
  ).toBeUndefined();
  expect(takeReturnRoute("/workspaces/ws_abcdefgh", "")).toBeUndefined();
  vi.useFakeTimers();
  markReconnect(conversation, "/workspaces/ws_abcdefgh");
  vi.advanceTimersByTime(11 * 60_000);
  expect(takeReturnRoute("/workspaces/ws_abcdefgh", "")).toBeUndefined();
});
