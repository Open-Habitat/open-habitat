// Kierros 17.10.2026: käyttäjän oma, interaktiivinen worktree-agentti (issue
// proto-interactive-worktrees; host-luonnos issues/research-worktree-agents-host/report.md,
// vaihtoehto A: Taskfleetin caller-owned-ajo ja daemonin ohjaama Pi worktreessä).
// Akseli: missä worktreen merkit ja hallinta ovat keskustelun ympärillä. Sama sisältö
// kaikissa: työtila aurinkokello, kuusi worktree-agenttia eri tiloissa (Status-skripti on
// elävä keskustelu), luonti työtilasivulta, sivupalkki ja työtilasivun kortit.
export const title = 'Worktree-agentti · merkit ja hallinta';
export const app = true;
export const recap = false;
export const strip = true;
export const variants = [
  { name: 'Yläpalkissa', axis: 'worktree on yläpalkin haaramerkki; merkki avaa kerroksen, jossa ovat haaran tiedot ja Yhdistä, Lopeta ja Hylkää', fn: 'v1' },
  { name: 'Kentän yllä', axis: 'worktree on aina näkyvä palkki kirjoituskentän yllä; Yhdistä on palkissa kentän vieressä ja palkista tulee lopputulos', fn: 'v2' },
  { name: 'Sivupaneelissa', axis: 'worktree on keskustelun oikealla puolella oma paneelinsa: haara, muutokset, agentti ja lopetus selityksineen', fn: 'v3' },
];
