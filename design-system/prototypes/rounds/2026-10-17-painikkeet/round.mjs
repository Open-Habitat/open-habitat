// Painikkeet (ui-control-audit, 17.10.2026). The catalogue (issues/ui-control-audit/
// catalogue.html) found one shared ControlButton but many local sizes: text buttons 26–44 px,
// icon buttons in eight sizes, pills and segments each with their own CSS. The hierarchy
// (primary filled, secondary outlined, quiet tinted, danger red) and the icon+text rule
// (icon on the text's centre line with a fixed gap) are the same in every direction; the
// directions differ on one axis: how large a button is and what decides it.
export const title = 'Painikkeet · koko ja tiheys';
export const variants = [
  { name: 'Yksi koko', axis: 'kaikki tekstipainikkeet 44 px kosketuskokoa kaikkialla; nykytuotanto yhtenäistettynä', fn: 'v1' },
  { name: 'Työpöytäkoko', axis: 'työpöydällä 34 px (prototyyppikirjaston koko), puhelimessa 44 px; sama koko joka paikassa', fn: 'v2' },
  { name: 'Rooli ratkaisee', axis: 'kolme kokoa paikan mukaan: sivun päätoiminto 44, rivin ja kortin toiminto 32, rivinsisäinen 26; puhelimessa rivit 40', fn: 'v3' },
];
