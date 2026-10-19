// Editorin tila (proto-file-viewing-2, 19.10.2026). Jari valitsi Editorin, mutta editorilla oli
// liian vähän tilaa. Sisältö, linkkien tunnistus ja VS Code -sijainen ovat edellisen kierroksen;
// suunnat eroavat vain siinä, miten editori ja keskustelu jakavat ikkunan. Puhelimessa linkki
// avaa kaikissa suunnissa lukukurkistuksen, koska VS Code ei toimi puhelimessa.
export const title = 'Editorin tila';
export const app = true;
export const variants = [
  { name: 'Rinnakkain', axis: 'editori ja keskustelu jakavat ikkunan: editori vasemmalla, keskustelu oikealla palstana, jonka leveyden voi vetää ja joka muistetaan; palstan voi piilottaa reunaliuskaksi', fn: 'v1' },
  { name: 'Laatikko', axis: 'editori täyttää koko ikkunan; keskustelu on laatikko, joka liukuu editorin päälle yhdellä näppäilyllä ja palaa samaan lukukohtaan', fn: 'v2' },
  { name: 'Oma välilehti', axis: 'editori on omassa selainvälilehdessään omassa originissaan; sovellus pysyy keskusteluna, ja linkki vie editorivälilehdelle riville', fn: 'v3' },
];
