// Workspace page and the workspace "+" layer (proto-workspace-page, 16.10.2026).
// One axis: how much weight Git state gets on the page. The content is the same in
// every direction (open conversations with their recaps, worktree agents, finished,
// archive, branch, changed files, sync with origin, recent commits), and the "+"
// layer is the same component everywhere: in the top bar, on the sidebar row and on
// the phone as a bottom sheet.
export const title = 'Työtilasivu ja +-valikko';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Keskustelut edellä', axis: 'Git on yksi rivi otsakkeessa ja avautuu kerrokseen; sivu on keskustelujen katsaukset', fn: 'v1' },
  { name: 'Git rinnalla', axis: 'työlista vasemmalla, Git ja työtilan tiedot omana palstanaan oikealla', fn: 'v2' },
  { name: 'Haaroittain', axis: 'sivu jäsentyy checkouteittain: main ja jokainen worktree omana osionaan työnsä kanssa', fn: 'v3' },
];
