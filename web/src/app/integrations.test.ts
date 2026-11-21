import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizationClient,
  connectPasswordAccount,
  providerStop,
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

describe("a provider's stop on its own return address", () => {
  const auth =
    "https://accounts.google.com/o/oauth2/v2/auth?client_id=app.example&state=s1&scope=openid";
  it.each([
    // The person stopped on Google's consent screen in this sign-in.
    ["http://localhost/?state=s1&error=access_denied", "access_denied"],
    ["  http://localhost/?error=org_internal&state=s1 ", "org_internal"],
    // Another sign-in's address: the daemon calls it an old address.
    ["http://localhost/?state=s0&error=access_denied", null],
    // A finished sign-in is not a stop.
    ["http://localhost/?state=s1&code=c", null],
    ["http://localhost/?state=s1&state=s1&error=access_denied", null],
    ["http://localhost/?state=s1&error=a&error=b", null],
    ["not a url", null],
  ])("%s → %s", (raw, want) => {
    expect(providerStop(auth, raw)).toBe(want);
  });
  it("needs the authorization's own state", () => {
    expect(
      providerStop(
        "https://accounts.google.com/auth?client_id=x",
        "http://localhost/?state=&error=access_denied",
      ),
    ).toBeNull();
    expect(
      providerStop(undefined, "http://localhost/?state=s1&error=x"),
    ).toBeNull();
  });
  it("reads the client the sign-in asks for", () => {
    expect(authorizationClient(auth)).toBe("app.example");
    expect(authorizationClient("garbage")).toBe("");
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
