import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  currentLanguage,
  resetLanguageForTests,
  setServerLanguage,
} from "../i18n";
import {
  AccountPreferencesProvider,
  chooseEditor,
  chooseLanguage,
  chooseWorkspaceSound,
  loadAccountPreferences,
  moveWorkspaceSound,
  setExperimentalFeature,
  useEditorChoice,
  useExperimentalFeature,
} from "./accountPreferences";

const reply = (
  identity: string,
  engine = "vscode",
  experimental: Record<string, true> = {},
  language = "system",
) =>
  new Response(
    JSON.stringify({
      schema_version: 1,
      web_identity_id: identity,
      engine,
      language,
      quiet_sort: "newest",
      quiet_workspace: null,
      yours_workspace: null,
      running_workspace: null,
      github_workflow: false,
      sound: {
        enabled: true,
        default: "kalimba",
        length: "short",
        in_view: "quiet",
        night: true,
        workspaces: {},
      },
      experimental,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
function Probe({ identity, csrf }: { identity: string; csrf: string }) {
  const value = useEditorChoice(identity, csrf);
  return createElement(
    "output",
    {
      "data-testid": "choice",
      "data-busy": value.busy,
      "data-error": value.error,
    },
    value.engine,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("loads from the daemon without browser storage and writes only confirmed choices with CSRF", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(reply("wid_device", "codemirror6"))
    .mockResolvedValueOnce(reply("wid_device"));
  vi.stubGlobal("fetch", fetch);
  const storage = vi.spyOn(Storage.prototype, "setItem");
  render(createElement(Probe, { identity: "wid_device", csrf: "session-a" }));
  await waitFor(() =>
    expect(screen.getByTestId("choice").getAttribute("data-busy")).toBe(
      "false",
    ),
  );
  await act(() => chooseEditor("wid_device", "vscode", "session-a"));
  expect(screen.getByTestId("choice").textContent).toBe("vscode");
  expect(fetch.mock.calls[1][1]).toMatchObject({
    method: "PUT",
    headers: { "X-Agent-Host-CSRF": "session-a" },
    body: JSON.stringify({ engine: "vscode" }),
  });
  expect(storage).not.toHaveBeenCalled();
});
it("ignores another person's reply and old-session responses, even on the same identity", async () => {
  let release!: (response: Response) => void;
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValueOnce(reply("wid_new", "codemirror6"));
  vi.stubGlobal("fetch", fetch);
  const { rerender } = render(
    createElement(Probe, { identity: "wid_old", csrf: "old" }),
  );
  rerender(createElement(Probe, { identity: "wid_new", csrf: "new" }));
  await waitFor(() =>
    expect(screen.getByTestId("choice").getAttribute("data-busy")).toBe(
      "false",
    ),
  );
  await act(async () => release(reply("wid_old")));
  expect(screen.getByTestId("choice").textContent).toBe("codemirror6");
  fetch.mockResolvedValueOnce(reply("wid_other"));
  await act(() => loadAccountPreferences("wid_new", "new"));
  expect(screen.getByTestId("choice").getAttribute("data-error")).toBe("true");
  expect(screen.getByTestId("choice").textContent).toBe("codemirror6");
});
it("does not retry a lost write or apply a stale read over its confirmed result", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(reply("wid_race", "codemirror6"));
  vi.stubGlobal("fetch", fetch);
  render(createElement(Probe, { identity: "wid_race", csrf: "race" }));
  await waitFor(() =>
    expect(screen.getByTestId("choice").getAttribute("data-busy")).toBe(
      "false",
    ),
  );
  let release!: (response: Response) => void;
  fetch
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValueOnce(reply("wid_race"));
  const read = loadAccountPreferences("wid_race", "race");
  await act(() => chooseEditor("wid_race", "vscode", "race"));
  await act(async () => {
    release(reply("wid_race", "codemirror6"));
    await read;
  });
  expect(screen.getByTestId("choice").textContent).toBe("vscode");
  fetch.mockRejectedValueOnce(new Error("lost reply"));
  await act(() => chooseEditor("wid_race", "codemirror6", "race"));
  expect(screen.getByTestId("choice").textContent).toBe("vscode");
  expect(screen.getByTestId("choice").getAttribute("data-error")).toBe("true");
  expect(fetch).toHaveBeenCalledTimes(4);
});
function Feature() {
  return createElement(
    "output",
    { "data-testid": "feature" },
    String(useExperimentalFeature("rewind-conversation")),
  );
}
const feature = (identity: string, csrf: string) =>
  createElement(
    AccountPreferencesProvider,
    { identity, csrf },
    createElement(Feature),
  );
it("switches an experimental feature only on the daemon's confirmation, one change per write", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(reply("wid_feature", "codemirror6"))
    .mockResolvedValueOnce(
      reply("wid_feature", "codemirror6", { "rewind-conversation": true }),
    );
  vi.stubGlobal("fetch", fetch);
  render(feature("wid_feature", "f"));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId("feature").textContent).toBe("false");
  await act(() =>
    setExperimentalFeature("wid_feature", "rewind-conversation", true, "f"),
  );
  expect(screen.getByTestId("feature").textContent).toBe("true");
  expect(fetch.mock.calls[1][1]).toMatchObject({
    method: "PUT",
    headers: { "X-Agent-Host-CSRF": "f" },
    body: JSON.stringify({ experimental: { "rewind-conversation": true } }),
  });
  fetch.mockRejectedValueOnce(new Error("lost reply"));
  await act(() =>
    setExperimentalFeature("wid_feature", "rewind-conversation", false, "f"),
  );
  expect(screen.getByTestId("feature").textContent).toBe("true");
});
it("keeps a feature off without a session, and ignores ids the browser does not know", async () => {
  const fetch = vi.fn().mockResolvedValue(
    reply("wid_unknown", "vscode", {
      "composer-lists-in-field": true,
      "markdown-block-preview": true,
      "worker-row-sentence": true,
      "raise-to-your-turn": true,
    }),
  );
  vi.stubGlobal("fetch", fetch);
  render(createElement(Feature));
  expect(screen.getByTestId("feature").textContent).toBe("false");
  cleanup();
  render(feature("wid_unknown", "u"));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId("feature").textContent).toBe("false");
});

it("observes native changes while visible, pauses hidden reads, and disposes the poll on logout", async () => {
  vi.useFakeTimers();
  let enabled = false;
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const fetch = vi.fn(() =>
    Promise.resolve(
      reply(
        "wid_poll",
        "codemirror6",
        enabled ? { "rewind-conversation": true } : {},
      ),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  const { rerender } = render(feature("wid_poll", "poll"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  enabled = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(screen.getByTestId("feature").textContent).toBe("true");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const before = fetch.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(fetch).toHaveBeenCalledTimes(before);
  enabled = false;
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(screen.getByTestId("feature").textContent).toBe("false");
  rerender(
    createElement(AccountPreferencesProvider, {}, createElement(Feature)),
  );
  const loggedOut = fetch.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(fetch).toHaveBeenCalledTimes(loggedOut);
});

it("does not let background polls dismiss a failed write, but explicit reload reconciles it", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const fetch = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(reply("wid_poll_error", "codemirror6")),
    );
  vi.stubGlobal("fetch", fetch);
  render(
    createElement(
      AccountPreferencesProvider,
      { identity: "wid_poll_error", csrf: "poll-error" },
      createElement(Probe, { identity: "wid_poll_error", csrf: "poll-error" }),
    ),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  fetch.mockRejectedValueOnce(new Error("lost write"));
  await act(() => chooseEditor("wid_poll_error", "vscode", "poll-error"));
  expect(screen.getByTestId("choice").getAttribute("data-error")).toBe("true");
  const failed = fetch.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(fetch).toHaveBeenCalledTimes(failed);
  expect(screen.getByTestId("choice").getAttribute("data-error")).toBe("true");
  await act(() => loadAccountPreferences("wid_poll_error", "poll-error"));
  expect(screen.getByTestId("choice").getAttribute("data-error")).toBe("false");
});

it("puts the interface in the person's confirmed language and back to the server default on System", async () => {
  resetLanguageForTests("fi");
  setServerLanguage("fi");
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(reply("wid_language", "codemirror6", {}, "en"))
    .mockResolvedValueOnce(reply("wid_language", "codemirror6", {}, "system"));
  vi.stubGlobal("fetch", fetch);
  render(
    createElement(AccountPreferencesProvider, {
      identity: "wid_language",
      csrf: "language",
    }),
  );
  await waitFor(() => expect(currentLanguage()).toBe("en"));
  expect(document.documentElement.lang).toBe("en");
  await act(() => chooseLanguage("wid_language", "system", "language"));
  expect(fetch.mock.calls[1][1]).toMatchObject({
    method: "PUT",
    body: JSON.stringify({ language: "system" }),
  });
  expect(currentLanguage()).toBe("fi");
  expect(document.documentElement.lang).toBe("fi");
  resetLanguageForTests("fi");
});

const soundReply = (identity: string, workspaces: Record<string, string>) =>
  new Response(
    JSON.stringify({
      schema_version: 1,
      web_identity_id: identity,
      engine: "codemirror6",
      language: "system",
      quiet_sort: "newest",
      quiet_workspace: null,
      yours_workspace: null,
      running_workspace: null,
      github_workflow: false,
      sound: {
        enabled: true,
        default: "kalimba",
        length: "short",
        in_view: "quiet",
        night: true,
        workspaces,
      },
      experimental: {},
    }),
    { headers: { "Content-Type": "application/json" } },
  );
const bodies = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(init.body));

it("a workspace sound chosen while another write is in flight waits for it, and a move frees the old id first", async () => {
  let release!: (response: Response) => void;
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(soundReply("wid_sound", { ws_example123: "lasit" }))
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValueOnce(soundReply("wid_sound", { ws_example123: "kulho" }));
  vi.stubGlobal("fetch", fetch);
  await loadAccountPreferences("wid_sound", "s");
  const first = chooseWorkspaceSound(
    "wid_sound",
    "ws_example123",
    "pisara",
    "s",
  );
  const second = chooseWorkspaceSound(
    "wid_sound",
    "ws_example123",
    "kulho",
    "s",
  );
  await waitFor(() => expect(bodies(fetch)).toHaveLength(1));
  release(soundReply("wid_sound", { ws_example123: "pisara" }));
  expect(await first).toBe(true);
  expect(await second).toBe(true);
  expect(bodies(fetch)).toEqual([
    { workspace_sound: { ws_example123: "pisara" } },
    { workspace_sound: { ws_example123: "kulho" } },
  ]);

  // At the bound the new id has no room until the old one is gone.
  fetch
    .mockResolvedValueOnce(soundReply("wid_sound", {}))
    .mockResolvedValueOnce(soundReply("wid_sound", { ws_example456: "kulho" }));
  await moveWorkspaceSound("wid_sound", "ws_example123", "ws_example456", "s");
  expect(bodies(fetch).slice(2)).toEqual([
    { workspace_sound: { ws_example123: null } },
    { workspace_sound: { ws_example456: "kulho" } },
  ]);
});
