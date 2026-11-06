// Round 9 of the explain mode (proto-explain-mode-r6). Round 8's chosen riff 1
// (Kuten aina) and its "a part explains only over what it shows" are the
// mode now; round 7's state guidance and round 6's cards stay as they were and
// are read from their rounds. Round 9 shows one question as pictures: once
// the mode is on and you have pointed at other parts, how do you get back to
// the state card (the card that tells the conversation's state with its
// "Voit nyt" rows)? In every way the Selitä button opens the mode at it.
export { STATES, BLOCKED, TOGGLE } from '../2026-11-06-selitystila-kulmat/state.mjs';
import { CHANGED as CHANGED8, NEW as NEW8 } from '../2026-11-06-selitystila-kulmat/state.mjs';

export const CHANGED = CHANGED8;

// The ? card says what the ? does in each way: in A it brings the state card
// back while the mode is on, in B and C a second press ends the mode.
const [X05] = NEW8;
export const NEW = [
  { ...X05, way: 0,
    fi: { name: "Selitä", lead: "Avaa selitystilan tilakortista. Kun tila on päällä, painallus tuo tilakortin takaisin.", know: "Tila päättyy Esc:llä tai palkin Lopeta-painikkeella; ?-näppäin tekee saman kuin painike." },
    en: { name: "Explain", lead: "Opens the explain mode at the state card. While the mode is on, a press brings the state card back.", know: "Esc or the bar's Stop ends the mode; the ? key does what the button does." } },
  { ...X05, way: 1,
    fi: { name: "Selitä", lead: "Avaa selitystilan tilakortista.", know: "Toinen painallus lopettaa tilan. Tilakortin saa takaisin napsauttamalla keskustelun tyhjää kohtaa." },
    en: { name: "Explain", lead: "Opens the explain mode at the state card.", know: "A second press ends the mode. Click empty space in the conversation to bring the state card back." } },
  { ...X05, way: 2,
    fi: { name: "Selitä", lead: "Avaa selitystilan tilakortista.", know: "Toinen painallus lopettaa tilan. Tilakortin saa takaisin palkin tilanteesta ylhäältä." },
    en: { name: "Explain", lead: "Opens the explain mode at the state card.", know: "A second press ends the mode. The state in the bar at the top brings the state card back." } },
];

// The three ways back to the state card. `bar` is what the mode's bar says
// about it; C's bar names the state itself and is the button.
export const WAYS = [
  { id: "painike", fi: { label: "A Selitä-painike", line: "Selitä (?) yläpalkissa tuo tilakortin takaisin myös kesken tilan; tila päättyy Esc:llä tai Lopeta-painikkeella.", bar: "Selitä (?) tuo tilanteen takaisin." },
    en: { label: "A Explain button", bar: "Explain (?) brings the state back." } },
  { id: "tyhja", fi: { label: "B Tyhjä kohta", line: "Napsautus (puhelimella napautus) keskustelun tyhjään kohtaan tuo tilakortin; Selitä lopettaa tilan.", bar: "Napsauta keskustelun tyhjää kohtaa, niin näet tilanteen." },
    en: { label: "B Empty space", bar: "Click empty space in the conversation to see the state." } },
  { id: "palkki", fi: { label: "C Palkin tilanne", line: "Selitystilan palkki kertoo tilanteen sanoin (esim. Odottaa sinua), ja sen painallus tuo tilakortin; Selitä lopettaa tilan.", bar: "" },
    en: { label: "C The bar's state", bar: "" } },
];
