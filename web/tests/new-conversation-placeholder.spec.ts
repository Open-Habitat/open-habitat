import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
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
    // No creation status text: the field is usable at once (Jari 16.10.2026).
    await expect(frame.getByText("Luodaan keskustelua")).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeEnabled();
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
  // Typing stays possible, but nothing can be sent to an unconfirmed creation.
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill("odottaa");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeDisabled();
  await page.reload();
  // The reconnect fix reconciles settled creation on a successful reload read.
  // Return to the list to choose the actual session, never replay the POST.
  await expect(page).not.toHaveURL(/conversation=new$/);
  await expect(newButton(page)).toBeEnabled();
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

for (const entry of ["home", "sidebar", "workspace"] as const) {
  test(`@placeholder refused live default: ${entry} + offers a model and creates once`, async ({
    page,
  }) => {
    // Exact model-catalog response captured through the gateway peer on
    // pilot.163, 2026-10-16. No history, user identity or content in this fixture.
    const models = JSON.parse(
      readFileSync(
        new URL("./fixtures/plus-live-models.json", import.meta.url),
        "utf8",
      ),
    );
    await page.clock.setFixedTime(new Date("2026-10-16T14:08:36Z"));
    await page.route("**/api/v1/pi/models", async (route) => {
      expect(route.request().method()).toBe("GET"); // never rewrite the default
      await route.fulfill({ json: models });
    });
    await open(page);
    const nav = page.getByRole("navigation");
    const href = await nav
      .getByRole("link", { name: "ordinary-dir", exact: true })
      .getAttribute("href");
    if (entry === "workspace") await page.goto(href ?? "/workspaces");
    const plus =
      entry === "sidebar"
        ? newButton(page)
        : entry === "workspace"
          ? page.getByRole("button", {
              name: "Aloita uusi Pi-keskustelu",
              exact: true,
            })
          : page.locator("main").getByRole("button", {
              name: "Uusi keskustelu työtilassa ordinary-dir",
              exact: true,
            });
    const create = await holdCreation(page);
    try {
      await expect(plus).toBeEnabled();
      await plus.click();
      const dialog = page.getByRole("dialog", {
        name: "Malli uudelle keskustelulle",
      });
      await expect(dialog).toBeVisible();
      expect(create.posts()).toBe(0);
      if (entry === "home") {
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await dialog
          .getByRole("button", { name: "Peruuta", exact: true })
          .click();
        await expect(dialog).not.toBeVisible();
        expect(create.posts()).toBe(0);
        await expect(plus).toBeFocused();
        await plus.click();
      }
      await expect(
        dialog.getByRole("radio", { name: /GPT-5.3 Codex Spark/ }),
      ).toBeDisabled();
      await dialog.getByRole("radio", { name: /GPT-6.1 Sol/ }).check();
      await dialog
        .getByRole("button", { name: "Aloita keskustelu valitulla mallilla" })
        .click();
      await expect(page).toHaveURL(/conversation=new$/);
      // The field is usable while the chosen-model conversation is created.
      await expect(
        page.getByRole("textbox", { name: "Viesti Pi:lle" }),
      ).toBeEnabled();
      create.release();
      await expect(page).toHaveURL(/conversation=pi:/);
      await expect(
        page.getByRole("textbox", { name: "Viesti Pi:lle" }),
      ).toBeEnabled();
      expect(create.posts()).toBe(1);
    } finally {
      create.release();
    }
  });
}
