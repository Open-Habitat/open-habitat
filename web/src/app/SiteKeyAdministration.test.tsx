import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SiteKeyAdministration } from "./SiteKeyAdministration";

afterEach(() => vi.restoreAllMocks());
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const config = (offer: string, suffix?: string) => ({
  schema_version: 1,
  version: 3,
  repositories: { mode: "preselected", defaults: [] },
  integrations: [],
  ai_account: { offer },
  ...(suffix
    ? {
        site_key: {
          provider: "anthropic",
          suffix,
          set_at: "2026-10-24T09:00:00Z",
        },
      }
    : {}),
});

/** The host: each key write answers with the next reply in turn. */
function mockHost(replies: (() => Response | Promise<Response>)[]) {
  const writes: { url: string; body: unknown }[] = [];
  let current = config("chatgpt");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.startsWith("/api/v1/server/onboarding/ai-key/")) {
      writes.push({ url, body: JSON.parse(String(init?.body)) });
      const r = await (
        replies.shift() ?? (() => new Response("", { status: 503 }))
      )();
      if (r.ok) current = await r.clone().json();
      return r;
    }
    if (url === "/api/v1/server/onboarding") return json(current);
    return new Response("", { status: 503 });
  });
  return writes;
}

const key = `sk-ant-${"a".repeat(30)}Wxyz`;
const enter = (value: string) => {
  fireEvent.click(
    within(screen.getByTestId("site-key-provider")).getByTestId(
      "segment-anthropic",
    ),
  );
  fireEvent.change(screen.getByTestId("site-key-input"), {
    target: { value },
  });
  return screen.getByTestId("site-key-save") as HTMLButtonElement;
};

it("stores the key, keeps only its suffix, and removes it giving people every option", async () => {
  const writes = mockHost([
    () => json(config("site_key", "Wxyz")),
    () => json(config("all")),
  ]);
  render(<SiteKeyAdministration csrf="csrf" />);
  await screen.findByTestId("site-key-input");
  // An OpenAI-shaped key is not Anthropic's.
  expect(enter(`sk-${"o".repeat(30)}`).disabled).toBe(true);
  fireEvent.click(enter(key));
  await screen.findByTestId("site-key-present");
  expect(screen.getByTestId("site-key-suffix").textContent).toContain("Wxyz");
  expect(screen.queryByTestId("site-key-input")).toBeNull();
  fireEvent.click(screen.getByTestId("site-key-remove"));
  fireEvent.click(await screen.findByTestId("site-key-remove-confirm"));
  await screen.findByTestId("site-key-input");
  expect(writes).toEqual([
    {
      url: "/api/v1/server/onboarding/ai-key/set",
      body: { provider: "anthropic", key },
    },
    { url: "/api/v1/server/onboarding/ai-key/delete", body: { offer: "all" } },
  ]);
});

it("a refused key leaves the page as it was, without the key in the field", async () => {
  mockHost([() => json({ error: { code: "invalid_key" } }, 400)]);
  render(<SiteKeyAdministration csrf="csrf" />);
  await screen.findByTestId("site-key-input");
  fireEvent.click(enter(key));
  await screen.findByTestId("site-key-refused");
  expect((screen.getByTestId("site-key-input") as HTMLInputElement).value).toBe(
    "",
  );
  expect(screen.queryByTestId("site-key-present")).toBeNull();
});

it("an unknown outcome stops the page until the host is read again", async () => {
  mockHost([() => new Response("", { status: 502 })]);
  render(<SiteKeyAdministration csrf="csrf" />);
  await screen.findByTestId("site-key-input");
  fireEvent.click(enter(key));
  await screen.findByTestId("site-key-uncertain");
  expect(
    (screen.getByTestId("site-key-input") as HTMLInputElement).disabled,
  ).toBe(true);
  fireEvent.click(
    within(screen.getByTestId("site-key-uncertain")).getByRole("button"),
  );
  await waitFor(() =>
    expect(screen.queryByTestId("site-key-uncertain")).toBeNull(),
  );
  expect(
    (screen.getByTestId("site-key-input") as HTMLInputElement).disabled,
  ).toBe(false);
});
