import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

const host = hostOrigin;
const attempt = "/api/v1/onboarding/pi/attempt";
test.use({ baseURL: host, ignoreHTTPSErrors: true });

async function login(page: Page, user: "Alice" | "Bob" = "Alice") {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: user }).click();
  expect((await page.request.get("/auth/session")).status()).toBe(200);
}

test("@pi-attempt native reads stay mapped while foreign and stale attempts are denied", async ({
  browser,
}) => {
  const owner = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  const stranger = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  try {
    const a = await owner.newPage();
    const b = await stranger.newPage();
    expect(
      (await a.request.get("/fixture/scenario?value=pi-blocked")).status(),
    ).toBe(204);
    await login(a);
    await login(b); // second session for same mapped Unix account
    const session = await (await a.request.get("/auth/session")).json();
    for (const path of [
      "/api/v1/snapshot",
      "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/history?limit=1",
      "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/entries/missing/blocks/0?revision=missing&offset=0&limit_bytes=100",
    ]) {
      const response = await a.request.get(path);
      expect(response.status(), path).toBe(
        path.includes("/entries/missing/blocks/") ? 404 : 200,
      );
      expect(response.headers()["cache-control"]).toContain("no-store");
      // Native reads remain scoped to this authenticated mapping.
    }
    expect((await a.request.get("/api/v1/onboarding/pi/status")).status()).toBe(
      200,
    );
    expect((await a.request.post(attempt)).status()).toBe(403); // no Origin/CSRF
    expect(
      (await a.request.post(attempt, { headers: { Origin: host } })).status(),
    ).toBe(403);
    const started = await a.request.post(attempt, {
      headers: {
        Origin: host,
        "X-Agent-Host-CSRF": session.csrf,
        "X-Agent-Host-Socket": "/tmp/foreign",
        "X-Agent-Host-Session": "forged",
      },
    });
    expect(started.status()).toBe(200);
    expect(started.headers()["cache-control"]).toContain("no-store");
    expect(await started.text()).not.toContain("synthetic-token");
    expect((await b.request.get(attempt)).status()).toBe(404);
    expect(
      (
        await b.request.delete(attempt, {
          headers: {
            Origin: host,
            "X-Agent-Host-CSRF": (
              await (await b.request.get("/auth/session")).json()
            ).csrf,
          },
        })
      ).status(),
    ).toBe(404);
    expect((await a.request.get(attempt)).status()).toBe(200);
    const foreignAccount = await browser.newContext({
      baseURL: host,
      ignoreHTTPSErrors: true,
    });
    try {
      const c = await foreignAccount.newPage();
      await login(c, "Bob");
      expect((await c.request.get(attempt)).status()).toBe(404);
      expect((await c.request.get("/api/v1/snapshot")).status()).toBe(200);
    } finally {
      await foreignAccount.close();
    }
    expect((await a.request.get("/fixture/expire")).status()).toBe(204);
    expect((await a.request.get(attempt)).status()).toBe(401);
    expect((await a.request.get("/api/v1/snapshot")).status()).toBe(401);
  } finally {
    await owner.request.get("/fixture/reset-clock");
    await owner.request.get("/fixture/scenario?value=ready");
    await owner.close();
    await stranger.close();
  }
});
