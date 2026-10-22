import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  chooseEditor,
  loadEditorPreference,
  useEditorChoice,
} from "./editorPreference";

const reply = (identity: string, engine = "vscode") =>
  new Response(
    JSON.stringify({ schema_version: 1, web_identity_id: identity, engine }),
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
  await act(() => loadEditorPreference("wid_new", "new"));
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
  const read = loadEditorPreference("wid_race", "race");
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
