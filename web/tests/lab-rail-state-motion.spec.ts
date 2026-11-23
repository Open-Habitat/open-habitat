import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "./lab-host";
import { rewrite } from "./rail-worlds";

test("simultaneous arrivals stay calm and signal the hidden destination", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let changed = false;
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = rewrite(await response.json(), {
      yours: changed ? 13 : 10,
      running: changed ? 0 : 3,
      quiet: 15,
      workspaces: 8,
    });
    await route.fulfill({ response, json: body });
  });
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const rail = page
    .getByRole("navigation")
    .and(page.getByTestId("workspace-navigation"));
  await expect(rail).toHaveAttribute("data-ready", "");
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "rail-state-motion": true } },
      })
    ).ok(),
  ).toBe(true);
  await page.clock.install();
  await page.reload();
  await expect(
    rail.getByTestId("rail-running").locator('li[data-testid^="agent-item-"]'),
  ).toHaveCount(3);
  await expect(rail).toHaveAttribute("data-rail-motion", "");
  changed = true;
  // One snapshot delivers all three arrivals in the same render.
  const refreshed = page.waitForResponse("**/api/v1/snapshot");
  await rail.getByTestId("snapshot-refresh").click();
  await refreshed;
  await expect(
    rail.getByTestId("rail-yours").locator('li[data-testid^="agent-item-"]'),
  ).toHaveCount(13);
  const cue = rail.getByTestId("rail-beyond-below-yours");
  await expect(cue).toBeVisible();
  await expect(cue).toHaveAttribute("data-rail-hold", "");
  await expect(rail.locator("[data-rail-still], [data-rail-glow]")).toHaveCount(
    0,
  );
  await page.clock.fastForward(4100);
  await expect(cue).not.toHaveAttribute("data-rail-hold", "");
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`closed phone shows one arrival cue: ${reducedMotion}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion });
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    const session = await (await page.request.get("/auth/session")).json();
    const headers = {
      Origin: new URL(page.url()).origin,
      "X-Agent-Host-CSRF": session.csrf,
    };
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers,
          data: { experimental: { "rail-state-motion": true } },
        })
      ).ok(),
    ).toBe(true);
    await page.clock.install();
    await page.reload();
    await expect(page.getByTestId("workspace-navigation")).toHaveAttribute(
      "data-rail-motion",
      "",
    );
    const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
    const id = snapshot.agents.find(
      (agent: { archive?: string }) => agent.archive !== "archived",
    )?.agent_id;
    if (!id) throw new Error("No conversation in the phone drawer");
    // A change from elsewhere, without opening the drawer.
    expect(
      (
        await page.request.post(
          `/api/v1/conversations/${encodeURIComponent(id.slice(3))}/turn`,
          { headers, data: { mark: "raised" } },
        )
      ).ok(),
    ).toBe(true);
    const cue = page.locator(".ah-rail-flight");
    await expect(cue).toBeVisible();
    await expect(cue).toHaveCount(1);
    const animations = await cue.evaluate((el) => el.getAnimations().length);
    expect(animations).toBe(reducedMotion === "reduce" ? 0 : 1);
    await expect(page.locator(".ah-shell-body")).not.toHaveClass(
      /ah-mobile-open/,
    );
    if (process.env.OH_VISUAL_CAPTURE === "1") {
      const dir = "/var/tmp/agent-keep/rail-state-motion";
      await mkdir(dir, { recursive: true });
      await page.screenshot({ path: `${dir}/phone-${reducedMotion}.png` });
      await writeFile(
        `${dir}/phone-${reducedMotion}.html`,
        await page.content(),
      );
    }
    await page.clock.fastForward(4100);
    await expect(cue).toHaveCount(0);
    await expect(page.getByTestId("navigation-badge")).toBeVisible();
  });
}

for (const mode of ["on", "reduced", "off"] as const) {
  test(`rail state motion: ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({
      reducedMotion: mode === "reduced" ? "reduce" : "no-preference",
    });
    await page.context().addInitScript(() => {
      localStorage.setItem("nah:rail-quiet-folded", "0");
      // Pause real travel, not a fake animation, so geometry is observable
      // without racing a 620ms transition on a busy test host.
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args);
        if (this.closest('li[data-testid^="agent-item-"]')) {
          animation.pause();
          animation.currentTime = 0;
        }
        return animation;
      };
    });
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    const rail = page
      .getByRole("navigation")
      .and(page.getByTestId("workspace-navigation"));
    await expect(rail).toBeVisible();
    const session = await (await page.request.get("/auth/session")).json();
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data: { experimental: { "rail-state-motion": mode !== "off" } },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await expect(rail).toHaveAttribute("data-ready", "");
    if (mode !== "off")
      await expect(rail).toHaveAttribute("data-rail-motion", "");
    const quiet = rail
      .getByTestId("rail-quiet")
      .locator('li[data-testid^="agent-item-"]')
      .first();
    await expect(quiet).toBeVisible();
    const id = await quiet.getAttribute("data-testid");
    const link = quiet.getByTestId("agent-link");
    await quiet.hover();
    const before = await link.boundingBox();
    if (!before || !id) throw new Error("Missing source row geometry");
    expect(
      await rail.evaluate(
        (el) =>
          el
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "paused").length,
      ),
    ).toBe(0);
    await quiet.getByTestId("rail-raise-conversation").click();
    const arrived = rail.getByTestId("rail-yours").getByTestId(id);
    await expect(arrived).toBeVisible();
    if (mode === "on") {
      await expect
        .poll(() =>
          arrived.evaluate(
            (el) =>
              el
                .getAnimations({ subtree: true })
                .filter((a) => a.playState === "paused").length,
          ),
        )
        .toBeGreaterThan(0);
      const atStart = await arrived.getByTestId("agent-link").boundingBox();
      if (!atStart) throw new Error("Missing moving row");
      expect(Math.abs(atStart.y - before.y)).toBeLessThan(3);
      if (process.env.OH_VISUAL_CAPTURE === "1") {
        await rail.evaluate((el) => {
          for (const a of el.getAnimations({ subtree: true }))
            if (a.playState === "paused")
              a.currentTime = Number(a.effect?.getTiming().duration) / 2;
        });
        const dir = "/var/tmp/agent-keep/rail-state-motion";
        await mkdir(dir, { recursive: true });
        await page.screenshot({ path: `${dir}/mid-travel.png` });
        await writeFile(`${dir}/mid-travel.html`, await page.content());
      }
      await rail.evaluate((el) => {
        for (const a of el.getAnimations({ subtree: true }))
          if (a.playState === "paused") a.finish();
      });
      const atEnd = await arrived.getByTestId("agent-link").boundingBox();
      if (!atEnd) throw new Error("Missing destination row");
      expect(atEnd.y).toBeLessThan(before.y - 10);
    } else {
      expect(
        await arrived.evaluate(
          (el) => el.getAnimations({ subtree: true }).length,
        ),
      ).toBe(0);
      await expect(arrived.locator("[data-rail-still]")).toHaveCount(
        mode === "reduced" ? 1 : 0,
      );
      if (mode === "reduced") {
        expect(
          await arrived
            .locator("[data-rail-still]")
            .evaluate((el) => getComputedStyle(el).boxShadow),
        ).not.toBe("none");
      }
    }
    if (process.env.OH_VISUAL_CAPTURE === "1") {
      const dir = "/var/tmp/agent-keep/rail-state-motion";
      await mkdir(dir, { recursive: true });
      await page.screenshot({ path: `${dir}/${mode}.png` });
      await writeFile(`${dir}/${mode}.html`, await page.content());
    }
    // An initial view (including a refresh) never replays old changes.
    await page.reload();
    await expect(rail).toHaveAttribute("data-ready", "");
    expect(
      await rail.evaluate(
        (el) =>
          el.querySelectorAll("[data-rail-still], [data-rail-glow]").length,
      ),
    ).toBe(0);
    expect(
      await rail.evaluate(
        (el) =>
          el
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "paused").length,
      ),
    ).toBe(0);
  });
}
