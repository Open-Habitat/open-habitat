import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AccountProfileOnboarding } from "./AccountProfileOnboarding";

afterEach(() => vi.unstubAllGlobals());
it("asks for missing GitHub fields and submits only presentation fields with session CSRF", async () => {
  const saved = vi.fn();
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      name: "Alice",
      email: "alice@example.invalid",
      avatar_url: "",
    }),
  });
  vi.stubGlobal("fetch", fetch);
  render(
    <AccountProfileOnboarding
      profile={{ name: "", email: "", avatar_url: "" }}
      csrf="synthetic-csrf"
      onSaved={saved}
      onLogin={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Nimi"), {
    target: { value: "Alice" },
  });
  fireEvent.change(screen.getByLabelText("Sähköposti"), {
    target: { value: "alice@example.invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Jatka" }));
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
