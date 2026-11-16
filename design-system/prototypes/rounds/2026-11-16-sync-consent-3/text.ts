// The round's own words, Finnish and English. Production's components keep
// their own catalogs and follow the same language switch.
export type Lang = 'fi' | 'en';

export type Counts = {changed: number; added: number; deleted: number};
/** changed: bisync's all-files-changed stop; deletes: its too-many-deletions stop. */
export type StopKind = 'changed' | 'deletes';
export type Dry = {stop: StopKind; up: Counts; down: Counts; total: number};

const n = (v: number) => v.toLocaleString('fi-FI');
const ne = (v: number) => v.toLocaleString('en-GB');
const join = (xs: string[], and: string) => xs.filter(Boolean).join(', ').replace(/, ([^,]*)$/, ` ${and} $1`);

function fiParts(d: Dry): string[] {
  const {up, down, total} = d;
  const parts: string[] = [];
  if (up.changed || up.added) parts.push(`vie OneDriveen ${join([up.changed ? `${n(up.changed)} muuttunutta` : '', up.added ? `${n(up.added)} uutta` : ''], 'ja')} tiedostoa`);
  if (down.changed || down.added) parts.push(`tuo OneDrivesta ${join([down.changed ? `${n(down.changed)} muuttunutta` : '', down.added ? `${n(down.added)} uutta` : ''], 'ja')}`);
  if (up.deleted) parts.push(`poistaa OneDrivesta ${n(up.deleted)} tiedostoa ${n(total)}:sta`);
  if (down.deleted) parts.push(`poistaa Habitatista ${n(down.deleted)} tiedostoa`);
  return parts;
}
function enParts(d: Dry): string[] {
  const {up, down, total} = d;
  const parts: string[] = [];
  if (up.changed || up.added) parts.push(`send ${join([up.changed ? `${ne(up.changed)} changed` : '', up.added ? `${ne(up.added)} new` : ''], 'and')} files to OneDrive`);
  if (down.changed || down.added) parts.push(`bring ${join([down.changed ? `${ne(down.changed)} changed` : '', down.added ? `${ne(down.added)} new` : ''], 'and')} from OneDrive`);
  if (up.deleted) parts.push(`delete ${ne(up.deleted)} of ${ne(total)} files from OneDrive`);
  if (down.deleted) parts.push(`delete ${ne(down.deleted)} files from Habitat`);
  return parts;
}
const dels = (d: Dry) => d.up.deleted + d.down.deleted;

const fi = {
  // Review chrome
  title: 'Synkronoinnin pysähdys ja lupa · kierros 3',
  scenario: 'Tilanne',
  data: 'Pysähdys',
  dataFew: 'Kaikki muuttuivat, ei poistoja',
  dataMixed: 'Kaikki muuttuivat, 3 poistoa',
  dataMoved: 'Liikaa poistoja (212 siirrettyä)',
  origin: 'Kortin tuo',
  originHabitat: 'Habitat itse',
  originAgent: 'Agentti komennolla',
  originYes: 'Agentti, ihminen vastasi kyllä',
  q4: 'Kysymys 4',
  q4Safe: 'Ajo ei voi poistaa (suositus)',
  q4Open: 'Ajo voi poistaa (nykyinen)',
  theme: 'Teema', light: 'Vaalea', dark: 'Tumma',
  language: 'Kieli',
  reset: 'Alusta',
  simulate: 'Simuloi: tiedosto muuttuu laskelman jälkeen',
  simulated: 'Tiedosto muuttui laskelman jälkeen. Jatka nyt, niin Habitat ei tee mitään.',
  slipSimulate: 'Simuloi: pilvessä poistetaan 150 juuri ennen ajoa',
  slipSimulated: 'OneDrivessa poistetaan 150 tiedostoa juuri, kun ajo alkaa (laskelman tarkistuksen jälkeen). Jatka nyt ja katso, mitä Kysymys 4 -valinta muuttaa.',
  scenarios: {
    pysahtyi: 'Pysähtyi, odottaa päätöstä (oletus)',
    lasketaan: 'Lasketaan, mitä jatkaminen tekisi',
    laskettu: 'Laskelma valmis',
    kaynnissa: 'Jatketaan kerran',
    valmis: 'Jatkettu, kortti kuitattu',
    peruttu: 'Ei jatkettu (Älä jatka)',
    torjuttu: 'Ei tehty: tiedostot muuttuivat laskelman jälkeen',
    epaonnistui: 'Jatkaminen epäonnistui',
    livahti: 'Kysymys 4: pilvessä poistettiin 150 juuri ennen ajoa',
    muualla: 'Toinen keskustelu auki',
    eikeskustelua: 'Mikään keskustelu ei aiheuttanut (kello)',
  } as Record<string, string>,
  roundLine: 'Jarin päätös: Habitatin oma kortti keskustelussa heti sen vuoron jälkeen, jonka muutokset pysäyttivät synkronoinnin. Lupa annetaan vain kortin painikkeella ja se koskee näytettyä laskelmaa. Agentti voi tuoda saman kortin komennolla, mutta ei anna lupaa. Tämä kierros: millainen kortti on.',
  lines: [
    'A Pyynnöstä: kortti kertoo pysähdyksen ja syyn. Laskelma tehdään vasta, kun ihminen pyytää. Valmis kortti tiivistyy kuittausriviksi, jonka voi avata.',
    'B Valmiina: kortti tulee laskelman kanssa. Yksi lause ja painike, joka nimeää teon. Erittely on avattavissa. Muuttunut tilanne lasketaan itse uudelleen. Valmis kortti on yksi rivi.',
    'C Nimeltä: laskelma pyynnöstä, ja se näyttää tiedostot nimeltä ryhmittäin, ei vain määriä. Valmis kortti on kuittausrivi, jonka tiedostolistan voi avata.',
  ],
  recommend: 'Suositus: B. Kortti kertoo heti ratkaisevan asian, poistaako jatkaminen jotain, ja lupa on yksi painallus, joka sanoo mitä tapahtuu. Laskelma tarkistetaan silti ennen ajoa, joten vanha laskelma ei voi päästää mitään läpi. A vaatii kaksi painallusta ilman lisäturvaa. C:n nimilista auttaa tunnistamaan muutokset, mutta 212 nimeä on luettelo eikä päätöksen tuki. B:n erittelyyn voi lisätä C:n nimet.',
  presetsLabel: 'Näytä',
  presets: [
    ['Kortti', 'Habitatin kortti heti sen vuoron jälkeen, jonka muutokset pysäyttivät synkronoinnin.'],
    ['Agentti toi', 'Agentti kertoo omin sanoin ja tuo saman kortin komennolla. Ihmisen kyllä agentille ei ole lupa.'],
    ['Liikaa poistoja', 'Siirto näkyy pilvelle 212 poistona: sama kortti, poistot nimettyinä, varoitus ja valintaruutu.'],
    ['Kysymys 4', 'Pilvessä poistetaan 150 tiedostoa juuri ennen ajoa. Vaihda Kysymys 4 -valintaa ja katso ero.'],
  ] as [string, string][],
  away: 'Avautuisi:',
  // The card
  habitat: 'Habitat',
  syncLabel: 'OneDriven synkronointi',
  byAgent: 'agentin pyynnöstä',
  leadHere: (d: Dry) => d.stop === 'changed'
    ? 'Synkronointi pysähtyi, koska tämän keskustelun muutokset koskivat kaikkia OneDrive-kansion tiedostoja.'
    : `Synkronointi pysähtyi, koska tämän keskustelun muutosten jälkeen se olisi poistanut OneDrivesta ${n(d.up.deleted)} tiedostoa ${n(d.total)}:sta.`,
  leadAny: (d: Dry) => d.stop === 'changed'
    ? 'OneDriven synkronointi pysähtyi, koska kaikki kansion tiedostot muuttuivat kerralla.'
    : `OneDriven synkronointi pysähtyi, koska se olisi poistanut OneDrivesta ${n(d.up.deleted)} tiedostoa ${n(d.total)}:sta.`,
  why: (d: Dry) => d.stop === 'changed'
    ? 'Näin käy myös vian sattuessa, joten synkronointi ei jatka itsestään. Tiedostot ovat tallessa molemmilla puolilla.'
    : 'Synkronointi pysähtyy aina, kun yli puolet toisen puolen tiedostoista poistuisi kerralla. Mitään ei ole vielä poistettu.',
  cause: {
    few: 'Tämän keskustelun muutokset: 14 muokattua ja 2 uutta tiedostoa.',
    mixed: 'Tämän keskustelun muutokset: 13 muokattua tiedostoa ja komento, joka poisti 3 luonnosta.',
    moved: 'Tämän keskustelun muutokset: komento, joka siirsi 212 raporttia, ja 4 muokattua tiedostoa.',
  } as Record<string, string>,
  look: 'Katso, mitä jatkaminen tekisi',
  lookAgain: 'Laske uudelleen',
  askAgent: 'Kysy agentilta',
  askDraft: 'Synkronointi pysähtyi muutostesi takia. Kerro, mitä teit OneDrive-kansiolle ja onko jotain poistettu.',
  // The count
  counting: 'Lasketaan, mitä jatkaminen tekisi. Mitään ei vielä muuteta.',
  countingArrive: 'Lasketaan, mitä jatkaminen tekisi…',
  tableCaption: 'Mitä jatkaminen tekisi',
  up: 'Habitatista OneDriveen',
  down: 'OneDrivesta Habitatiin',
  changed: 'Muuttuneita',
  added: 'Uusia',
  deleted: 'Poistettavia',
  would: (d: Dry, safe: boolean) => {
    const s = `Jatkaminen ${join(fiParts(d), 'ja')}.`;
    if (dels(d)) return s;
    return safe ? `${s} Mitään ei poisteta: tämä ajo ei voi poistaa tiedostoja.` : `${s} Mitään ei poisteta.`;
  },
  showDetail: 'Näytä erittely',
  hideDetail: 'Piilota erittely',
  both: 'Jos tiedostoa on muutettu molemmissa, kumpikin versio säilyy.',
  bindingA: (time: string) => `Laskettu klo ${time}. Lupa koskee vain tätä laskelmaa: jos tiedostot muuttuvat ennen ajoa, mitään ei tehdä ja saat uuden laskelman.`,
  bindingB: (time: string) => `Laskettu klo ${time}. Habitat laskee uudelleen juuri ennen ajoa. Jos jokin on muuttunut, mitään ei tehdä ja näet uuden laskelman.`,
  fewDel: (d: Dry) => `Jatkaminen poistaa OneDrivesta ${n(d.up.deleted)} tiedostoa. Ne puuttuvat Habitatista.`,
  manyLead: (d: Dry) => `Jatkaminen poistaa OneDrivesta ${n(d.up.deleted)} tiedostoa ${n(d.total)}:sta.`,
  manyBody: 'Ne puuttuvat Habitatista vanhalta paikaltaan. Jos ne siirrettiin tarkoituksella, ne tulevat OneDriveen uuteen paikkaan. Jos et tunnista poistoja, älä jatka.',
  agree: 'Poistot ovat tarkoituksellisia',
  confirm: 'Jatka kerran',
  confirmNamed: (d: Dry) => `Vie ${n(d.up.changed + d.up.added)} tiedostoa OneDriveen`,
  confirmDelete: (v: number) => `Poista ${n(v)} ja jatka`,
  dontContinue: 'Älä jatka',
  // C: names
  groupUpChanged: 'Viedään OneDriveen muuttuneina',
  groupUpAdded: 'Viedään OneDriveen uusina',
  groupDownAdded: 'Tuodaan OneDrivesta uusina',
  groupUpDeleted: 'Poistetaan OneDrivesta',
  more: (v: number) => `ja ${n(v)} muuta`,
  showFiles: 'Näytä tiedostot',
  hideFiles: 'Piilota tiedostot',
  // Outcomes
  cancelled: 'Ei jatkettu. Synkronointi odottaa yhä päätöstäsi.',
  cancelledShort: 'Et jatkanut. Synkronointi on yhä pysähdyksissä.',
  showCount: 'Näytä laskelma',
  running: (safe: boolean, d: Dry) => `Jatketaan kerran luvallasi.${safe && !dels(d) ? ' Ajo ei voi poistaa mitään.' : ''} Sen jälkeen synkronointi jatkuu tavalliseen tapaan, ja seuraava samanlainen pysähdys kysyy taas.`,
  done: (d: Dry, time: string) => {
    const {up, down} = d;
    const parts: string[] = [];
    if (d.stop === 'deletes') parts.push(`${n(up.added)} tiedostoa vietiin uuteen paikkaan ja ${n(up.deleted)} poistettiin vanhalta paikaltaan`);
    else {
      if (up.changed || up.added) parts.push(`${join([up.changed ? `${n(up.changed)} muuttunutta` : '', up.added ? `${n(up.added)} uutta` : ''], 'ja')} tiedostoa vietiin OneDriveen`);
      if (up.deleted) parts.push(`${n(up.deleted)} poistettiin OneDrivesta`);
    }
    if (d.stop === 'deletes' && up.changed) parts.push(`${n(up.changed)} muuttunutta vietiin`);
    if (down.added) parts.push(`${n(down.added)} uusi tuotiin OneDrivesta`);
    return `Jatkettu kerran luvallasi klo ${time}: ${join(parts, 'ja')}.`;
  },
  doneTail: 'Synkronointi jatkuu taas tavalliseen tapaan.',
  receiptShow: 'Näytä',
  receiptHide: 'Piilota',
  refused: 'Ei tehty: tiedostot muuttuivat sen jälkeen, kun katsoit, joten lupasi ei koske niitä. Mitään ei muutettu.',
  refusedB: 'Tiedostot muuttuivat laskennan jälkeen, joten mitään ei tehty. Alla uusi laskelma.',
  failed: 'Jatkaminen keskeytyi, koska OneDriveen ei saatu yhteyttä. Osa tiedostoista ehti ehkä siirtyä. Synkronointi on yhä pysähdyksissä eikä jatka itsestään.',
  slipSafe: 'OneDrivessa poistettiin 150 tiedostoa juuri ajon alkaessa. Tämä ajo ei voinut poistaa niitä Habitatista. Seuraava synkronointi pysähtyi niiden takia ja kysyy erikseen.',
  slipOpen: 'Ajo poisti myös 150 tiedostoa Habitatista. Ne poistettiin OneDrivessa laskelman jälkeen, eikä lupasi koskenut niitä.',
  // Agent conversation
  askWhy: 'Kello sanoo, että OneDriven synkronointi pysähtyi. Johtuiko se tästä?',
  agentExplain: {
    few: 'Kyllä, todennäköisesti. Muutin kaikkien 14 muistiinpanon otsikot ja tein kaksi uutta pohjaa, joten jokainen kansion tiedosto muuttui kerralla. Synkronointi pysähtyy silloin varmuuden vuoksi. En poistanut mitään.\n\nToin Habitatin kortin tähän alle. Siinä näkyy, mitä jatkaminen tekisi, ja lupa annetaan sen painikkeella. En voi jatkaa synkronointia itse.',
    mixed: 'Kyllä, todennäköisesti. Muutin 13 muistiinpanon otsikot ja poistin kolme vanhaa luonnosta (`luonnos-*.md`), joten jokainen kansion tiedosto muuttui kerralla. Synkronointi pysähtyy silloin varmuuden vuoksi.\n\nToin Habitatin kortin tähän alle. Siinä näkyvät myös nämä kolme poistoa, ja lupa annetaan sen painikkeella. En voi jatkaa synkronointia itse.',
    moved: 'Kyllä. Siirsin 212 raporttia kansioon `Arkisto/2025`. OneDrive näkee siirron poistoina vanhasta paikasta ja uusina tiedostoina uudessa. Poistoja olisi yli puolet tiedostoista, joten synkronointi pysähtyi. Muuta en poistanut.\n\nToin Habitatin kortin tähän alle. Jos siirto on oikein, lupa annetaan sen painikkeella. En voi jatkaa synkronointia itse.',
  } as Record<string, string>,
  yes: 'Kyllä, jatka vaan.',
  agentYes: 'Viestisi ei käy luvaksi. Lupa annetaan Habitatin kortin painikkeella, jotta se koskee juuri näytettyä laskelmaa. Toin kortin uudelleen tähän alle.',
  // Rail and bell
  railMark: 'Synkronointi pysähtyi',
  bellTitle: 'OneDriven synkronointi pysähtyi',
  bellMeta: 'Microsoft 365',
  bellBodyHere: (title: string) => `Keskustelun ”${title}” muutokset pysäyttivät synkronoinnin. Se odottaa päätöstäsi.`,
  bellBodyElsewhere: (d: Dry) => d.stop === 'changed'
    ? 'Kaikki OneDrive-kansion tiedostot muuttuivat kerralla, mutta muutokset eivät tulleet Habitatin keskusteluista. Synkronointi ei jatka itsestään.'
    : `Synkronointi olisi poistanut OneDrivesta ${n(d.up.deleted)} tiedostoa ${n(d.total)}:sta, mutta poistot eivät tulleet Habitatin keskusteluista. Synkronointi ei jatka itsestään.`,
  bellSlip: 'Synkronointi olisi poistanut Habitatista 150 tiedostoa 240:stä. Ne poistettiin OneDrivessa, eivät Habitatin keskusteluissa. Synkronointi ei jatka itsestään.',
  bellOpenConversation: 'Avaa keskustelu',
  bellShowHere: 'Näytä keskustelussa',
  bellLook: 'Katso, mitä jatkaminen tekisi…',
  bellSettings: 'Avaa asetukset',
  settingsToast: 'Asetukset › Tiedot agenteille: Microsoft 365 -kortin yläosassa sama kortti.',
  dialogTitle: 'OneDriven synkronointi pysähtyi',
  // The conversations (synthetic)
  conv: {few: 'Muistiinpanojen otsikot yhtenäisiksi', mixed: 'Muistiinpanot kuntoon', moved: 'Vuoden 2025 raportit arkistoon'} as Record<string, string>,
  convOther: 'Kotisivun yhteystiedot',
  ask: {
    few: 'Yhtenäistä Muistiinpanot-kansion otsikot muotoon `# PVM – aihe` ja tee puuttuvista kokouksista tyhjät pohjat.',
    mixed: 'Yhtenäistä Muistiinpanot-kansion otsikot muotoon `# PVM – aihe` ja poista vanhat luonnokset.',
    moved: 'Siirrä vuoden 2025 raportit kansioon Arkisto/2025 ja päivitä hakemistosivut.',
  } as Record<string, string>,
  reply: {
    few: 'Yhtenäistin 14 muistiinpanon otsikot muotoon `# PVM – aihe` ja tein pohjat kahdelle puuttuvalle kokoukselle (`2026-11-06` ja `2026-11-13`).',
    mixed: 'Yhtenäistin 13 muistiinpanon otsikot ja poistin kolme vanhaa luonnosta.',
    moved: 'Siirsin 212 vuoden 2025 raporttia kansioon `Arkisto/2025` ja päivitin neljä hakemistosivua osoittamaan uuteen paikkaan.',
  } as Record<string, string>,
  askOther: 'Päivitä kotisivun yhteystiedot uuteen osoitteeseen.',
  replyOther: 'Päivitin osoitteen sivuille `yhteystiedot.html` ja `index.html`.',
  thinking: 'Katson synkronoinnin tilan ja sen, mitä muutin.',
  working: 'Työskentelee',
  waiting: 'Odottaa viestiä',
};

type Text = typeof fi;

const en: Text = {
  title: 'Sync stop and consent · round 3',
  scenario: 'Situation',
  data: 'Stop',
  dataFew: 'All changed, no deletions',
  dataMixed: 'All changed, 3 deletions',
  dataMoved: 'Too many deletions (212 moved)',
  origin: 'Card brought by',
  originHabitat: 'Habitat itself',
  originAgent: 'The agent, by command',
  originYes: 'The agent, person said yes',
  q4: 'Question 4',
  q4Safe: 'Pass cannot delete (recommended)',
  q4Open: 'Pass may delete (today)',
  theme: 'Theme', light: 'Light', dark: 'Dark',
  language: 'Language',
  reset: 'Reset',
  simulate: 'Simulate: a file changes after the count',
  simulated: 'A file changed after the count. Continue now and Habitat does nothing.',
  slipSimulate: 'Simulate: 150 deleted in the cloud just before the pass',
  slipSimulated: '150 files are deleted in OneDrive just as the pass starts (after the count was checked). Continue now and see what the Question 4 choice changes.',
  scenarios: {
    pysahtyi: 'Stopped, waiting for a decision (default)',
    lasketaan: 'Counting what continuing would do',
    laskettu: 'Count ready',
    kaynnissa: 'Continuing once',
    valmis: 'Continued, card settled',
    peruttu: 'Not continued (Don\'t continue)',
    torjuttu: 'Not done: files changed after the count',
    epaonnistui: 'Continuing failed',
    livahti: 'Question 4: 150 deleted in the cloud just before the pass',
    muualla: 'Another conversation open',
    eikeskustelua: 'No conversation caused it (bell)',
  },
  roundLine: 'Jari\'s decision: Habitat\'s own card in the conversation right after the turn whose edits stopped sync. Consent is only the card\'s button and covers the count shown. The agent may bring the same card with a command but never consents. This round: what the card is like.',
  lines: [
    'A On request: the card says that sync stopped and why. The count is made only when the person asks. A finished card folds to a receipt line that can be opened.',
    'B Ready: the card arrives with the count. One sentence and a button that names the action. Details open on request. A changed situation is recounted by itself. A finished card is one line.',
    'C By name: count on request, showing the files by name in groups, not only numbers. A finished card is a receipt whose file list can be opened.',
  ],
  recommend: 'Recommendation: B. The card says at once what decides the matter, whether continuing deletes anything, and consent is one press that says what will happen. The count is still checked before the pass, so a stale count cannot let anything through. A takes two presses for no extra safety. C\'s names help recognise the edits, but 212 names are a list, not help to decide. B\'s details can take C\'s names.',
  presetsLabel: 'Show',
  presets: [
    ['Card', 'Habitat\'s card right after the turn whose edits stopped sync.'],
    ['Agent brought', 'The agent explains in its own words and brings the same card by command. A yes to the agent is not consent.'],
    ['Too many deletions', 'A move looks like 212 deletions to the cloud: the same card, deletions named, warning and checkbox.'],
    ['Question 4', '150 files are deleted in the cloud just before the pass. Switch Question 4 and see the difference.'],
  ],
  away: 'Would open:',
  habitat: 'Habitat',
  syncLabel: 'OneDrive sync',
  byAgent: 'at the agent\'s request',
  leadHere: (d: Dry) => d.stop === 'changed'
    ? 'Sync stopped because this conversation\'s edits touched every file in the OneDrive folder.'
    : `Sync stopped because after this conversation's edits it would have deleted ${ne(d.up.deleted)} of ${ne(d.total)} files from OneDrive.`,
  leadAny: (d: Dry) => d.stop === 'changed'
    ? 'OneDrive sync stopped because every file in the folder changed at once.'
    : `OneDrive sync stopped because it would have deleted ${ne(d.up.deleted)} of ${ne(d.total)} files from OneDrive.`,
  why: (d: Dry) => d.stop === 'changed'
    ? 'This also happens when something goes wrong, so sync does not continue by itself. Your files are kept on both sides.'
    : 'Sync always stops when more than half of the other side\'s files would be deleted at once. Nothing has been deleted yet.',
  cause: {
    few: 'This conversation\'s edits: 14 edited and 2 new files.',
    mixed: 'This conversation\'s edits: 13 edited files and a command that deleted 3 drafts.',
    moved: 'This conversation\'s edits: a command that moved 212 reports, and 4 edited files.',
  },
  look: 'See what continuing would do',
  lookAgain: 'Count again',
  askAgent: 'Ask the agent',
  askDraft: 'Sync stopped because of your edits. Tell me what you did to the OneDrive folder and whether anything was deleted.',
  counting: 'Counting what continuing would do. Nothing is changed yet.',
  countingArrive: 'Counting what continuing would do…',
  tableCaption: 'What continuing would do',
  up: 'From Habitat to OneDrive',
  down: 'From OneDrive to Habitat',
  changed: 'Changed',
  added: 'New',
  deleted: 'To delete',
  would: (d: Dry, safe: boolean) => {
    const s = `Continuing would ${join(enParts(d), 'and')}.`;
    if (dels(d)) return s;
    return safe ? `${s} Nothing is deleted: this pass cannot delete files.` : `${s} Nothing is deleted.`;
  },
  showDetail: 'Show details',
  hideDetail: 'Hide details',
  both: 'If a file was changed in both places, both versions are kept.',
  bindingA: (time: string) => `Counted at ${time}. Your consent covers only this count: if the files change before the pass, nothing is done and you get a new count.`,
  bindingB: (time: string) => `Counted at ${time}. Habitat counts again just before the pass. If anything changed, nothing is done and you see a new count.`,
  fewDel: (d: Dry) => `Continuing deletes ${ne(d.up.deleted)} files from OneDrive. They are gone from Habitat.`,
  manyLead: (d: Dry) => `Continuing deletes ${ne(d.up.deleted)} of ${ne(d.total)} files from OneDrive.`,
  manyBody: 'They are gone from their old place in Habitat. If they were moved on purpose, they arrive in OneDrive in the new place. If you do not recognise the deletions, do not continue.',
  agree: 'The deletions are intended',
  confirm: 'Continue once',
  confirmNamed: (d: Dry) => `Send ${ne(d.up.changed + d.up.added)} files to OneDrive`,
  confirmDelete: (v: number) => `Delete ${ne(v)} and continue`,
  dontContinue: 'Don\'t continue',
  groupUpChanged: 'Sent to OneDrive as changed',
  groupUpAdded: 'Sent to OneDrive as new',
  groupDownAdded: 'Brought from OneDrive as new',
  groupUpDeleted: 'Deleted from OneDrive',
  more: (v: number) => `and ${ne(v)} more`,
  showFiles: 'Show files',
  hideFiles: 'Hide files',
  cancelled: 'Not continued. Sync is still waiting for your decision.',
  cancelledShort: 'You did not continue. Sync is still stopped.',
  showCount: 'Show the count',
  running: (safe: boolean, d: Dry) => `Continuing once with your consent.${safe && !dels(d) ? ' The pass cannot delete anything.' : ''} After that, sync carries on as usual, and the next stop like this asks again.`,
  done: (d: Dry, time: string) => {
    const {up, down} = d;
    const parts: string[] = [];
    if (d.stop === 'deletes') parts.push(`${ne(up.added)} files went to the new place and ${ne(up.deleted)} were removed from the old one`);
    else {
      if (up.changed || up.added) parts.push(`${join([up.changed ? `${ne(up.changed)} changed` : '', up.added ? `${ne(up.added)} new` : ''], 'and')} files were sent to OneDrive`);
      if (up.deleted) parts.push(`${ne(up.deleted)} were deleted from OneDrive`);
    }
    if (d.stop === 'deletes' && up.changed) parts.push(`${ne(up.changed)} changed were sent`);
    if (down.added) parts.push(`${ne(down.added)} new came from OneDrive`);
    return `Continued once with your consent at ${time}: ${join(parts, 'and')}.`;
  },
  doneTail: 'Sync carries on as usual again.',
  receiptShow: 'Show',
  receiptHide: 'Hide',
  refused: 'Not done: the files changed after you looked, so your consent does not cover them. Nothing was changed.',
  refusedB: 'The files changed after the count, so nothing was done. A new count is below.',
  failed: 'Continuing stopped because OneDrive could not be reached. Some files may have been transferred. Sync is still stopped and does not continue by itself.',
  slipSafe: '150 files were deleted in OneDrive just as the pass started. This pass could not delete them from Habitat. The next sync stopped because of them and asks separately.',
  slipOpen: 'The pass also deleted 150 files from Habitat. They were deleted in OneDrive after the count, and your consent did not cover them.',
  askWhy: 'The bell says OneDrive sync stopped. Was it because of this?',
  agentExplain: {
    few: 'Yes, probably. I changed the headings of all 14 notes and added two new templates, so every file in the folder changed at once. Sync stops then, to be safe. I did not delete anything.\n\nI brought Habitat\'s card below. It shows what continuing would do, and consent is its button. I cannot continue sync myself.',
    mixed: 'Yes, probably. I changed the headings of 13 notes and deleted three old drafts (`luonnos-*.md`), so every file in the folder changed at once. Sync stops then, to be safe.\n\nI brought Habitat\'s card below. It shows these three deletions too, and consent is its button. I cannot continue sync myself.',
    moved: 'Yes. I moved 212 reports to `Arkisto/2025`. OneDrive sees a move as deletions in the old place and new files in the new one. That would delete more than half of the files, so sync stopped. I deleted nothing else.\n\nI brought Habitat\'s card below. If the move is right, consent is its button. I cannot continue sync myself.',
  },
  yes: 'Yes, go ahead.',
  agentYes: 'Your message does not count as consent. Consent is the button on Habitat\'s card, so that it covers exactly the count shown. I brought the card again below.',
  railMark: 'Sync stopped',
  bellTitle: 'OneDrive sync stopped',
  bellMeta: 'Microsoft 365',
  bellBodyHere: (title: string) => `The edits in “${title}” stopped sync. It is waiting for your decision.`,
  bellBodyElsewhere: (d: Dry) => d.stop === 'changed'
    ? 'Every file in the OneDrive folder changed at once, but the changes did not come from Habitat\'s conversations. Sync does not continue by itself.'
    : `Sync would have deleted ${ne(d.up.deleted)} of ${ne(d.total)} files from OneDrive, but the deletions did not come from Habitat's conversations. Sync does not continue by itself.`,
  bellSlip: 'Sync would have deleted 150 of 240 files from Habitat. They were deleted in OneDrive, not in Habitat\'s conversations. Sync does not continue by itself.',
  bellOpenConversation: 'Open the conversation',
  bellShowHere: 'Show in the conversation',
  bellLook: 'See what continuing would do…',
  bellSettings: 'Open settings',
  settingsToast: 'Settings › Data for agents: the same card at the top of the Microsoft 365 card.',
  dialogTitle: 'OneDrive sync stopped',
  conv: {few: 'Consistent note headings', mixed: 'Tidy the notes', moved: 'The 2025 reports to the archive'},
  convOther: 'Home page contact details',
  ask: {
    few: 'Make the headings in the Muistiinpanot folder follow `# DATE – topic` and add empty templates for the missing meetings.',
    mixed: 'Make the headings in the Muistiinpanot folder follow `# DATE – topic` and delete the old drafts.',
    moved: 'Move the 2025 reports to Arkisto/2025 and update the index pages.',
  },
  reply: {
    few: 'I made the 14 note headings follow `# DATE – topic` and added templates for the two missing meetings (`2026-11-06` and `2026-11-13`).',
    mixed: 'I made 13 note headings consistent and deleted three old drafts.',
    moved: 'I moved the 212 reports of 2025 to `Arkisto/2025` and updated four index pages to point to the new place.',
  },
  askOther: 'Update the home page contact details to the new address.',
  replyOther: 'I updated the address on `yhteystiedot.html` and `index.html`.',
  thinking: 'I will look at the sync state and at what I changed.',
  working: 'Working',
  waiting: 'Waiting for a message',
};

export const TEXT: Record<Lang, Text> = {fi, en};
export type {Text};
