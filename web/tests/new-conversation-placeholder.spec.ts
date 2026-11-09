import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page, Route } from "@playwright/test";
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
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  // The click returns while the signed-in document is still loading. A route
  // or listener added then can miss every request of that document (seen
  // under gate load: creation's POST went out unheld), so wait for the app.
  await newButton(page).waitFor();
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
  page.getByRole("navigation").getByTestId("workspace-start-ordinary-dir");

test("@placeholder @a11y sidebar + opens a stable conversation before creation replies", async ({
  page,
}) => {
  await open(page);
  const create = await holdCreation(page);
  try {
    await newButton(page).click();
    await expect(page).toHaveURL(/conversation=new$/);
    const frame = page.locator(".ah-conversation-frame");
    await expect(frame.getByRole("heading", { level: 1 })).toBeVisible();
    // No creation status text: the field is usable at once (Jari 16.10.2026).
    await expect(frame.getByTestId("creation-progress")).toHaveCount(0);
    await expect(page.getByTestId("message-input")).toBeEnabled();
    const headerBefore = await frame.locator(".ah-agent-header").boundingBox();
    // The field itself must not move. Conversation controls such as the
    // background strip join the composer above the field once it opens.
    const fieldBefore = await frame.locator(".ah-cbox").boundingBox();
    expect(create.posts()).toBe(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    create.release();
    await expect(page).toHaveURL(/conversation=pi:/);
    await expect(page.getByTestId("message-input")).toBeEnabled();
    // The placeholder's elements are replaced by the conversation's own once
    // the snapshot names it; measure whichever is mounted when the box resolves.
    const settledBox = async (selector: string) => {
      const boxes: Awaited<ReturnType<Locator["boundingBox"]>>[] = [];
      await expect
        .poll(async () => {
          boxes.unshift(await frame.locator(selector).boundingBox());
          return boxes[0];
        })
        .not.toBeNull();
      return boxes[0];
    };
    const headerAfter = await settledBox(".ah-agent-header");
    const fieldAfter = await settledBox(".ah-cbox");
    if (!headerBefore || !headerAfter || !fieldBefore || !fieldAfter)
      throw new Error("Missing conversation layout");
    expect(Math.abs(headerBefore.y - headerAfter.y)).toBeLessThan(1);
    expect(Math.abs(fieldBefore.y - fieldAfter.y)).toBeLessThan(1);
    expect(create.posts()).toBe(1);
  } finally {
    create.release();
  }
});

test("@placeholder lost creation reply stays in the conversation, including reload, without replay", async ({
  page,
}) => {
  await open(page);
  // Any successful snapshot read reconciles the creation, and the new
  // session's own event requests one. Hold the reads that start once the
  // session exists, so the uncertain view is observed before the reload read,
  // not before a racing live one.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const holdSnapshots = async (route: Route) => {
    await held;
    await route.continue().catch(() => {});
  };
  let posts = 0;
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    ++posts;
    await page.route("**/api/v1/snapshot", holdSnapshots);
    await route.fetch(); // A real native session exists, but the browser loses its reply.
    await route.abort("failed");
  });
  await newButton(page).click();
  await expect(
    page.getByRole("main").getByTestId("creation-problem"),
  ).toBeVisible();
  await expect(page).toHaveURL(/conversation=new$/);
  // Typing stays possible, but nothing can be sent to an unconfirmed creation.
  await page.getByTestId("message-input").fill("odottaa");
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeDisabled();
  await page.unroute("**/api/v1/snapshot", holdSnapshots);
  await page.reload();
  release(); // Reads held on the previous document can no longer reconcile it.
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
      page.getByTestId(/^(new-conversation|conversation-start)$/),
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
      .getByTestId("workspace-ordinary-dir")
      .getAttribute("href");
    if (entry === "workspace") await page.goto(href ?? "/workspaces");
    const plus =
      entry === "sidebar"
        ? newButton(page)
        : entry === "workspace"
          ? page.getByTestId(/^(new-conversation|conversation-start)$/)
          : page.locator("main").getByTestId("workspace-start-ordinary-dir");
    const create = await holdCreation(page);
    try {
      await expect(plus).toBeEnabled();
      await plus.click();
      const dialog = page.getByTestId("new-conversation-model");
      await expect(dialog).toBeVisible();
      expect(create.posts()).toBe(0);
      if (entry === "home") {
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await dialog.getByTestId("cancel").click();
        await expect(dialog).not.toBeVisible();
        expect(create.posts()).toBe(0);
        await expect(plus).toBeFocused();
        await plus.click();
      }
      await expect(
        dialog.getByTestId("model-gpt-5.3-codex-spark"),
      ).toBeDisabled();
      await dialog.getByTestId("model-gpt-6.1-sol").check();
      await dialog
        .getByTestId(/^(model-commit|conversation-model-start)$/)
        .click();
      await expect(page).toHaveURL(/conversation=new$/);
      // The field is usable while the chosen-model conversation is created.
      await expect(page.getByTestId("message-input")).toBeEnabled();
      create.release();
      await expect(page).toHaveURL(/conversation=pi:/);
      await expect(page.getByTestId("message-input")).toBeEnabled();
      expect(create.posts()).toBe(1);
    } finally {
      create.release();
    }
  });
}
