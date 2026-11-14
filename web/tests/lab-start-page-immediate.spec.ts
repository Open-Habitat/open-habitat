import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

for (const entry of ["workspace", "conversation", "worktree"] as const) {
  for (const wait of ["none", "placeholder", "draft"] as const) {
    if (entry === "workspace" && wait === "draft") continue;
    if (entry === "worktree" && wait !== "none") continue;
    test(`@lab immediate goal from ${entry}, waiting for ${wait}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.request.get("/fixture/scenario?value=ready");
      await page.route("**/workspaces/start_page?*", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        if (body.start_page?.goals?.length) {
          body.start_page.goals[0].start = "immediate";
          if (wait !== "placeholder")
            body.start_page.goals[0].prompt = "Investigate the repository.";
        }
        await route.fulfill({ response, json: body });
      });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      if (entry === "worktree") {
        const session = await (await page.request.get("/auth/session")).json();
        expect(
          (
            await page.request.post("/api/v1/pi/models", {
              headers: {
                Origin: new URL(page.url()).origin,
                "X-Agent-Host-CSRF": session.csrf,
              },
              data: { model: "gpt-6-astra", thinking: "medium" },
            })
          ).ok(),
        ).toBe(true);
        await page.reload();
      }
      if (entry === "conversation") {
        await page
          .getByRole("navigation")
          .getByTestId("workspace-start-aurinkokello")
          .click();
        await expect(page).toHaveURL(/\?conversation=pi:/);
      } else {
        await page
          .getByRole("navigation")
          .getByTestId("workspace-aurinkokello")
          .click();
        if (entry === "worktree") {
          await page.locator("main").getByTestId("new-worktree").click();
          await expect(page).toHaveURL(/conversation=new-worktree/);
          await expect(page.getByTestId("worktree-intro")).toBeVisible();
        }
      }
      await expect(page.getByTestId("starting-goal").first()).toBeVisible();
      if (wait === "draft") {
        await page.getByTestId("message-input").fill("My existing draft");
      }
      const sends: unknown[] = [];
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          /\/(send|steer|follow_up)$/.test(new URL(request.url()).pathname)
        )
          sends.push(request.postDataJSON());
      });
      // Two synchronous clicks exercise the guard before React can disable the card.
      await page
        .getByTestId("starting-goal")
        .first()
        .evaluate((element: HTMLElement) => {
          element.click();
          element.click();
        });
      await expect(page).toHaveURL(/\?conversation=pi:/);
      if (wait === "none") {
        await expect(page.getByTestId("skill-chip").first()).toBeVisible({
          timeout: 20000,
        });
        expect(sends).toHaveLength(1);
        expect(sends[0]).toMatchObject({ message: "/skill:korjaa-ongelma " });
        await expect(page.getByTestId("message-input")).toHaveValue("");
        await expect(page.getByTestId("guide-panel")).toBeVisible();
        await snapshot(page, testInfo.outputPath(`immediate-${entry}`), {
          labOrigin,
        });
        await page.reload();
        await expect(page.getByTestId("skill-chip").first()).toBeVisible({
          timeout: 20000,
        });
        expect(sends).toHaveLength(1);
      } else {
        await expect(page.getByTestId("goal-chip")).toBeVisible();
        await expect(page.getByTestId("message-input")).toHaveValue(
          wait === "draft" ? "My existing draft\n\n" : "[kuvaile havainto]",
        );
        expect(sends).toHaveLength(0);
        await expect(page.getByTestId("guide-panel")).toBeVisible();
      }
    });
  }
}

for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    test(`@lab Explain mode prepares immediate goal ${width} ${language}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route("**/workspaces/start_page?*", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        if (body.start_page?.goals?.length) {
          body.start_page.goals[0].start = "immediate";
          body.start_page.goals[0].prompt = "Investigate the repository.";
        }
        await route.fulfill({ response, json: body });
      });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      const session = await (await page.request.get("/auth/session")).json();
      for (const data of [
        { language },
        { experimental: { "explain-mode": true } },
      ])
        expect(
          (
            await page.request.put("/api/v1/account/preferences", {
              headers: {
                Origin: new URL(page.url()).origin,
                "X-Agent-Host-CSRF": session.csrf,
              },
              data,
            })
          ).ok(),
        ).toBe(true);
      await page.reload();
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-aurinkokello")
        .click();
      await expect(page).toHaveURL(/\?conversation=pi:/);
      await page.getByTestId("explain-toggle").click();
      const goal = page.getByTestId("starting-goal").first();
      await goal.hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "A02",
      );
      await snapshot(
        page,
        testInfo.outputPath(`explain-${width}-${language}`),
        { labOrigin: new URL(page.url()).origin },
      );
      const sends: string[] = [];
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          new URL(request.url()).pathname.endsWith("/send")
        )
          sends.push(request.url());
      });
      await goal.click();
      await expect(page.getByTestId("goal-chip")).toBeVisible();
      expect(sends).toEqual([]);
      await page.getByTestId("explain-stop").click();
      expect(sends).toEqual([]);
    });
  }
}
