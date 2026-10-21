import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClaudeSignIn } from "./ClaudeSignIn";

afterEach(() => vi.restoreAllMocks());
const attempt = "20261016T120000.000000001";
const reply = (state: string) =>
  new Response(
    JSON.stringify({
      schema_version: 1,
      state,
      attempt_id: attempt,
      ...(state === "code"
        ? {
            verification_uri:
              "https://claude.com/cai/oauth/authorize?code=true&state=synthetic",
          }
        : {}),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
it("notifies only its own completed attempt once across callback identity changes", async () => {
  let state = "missing";
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    if (init?.method === "POST") state = "code";
    if (init?.method === "PUT") state = "completed";
    return reply(state);
  });
  const first = vi.fn(),
    second = vi.fn();
  const view = render(<ClaudeSignIn csrf="csrf" onSignedIn={first} />);
  const start = await screen.findByRole("button");
  await waitFor(() => expect(start).not.toHaveProperty("disabled", true));
  fireEvent.click(start);
  fireEvent.change(await screen.findByTestId("claude-code-input"), {
    target: { value: "synthetic-code#state" },
  });
  fireEvent.click(screen.getByTestId("claude-code-confirm"));
  await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
  view.rerender(<ClaudeSignIn csrf="csrf" onSignedIn={second} />);
  expect(second).not.toHaveBeenCalled();
  expect(screen.queryByTestId("claude-code-input")).toBeNull();
});
it("does not escape forced onboarding because an existing native login is present", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    reply("completed"),
  );
  const onSignedIn = vi.fn();
  render(<ClaudeSignIn csrf="csrf" onSignedIn={onSignedIn} />);
  await waitFor(() =>
    expect(screen.getByRole("button")).not.toHaveProperty("disabled", true),
  );
  expect(onSignedIn).not.toHaveBeenCalled();
});
