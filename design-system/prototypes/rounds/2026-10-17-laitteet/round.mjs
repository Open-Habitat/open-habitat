// Kirjaudu puhelimella ja istuntolista (proto-trash-and-devices, 17.10.2026). ADR 0018:
// kirjautunut tietokone näyttää minuutin QR-koodin, puhelin vahvistaa "Kirjaudu nimellä …?",
// tietokone näkee, mikä laite koodia käytti, ja Asetukset listaa omat istunnot uloskirjausta
// varten. QR-paneeli, puhelimen sivu ja istuntorivi ovat samat kaikissa suunnissa; suunnat
// eroavat siinä, kuinka lähellä koodi on.
export const title = 'Kirjaudu puhelimella';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Tilin rivi', axis: 'Asetukset › Tili: rivi "Kirjaudu puhelimella" avaa koodin dialogiin, ja kirjautuneet laitteet ovat saman osion lopussa', fn: 'v1' },
  { name: 'Laitteet-osio', axis: 'Asetuksissa oma Laitteet-osio: koodi aukeaa sivulle kortin sisään, ja uusi laite ilmestyy suoraan alla olevaan listaan', fn: 'v2' },
  { name: 'Tilivalikosta', axis: 'tilivalikon "Kirjaudu puhelimella" näyttää koodin heti sivupalkin päällä käymättä Asetuksissa; Asetuksissa vain laitelista', fn: 'v3' },
];
