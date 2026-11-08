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

/** Drops files on the conversation as a person would. The stream is found
 * when the event is dispatched: the loading view's stream is replaced by the
 * opened view's, and an event dispatched on a stream held across that swap
 * starts on a detached node and never reaches the document, where the
 * composer takes drops. A real drop's target is always in the page. */
export async function dropFiles(
  page: Page,
  files: { name: string; bytes: Uint8Array; type?: string }[],
) {
  await page.evaluate(
    (items) => {
      const data = new DataTransfer();
      for (const file of items)
        data.items.add(
          new File([new Uint8Array(file.bytes)], file.name, {
            type: file.type,
          }),
        );
      const stream = document.querySelector(".ah-conversation-stream");
      if (!stream) throw new Error("no conversation stream to drop on");
      stream.dispatchEvent(
        new DragEvent("drop", {
          dataTransfer: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    files.map((f) => ({ ...f, bytes: Array.from(f.bytes) })),
  );
}

type HeaderPanel = "toggle-editor" | "toggle-terminal" | "guide-toggle";

/** Opens a conversation header panel. On a phone the panels leave the top bar
 * for its ⋯ menu (Alarivi, Jari 6.11.2026), so there the menu's row opens it;
 * on a desktop the header's own button does. `keyboard` reaches the control
 * with focus and Enter instead of a pointer. */
export async function openHeaderPanel(
  page: Page,
  id: HeaderPanel,
  how: "pointer" | "keyboard" = "pointer",
) {
  const phone = (page.viewportSize()?.width ?? 1280) <= 800;
  const press = async (target: ReturnType<Page["getByTestId"]>) => {
    if (how === "pointer") await target.click();
    else {
      await target.focus();
      await page.keyboard.press("Enter");
    }
  };
  if (!phone) {
    await press(page.getByRole("button").and(page.getByTestId(id)));
    return;
  }
  await press(
    page
      .locator(".ah-agent-header")
      .getByRole("button")
      .and(page.getByTestId("conversation-menu")),
  );
  await press(page.getByRole("menuitem").and(page.getByTestId(`menu-${id}`)));
}

/** The phone's ⋯ menu offers the header panel; the menu is closed again. */
export async function expectPhoneMenuPanel(page: Page, id: HeaderPanel) {
  const trigger = page
    .locator(".ah-agent-header")
    .getByRole("button")
    .and(page.getByTestId("conversation-menu"));
  await trigger.click();
  await expect(
    page.getByRole("menuitem").and(page.getByTestId(`menu-${id}`)),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();
}
