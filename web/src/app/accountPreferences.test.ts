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
  loadAccountPreferences,
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
      github_workflow: false,
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
