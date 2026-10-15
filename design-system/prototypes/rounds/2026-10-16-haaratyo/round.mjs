// Kierros 16.10.2026: worktree-agentit Taskfleetin kautta (issue proto-worktree-agents).
// Akseli: mitä haaratyö on näkymässä. Sama sisältö kaikissa: työtila aurinkokello, kuusi
// haaratyötä kaikissa tiloissa, uuden haaratyön aloitus ja yhdistämisen tulos keskustelussa.
export const title = 'Haaratyö · worktree-agentit';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Keskusteluna', axis: 'haaratyö on keskustelu muiden joukossa; haara ja tapa ovat rivin merkkejä', fn: 'v1' },
  { name: 'Tehtävänä', axis: 'haaratyö on oma osionsa ja korttinsa; ajo, Pi ja ohjaus näkyvät erillisinä tietoina', fn: 'v2' },
  { name: 'Paikkana', axis: 'haaratyö on työtilan haara; haarat piirtyvät main-linjasta erkanevina ja siihen palaavina', fn: 'v3' },
];
