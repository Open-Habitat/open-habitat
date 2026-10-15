// Round of 2026-10-15 (Jari): for ordinary users and by default, the agent's work
// happens out of sight. The whole thread stays closed and a single information row
// tells that the agent is working; the answer appears below it. The account menu
// switches the work to visible ("säikeet kiinni" behaviour) for those who want it.
export const title = 'Keskustelu · hiljainen työ';
export const app = true;
export const variants = [
  { name: 'Hiljainen', axis: 'säie aina kiinni, yksi inforivi työn ajan, vastaus näkyviin', fn: 'v1' },
];
