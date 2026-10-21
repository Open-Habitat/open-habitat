import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AccountProfileOnboarding } from "./AccountProfileOnboarding";

afterEach(() => vi.unstubAllGlobals());
it("asks for missing GitHub fields and submits only presentation fields with session CSRF", async () => {
  const saved = vi.fn();
  const skip = vi.fn();
  const fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      name: "Alice",
      email: "alice@example.invalid",
      avatar_url: "",
    }),
  });
  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            JSON.stringify({
              schema_version: 1,
              provider: "github",
              web_identity_id: "wid_example-a",
              csrf: "a".repeat(43),
              profile: {
                name: "Alice",
                email: "alice@example.invalid",
                avatar_url: "",
              },
            }),
          ),
        );
        controller.close();
      },
    }),
  });
  vi.stubGlobal("fetch", fetch);
  render(
    <AccountProfileOnboarding
      profile={{ name: "", email: "", avatar_url: "" }}
      csrf="synthetic-csrf"
      onSaved={saved}
      onLogin={() => {}}
      onSkip={skip}
    />,
  );
  expect(screen.getByTestId("profile-skip")).toBeTruthy();
  fireEvent.change(screen.getByTestId("profile-name"), {
    target: { value: "Alice" },
  });
  fireEvent.change(screen.getByTestId("profile-email"), {
    target: { value: "alice@example.invalid" },
  });
  fireEvent.click(screen.getByTestId("profile-submit"));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledWith(
    "/auth/profile",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Alice", email: "alice@example.invalid" }),
      headers: expect.objectContaining({
        "X-Agent-Host-CSRF": "synthetic-csrf",
      }),
    }),
  );
});

it("lets a person continue when GitHub has no public email", () => {
  const skip = vi.fn();
  render(
    <AccountProfileOnboarding
      profile={{ name: "Alice", email: "", avatar_url: "" }}
      csrf="synthetic-csrf"
      onSaved={() => {}}
      onLogin={() => {}}
      onSkip={skip}
    />,
  );
  fireEvent.click(screen.getByTestId("profile-skip"));
  expect(skip).toHaveBeenCalledOnce();
});
