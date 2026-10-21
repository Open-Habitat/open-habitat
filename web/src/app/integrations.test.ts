import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectPasswordAccount,
  Refused,
  readIntegrations,
  redirectMatches,
} from "./integrations";

afterEach(() => vi.restoreAllMocks());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("pasted redirect", () => {
  it.each([
    ["http://127.0.0.1:46399/oauth2/callback?state=s&code=c", true],
    ["  http://127.0.0.1/?code=c  ", true],
    // The provider's own consent page, which people copy by mistake.
    ["https://accounts.google.com/signin/oauth/consent?authuser=0", false],
    // Loopback-looking hosts that are not loopback.
    ["http://127.0.0.1.evil.test/?code=c", false],
    ["http://localhost:53682/?code=c", false],
    ["http://127.0.0.1:46399/oauth2/callback", false],
  ])("%s → %s", (raw, ok) => {
    expect(redirectMatches("http://127.0.0.1", raw)).toBe(ok);
  });
});

it("rejects a list that does not match the contract", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    json({ schema_version: 1, providers: [], accounts: [], skill: "maybe" }),
  );
  await expect(readIntegrations()).rejects.toThrow();
});

it("tells a refusal from an uncertain outcome", async () => {
  const account = {
    address: "p@example.test",
    server: "imap.example.test",
    port: 993,
    security: "tls" as const,
    username: "p",
    password: "x",
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    json({ schema_version: 1, error: { code: "credentials_rejected" } }, 422),
  );
  const refused = await connectPasswordAccount("csrf", account).catch((e) => e);
  expect(refused).toBeInstanceOf(Refused);
  expect(refused.code).toBe("credentials_rejected");

  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    json({ schema_version: 1, error: { code: "native_unavailable" } }, 503),
  );
  const uncertain = await connectPasswordAccount("csrf", account).catch(
    (e) => e,
  );
  expect(uncertain).not.toBeInstanceOf(Refused);
});
