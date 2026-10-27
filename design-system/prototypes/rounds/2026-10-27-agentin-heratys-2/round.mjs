export const title = 'Pysähtyneen agentin herätys · kierros 2';
export const app = true;
export const recap = false;
export const strip = true;
export const variants = [
  {name: 'Kortti', axis: 'Hostin selostus langan lopun korttina; kirjoittaminen herättää, kortti jää langan merkinnäksi', fn: 'wkCard'},
  {name: 'Aikajana', axis: 'Hostin selostus langassa tapahtumina omilla kellonajoillaan; kirjoittaminen herättää', fn: 'wkTime'},
  {name: 'Liitteenä', axis: 'Hostin selostus kentän liitteinä, jotka lähtevät agentille seuraavan viestin mukana', fn: 'wkAttach'},
];
