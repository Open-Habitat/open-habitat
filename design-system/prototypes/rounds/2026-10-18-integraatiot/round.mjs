// Integraatiot (proto-integrations, 18.10.2026). Asetukset › Integraatiot: Google (Drive,
// Gmail, kalenteri), Microsoft 365 (OneDrive ja SharePoint, Outlook-posti ja -kalenteri) ja
// Dropbox. Kirjautuminen kulkee selaimen kautta (Google ja Dropbox: paluuosoite liitetään,
// Microsoft: laitekoodi), tila luetaan työkaluilta, synkronoidut kansiot näkyvät kiintiötä
// vasten, varoitus agenttien pääsystä on kaikissa, ja liitoksen voi poistaa. Sisältö ja
// kirjautumisvaiheet ovat samat kaikissa suunnissa; suunnat eroavat siinä, mikä on yksi liitos.
export const title = 'Asetukset · integraatiot';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Tili', axis: 'yksi liitos on palveluntarjoajan tili: Google-tili kerralla Driveineen, Gmaileineen ja kalentereineen, poisto koko tilille; kirjautuminen dialogissa', fn: 'v1' },
  { name: 'Palvelu', axis: 'yksi liitos on yksittäinen palvelu: kuusi riviä tarjoajittain, jokainen yhdistetään ja poistetaan erikseen; kirjautuminen avautuu rivin alle', fn: 'v2' },
  { name: 'Mitä agentti saa', axis: 'yksi liitos on se, mitä agentti saa: kansio kotihakemistossa kiintiön rinnalla tai posti ja kalenteri työkaluna; kirjautuminen sivupaneelissa', fn: 'v3' },
];
