// Synthetic evidence for the three web-polish issues; never uses live data.
import { openLab, origin, snapshot } from "./session.mjs";

const { browser, page } = await openLab({ width: 1920 });
async function capture(slug, state) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      localStorage.setItem("nah:theme", theme);
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const [form, width, height] of [
      ["wide", 1920, 1080],
      ["narrow", 1000, 900],
      ["phone", 390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await snapshot(page, `issues/${slug}/lab/${state}-${form}-${theme}`);
    }
  }
}
try {
  await page.request.get(
    `${origin}/fixture/checkout?name=first&mode=interrupted`,
  );
  await page.goto(`${origin}/workspaces/new`);
  const clone = page.getByRole("article", { name: "Kloonaus fixture/first" });
  await clone.getByRole("button", { name: /Poista keskeneräinen/ }).click();
  await page.waitForURL(`${origin}/workspaces`);
  await page.getByRole("heading", { name: "Työtilat", exact: true }).waitFor();
  await capture("clone-delete-goes-home", "after-removal-home");

  const session = await (
    await page.request.get(`${origin}/auth/session`)
  ).json();
  const saved = await page.request.post(`${origin}/api/v1/pi/models`, {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-Agent-Host-CSRF": session.csrf,
    },
    data: { model: "gpt-6-astra", thinking: "medium" },
  });
  if (!saved.ok()) throw new Error("Synthetic model default save failed");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${origin}/workspaces`);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  await page
    .locator("main")
    .getByRole("button", {
      name: "Uusi worktree-agentti työtilassa aurinkokello",
    })
    .click();
  await page
    .locator(".ah-composer")
    .getByText("gpt-6-astra · medium")
    .waitFor();
  await capture("worktree-agent-layout", "new-worktree");

  await page.request.get(
    `${origin}/fixture/keep-workspaces?names=aurinkokello`,
  );
  // The layout fixture represents the real host's unknown archive source.
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.sources.find((f) => f.source === "pi_history").state = "unknown";
    await route.fulfill({ response, json: body });
  });
  await page.goto(`${origin}/workspaces`);
  await page.waitForURL(`${origin}/`);
  await page.locator(".ah-workspace-home-notice").waitFor();
  await capture("single-mode-notice-and-url", "single-home-notice");
} finally {
  await browser.close();
}
