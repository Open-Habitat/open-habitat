// Round 1 of 2026-10-13 (issue conversation-actions-layout): where the
// conversation's own actions live — new title, archive and details. The
// sidebar with one-row conversations and the workspace "+" is shared context
// in every direction, so it can be commented on at the same time.
export const title = 'Keskustelun yläpalkki · toiminnot';
export const variants = [
  { name: 'Ikonirivi', axis: 'kaikki toiminnot näkyvinä ikoneina oikeassa reunassa', fn: 'v1' },
  { name: 'Valikko', axis: 'yksi ⋯-valikko kokoaa harvinaiset toiminnot', fn: 'v2' },
  { name: 'Tietopaneeli', axis: 'otsikon päivitys otsikossa, arkistointi tietopaneelissa', fn: 'v3' },
];
