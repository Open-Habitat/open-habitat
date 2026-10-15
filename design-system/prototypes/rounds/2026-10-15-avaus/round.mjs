// Round of 2026-10-15 (Jari's prototype queue): when tool and thinking blocks are
// open or closed. Jari: closed by default; once the reader opens one, they come open
// from then on; a global "Avaa kaikki / Sulje kaikki"; after that blocks follow on
// their own. The directions differ in what "from then on" means. Density is the
// chosen Tiivis (lib/density.css).
export const title = 'Keskustelu · blokkien avaus';
export const app = true;
export const variants = [
  { name: 'Muistaa lajin', axis: 'avattu laji (bash, edit, ajattelu…) tulee jatkossa auki; suljettu laji kiinni', fn: 'v1' },
  { name: 'Vuoro kerrallaan', axis: 'avaus koskee käynnissä olevaa vuoroa; vuoron päättyessä sen blokit sulkeutuvat', fn: 'v2' },
  { name: 'Seuraa työtä', axis: 'käynnissä oleva blokki on auki ja sulkeutuu valmistuttuaan; itse avattu pysyy auki', fn: 'v3' },
];
