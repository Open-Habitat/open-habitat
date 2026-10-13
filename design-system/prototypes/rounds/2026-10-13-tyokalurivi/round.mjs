// Riff of 2026-10-13 (issue conversation-actions-layout) on the chosen tool-row
// composer: how the row of stop, mode and send separates from the writing area.
export const title = 'Alakerta · työkalurivin erottuminen';
export const app = true;
export const composer = false; // draws its own composer
export const variants = [
  { name: 'Jakoviiva', axis: 'ohut viiva laatikon sisällä tekstin ja rivin välissä', fn: 'v1' },
  { name: 'Alapalkki', axis: 'rivi on laatikon sävytetty alaosa', fn: 'v2' },
  { name: 'Kentän alla', axis: 'laatikossa on vain teksti, rivi sen alla laatikon ulkopuolella', fn: 'v3' },
];
