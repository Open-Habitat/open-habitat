// The round's own words, Finnish and English. Production's components keep
// their own catalogs and follow the same language switch.
export type Lang = 'fi' | 'en';

export type Counts = {changed: number; added: number; deleted: number};

const n = (v: number) => v.toLocaleString('fi-FI');
const ne = (v: number) => v.toLocaleString('en-GB');

function fiWould(up: Counts, down: Counts, total: number): string {
  const parts: string[] = [];
  if (up.changed || up.added) parts.push(`vie OneDriveen ${[up.changed ? `${n(up.changed)} muuttunutta` : '', up.added ? `${n(up.added)} uutta` : ''].filter(Boolean).join(' ja ')} tiedostoa`);
  if (down.changed || down.added) parts.push(`tuo OneDrivesta ${[down.changed ? `${n(down.changed)} muuttunutta` : '', down.added ? `${n(down.added)} uutta` : ''].filter(Boolean).join(' ja ')}`);
  if (up.deleted) parts.push(`poistaa OneDrivesta ${n(up.deleted)} tiedostoa ${n(total)}:sta`);
  if (down.deleted) parts.push(`poistaa Habitatista ${n(down.deleted)} tiedostoa`);
  const s = `Jatkaminen ${parts.join(', ').replace(/, ([^,]*)$/, ' ja $1')}.`;
  return up.deleted || down.deleted ? s : `${s} Mitään ei poisteta.`;
}
function enWould(up: Counts, down: Counts, total: number): string {
  const parts: string[] = [];
  if (up.changed || up.added) parts.push(`send ${[up.changed ? `${ne(up.changed)} changed` : '', up.added ? `${ne(up.added)} new` : ''].filter(Boolean).join(' and ')} files to OneDrive`);
  if (down.changed || down.added) parts.push(`bring ${[down.changed ? `${ne(down.changed)} changed` : '', down.added ? `${ne(down.added)} new` : ''].filter(Boolean).join(' and ')} from OneDrive`);
  if (up.deleted) parts.push(`delete ${ne(up.deleted)} of ${ne(total)} files from OneDrive`);
  if (down.deleted) parts.push(`delete ${ne(down.deleted)} files from Habitat`);
  const s = `Continuing would ${parts.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
  return up.deleted || down.deleted ? s : `${s} Nothing is deleted.`;
}

const fi = {
  // Review chrome
  title: 'Synkronoinnin pysähdys keskustelussa · kierros 2',
  scenario: 'Tilanne',
  data: 'Keskustelu',
  dataFew: 'Otsikot (14 muokattua, 2 uutta)',
  dataMany: 'Arkistointi (212 siirrettyä)',
  theme: 'Teema', light: 'Vaalea', dark: 'Tumma',
  language: 'Kieli',
  reset: 'Alusta',
  simulate: 'Simuloi: tiedosto muuttuu laskelman jälkeen',
  simulated: 'Tiedosto muuttui laskelman jälkeen. Jatka nyt, niin Habitat kieltäytyy.',
  scenarios: {
    pysahtyi: 'Pysähtyi, odottaa päätöstä (oletus)',
    lasketaan: 'Lasketaan, mitä jatkaminen tekisi',
    laskettu: 'Laskelma valmis',
    kaynnissa: 'Jatketaan kerran',
    valmis: 'Jatkettu, synkronointi taas tavallista',
    torjuttu: 'Ei jatkettu: tiedostot muuttuivat laskelman jälkeen',
    epaonnistui: 'Jatkaminen epäonnistui',
    muualla: 'Toinen keskustelu auki',
    eikeskustelua: 'Varapaikka: muutos tuli muualta',
  } as Record<string, string>,
  roundLine: 'Sama kaikissa: synkronointi pysähtyy eikä jatka itsestään. Pysähdys näytetään keskustelussa, jonka agentin muutokset sen aiheuttivat. Lupa koskee vain näytettyä laskelmaa ja on Habitatin oma painike, ei agentin sana. Sivupalkki merkitsee keskustelun, ja kello kertoo pysähdyksestä koko tilille.',
  lines: [
    'A Kortti: Habitatin kortti keskustelun aikajanalla heti niiden muutosten jälkeen, jotka pysäyttivät synkronoinnin. Laskelma ja lupa täyttyvät korttiin.',
    'B Agentti kertoo: Habitat kertoo pysähdyksestä agentille, ja agentti selittää omin sanoin, mitä teki, ja laskee. Lupa on Habitatin kortti agentin vastauksen alla.',
    'C Kentän yllä: pysähdys on kiinteä rivi kirjoituskentän yllä eikä aikajanalla. Laskelma ja lupa ovat ikkunassa kuten kierroksella 1.',
  ],
  recommend: 'Suositus: A. Kortti on siellä, missä ihminen lukee agentin tuloksen, ja se sanoo, mitkä muutokset pysäyttivät synkronoinnin. Lupa on Habitatin oma, eikä se vaadi agentin vuoroa. Toimii myös, kun agentti on jo muussa työssä tai Pi on pysähtynyt. B selittää parhaiten, mutta käynnistää vuoron, jota ihminen ei pyytänyt, ja agentin selitys voi olla väärä. C:n rivi irtoaa syystä ja vie puhelimessa kentän tilaa. A:n Kysy agentilta -painike tuo B:n selityksen pyynnöstä.',
  away: 'Avautuisi:',
  // The stop, in the conversation
  habitat: 'Habitat',
  syncLabel: 'OneDriven synkronointi',
  leadHere: 'Synkronointi pysähtyi, koska tämän keskustelun muutokset koskivat kaikkia OneDrive-kansion tiedostoja.',
  why: 'Synkronointi pysähtyy aina, kun kaikki tiedostot muuttuvat kerralla, koska niin käy myös vian sattuessa. Se ei jatka itsestään. Tiedostot ovat tallessa sekä Habitatissa että OneDrivessa.',
  causeFew: 'Tämän keskustelun muutokset: 14 muokattua ja 2 uutta tiedostoa.',
  causeMany: 'Tämän keskustelun muutokset: komento, joka siirsi raportit, ja 4 muokattua tiedostoa.',
  look: 'Katso, mitä jatkaminen tekisi',
  lookDialog: 'Katso, mitä jatkaminen tekisi…',
  lookAgain: 'Katso uudelleen',
  askAgent: 'Kysy agentilta',
  askDraft: 'Synkronointi pysähtyi muutostesi takia. Kerro, mitä teit OneDrive-kansiolle ja onko jotain poistettu.',
  // B: Habitat tells the agent
  toldAgent: 'Habitat kertoi agentille: OneDriven synkronointi pysähtyi tämän keskustelun muutosten takia.',
  agentChecking: 'Tarkistaa synkronointia',
  agentReplyFew: 'Synkronointi pysähtyi minun muutosteni takia: yhtenäistin kaikkien 14 muistiinpanon otsikot ja tein kaksi uutta pohjaa, joten jokainen kansion tiedosto muuttui kerralla. Laskin, mitä jatkaminen tekisi. Mitään ei poisteta. Jos haluat muutokset OneDriveen, hyväksy alla. En voi jatkaa synkronointia itse.',
  agentReplyMany: 'Synkronointi pysähtyi minun komentoni takia: siirsin 212 raporttia kansioon `Arkisto/2025`. OneDrive näkee siirron poistoina vanhasta paikasta ja uusina tiedostoina uudessa, siksi laskelmassa on 212 poistoa. Muuta ei poistettu. Jos siirto on oikein, hyväksy alla. En voi jatkaa synkronointia itse.',
  consentLabel: 'Habitatin lupa',
  // C: above the field
  stripLead: 'OneDriven synkronointi pysähtyi tämän keskustelun muutosten takia.',
  stripShort: 'Synkronointi pysähtyi',
  // The count
  dialogTitle: 'Jatketaanko OneDriven synkronointia kerran?',
  counting: 'Lasketaan, mitä jatkaminen tekisi. Mitään ei vielä muuteta.',
  tableCaption: 'Mitä jatkaminen tekisi',
  up: 'Habitatista OneDriveen',
  down: 'OneDrivesta Habitatiin',
  changed: 'Muuttuneita',
  added: 'Uusia',
  deleted: 'Poistettavia',
  would: fiWould,
  both: 'Jos tiedostoa on muutettu molemmissa, kumpikin versio säilyy.',
  countedAt: (time: string) => `Laskettu klo ${time}.`,
  binding: 'Lupasi koskee vain tätä laskelmaa. Jos tiedostot muuttuvat ennen kuin jatkat, mitään ei tehdä ja saat katsoa uudelleen.',
  manyLead: (v: number, total: number) => `Jatkaminen poistaa OneDrivesta ${n(v)} tiedostoa ${n(total)}:sta.`,
  manyBody: 'Ne puuttuvat Habitatista vanhalta paikaltaan. Jos ne siirrettiin tarkoituksella, ne tulevat OneDriveen uuteen paikkaan. Jos et tunnista poistoja, älä jatka.',
  agree: 'Poistot ovat tarkoituksellisia',
  confirm: 'Jatka kerran',
  confirmDelete: (v: number) => `Poista ${n(v)} ja jatka`,
  dontContinue: 'Älä jatka',
  // Outcomes
  cancelled: 'Ei jatkettu. Synkronointi odottaa yhä päätöstäsi.',
  running: 'Jatketaan kerran luvallasi. Sen jälkeen synkronointi jatkuu tavalliseen tapaan, ja seuraava samanlainen pysähdys kysyy taas.',
  doneFew: (up: Counts) => `${[up.changed ? `${n(up.changed)} muuttunutta` : '', up.added ? `${n(up.added)} uutta` : ''].filter(Boolean).join(' ja ')} tiedostoa vietiin OneDriveen.`,
  doneMany: (up: Counts) => `${n(up.added)} tiedostoa vietiin OneDriveen ja ${n(up.deleted)} poistettiin vanhalta paikaltaan.`,
  doneAt: (time: string) => `Jatkettu kerran klo ${time}.`,
  doneTail: 'Synkronointi jatkuu taas tavalliseen tapaan.',
  refused: 'Ei jatkettu: tiedostot muuttuivat sen jälkeen, kun katsoit, joten lupasi ei koske niitä. Mitään ei muutettu.',
  failed: 'Jatkaminen keskeytyi, koska OneDriveen ei saatu yhteyttä. Osa tiedostoista ehti ehkä siirtyä. Synkronointi on yhä pysähdyksissä eikä jatka itsestään.',
  // Rail and bell
  railMark: 'Synkronointi pysähtyi',
  bellTitle: 'OneDriven synkronointi pysähtyi',
  bellMeta: 'Microsoft 365',
  bellBodyHere: (title: string) => `Keskustelun ”${title}” muutokset koskivat kaikkia kansion tiedostoja. Synkronointi odottaa päätöstäsi.`,
  bellBodyElsewhere: 'Kaikki OneDrive-kansion tiedostot muuttuivat kerralla, mutta muutokset eivät tulleet Habitatin keskusteluista. Synkronointi ei jatka itsestään. Tiedostot ovat tallessa sekä Habitatissa että OneDrivessa.',
  bellOpenConversation: 'Avaa keskustelu',
  bellShowHere: 'Näytä keskustelussa',
  bellSettings: 'Avaa asetukset',
  settingsToast: 'Asetukset › Tiedot agenteille: Microsoft 365 -kortin yläosassa sama ilmoitus kuin kierroksen 1 suunnassa B.',
  // The conversations (synthetic)
  convFew: 'Muistiinpanojen otsikot yhtenäisiksi',
  convMany: 'Vuoden 2025 raportit arkistoon',
  convOther: 'Kotisivun yhteystiedot',
  askFew: 'Yhtenäistä Muistiinpanot-kansion otsikot muotoon `# PVM – aihe` ja tee puuttuvista kokouksista tyhjät pohjat.',
  askMany: 'Siirrä vuoden 2025 raportit kansioon Arkisto/2025 ja päivitä hakemistosivut.',
  replyFew: 'Yhtenäistin 14 muistiinpanon otsikot muotoon `# PVM – aihe` ja tein pohjat kahdelle puuttuvalle kokoukselle (`2026-11-06` ja `2026-11-13`).',
  replyMany: 'Siirsin 212 vuoden 2025 raporttia kansioon `Arkisto/2025` ja päivitin neljä hakemistosivua osoittamaan uuteen paikkaan.',
  askOther: 'Päivitä kotisivun yhteystiedot uuteen osoitteeseen.',
  replyOther: 'Päivitin osoitteen sivuille `yhteystiedot.html` ja `index.html`.',
  working: 'Työskentelee',
  waiting: 'Odottaa viestiä',
};

type Text = typeof fi;

const en: Text = {
  title: 'Sync stop in the conversation · round 2',
  scenario: 'Situation',
  data: 'Conversation',
  dataFew: 'Headings (14 edited, 2 new)',
  dataMany: 'Archiving (212 moved)',
  theme: 'Theme', light: 'Light', dark: 'Dark',
  language: 'Language',
  reset: 'Reset',
  simulate: 'Simulate: a file changes after the count',
  simulated: 'A file changed after the count. Continue now and Habitat refuses.',
  scenarios: {
    pysahtyi: 'Stopped, waiting for a decision (default)',
    lasketaan: 'Counting what continuing would do',
    laskettu: 'Count ready',
    kaynnissa: 'Continuing once',
    valmis: 'Continued, sync back to normal',
    torjuttu: 'Not continued: files changed after the count',
    epaonnistui: 'Continuing failed',
    muualla: 'Another conversation open',
    eikeskustelua: 'Fallback: the change came from elsewhere',
  },
  roundLine: 'Same in all: sync stops and does not continue by itself. The stop shows in the conversation whose agent edits caused it. The consent covers only the count shown and is Habitat\'s own button, not the agent\'s word. The rail marks the conversation, and the bell tells the whole account.',
  lines: [
    'A Card: Habitat\'s card in the conversation\'s timeline right after the edits that stopped sync. The count and the consent fill in the card.',
    'B Agent tells: Habitat tells the agent about the stop, and the agent explains in its own words what it did and counts. The consent is Habitat\'s card under the agent\'s reply.',
    'C Above the field: the stop is a fixed line above the message field, not in the timeline. The count and the consent are in a dialog as in round 1.',
  ],
  recommend: 'Recommendation: A. The card is where the person reads the agent\'s result, and it says which edits stopped sync. The consent is Habitat\'s own and needs no agent turn. It works when the agent has moved on or Pi has stopped. B explains best, but starts a turn the person did not ask for, and the agent\'s explanation can be wrong. C\'s line comes loose from its cause and takes field space on a phone. A\'s Ask the agent button brings B\'s explanation on request.',
  away: 'Would open:',
  habitat: 'Habitat',
  syncLabel: 'OneDrive sync',
  leadHere: 'Sync stopped because this conversation\'s edits touched every file in the OneDrive folder.',
  why: 'Sync always stops when every file changes at once, because that also happens when something goes wrong. It does not continue by itself. Your files are kept both in Habitat and in OneDrive.',
  causeFew: 'This conversation\'s edits: 14 edited and 2 new files.',
  causeMany: 'This conversation\'s edits: a command that moved the reports, and 4 edited files.',
  look: 'See what continuing would do',
  lookDialog: 'See what continuing would do…',
  lookAgain: 'Look again',
  askAgent: 'Ask the agent',
  askDraft: 'Sync stopped because of your edits. Tell me what you did to the OneDrive folder and whether anything was deleted.',
  toldAgent: 'Habitat told the agent: OneDrive sync stopped because of this conversation\'s edits.',
  agentChecking: 'Checking sync',
  agentReplyFew: 'Sync stopped because of my edits: I made the headings of all 14 notes consistent and added two new templates, so every file in the folder changed at once. I counted what continuing would do. Nothing is deleted. If you want the edits in OneDrive, approve below. I cannot continue sync myself.',
  agentReplyMany: 'Sync stopped because of my command: I moved 212 reports to `Arkisto/2025`. OneDrive sees a move as deletions in the old place and new files in the new one, which is why the count has 212 deletions. Nothing else was deleted. If the move is right, approve below. I cannot continue sync myself.',
  consentLabel: 'Habitat\'s consent',
  stripLead: 'OneDrive sync stopped because of this conversation\'s edits.',
  stripShort: 'Sync stopped',
  dialogTitle: 'Continue OneDrive sync once?',
  counting: 'Counting what continuing would do. Nothing is changed yet.',
  tableCaption: 'What continuing would do',
  up: 'From Habitat to OneDrive',
  down: 'From OneDrive to Habitat',
  changed: 'Changed',
  added: 'New',
  deleted: 'To delete',
  would: enWould,
  both: 'If a file was changed in both places, both versions are kept.',
  countedAt: (time: string) => `Counted at ${time}.`,
  binding: 'Your consent covers only this count. If the files change before you continue, nothing is done and you can look again.',
  manyLead: (v: number, total: number) => `Continuing deletes ${ne(v)} of ${ne(total)} files from OneDrive.`,
  manyBody: 'They are gone from their old place in Habitat. If they were moved on purpose, they arrive in OneDrive in the new place. If you do not recognise the deletions, do not continue.',
  agree: 'The deletions are intended',
  confirm: 'Continue once',
  confirmDelete: (v: number) => `Delete ${ne(v)} and continue`,
  dontContinue: 'Don\'t continue',
  cancelled: 'Not continued. Sync is still waiting for your decision.',
  running: 'Continuing once with your consent. After that, sync carries on as usual, and the next stop like this asks again.',
  doneFew: (up: Counts) => `${[up.changed ? `${ne(up.changed)} changed` : '', up.added ? `${ne(up.added)} new` : ''].filter(Boolean).join(' and ')} files were sent to OneDrive.`,
  doneMany: (up: Counts) => `${ne(up.added)} files were sent to OneDrive and ${ne(up.deleted)} removed from their old place.`,
  doneAt: (time: string) => `Continued once at ${time}.`,
  doneTail: 'Sync carries on as usual again.',
  refused: 'Not continued: the files changed after you looked, so your consent does not cover them. Nothing was changed.',
  failed: 'Continuing stopped because OneDrive could not be reached. Some files may have been transferred. Sync is still stopped and does not continue by itself.',
  railMark: 'Sync stopped',
  bellTitle: 'OneDrive sync stopped',
  bellMeta: 'Microsoft 365',
  bellBodyHere: (title: string) => `The edits in “${title}” touched every file in the folder. Sync is waiting for your decision.`,
  bellBodyElsewhere: 'Every file in the OneDrive folder changed at once, but the changes did not come from Habitat\'s conversations. Sync does not continue by itself. Your files are kept both in Habitat and in OneDrive.',
  bellOpenConversation: 'Open the conversation',
  bellShowHere: 'Show in the conversation',
  bellSettings: 'Open settings',
  settingsToast: 'Settings › Data for agents: the same notice at the top of the Microsoft 365 card as in round 1, direction B.',
  convFew: 'Consistent note headings',
  convMany: 'The 2025 reports to the archive',
  convOther: 'Home page contact details',
  askFew: 'Make the headings in the Muistiinpanot folder follow `# DATE – topic` and add empty templates for the missing meetings.',
  askMany: 'Move the 2025 reports to Arkisto/2025 and update the index pages.',
  replyFew: 'I made the 14 note headings follow `# DATE – topic` and added templates for the two missing meetings (`2026-11-06` and `2026-11-13`).',
  replyMany: 'I moved the 212 reports of 2025 to `Arkisto/2025` and updated four index pages to point to the new place.',
  askOther: 'Update the home page contact details to the new address.',
  replyOther: 'I updated the address on `yhteystiedot.html` and `index.html`.',
  working: 'Working',
  waiting: 'Waiting for a message',
};

export const TEXT: Record<Lang, Text> = {fi, en};
export type {Text};
