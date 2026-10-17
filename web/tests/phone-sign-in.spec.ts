import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// ADR 0018: a signed-in desktop shows a one-minute code; a second browser
// with no session confirms and gets its own session, which the desktop can
// then sign out. Host-backed synthetic evidence (fake OAuth, one UID).
test("a second browser signs in through /link, once, and the desktop can sign it out", async ({
  page,
  browser,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page.goto("/settings#laitteet");
  await expect(
    page.getByRole("heading", { name: "Laitteet", exact: true }),
  ).toBeVisible();
  const devices = page.getByRole("list", { name: "Kirjautuneet laitteet" });
  await expect(devices.getByRole("listitem")).toHaveCount(1);
  await expect(devices).toContainText("Tämä selain");

  const minted = page.waitForResponse(
    (r) => r.url().endsWith("/auth/link") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Näytä koodi" }).click();
  const { token } = await (await minted).json();
  await expect(page.getByRole("img", { name: "QR-koodi" })).toBeVisible();
  await expect(page.getByTestId("link-countdown")).toHaveText(/^0\.[0-5]\d$/);

  const phone = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    userAgent: iphone,
  });
  const phonePage = await phone.newPage();
  const requests: string[] = [];
  phonePage.on("request", (r) => requests.push(r.url()));
  await phonePage.goto(`/link#${token}`);
  await expect(
    phonePage.getByRole("heading", { name: /^Kirjaudutaanko nimellä .+\?$/ }),
  ).toBeVisible();
  // The token left the address bar and never travelled in a URL.
  expect(new URL(phonePage.url()).hash).toBe("");
  expect(requests.some((u) => u.includes(token))).toBe(false);
  await phonePage.getByRole("button", { name: "Kirjaudu", exact: true }).click();
  await expect(
    phonePage.getByRole("heading", { name: "Kirjauduttu" }),
  ).toBeVisible();
  // The success page moves on to the home view by itself, signed in.
  await expect(phonePage).not.toHaveURL(/\/link$/, { timeout: 10_000 });
  await expect(
    phonePage.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toHaveCount(0);
  expect((await phone.request.get("/auth/session")).status()).toBe(200);

  // The desktop hides the code and names the device that used it.
  await expect(page.getByRole("img", { name: "QR-koodi" })).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "kirjautui" }),
  ).toContainText("iPhone · Safari");
  await expect(devices.getByRole("listitem")).toHaveCount(2);
  await expect(
    devices.getByRole("listitem").filter({ hasText: "Uusi" }),
  ).toContainText("Kirjautunut QR-koodilla");

  // The code worked once: a third browser gets nothing from it.
  const late = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  const latePage = await late.newPage();
  await latePage.goto(`/link#${token}`);
  await expect(
    latePage.getByRole("heading", { name: "Koodi ei enää toimi" }),
  ).toBeVisible();
  expect((await late.request.get("/auth/session")).status()).toBe(401);

  // Signing the phone out from the desktop ends only the phone's session.
  await devices
    .getByRole("button", { name: "Kirjaa iPhone · Safari ulos" })
    .click();
  await page.getByRole("button", { name: "Kirjaa ulos", exact: true }).click();
  await expect(devices.getByRole("listitem")).toHaveCount(1);
  expect((await phone.request.get("/auth/session")).status()).toBe(401);
  expect((await page.request.get("/auth/session")).status()).toBe(200);
  await phone.close();
  await late.close();
});
