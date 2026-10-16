import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});

async function open(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
}

async function holdCreation(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() === "POST") {
      ++posts;
      await held;
    }
    await route.continue();
  });
  return { release, posts: () => posts };
}

const newButton = (page: Page) =>
  page.getByRole("navigation").getByRole("button", {
    name: "Uusi keskustelu työtilassa ordinary-dir",
    exact: true,
  });

test("@placeholder @a11y sidebar + opens a stable conversation before creation replies", async ({
  page,
}) => {
  await open(page);
  const create = await holdCreation(page);
  try {
    await newButton(page).click();
    await expect(page).toHaveURL(/conversation=new$/);
    const frame = page.locator(".ah-conversation-frame");
    await expect(
      frame.getByRole("heading", { name: "Uusi keskustelu", exact: true }),
    ).toBeVisible();
    await expect(frame.getByRole("status")).toHaveText("Luodaan keskustelua…");
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeDisabled();
    const headerBefore = await frame.locator(".ah-agent-header").boundingBox();
    const composerBefore = await frame.locator(".ah-composer").boundingBox();
    expect(create.posts()).toBe(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    create.release();
    await expect(page).toHaveURL(/conversation=pi:/);
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeEnabled();
    const headerAfter = await frame.locator(".ah-agent-header").boundingBox();
    const composerAfter = await frame.locator(".ah-composer").boundingBox();
    if (!headerBefore || !headerAfter || !composerBefore || !composerAfter)
      throw new Error("Missing conversation layout");
    expect(Math.abs(headerBefore.y - headerAfter.y)).toBeLessThan(1);
    expect(Math.abs(composerBefore.y - composerAfter.y)).toBeLessThan(1);
    expect(create.posts()).toBe(1);
  } finally {
    create.release();
  }
});

test("@placeholder lost creation reply stays in the conversation, including reload, without replay", async ({
  page,
}) => {
  await open(page);
  let posts = 0;
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    ++posts;
    await route.fetch(); // A real native session exists, but the browser loses its reply.
    await route.abort("failed");
  });
  await newButton(page).click();
  await expect(
    page
      .getByRole("region", { name: "Keskustelu", exact: true })
      .getByText(/Luonnin tulos epävarma/),
  ).toBeVisible();
  await expect(page).toHaveURL(/conversation=new$/);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Keskustelu", exact: true })
      .getByText(/Luonnin tilaa ei voida vahvistaa/),
  ).toBeVisible();
  expect(posts).toBe(1);
});

test("@placeholder completing creation does not steal navigation after leaving its placeholder", async ({
  page,
}) => {
  await open(page);
  const create = await holdCreation(page);
  try {
    await newButton(page).click();
    await expect(page).toHaveURL(/conversation=new$/);
    await page.locator(".ah-header-workspace").click();
    await expect(page).not.toHaveURL(/conversation=/);
    const completed = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/conversations") &&
        r.request().method() === "POST",
    );
    create.release();
    await completed;
    await expect(
      page.getByRole("button", {
        name: "Aloita uusi Pi-keskustelu",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(page).not.toHaveURL(/conversation=/);
  } finally {
    create.release();
  }
});
