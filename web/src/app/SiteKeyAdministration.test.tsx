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
function mockHost(
  replies: (() => Response | Promise<Response>)[],
  copies: unknown = { schema_version: 1, people: [], waiting: 0 },
) {
  const writes: { url: string; body: unknown }[] = [];
  let current = config("chatgpt");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === "/api/v1/server/onboarding/ai-key/copies") return json(copies);
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

const siteKey = {
  provider: "anthropic",
  suffix: "7Q2x",
  set_at: "2026-10-24T09:00:00Z",
};
const joined = {
  schema_version: 1,
  site_key: siteKey,
  people: [
    { id: "1001", login_hint: "kaisa-admin", username: "kaisa" },
    {
      id: "1002",
      login_hint: "aino-v",
      username: "aino",
      copy: {
        provider: "anthropic",
        suffix: "m4Pz",
        at: "2026-10-21T12:00:00Z",
        current: false,
      },
    },
    { id: "1003", login_hint: "mikko-k", username: "mikko" },
    { id: "1007", login_hint: "ville-r", username: "ville" },
  ],
  waiting: 1,
};

/** The host with a stored key: each person's daemon answers a check with
 * the given word, and a write with the outcome its check implies. */
function mockGiving(words: Record<string, string>) {
  const sent: { url: string; body: Record<string, string> }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === "/api/v1/server/onboarding")
      return json(config("site_key", "7Q2x"));
    if (url === "/api/v1/server/onboarding/ai-key/copies") return json(joined);
    const body = JSON.parse(String(init?.body));
    sent.push({ url, body });
    const word = words[body.subject] ?? "unknown";
    if (url.endsWith("/check"))
      return json({ schema_version: 1, subject: body.subject, state: word });
    if (url.endsWith("/seed"))
      return json({
        schema_version: 1,
        subject: body.subject,
        outcome: word === "absent" ? "seeded" : "replaced",
      });
    return new Response("", { status: 503 });
  });
  return sent;
}

it("lists what the site gave whom and names earlier copies' holders", async () => {
  mockGiving({});
  render(<SiteKeyAdministration csrf="csrf" />);
  const card = await screen.findByTestId("joined-card");
  expect(within(card).getByTestId("given-1001").textContent).toContain(
    "Ei annettu",
  );
  expect(within(card).getByTestId("given-1002").textContent).toContain(
    "aiempi avain …m4Pz",
  );
  expect(screen.getByTestId("joined-waiting").textContent).toContain(
    "1 sallittua",
  );
  expect(screen.getByTestId("old-copies").textContent).toContain("@aino-v");
});

it("checks everyone, preselects only who a write can reach, and never writes over an own credential", async () => {
  const sent = mockGiving({
    "1001": "own",
    "1002": "earlier",
    "1003": "absent",
    "1007": "unknown",
  });
  render(<SiteKeyAdministration csrf="csrf" />);
  fireEvent.click(await screen.findByTestId("give-all"));
  const dialog = await screen.findByTestId("give-dialog");
  await waitFor(() => expect(dialog.dataset.phase).toBe("review"));
  // The administrator sees one word, never the kind of credential.
  expect(within(dialog).getByTestId("give-1001").textContent).toContain(
    "Oma Anthropic-tunnus",
  );
  expect(within(dialog).getByTestId("give-1001").textContent).toContain(
    "Ei koskaan korvata",
  );
  expect(within(dialog).queryByTestId("give-pick-1001")).toBeNull();
  expect(within(dialog).queryByTestId("give-pick-1007")).toBeNull();
  expect(screen.getByTestId("give-consequences").textContent).toContain(
    "toisen henkilön omiin tunnuksiin",
  );
  const confirm = screen.getByTestId("give-confirm");
  expect(confirm.textContent).toContain("2 henkilölle");
  // Leaving one out gives only the other.
  fireEvent.click(
    within(screen.getByTestId("give-pick-1002")).getByRole("checkbox"),
  );
  expect(confirm.textContent).toContain("1 henkilölle");
  fireEvent.click(confirm);
  await waitFor(() => expect(dialog.dataset.phase).toBe("done"));
  const seeds = sent.filter((x) => x.url.endsWith("/seed"));
  expect(seeds).toEqual([
    {
      url: "/api/v1/server/onboarding/ai-key/seed",
      body: { subject: "1003", ...siteKey },
    },
  ]);
  expect(within(dialog).getByTestId("give-1003").dataset.outcome).toBe(
    "seeded",
  );
});

it("a new key names whose copies were replaced and who was not reached", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url === "/api/v1/server/onboarding")
      return json(config("site_key", "m4Pz"));
    if (url === "/api/v1/server/onboarding/ai-key/copies") return json(joined);
    if (url.endsWith("/set"))
      return json({
        ...config("site_key", "Wxyz"),
        rotation: [
          { subject: "1002", outcome: "replaced" },
          { subject: "1007", outcome: "not_reached" },
        ],
      });
    return new Response("", { status: 503 });
  });
  render(<SiteKeyAdministration csrf="csrf" />);
  await screen.findByTestId("joined-card");
  fireEvent.click(await screen.findByTestId("site-key-replace"));
  fireEvent.click(enter(key));
  const notice = await screen.findByTestId("replaced-notice");
  expect(notice.textContent).toContain("1 henkilöltä: @aino-v");
  expect(notice.textContent).toContain("Ei tavoitettu: @ville-r");
});

it("the removal dialog names who keeps a copy", async () => {
  mockGiving({});
  render(<SiteKeyAdministration csrf="csrf" />);
  await screen.findByTestId("joined-card");
  fireEvent.click(screen.getByTestId("site-key-remove"));
  expect((await screen.findByTestId("remove-holders")).textContent).toContain(
    "1 henkilölle: @aino-v",
  );
});
