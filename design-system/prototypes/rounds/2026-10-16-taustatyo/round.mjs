// Round of 2026-10-16 (issue proto-composer-strip, topic 2): processes and spinoffs above
// the composer on an equal footing. Built on 2026-10-16-prosessit direction 3 (Kentän yllä,
// with Poista päättyneet), 2026-10-16-prosessilohkot direction 1 (Merkintänä; the waiting
// summary reads "Odotan …") and 2026-10-16-spinoffit direction 1 (the spinoff state is shown
// above the field). The same background work in every direction: three running processes,
// one of which the agent waits on, two finished ones, and three spinoffs, one of which the
// agent waits on through `taskfleet run wait`. That wait process is never listed as a
// process; it is the spinoff's "Agentti odottaa" mark. The directions differ in how the two
// kinds share the space above the field.
export const title = 'Keskustelu · prosessit ja spinoffit kentän yllä';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Yksi palkki', axis: 'yksi Taustatyö-palkki kertoo molemmat; lista ryhmittelee tilan mukaan (Agentti odottaa, Käynnissä, Päättyneet), lajit sekaisin samalla rivillä', fn: 'v1' },
  { name: 'Kaksi palkkia', axis: 'Spinoffit- ja Prosessit-palkki päällekkäin, samannäköisinä ja samalla rivirakenteella; kumpikin avautuu omaksi listakseen', fn: 'v2' },
  { name: 'Sirut', axis: 'jokainen käynnissä oleva prosessi ja spinoff on oma siru yhdellä rivillä, odotetut ensin; siru avaa sen tiedot ja päättyneet ovat yhdessä sirussa', fn: 'v3' },
];
