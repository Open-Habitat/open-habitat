#!/usr/bin/env node
// The browser shell, Paneeli (issue implement-browser-shell): paired
// screenshots and inert HTML of the states the prototype round
// 2026-10-19-selainpaate shows, from the synthetic lab only. The shells are
// real tmux and bash in the lab's invented home.
// Run from the repository root with the lab started:
// PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node web/lab/capture-browser-shell.mjs
import { mkdir } from "node:fs/promises";
import { openLab, origin, snapshot } from "./session.mjs";

const out = "issues/implement-browser-shell/evidence";
await mkdir(out, { recursive: true });
const { browser, page } = await openLab();
// Routed so that the capture can cut the connection between browser and host.
let cut = false;
const sockets = [];
await page.routeWebSocket(/\/api\/v1\/workspaces\/terminal\?/, (ws) => {
  if (cut) {
    void ws.close({ code: 1011 });
    return;
  }
  ws.connectToServer();
  sockets.push(ws);
});
try {
  const fixture = async (path) => {
    const response = await page.request.get(`${origin}/fixture/${path}`);
    if (response.status() !== 204) throw Error(`${path}: ${response.status()}`);
  };
  const workspace = await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  if (!workspace) throw Error("Missing synthetic workspace");
  const id = workspace.split("/").pop();
  // Start from no shells: end whatever an earlier capture left in tmux.
  const { csrf } = await (
    await page.request.get(`${origin}/auth/session`)
  ).json();
  const list = await (
    await page.request.get(
      `${origin}/api/v1/workspaces/terminals?workspace_id=${id}`,
    )
  ).json();
  for (const s of list.shells)
    await page.request.post(`${origin}/api/v1/workspaces/terminals/close`, {
      headers: { "X-Agent-Host-CSRF": csrf, Origin: origin },
      data: { workspace_id: id, shell: s.shell },
    });
  await fixture("scenario?value=ready");
  await fixture("conversations-reset");
  await fixture("lab-conversations-clean");
  await page.goto(`${origin}${workspace}`);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Tarkista tilarivit ja aja testit");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await page.getByText("Vastaus valmis").first().waitFor();

  const panel = page.getByRole("region", { name: "Päätepaneeli" });
  const rows = page.locator(".ah-terminal-surface .xterm-rows");
  await page.getByRole("button", { name: /^Pääte/ }).click();
  await snapshot(page, `${out}/desktop-light-1-empty`);
  await panel.getByRole("button", { name: "Avaa pääte" }).click();
  await page.getByRole("dialog", { name: "Avataanko pääte?" }).waitFor();
  await snapshot(page, `${out}/desktop-light-2-first-open`);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Avaa pääte" })
    .click();
  await rows.getByText("alice@open-habitat-lab").first().waitFor();
  await page.keyboard.type("git log --oneline -4 2>/dev/null || ls\n");
  await page.waitForTimeout(500);
  // A second shell runs something long, like a dev server would.
  await panel.getByRole("button", { name: /^Uusi pääte työtilaan/ }).click();
  await rows.getByText("alice@open-habitat-lab").first().waitFor();
  await page.keyboard.type(
    'while sleep 1; do echo "$(date +%T) [watch] ok"; done\n',
  );
  await panel
    .getByRole("img", { name: /^Ajossa/ })
    .waitFor({ timeout: 10_000 });
  await panel.getByRole("tab").first().click();
  await page.waitForTimeout(800);
  await snapshot(page, `${out}/desktop-light-3-tabs`);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(400);
  await snapshot(page, `${out}/desktop-dark-3-tabs`);
  await page.emulateMedia({ colorScheme: "light" });

  // Phone: the panel covers the conversation; the key row replaces the hint.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await snapshot(page, `${out}/phone-1-panel`);
  await page.setViewportSize({ width: 1440, height: 900 });
  // tmux redraws for the wide terminal again.
  await page.waitForTimeout(1000);

  // Multi-line paste waits for a yes.
  await page.locator(".ah-terminal-surface textarea").evaluate((el) => {
    const data = new DataTransfer();
    data.setData(
      "text/plain",
      "cd web\nnpm ci\nnpm run test -- PersonalStorage\n",
    );
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await page.getByRole("group", { name: "Monirivinen liitos" }).waitFor();
  await snapshot(page, `${out}/desktop-light-4-paste`);
  await page.getByRole("button", { name: "Peruuta" }).click();

  // A selection offers Kopioi and Vie keskusteluun.
  const row = rows
    .locator("div", { hasText: /alice@open-habitat-lab/ })
    .first();
  const box = await row.boundingBox();
  if (box) {
    await page.keyboard.down("Shift");
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await page.getByRole("button", { name: "Vie keskusteluun" }).waitFor();
    await snapshot(page, `${out}/desktop-light-5-selection`);
    await page.getByRole("button", { name: "Vie keskusteluun" }).click();
    await page.waitForTimeout(300);
    await snapshot(page, `${out}/desktop-light-6-sent-to-composer`);
  }

  // A lost connection dims the terminal; the shell keeps running.
  cut = true;
  await Promise.all(sockets.map((ws) => ws.close({ code: 1011 })));
  await panel.getByText("Vain luku, kunnes yhteys palaa").waitFor();
  await snapshot(page, `${out}/desktop-light-7-connection-lost`);
} finally {
  await browser.close();
}
