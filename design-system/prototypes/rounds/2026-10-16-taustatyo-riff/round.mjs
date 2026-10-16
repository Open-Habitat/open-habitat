// Round of 2026-10-16 (issue proto-background-strip-riff): a riff on 2026-10-16-taustatyo
// direction Yksi palkki, which Jari chose as the base but found far too busy ("infoähky"),
// and in which spinoffs and processes did not read as separate things. The same background
// work in every direction: two running spinoffs (the agent waits on one through
// `taskfleet run wait`), one merged and one failed with its work saved; three running
// processes (the agent waits on one), one finished and one failed. The directions differ in
// how little the strip says at rest while keeping the two kinds visibly apart; open, every
// direction shows the same quiet list, one kind at a time.
export const title = 'Keskustelu · taustatyö hiljaisena palkkina';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Kaksi lokeroa', axis: 'yksi palkki jaettu kahteen nimettyyn lokeroon, Spinoffit ja Prosessit; levossa vain käynnissä olevien määrä ja merkit (odotus, huomio); lokero avaa oman listansa', fn: 'v1' },
  { name: 'Rivi lajille', axis: 'kaksi matalaa riviä, yksi kummallekin lajille; rivi kertoo vain lajinsa tärkeimmän asian (Odotan …, huomio tai määrä); rivi avaa oman listansa', fn: 'v2' },
  { name: 'Merkit', axis: 'kaksi pientä kuvake–luku-merkkiä ilman tekstiä; odotus ja huomio pisteinä merkin kulmassa; merkki avaa paneelin, jossa lajit ovat välilehtinä', fn: 'v3' },
];
