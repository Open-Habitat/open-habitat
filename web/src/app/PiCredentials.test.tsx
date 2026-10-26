import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PiCredentials } from "./PiCredentials";

afterEach(() => vi.restoreAllMocks());
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const credentials = (suffix: string) => ({
  schema_version: 1,
  openai: { present: false, suffix: null },
  anthropic: { present: true, suffix },
  deepseek: { present: false, suffix: null },
  subscription: { present: false },
});
const site = (copy?: object) => ({
  schema_version: 1,
  repositories: { mode: "preselected" },
  integrations: [],
  ai_account: { offer: "all" },
  ...(copy ? { site_key_copy: copy } : {}),
});
function host(suffix: string, copy?: object) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url === "/api/v1/pi/credentials") return json(credentials(suffix));
    if (url === "/api/v1/onboarding/site") return json(site(copy));
    return new Response("", { status: 503 });
  });
}
const given = (current: boolean) => ({
  provider: "anthropic",
  suffix: "7Q2x",
  at: "2026-10-24T09:00:00Z",
  current,
});

it("marks the person's key row as the site's while it is the given copy", async () => {
  host("7Q2x", given(true));
  render(<PiCredentials csrf="csrf" />);
  const row = await screen.findByTestId("api-key-row-anthropic");
  await waitFor(() => expect(row.dataset.site).toBe("current"));
  expect(within(row).getByTestId("api-key-site")).toBeTruthy();
});

it("says an earlier site copy may stop working", async () => {
  host("7Q2x", given(false));
  render(<PiCredentials csrf="csrf" />);
  const row = await screen.findByTestId("api-key-row-anthropic");
  await waitFor(() => expect(row.dataset.site).toBe("earlier"));
  expect(within(row).getByTestId("api-key-desc").textContent).toContain(
    "voi lakata toimimasta",
  );
});

it("a key the person changed to their own is theirs", async () => {
  host("k9Lw", given(true));
  render(<PiCredentials csrf="csrf" />);
  const row = await screen.findByTestId("api-key-row-anthropic");
  await waitFor(() =>
    expect(within(row).getByTestId("api-key-suffix").textContent).toBe(
      "sk-ant-…k9Lw",
    ),
  );
  expect(row.dataset.site).toBeUndefined();
  expect(within(row).queryByTestId("api-key-site")).toBeNull();
});
