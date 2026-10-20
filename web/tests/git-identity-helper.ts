import { expect, type Page } from "@playwright/test";

/** Advance through the native Git confirmation before repository selection. */
export async function confirmGitIdentity(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Git-identiteetti", level: 1 }),
  ).toBeVisible();
  const action = page.getByRole("button", {
    name: /Vahvista Git-identiteetti|Jatka repoihin/,
  });
  await expect(action).toBeVisible();
  if (
    await page
      .getByRole("button", { name: "Vahvista Git-identiteetti" })
      .isVisible()
  ) {
    const session = await (await page.request.get("/auth/session")).json();
    await expect(
      page.getByRole("combobox", { name: /sähköposti/ }),
    ).toHaveValue(session.profile.email || /@users.noreply.github.com/);
  }
  await action.click();
}
