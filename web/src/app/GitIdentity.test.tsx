import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GitIdentity } from "./GitIdentity";

afterEach(() => vi.unstubAllGlobals());

it("prefills account details during onboarding and saves the edited name", async () => {
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
      preferredName="Typed Person"
      preferredEmail="typed@example.invalid"
      onContinue={onContinue}
    />,
  );
  await screen.findByTestId("git-identity-confirm");
  expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
    "typed@example.invalid",
  );
  expect(screen.getByTestId("git-name-input")).toHaveProperty(
    "value",
    "Typed Person",
  );
  fireEvent.change(screen.getByTestId("git-name-input"), {
    target: { value: "Edited Person" },
  });
  fireEvent.click(screen.getByTestId("git-identity-confirm"));
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
    name: "Edited Person",
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
  await screen.findByTestId("git-identity-edit");
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId("git-identity-edit"));
  fireEvent.change(screen.getByTestId("git-name-input"), {
    target: { value: "Changed" },
  });
  fireEvent.change(screen.getByTestId("git-email-input"), {
    target: { value: "new@example.invalid" },
  });
  fireEvent.click(screen.getByTestId("git-identity-save"));
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
  await screen.findByTestId("git-identity-retry");
  expect(screen.queryByTestId("git-identity-confirm")).toBeNull();
  fireEvent.click(screen.getByTestId("git-identity-retry"));
  await screen.findByTestId("git-identity-confirm");
  expect(screen.getByTestId("git-name-input")).toHaveProperty("value", "Alice");
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
  fireEvent.click(await screen.findByTestId("git-identity-edit"));
  expect(screen.getByTestId("git-name-input")).toHaveProperty("value", "Alice");
  fireEvent.click(screen.getByTestId("cancel"));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByTestId("git-identity-edit")).toBeTruthy();
});
