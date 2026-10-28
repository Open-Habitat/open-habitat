// Markdownin koko näkymän esikatselu (proto-markdown-full-preview-button, 28.10.2026). Jari
// haluaa Cmd+Shift+V:n avaaman esikatselun tekstin tilalle juuri sellaisenaan, nopeamman
// näppäimen Cmd+K V:n tilalle ja oman painikkeen koko näkymän esikatselulle. Sisältö ja
// näppäimet ovat samat kaikissa suunnissa: pitkä synteettinen suunnitelma, ⌘⇧V koko näkymään,
// ⌘⌥V rinnakkain, Esc takaisin tekstiin ja paluu samaan kohtaan dokumenttia. Suunnat eroavat
// siinä, minkä muotoinen ohjain koko näkymän esikatselulla on.
export const title = 'Markdownin esikatselu · koko näkymän ohjain';
export const variants = [
  { name: 'Painike', axis: 'työkalurivillä kaksi painiketta: Esikatselu avaa koko näkymän, kuvake rinnakkaisen', fn: 'mdTwo' },
  { name: 'Valitsin', axis: 'työkalurivillä yksi valitsin Teksti · Rinnakkain · Esikatselu, joka näyttää tilan aina', fn: 'mdSeg' },
  { name: 'Kelluva', axis: 'työkalurivi ennallaan ilman esikatselua; dokumentin kulmassa kelluva Esikatselu ⇄ Muokkaa', fn: 'mdFloat' },
];
