import type { Page } from "@playwright/test";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// GitLab as a code host (proto-gitlab-connect) through the real gateway and
// daemon against a synthetic HTTPS GitLab with nested groups and real Git
// smart HTTP: the token goes once to the person's daemon, which writes it
// only into glab's config.yml; the projects join Uusi työtila's common list
// under their whole namespace and clone into ~/src with the native helper.
// Same-UID synthetic evidence: it proves routing, the browser/host contract
// and the native file and Git paths, not a real GitLab.

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

async function signIn(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function openForm(page: Page) {
  const tile = page.getByTestId("integration-tile-gitlab");
  await tile
    .getByRole("button")
    .and(tile.getByTestId("integration-connect-open"))
    .click();
  return page.getByRole("dialog").and(page.getByTestId("gitlab-dialog"));
}

test("@lab a GitLab connection is made from Koodipalvelut, its nested projects are cloned and it is disconnected", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const fixture = await (
    await page.request.get("/fixture/gitlab?action=enable")
  ).json();
  await signIn(page);
  await page.goto("/settings/code-hosts");
  const dialog = await openForm(page);
  const address = dialog.getByTestId("gitlab-address");
  await expect(address).toHaveValue("https://gitlab.com");
  await expect(dialog.getByTestId("gitlab-token-link")).toHaveAttribute(
    "href",
    "https://gitlab.com/-/user_settings/personal_access_tokens?name=Open+Habitat&scopes=read_api,write_repository",
  );
  await expect(dialog.getByTestId("gitlab-agent-note")).toBeVisible();
  // https:// is added on leaving the field, and the token link follows.
  await address.fill(fixture.url.replace(/^https:\/\//, ""));
  await dialog.getByTestId("gitlab-token-input").focus();
  await expect(address).toHaveValue(fixture.url);
  await expect(dialog.getByTestId("gitlab-token-link")).toHaveAttribute(
    "href",
    new RegExp(
      `^${fixture.url.replace(/[.]/g, "\\.")}/-/user_settings/personal_access_tokens`,
    ),
  );

  // An expired token is refused at the top, the fields kept.
  await dialog.getByTestId("gitlab-token-input").fill(fixture.expired_token);
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("gitlab-submit"))
    .click();
  const error = dialog
    .getByRole("alert")
    .and(dialog.getByTestId("gitlab-error"));
  await expect(error).toHaveAttribute("data-field", "token");
  await expect(error).toContainText("vanhentunut");
  await expect(error).toBeFocused();

  // A read-only token connects and says push will not work.
  await dialog.getByTestId("gitlab-token-input").fill(fixture.readonly_token);
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("gitlab-submit"))
    .click();
  await expect(dialog.getByTestId("gitlab-connected")).toHaveAttribute(
    "data-push",
    "no",
  );
  await expect(dialog.getByTestId("gitlab-readonly")).toBeVisible();
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("gitlab-done"))
    .click();
  const connection = page
    .getByRole("article")
    .and(page.getByTestId("gitlab-connection"));
  await expect(connection).toHaveAttribute("data-git", "registered");
  await expect(connection.getByTestId("gitlab-push")).toContainText(
    "Vain luku",
  );
  await expect(connection.getByTestId("gitlab-token")).toContainText(
    "voimassa 27.10.2027 asti",
  );
  const list = await (await page.request.get("/api/v1/integrations")).json();
  expect(JSON.stringify(list)).not.toContain("glpat-");
  expect(list.gitlab.connections).toHaveLength(1);
  // glab keeps one account per server: a second connect is refused here.
  await page
    .getByRole("button")
    .and(page.getByTestId("integration-add-gitlab"))
    .click();
  const again = page.getByRole("dialog").and(page.getByTestId("gitlab-dialog"));
  await again.getByTestId("gitlab-address").fill(fixture.url);
  await again.getByTestId("gitlab-token-input").fill(fixture.token);
  await again
    .getByRole("button")
    .and(again.getByTestId("gitlab-submit"))
    .click();
  await expect(again.getByTestId("gitlab-error")).toContainText(
    "yhden tilin palvelinta kohden",
  );
  await again.getByTestId("dialog-close").click();

  // The token is replaced with one that can push.
  await connection
    .getByRole("button")
    .and(connection.getByTestId("gitlab-replace"))
    .click();
  const replace = page
    .getByRole("dialog")
    .and(page.getByTestId("gitlab-dialog"));
  await replace.getByTestId("gitlab-token-input").fill(fixture.token);
  await replace
    .getByRole("button")
    .and(replace.getByTestId("gitlab-submit"))
    .click();
  await expect(replace.getByTestId("gitlab-connected")).toHaveAttribute(
    "data-push",
    "yes",
  );
  await replace
    .getByRole("button")
    .and(replace.getByTestId("gitlab-done"))
    .click();
  await expect(connection.getByTestId("gitlab-push")).toContainText(
    "Push toimii",
  );

  // An empty project is selectable and cloneable too, not a disabled action.
  await page.goto("/workspaces/new");
  await page
    .getByTestId("repository-option-konepaja/sisainen/uusi-palvelu")
    .first()
    .click();
  await expect(page.getByTestId("repository-clone")).toBeEnabled();
  if (process.env.OH_VISUAL_CAPTURE === "1") {
    await snapshot(page, "../issues/clone-empty-repo/empty-project", {
      labOrigin,
    });
  }
  await page.getByTestId("repository-clone").click();
  await expect(
    page
      .getByTestId("clone-job")
      .and(page.locator('[data-repository="konepaja/sisainen/uusi-palvelu"]')),
  ).toHaveAttribute("data-state", "confirmed", { timeout: 20000 });
  await page.reload();
  const afterEmpty = await (await page.request.get("/api/v1/snapshot")).json();
  expect(
    afterEmpty.workspaces.some(
      (workspace: { name: string }) => workspace.name === "uusi-palvelu",
    ),
  ).toBe(true);

  // Uusi työtila: each namespace is its own section, the row names the
  // project, and the details show the whole group path.
  await page.goto("/workspaces/new");
  const section = page.getByTestId("repo-owner-konepaja/verkkokauppa/infra");
  await expect(section).toHaveAttribute("data-source", "gitlab");
  await expect(section).toContainText("Aliryhmä");
  const terraform = page
    .locator("main")
    .getByRole("link")
    .and(
      page.getByTestId(
        "repository-option-konepaja/verkkokauppa/infra/terraform",
      ),
    );
  await terraform.first().click();
  await expect(page).toHaveURL(/gitlab=gitlab_[0-9a-f]{24}%2F501/);
  await expect(page.getByTestId("repo-details-group")).toHaveText(
    "konepaja › verkkokauppa › infra",
  );
  await expect(page.getByTestId("repo-details-push")).toHaveText("Toimii");
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .click();
  const job = page
    .getByRole("article")
    .and(page.getByTestId("clone-job"))
    .and(
      page.locator('[data-repository="konepaja/verkkokauppa/infra/terraform"]'),
    );
  await expect(job).toHaveAttribute("data-state", "confirmed", {
    timeout: 20000,
  });

  // A group that requires an SSO session for Git refuses the clone; the
  // card says why in fixed words.
  await page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"))
    .fill("pankki-oy");
  await page
    .locator("main")
    .getByRole("link")
    .and(page.getByTestId("repository-option-pankki-oy/digi/mobiili"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .click();
  const refused = page
    .getByRole("article")
    .and(page.getByTestId("clone-job"))
    .and(page.locator('[data-repository="pankki-oy/digi/mobiili"]'));
  await expect(refused).toHaveAttribute("data-state", "failed", {
    timeout: 20000,
  });
  await expect(refused).toContainText("SSO-istunnon");

  // Koodipalvelut names the clone by its whole path on that GitLab.
  await page.goto("/settings/code-hosts");
  const imported = page
    .getByTestId("code-host-workspace")
    .and(page.locator('[data-host="gitlab"]'))
    .filter({ hasText: "konepaja/verkkokauppa/infra/terraform" });
  await expect(imported).toContainText(
    "konepaja/verkkokauppa/infra/terraform",
    { timeout: 15000 },
  );

  // An expired token says so on the card, and the list says why GitLab's
  // projects are not shown.
  await page.request.get("/fixture/gitlab?action=expire");
  await page.reload();
  await expect(connection).toHaveAttribute("data-state", "expired");
  await page.goto("/workspaces/new");
  await expect(
    page
      .getByTestId("repository-source-note")
      .filter({ hasText: "vanhentunut" }),
  ).toBeVisible();
  await page.request.get("/fixture/gitlab?action=renew");

  // Disconnect logs glab's entry out; the clone stays.
  await page.goto("/settings/code-hosts");
  await connection
    .getByRole("button")
    .and(connection.getByTestId("gitlab-disconnect-open"))
    .click();
  const confirm = page.getByRole("alertdialog");
  await confirm
    .getByRole("button")
    .and(confirm.getByTestId("gitlab-disconnect-confirm"))
    .click();
  await expect(connection).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/integrations")).json()).gitlab
      .connections,
  ).toEqual([]);
  await expect(page.getByTestId("integration-tile-gitlab")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
