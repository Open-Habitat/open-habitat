import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GitIdentity } from "./GitIdentity";

afterEach(() => vi.unstubAllGlobals());

it("prefers the account email over GitHub noreply during onboarding, then displays native readback", async () => {
  const onContinue = vi.fn();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: 1,
        name: "",
        email: "",
        source: "~/.gitconfig",
        suggested_name: "Alice",
        suggested_email: "42+alice@users.noreply.github.com",
        emails: ["42+alice@users.noreply.github.com"],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: 1,
        name: "Alice",
        email: "42+alice@users.noreply.github.com",
        source: "~/.gitconfig",
        suggested_name: "",
        suggested_email: "",
        emails: [],
      }),
    });
  vi.stubGlobal("fetch", fetcher);
  render(
    <GitIdentity
      csrf="csrf"
      onboarding
      preferredEmail="typed@example.invalid"
      onContinue={onContinue}
    />,
  );
  await screen.findByRole("button", { name: "Vahvista Git-identiteetti" });
  expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
    "typed@example.invalid",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Vahvista Git-identiteetti" }),
  );
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
    name: "Alice",
    email: "typed@example.invalid",
    mode: "onboarding",
  });
});

it("shows existing identity read-only during onboarding", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: 1,
        name: "Existing",
        email: "existing@example.invalid",
        source: "~/.gitconfig",
        suggested_name: "Alice",
        suggested_email: "42+alice@users.noreply.github.com",
        emails: ["42+alice@users.noreply.github.com"],
      }),
    }),
  );
  render(<GitIdentity csrf="csrf" onboarding onContinue={vi.fn()} />);
  await screen.findByText(/Existing/);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByText(/~\/.gitconfig/)).toBeTruthy();
});

it("edits the global identity only after an explicit settings action", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: 1,
        name: "Existing",
        email: "old@example.invalid",
        source: "~/.gitconfig",
        suggested_name: "",
        suggested_email: "",
        emails: [],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: 1,
        name: "Changed",
        email: "new@example.invalid",
        source: "~/.gitconfig",
        suggested_name: "",
        suggested_email: "",
        emails: [],
      }),
    });
  vi.stubGlobal("fetch", fetcher);
  render(<GitIdentity csrf="csrf" />);
  await screen.findByRole("button", { name: "Muokkaa Git-identiteettiä" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByRole("button", { name: "Muokkaa Git-identiteettiä" }),
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Gitissä näkyvä nimi" }),
    { target: { value: "Changed" } },
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Gitissä näkyvä sähköposti" }),
    { target: { value: "new@example.invalid" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Tallenna Git-identiteetti" }),
  );
  await screen.findByText(/Changed/);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
    name: "Changed",
    email: "new@example.invalid",
    mode: "settings",
  });
});

it("offers retry if native GitHub suggestions are temporarily unavailable", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: 1,
        name: "",
        email: "",
        source: "~/.gitconfig",
        suggested_name: "",
        suggested_email: "",
        emails: [],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: 1,
        name: "",
        email: "",
        source: "~/.gitconfig",
        suggested_name: "Alice",
        suggested_email: "42+alice@users.noreply.github.com",
        emails: ["42+alice@users.noreply.github.com"],
      }),
    });
  vi.stubGlobal("fetch", fetcher);
  render(<GitIdentity csrf="csrf" onboarding />);
  await screen.findByRole("button", { name: "Yritä uudelleen" });
  expect(
    screen.queryByRole("button", { name: "Vahvista Git-identiteetti" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Yritä uudelleen" }));
  await screen.findByRole("button", { name: "Vahvista Git-identiteetti" });
});

it("does not open an unset settings identity as an editable form", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: 1,
        name: "",
        email: "",
        source: "~/.gitconfig",
        suggested_name: "Alice",
        suggested_email: "alice@example.invalid",
        emails: ["alice@example.invalid"],
      }),
    }),
  );
  render(<GitIdentity csrf="csrf" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Muokkaa Git-identiteettiä" }),
  );
  expect(
    screen.getByRole("textbox", { name: "Gitissä näkyvä nimi" }),
  ).toHaveProperty("value", "Alice");
  fireEvent.click(screen.getByRole("button", { name: "Peruuta" }));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByText("Nimi puuttuu")).toBeTruthy();
});
