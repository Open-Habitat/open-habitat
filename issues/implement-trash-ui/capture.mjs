// Paired lab captures for implement-trash-ui. Run from the repository root
// against a freshly started synthetic lab (scripts/lab.sh start).
import { openLab, origin, snapshot } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';

const out = (tag, name) => `issues/implement-trash-ui/lab-${tag}-${name}`;
const dialog = (page) => page.getByRole('dialog');

async function api(page, body) {
  const { csrf } = await (await page.request.get(`${origin}/auth/session`)).json();
  return page.evaluate(async ([body, csrf]) => {
    const r = await fetch('/api/v1/workspaces', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Agent-Host-CSRF': csrf }, body: JSON.stringify(body) });
    return r.json();
  }, [body, csrf]);
}
async function workspace(page, name) {
  const snap = await (await page.request.get(`${origin}/api/v1/snapshot`)).json();
  return snap.workspaces.find((w) => w.name === name);
}
async function open(page, name) {
  const w = await workspace(page, name);
  await page.goto(`${origin}/workspaces/${w.workspace_id}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

// One-time setup: an answering Taskfleet, a busy process, a clean pushed
// clone, and two workspaces already in the Trash.
{
  const { page, browser } = await openLab();
  for (const path of ['/fixture/taskfleet?status=empty', '/fixture/busy-process?name=reseptikirja', '/fixture/pushed-clone?name=kokeilu-wasm', '/fixture/pushed-clone?name=vanha-demo'])
    if ((await page.request.get(origin + path)).status() !== 204) throw new Error(path);
  for (const name of ['muistiinpanot', 'vanha-demo']) {
    const w = await workspace(page, name);
    const r = await api(page, { action: 'delete', workspace_id: w.workspace_id, observation_token: w.observation_token, disposal: 'trash' });
    if (r.state !== 'trashed') throw new Error(JSON.stringify(r));
  }
  await browser.close();
}

for (const narrow of [false, true]) for (const dark of [false, true]) {
  const tag = `${narrow ? 'phone' : 'desktop'}-${dark ? 'dark' : 'light'}`;
  const { page, browser } = await openLab({ width: narrow ? 390 : 1440, height: narrow ? 844 : 900 });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  const del = () => page.getByRole('button', { name: 'Poista työtila…' }).click();
  const cancel = async (name) => { await dialog(page).getByRole('button', { name }).click(); await expect(dialog(page)).toHaveCount(0); };

  await open(page, 'reseptikirja');
  await del();
  await expect(dialog(page)).toContainText('sleep');
  await snapshot(page, out(tag, 'blocked'));
  await cancel('Sulje');

  await open(page, 'aurinkokello');
  await del();
  await expect(dialog(page).getByRole('button', { name: 'Siirrä roskakoriin' })).toBeVisible();
  await snapshot(page, out(tag, 'to-trash'));
  await cancel('Peruuta');

  await open(page, 'kokeilu-wasm');
  await del();
  await expect(dialog(page).getByRole('button', { name: 'Poista pysyvästi' })).toBeVisible();
  await snapshot(page, out(tag, 'permanent'));
  await cancel('Peruuta');

  await open(page, 'tilastoharjoitus');
  await del();
  await dialog(page).getByRole('button', { name: 'Siirrä roskakoriin' }).click();
  const notice = page.locator('.ah-archive-notice');
  await expect(notice).toContainText('Siirretty roskakoriin');
  await snapshot(page, out(tag, 'moved-notice'));
  await notice.getByRole('button', { name: 'Palauta' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'tilastoharjoitus' })).toBeVisible();

  await page.goto(`${origin}/settings#tallennustila`);
  await expect(page.getByRole('list', { name: 'Roskakori' }).getByText('kaikki etärepossa')).toBeVisible();
  await snapshot(page, out(tag, 'storage-trash'));
  await browser.close();
}
