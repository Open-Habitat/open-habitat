import { afterEach, expect, it, vi } from "vitest";
import withKey from "../../../contracts/v1/examples/server-onboarding-site-key.json";
import example from "../../../contracts/v1/examples/site-onboarding.json";
import {
  deleteSiteKey,
  documentOf,
  readServerOnboarding,
  readSiteOnboarding,
  saveServerOnboarding,
  setSiteKey,
  validSiteKey,
} from "./onboardingConfig";

afterEach(() => vi.restoreAllMocks());
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

it("accepts the person-side read and rejects one that carries defaults", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  fetch.mockResolvedValueOnce(reply(example));
  expect((await readSiteOnboarding()).repositories.mode).toBe("auto");
  for (const leak of [
    { ...example, repositories: { mode: "auto", defaults: ["example-org/x"] } },
    { ...example, defaults: ["example-org/x"] },
  ]) {
    fetch.mockResolvedValueOnce(reply(leak));
    await expect(readSiteOnboarding()).rejects.toThrow();
  }
});

it("rejects an administrator read outside the contract", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    reply({
      schema_version: 1,
      version: 1,
      repositories: { mode: "auto", defaults: ["example-org/../x"] },
      integrations: [],
      ai_account: { offer: "all" },
    }),
  );
  await expect(readServerOnboarding()).rejects.toThrow();
});

it("sends the whole document under its expected version and reads the outcome", async () => {
  const doc = {
    repositories: { mode: "skip" as const, defaults: [] },
    integrations: [
      { provider: "dropbox" as const, required: false },
      { provider: "google" as const, required: true },
    ],
    ai_account: { offer: "all" as const },
  };
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      reply({ schema_version: 1, version: 5, ...documentOf(doc) }),
    );
  const saved = await saveServerOnboarding("csrf", 4, doc);
  expect(saved.kind).toBe("saved");
  const [, init] = fetch.mock.calls[0];
  expect(init?.method).toBe("PUT");
  expect(JSON.parse(String(init?.body))).toEqual({
    expected_version: 4,
    ...documentOf(doc),
  });
  // Catalog order on the wire, as the gateway stores it.
  expect(
    JSON.parse(String(init?.body)).integrations.map(
      (i: { provider: string }) => i.provider,
    ),
  ).toEqual(["google", "dropbox"]);
  fetch.mockResolvedValueOnce(
    reply({ schema_version: 1, error: { code: "version_conflict" } }, 409),
  );
  expect(await saveServerOnboarding("csrf", 4, doc)).toEqual({
    kind: "refused",
    code: "version_conflict",
  });
  fetch.mockResolvedValueOnce(new Response("", { status: 503 }));
  expect((await saveServerOnboarding("csrf", 4, doc)).kind).toBe("uncertain");
  fetch.mockRejectedValueOnce(new TypeError("network"));
  expect((await saveServerOnboarding("csrf", 4, doc)).kind).toBe("uncertain");
});

it("keeps a key off the wrong provider: sk-ant- is Anthropic's alone, and only literal keys", () => {
  const body = "a".repeat(24);
  expect(validSiteKey("anthropic", `sk-ant-${body}`)).toBe(true);
  expect(validSiteKey("openai", `sk-ant-${body}`)).toBe(false);
  expect(validSiteKey("anthropic", `sk-${body}`)).toBe(false);
  expect(validSiteKey("deepseek", `sk-${body}`)).toBe(true);
  expect(validSiteKey("openai", `!cat ~/.key${body}`)).toBe(false);
  expect(validSiteKey("openai", `sk-${body} `)).toBe(false);
});

it("sends the key once to its own write and reads back only the configuration", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(reply(withKey));
  const key = `sk-ant-${"k".repeat(30)}`;
  const saved = await setSiteKey("csrf", "anthropic", key);
  expect(saved.kind === "saved" && saved.config.site_key?.suffix).toBe("Xa1b");
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe("/api/v1/server/onboarding/ai-key/set");
  expect(JSON.parse(String(init?.body))).toEqual({
    provider: "anthropic",
    key,
  });
  // A reply that would carry the key back is outside the contract.
  fetch.mockResolvedValueOnce(
    reply({ ...withKey, site_key: { ...withKey.site_key, key } }),
  );
  expect((await setSiteKey("csrf", "anthropic", key)).kind).toBe("uncertain");
  fetch.mockResolvedValueOnce(
    reply({ schema_version: 1, error: { code: "invalid_key" } }, 400),
  );
  expect(await setSiteKey("csrf", "anthropic", key)).toEqual({
    kind: "refused",
    code: "invalid_key",
  });
  const { site_key: _, ...without } = withKey;
  fetch.mockResolvedValueOnce(
    reply({ ...without, ai_account: { offer: "claude" } }),
  );
  expect((await deleteSiteKey("csrf", "claude")).kind).toBe("saved");
  const [deleteURL, deleteInit] = fetch.mock.calls[3];
  expect(deleteURL).toBe("/api/v1/server/onboarding/ai-key/delete");
  expect(JSON.parse(String(deleteInit?.body))).toEqual({ offer: "claude" });
});
