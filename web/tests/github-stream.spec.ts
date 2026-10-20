import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@github-first synthetic slow native clone exposes per-repository receiving stage", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  // Hold the native receive phase until observed, not for a wall-clock window
  // that the browser can miss when the host is under load.
  await page.request.get("/fixture/clone?mode=hold");
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await confirmGitIdentity(page);
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /jatka/i }).click();
    await expect(page.getByText(/Haetaan 14 % · 120 MiB/)).toBeVisible();
    await page.request.get("/fixture/clone?mode=release");
    await expect(
      page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/clone?mode=normal");
    await page.request.get("/fixture/checkout?name=first&mode=absent");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
