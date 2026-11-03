import { expect, type Page } from "@playwright/test";

/** The conversation has opened: the view shows the native conversation, not
 * the creation or loading state before it. The field is the same element
 * through all three, so typing and sending need not wait for this; a spec
 * that needs the conversation itself (its address, its controls) does. */
export async function openedConversation(page: Page) {
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(
    page.locator('.ah-conversation-frame[data-view="opened"]'),
  ).toBeVisible();
}
