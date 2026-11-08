import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// The composer in English (en-composer): an English browser on System sees
// the field, its row, the command list, the picker and a `!` command in
// English. The rest of the composer's behaviour is proven in Finnish by the
// other composer specs.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  locale: "en-GB",
});

async function newConversation(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "ordinary-dir",
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  return page.getByTestId("message-input");
}

test("@composer-english the composer speaks English to an English browser", async ({
  page,
}) => {
  const field = await newConversation(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-GB");
  await expect(field).toHaveAttribute("aria-label", "Message to the agent");
  await expect(page.getByTestId("attach-file")).toHaveAccessibleName(
    "Add an attachment",
  );
  await expect(page.getByTestId("command-palette")).toHaveText("Commands");
  await expect(page.getByTestId("file-picker")).toHaveText("File");

  await field.fill("Hello");
  await expect(page.getByTestId("send")).toHaveAccessibleName("Send");

  // The command list opened from the field.
  await field.fill("/");
  await expect(page.locator(".ah-choice-head")).toHaveText(
    "Commands and skills",
  );
  await field.press("Escape");

  // The file list opens inside the field without a preference.
  await field.fill("");
  await field.press("ControlOrMeta+p");
  const list = page.getByTestId("composer-field-list");
  await expect(list).toBeVisible();
  await expect(field).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);

  // A `!` command.
  await field.fill("!ls");
  await expect(page.getByTestId("command-mode")).toContainText("Command in");
  await expect(page.getByTestId("command-context")).toHaveText(
    "The agent sees the output",
  );
  await expect(page.getByTestId("send")).toHaveAccessibleName("Run");
  await field.fill("!!ls");
  await expect(page.getByTestId("command-context")).toHaveText(
    "only for you, not the agent",
  );
});
