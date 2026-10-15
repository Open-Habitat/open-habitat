// Round of 2026-10-15: where a code or output box says its language and line count.
// Jari: the caption must not sit below the box; it takes too much room for what it
// says. The directions differ only in where "python · 33 riviä" goes; the box, its
// side rail and the conversation are the library's.
export const title = 'Keskustelu · koodilohkon otsake';
export const app = true;
export const variants = [
  { name: 'Reunassa', axis: 'kieli ja rivimäärä laatikon yläreunan viivalla, ei omaa riviä', fn: 'v1' },
  { name: 'Kulmassa', axis: 'kieli ja rivimäärä himmeänä laatikon sisällä oikeassa yläkulmassa', fn: 'v2' },
  { name: 'Ei otsaketta', axis: 'kieli ja rivimäärä vain työkaluvihjeessä ja kopioinnin nimessä', fn: 'v3' },
];
