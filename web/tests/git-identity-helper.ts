import { expect, type Page } from "@playwright/test";

/** Advance through the native Git confirmation before repository selection. */
export async function confirmGitIdentity(page: Page) {
  const panel = page.getByTestId("git-identity");
  await expect(panel.getByRole("heading")).toBeVisible();
  const confirm = panel
    .getByRole("button")
    .and(page.getByTestId("git-identity-confirm"));
  const action = confirm.or(
    panel.getByRole("button").and(page.getByTestId("git-identity-continue")),
  );
  await expect(action).toBeVisible();
  if (await confirm.isVisible()) {
    const session = await (await page.request.get("/auth/session")).json();
    await expect(
      panel.getByRole("combobox").and(page.getByTestId("git-email-input")),
    ).toHaveValue(session.profile.email || /@users.noreply.github.com/);
  }
  await action.click();
}
