import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  markDisconnectReturn,
  takeDisconnectReturn,
} from "../app/githubDisconnectReturn";
import { NativeDisconnect } from "./NativeDisconnect";

const observed = {
  state: "connected",
  scope: "user",
  observation_token: "synthetic-observation",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const denied = () =>
  reply({ error: { code: "reauthentication_required" } }, 403);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  history.replaceState(null, "", "/");
});
function mount() {
  return render(
    <NativeDisconnect identity="wid_alice" csrf="synthetic-csrf" />,
  );
}
it("opens the dialog for a stale sign-in, but not for an unrelated forbidden response", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(denied())
    .mockResolvedValueOnce(
      reply({ error: { code: "cross_user_denied" } }, 403),
    );
  vi.stubGlobal("fetch", fetch);
  mount();
  fireEvent.click(screen.getByTestId("github-disconnect-inspect"));
  expect(await screen.findByTestId("github-disconnect-reauth")).toBeTruthy();
  expect(screen.queryByTestId("github-disconnect-confirm")).toBeNull();
  fireEvent.click(screen.getByTestId("cancel"));
  fireEvent.click(screen.getByTestId("github-disconnect-inspect"));
  await waitFor(() =>
    expect(
      screen.getByTestId("github-disconnect-retry").hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.queryByTestId("github-disconnect-reauth")).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("requires an explicit press and sends the observed token and CSRF; expiry returns to confirmation", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(reply(observed))
    .mockResolvedValueOnce(denied());
  vi.stubGlobal("fetch", fetch);
  mount();
  fireEvent.click(screen.getByTestId("github-disconnect-inspect"));
  const confirm = await screen.findByTestId("github-disconnect-confirm");
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(confirm);
  expect(await screen.findByTestId("github-disconnect-reauth")).toBeTruthy();
  const init = fetch.mock.calls[1][1];
  expect(JSON.parse(init.body)).toEqual({
    scope: "user",
    confirmation: "disconnect",
    observation_token: "synthetic-observation",
  });
  expect(new Headers(init.headers).get("X-Agent-Host-CSRF")).toBe(
    "synthetic-csrf",
  );
});
it("reopens once after sign-in under StrictMode and never posts automatically", async () => {
  history.replaceState(null, "", "/settings/code-hosts");
  markDisconnectReturn("wid_alice");
  const fetch = vi.fn(async () => reply(observed));
  vi.stubGlobal("fetch", fetch);
  const view = render(
    <StrictMode>
      <NativeDisconnect identity="wid_alice" csrf="new-csrf" />
    </StrictMode>,
  );
  expect(await screen.findByTestId("github-disconnect-confirm")).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    fetch.mock.calls.every(
      (call) =>
        !(call as unknown[])[1] ||
        ((call as unknown[])[1] as RequestInit).method !== "POST",
    ),
  ).toBe(true);
  fireEvent.click(screen.getByTestId("cancel"));
  view.unmount();
  mount();
  expect(screen.queryByTestId("github-disconnect-dialog")).toBeNull();
});
it("does not reuse an observation after a lost write reply", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(reply(observed))
    .mockRejectedValueOnce(new Error("lost"));
  vi.stubGlobal("fetch", fetch);
  mount();
  fireEvent.click(screen.getByTestId("github-disconnect-inspect"));
  fireEvent.click(await screen.findByTestId("github-disconnect-confirm"));
  await waitFor(() =>
    expect(
      screen.getByTestId("github-disconnect-retry").hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.queryByTestId("github-disconnect-confirm")).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("allows cancellation of a pending read and clears an abandoned OAuth intent", async () => {
  history.replaceState(null, "", "/settings/code-hosts");
  let resolve!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    ),
  );
  const view = mount();
  fireEvent.click(screen.getByTestId("github-disconnect-inspect"));
  // The OAuth navigation could fail or restore this document from history.
  markDisconnectReturn("wid_alice");
  const cancel = screen.getByTestId("cancel");
  expect(cancel.hasAttribute("disabled")).toBe(false);
  fireEvent.click(cancel);
  resolve(reply(observed));
  await waitFor(() =>
    expect(screen.queryByTestId("github-disconnect-dialog")).toBeNull(),
  );
  expect(takeDisconnectReturn("wid_alice")).toBe(false);
  view.unmount();
  mount();
  expect(screen.queryByTestId("github-disconnect-dialog")).toBeNull();
});
it("consumes return marks only for the same identity, route and recent attempt", () => {
  history.replaceState(null, "", "/settings/code-hosts");
  markDisconnectReturn("wid_alice");
  expect(takeDisconnectReturn("wid_bob")).toBe(false);
  expect(takeDisconnectReturn("wid_alice")).toBe(false);
  markDisconnectReturn("wid_alice");
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now + 6 * 60_000);
  expect(takeDisconnectReturn("wid_alice")).toBe(false);
  clock.mockRestore();
  markDisconnectReturn("wid_alice");
  history.replaceState(null, "", "/settings/account");
  expect(takeDisconnectReturn("wid_alice")).toBe(false);
});
