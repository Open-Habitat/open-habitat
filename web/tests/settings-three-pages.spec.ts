import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Asetukset › Tekoäly, Koodipalvelut and Tiedot agenteille replace Agentit,
// Yhteydet and Integraatiot (proto-integration-grouping, Kolme sivua). A link
// from elsewhere names a page and a row; the row is where it lands.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  // Jari reviews the screenshots; 1x evidence was blurry.
  deviceScaleFactor: 2,
});

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
}

/** The synthetic workspaces as clones of a GitHub and a Gitea repository. */
async function hostedWorkspaces(page: Page, gitea: string) {
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const [first, second] = body.workspaces ?? [];
    if (first) {
      first.git_summary = {
        ...(first.git_summary ?? { branch: "main", dirty_count: 0 }),
        github_repo: "alice-demo/git-project",
      };
    }
    if (second)
      second.gitea_origin = {
        base_url: gitea,
        full_name: `alice/${second.name}`,
      };
    await route.fulfill({ response, json: body });
  });
}

test("the three pages replace the old ones and each holds its own accounts", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings");
  const nav = page.getByTestId("settings-navigation");
  for (const old of ["agentti", "yhteydet", "integraatiot"])
    await expect(nav.getByTestId(`settings-${old}`)).toHaveCount(0);
  await nav.getByRole("link").and(page.getByTestId("settings-tekoaly")).click();
  await expect(page).toHaveURL(/\/settings\/ai$/);
  await expect(page.getByTestId("openai-credential-state")).toBeVisible();
  await expect(
    page.getByRole("region").and(page.getByTestId("claude-sign-in")),
  ).toBeVisible();
  await expect(page.getByTestId("api-key-add-open")).toBeVisible();
  await expect(page.getByTestId("github-native-state")).toHaveCount(0);
  await nav
    .getByRole("link")
    .and(page.getByTestId("settings-koodipalvelut"))
    .click();
  await expect(page).toHaveURL(/\/settings\/code-hosts$/);
  await expect(page.getByTestId("github-native-state")).toBeVisible();
  await expect(page.getByTestId("openai-credential-state")).toHaveCount(0);
  await nav.getByRole("link").and(page.getByTestId("settings-tiedot")).click();
  await expect(page).toHaveURL(/\/settings\/agent-data$/);
  await expect(page.getByTestId("integrations-loading")).toHaveCount(0);
  await expect(page.getByTestId("integration-tile-google")).toBeVisible();
  // Gitea is a code host, not a data source for agents.
  await expect(page.getByTestId("integration-tile-gitea")).toHaveCount(0);
});

test("an API key is added through the provider dialog and the wrong provider's key is not accepted", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/ai");
  await page
    .getByRole("button")
    .and(page.getByTestId("api-key-add-open"))
    .click();
  const dialog = page
    .getByRole("dialog")
    .and(page.getByTestId("api-key-dialog"));
  await expect(dialog.getByTestId("api-key-input")).toHaveCount(0);
  await dialog
    .getByRole("button")
    .and(page.getByTestId("api-key-provider-anthropic"))
    .click();
  // An OpenAI key in Anthropic's slot would be billed to the wrong account.
  await dialog.getByTestId("api-key-input").fill(`sk-${"o".repeat(24)}abcd`);
  await expect(
    dialog.getByRole("button").and(page.getByTestId("api-key-save")),
  ).toBeDisabled();
  await dialog
    .getByRole("button")
    .and(page.getByTestId("api-key-provider-openai"))
    .click();
  // Switching provider never carries a typed key over.
  await expect(dialog.getByTestId("api-key-input")).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button").and(page.getByTestId("api-key-add-open")),
  ).toBeFocused();
});

test("links from the model selector and the new-workspace page land on their row", async ({
  page,
}, testInfo) => {
  await page.request.get("/fixture/gitea?action=enable");
  await signIn(page);
  // The model selector's "Muuta oletusmallia" points here (its href is
  // checked in lab-picker-declutter); a full load of the link lands too.
  await page.goto("/settings/ai#default-model");
  const model = page.locator('[data-settings-row="default-model"]');
  await expect(model).toBeFocused();
  await expect(model).toBeInViewport();

  // The new-workspace page's failed Gitea list links to the Gitea row.
  await page.route("**/api/v1/integrations/gitea/repos", (route) =>
    route.fulfill({ status: 503, body: "" }),
  );
  await page.goto("/workspaces/new");
  const fix = page
    .getByRole("link")
    .and(page.getByTestId("repository-source-fix"));
  await expect(fix).toHaveAttribute("href", "/settings/code-hosts#gitea");
  await fix.click();
  await expect(page).toHaveURL(/\/settings\/code-hosts#gitea$/);
  const gitea = page.locator('[data-settings-row="gitea"]');
  await expect(gitea).toBeFocused();
  await expect(gitea.getByTestId("integration-tile-gitea")).toBeVisible();
  await expect(gitea).toHaveAttribute("data-landed", "");
  await page.screenshot({
    path: testInfo.outputPath("evidence/koodipalvelut-landed-gitea.png"),
  });
});

test("Koodipalvelut lists the workspaces each code host serves", async ({
  page,
}) => {
  await hostedWorkspaces(page, "https://gitea.example.test");
  await signIn(page);
  await page.goto("/settings/code-hosts");
  const rows = page.getByTestId("code-host-workspace");
  await expect(rows.and(page.locator('[data-host="github"]'))).toHaveCount(1);
  await expect(rows.and(page.locator('[data-host="gitea"]'))).toHaveCount(1);
  await page
    .getByRole("button")
    .and(page.getByTestId("code-host-new-workspace"))
    .click();
  await expect(page).toHaveURL(/\/workspaces\/new$/);
});

test("@a11y the three pages have no axe violations, light and dark, desktop and phone", async ({
  page,
}, testInfo) => {
  const { url, token } = await (
    await page.request.get("/fixture/gitea?action=enable")
  ).json();
  await hostedWorkspaces(page, url);
  await signIn(page);
  // One own key so the key list has a row; Gitea connected for its card.
  await page.goto("/settings/ai");
  await page
    .getByRole("button")
    .and(page.getByTestId("api-key-add-open"))
    .click();
  const dialog = page
    .getByRole("dialog")
    .and(page.getByTestId("api-key-dialog"));
  await dialog
    .getByRole("button")
    .and(page.getByTestId("api-key-provider-openai"))
    .click();
  await dialog.getByTestId("api-key-input").fill(`sk-${"s".repeat(24)}abcd`);
  await page.screenshot({
    path: testInfo.outputPath("evidence/tekoaly-add-key-desktop-light.png"),
  });
  await dialog
    .getByRole("button")
    .and(page.getByTestId("api-key-save"))
    .click();
  await expect(page.getByTestId("api-key-row-openai")).toBeVisible();
  await page.goto("/settings/code-hosts");
  await page
    .getByTestId("integration-tile-gitea")
    .getByRole("button")
    .and(page.getByTestId("integration-connect-open"))
    .click();
  const gitea = page.getByRole("dialog").and(page.getByTestId("gitea-dialog"));
  await gitea.getByTestId("gitea-address").fill(url);
  await gitea.getByTestId("gitea-token").fill(token);
  await gitea
    .getByRole("button")
    .and(gitea.getByTestId("gitea-submit"))
    .click();
  await gitea.getByRole("button").and(gitea.getByTestId("gitea-done")).click();
  await expect(page.getByTestId("gitea-connection")).toBeVisible();

  for (const [width, height, device] of [
    // The shell scrolls inside its main pane; a tall viewport shows the
    // whole page in one screenshot.
    [1280, 2300, "desktop"],
    [390, 2600, "phone"],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const colorScheme of ["light", "dark"] as const) {
      // Reduced motion: the theme switch must not be measured mid-transition.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      for (const [path, name] of [
        ["/settings/ai", "tekoaly"],
        ["/settings/code-hosts", "koodipalvelut"],
        ["/settings/agent-data", "tiedot"],
      ] as const) {
        await page.goto(path);
        await expect(
          page.getByTestId(`settings-section-${name}`),
        ).toBeVisible();
        await expect(page.getByTestId("integrations-loading")).toHaveCount(0);
        if (name === "tekoaly")
          await expect(
            page.getByTestId("openai-credential-state"),
          ).toHaveAttribute("data-state", /^(signed_in|api_key|missing)$/);
        expect(
          (
            await new AxeBuilder({ page })
              .include(".ah-account-settings")
              .analyze()
          ).violations,
          `${name} ${device} ${colorScheme}`,
        ).toEqual([]);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
          `${name} ${device} fits`,
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(
            `evidence/${name}-${device}-${colorScheme}.png`,
          ),
          fullPage: true,
        });
      }
    }
  }
});
