// Round of 2026-10-13 (Jari's order: the other tool blocks after bash). How read, write
// and edit show what happened to a file. Today production shows the allowed arguments and
// the raw result; the edit diff was deferred. Common to all directions: the closed row
// says how much (read 34 riviä, write uusi · 34 riviä, edit +5 −1), and read and write
// open into the chosen output box with the file's language. The directions differ in how
// an edit is shown.
export const title = 'Tiedostotyökalut · read, write ja edit';
export const app = true;
export const variants = [
  { name: 'Rivit', axis: 'edit yhtenä rividiffinä: poistetut ja lisätyt rivit merkein ja värein', fn: 'v1' },
  { name: 'Rinnakkain', axis: 'edit vanha ja uusi vierekkäin, puhelimessa allekkain', fn: 'v2' },
  { name: 'Sanat', axis: 'edit rivin sisäisenä muutoksena: vain muuttuneet sanat korostettuina', fn: 'v3' },
];
