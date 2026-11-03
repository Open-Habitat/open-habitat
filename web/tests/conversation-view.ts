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
