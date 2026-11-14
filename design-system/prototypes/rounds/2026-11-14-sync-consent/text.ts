// The round's own words, Finnish and English. Production's Microsoft card
// keeps its own catalog (text/integrations.tsx) and follows the same switch;
// the round only replaces its status line for the stop (round.tsx).
export type Lang = 'fi' | 'en';

export type Counts = {changed: number; added: number; deleted: number};

const n = (v: number) => v.toLocaleString('fi-FI');
const ne = (v: number) => v.toLocaleString('en-GB');
const fiFiles = (v: number) => (v === 1 ? '1 tiedosto' : `${n(v)} tiedostoa`);
const enFiles = (v: number) => (v === 1 ? '1 file' : `${ne(v)} files`);

/** What the forced pass would do, in one sentence, from the dry run's counts. */
function fiWould(up: Counts, down: Counts, total: number): string {
  const parts: string[] = [];
  if (up.changed || up.added) parts.push(`vie OneDriveen ${[up.changed ? `${n(up.changed)} muuttunutta` : '', up.added ? `${n(up.added)} uutta` : ''].filter(Boolean).join(' ja ')} tiedostoa`);
  if (down.changed || down.added) parts.push(`tuo OneDrivesta ${[down.changed ? `${n(down.changed)} muuttunutta` : '', down.added ? `${n(down.added)} uutta` : ''].filter(Boolean).join(' ja ')}`);
  if (up.deleted) parts.push(`poistaa OneDrivesta ${n(up.deleted)} tiedostoa ${n(total)}:stä`);
  if (down.deleted) parts.push(`poistaa Habitatista ${fiFiles(down.deleted)}`);
  const s = `Jatkaminen ${parts.join(', ').replace(/, ([^,]*)$/, ' ja $1')}.`;
  return up.deleted || down.deleted ? s : `${s} Mitään ei poisteta.`;
}
function enWould(up: Counts, down: Counts, total: number): string {
  const parts: string[] = [];
  if (up.changed || up.added) parts.push(`send ${[up.changed ? `${ne(up.changed)} changed` : '', up.added ? `${ne(up.added)} new` : ''].filter(Boolean).join(' and ')} files to OneDrive`);
  if (down.changed || down.added) parts.push(`bring ${[down.changed ? `${ne(down.changed)} changed` : '', down.added ? `${ne(down.added)} new` : ''].filter(Boolean).join(' and ')} from OneDrive`);
  if (up.deleted) parts.push(`delete ${ne(up.deleted)} of ${ne(total)} files from OneDrive`);
  if (down.deleted) parts.push(`delete ${enFiles(down.deleted)} from Habitat`);
  const s = `Continuing would ${parts.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
  return up.deleted || down.deleted ? s : `${s} Nothing is deleted.`;
}

const fi = {
  // Review chrome
  title: 'Synkronoinnin pysähdys ja lupa · kierros 1',
  scenario: 'Tilanne',
  theme: 'Teema', light: 'Vaalea', dark: 'Tumma',
  language: 'Kieli',
  reset: 'Alusta',
  simulate: 'Simuloi: tiedosto muuttuu laskelman jälkeen',
  simulated: 'Tiedosto muuttui Habitatissa laskelman jälkeen. Jatka nyt, niin Habitat kieltäytyy.',
  scenarios: {
    pysahtyi: 'Pysähtyi, odottaa päätöstä (oletus)',
    lasketaan: 'Lasketaan, mitä jatkaminen tekisi',
    eipoistoja: 'Laskelma: ei poistoja',
    poistoja: 'Laskelma: paljon poistoja',
    kaynnissa: 'Jatketaan kerran',
    valmis: 'Jatkettu, synkronointi taas tavallista',
    torjuttu: 'Ei jatkettu: tiedostot muuttuivat laskelman jälkeen',
    epaonnistui: 'Jatkaminen epäonnistui',
  } as Record<string, string>,
  roundLine: 'Sama kaikissa: kun kansion kaikki tiedostot muuttuvat kerralla, synkronointi pysähtyy eikä jatka itsestään. Ihminen voi pyytää yhden jatkamisen nähtyään laskelman (muuttuneet, uudet ja poistetut kummallakin puolella), ja lupa koskee vain sitä laskelmaa. Agentilta voi myös kysyä.',
  lines: [
    'A Rivi: pysähdys näkyy OneDriven omalla rivillä tuotannon virhetilan tapaan, ja rivillä on painike. Laskelma ja lupa ovat ikkunassa.',
    'B Ilmoitus: pysähdys on kortin yläosassa ilmoituksena, jossa on selitys ja kaksi painiketta (katso ja jatka, kysy agentilta). Laskelma ja lupa ovat ikkunassa.',
    'C Paneeli: pysähdys avaa kortissa OneDriven rivin alle paneelin, ja laskelma täyttyy siihen. Ikkuna vain vahvistaa.',
  ],
  recommend: 'Suositus: B. Pysähdys on kortin tärkein asia ja odottaa päätöstä, joten se kuuluu kortin yläosaan kuten tuotannon muutkin ilmoitukset, jotka odottavat ihmistä. Ikkuna pitää laskelman ja luvan yhdessä, joten lupa annetaan juuri näytetylle laskelmalle. A hukkuu viiden palvelurivin joukkoon. C tekee kortista raskaan ja jättää laskelman näkyviin, vaikka tiedostot ehtisivät muuttua.',
  away: 'Avautuisi uuteen välilehteen:',
  // Production's status line for the stop
  statusStopped: 'Pysähtyi: kaikki tiedostot muuttuivat kerralla',
  // The stop
  stopLead: 'OneDriven synkronointi pysähtyi.',
  stopWhy: 'Kaikki kansion tiedostot näyttävät muuttuneen yhtä aikaa. Niin käy, kun agentti muokkaa jokaista tiedostoa, mutta myös silloin, kun jokin on mennyt vikaan. Siksi synkronointi ei jatka itsestään. Tiedostot ovat tallessa sekä Habitatissa että OneDrivessa.',
  stopShort: 'Synkronointi ei jatka itsestään. Tiedostot ovat tallessa sekä Habitatissa että OneDrivessa.',
  panelTitle: 'Synkronointi pysähtyi',
  look: 'Katso, mitä jatkaminen tekisi…',
  lookAgain: 'Katso uudelleen…',
  count: 'Laske, mitä jatkaminen tekisi',
  countAgain: 'Laske uudelleen',
  askAgent: 'Kysy agentilta',
  askToast: 'Avautuisi uusi keskustelu, jossa agentille on valmiina viesti: ”OneDriven synkronointi pysähtyi, koska kaikki tiedostot muuttuivat. Katso, mitä on tapahtunut.” Agentti voi laskea saman laskelman ja jatkaa kerran, kun vastaat keskustelussa kyllä.',
  // The dry run
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
  showDeleted: (v: number) => `Näytä poistettavat tiedostot (${n(v)})`,
  andMore: (v: number) => `ja ${n(v)} muuta`,
  manyLead: (v: number, total: number) => `Jatkaminen poistaa OneDrivesta ${n(v)} tiedostoa ${n(total)}:stä.`,
  manyBody: 'Ne on poistettu Habitatissa. Jos et poistanut niitä tarkoituksella, älä jatka. Kysy agentilta, mitä tapahtui.',
  agree: 'Poistin nämä tiedostot tarkoituksella',
  confirm: 'Jatka kerran',
  confirmDelete: (v: number) => `Poista ${n(v)} tiedostoa ja jatka`,
  dontContinue: 'Älä jatka',
  continueOnce: 'Jatka kerran…',
  confirmTitle: 'Jatketaanko kerran?',
  // Outcomes
  cancelled: 'Ei jatkettu. Synkronointi odottaa yhä päätöstäsi.',
  running: 'Jatketaan kerran luvallasi. Sen jälkeen synkronointi jatkuu tavalliseen tapaan, ja seuraava samanlainen pysähdys kysyy taas.',
  doneFew: (up: Counts) => `${[up.changed ? `${n(up.changed)} muuttunutta` : '', up.added ? `${n(up.added)} uutta` : ''].filter(Boolean).join(' ja ')} tiedostoa vietiin OneDriveen.`,
  doneMany: (up: Counts) => `${n(up.deleted)} tiedostoa poistettiin OneDrivesta.`,
  doneAt: (time: string) => `Jatkettu kerran klo ${time}.`,
  doneTail: 'Synkronointi jatkuu taas tavalliseen tapaan.',
  refused: 'Ei jatkettu: tiedostot muuttuivat sen jälkeen, kun katsoit, joten lupasi ei koske niitä. Mitään ei muutettu.',
  failed: 'Jatkaminen keskeytyi, koska OneDriveen ei saatu yhteyttä. Osa tiedostoista ehti ehkä siirtyä. Synkronointi on yhä pysähdyksissä eikä jatka itsestään.',
};

type Text = typeof fi;

const en: Text = {
  title: 'Sync stop and consent · round 1',
  scenario: 'Situation',
  theme: 'Theme', light: 'Light', dark: 'Dark',
  language: 'Language',
  reset: 'Reset',
  simulate: 'Simulate: a file changes after the count',
  simulated: 'A file changed in Habitat after the count. Continue now and Habitat refuses.',
  scenarios: {
    pysahtyi: 'Stopped, waiting for a decision (default)',
    lasketaan: 'Counting what continuing would do',
    eipoistoja: 'Count: no deletions',
    poistoja: 'Count: many deletions',
    kaynnissa: 'Continuing once',
    valmis: 'Continued, sync back to normal',
    torjuttu: 'Not continued: files changed after the count',
    epaonnistui: 'Continuing failed',
  },
  roundLine: 'Same in all: when every file of a folder changes at once, sync stops and does not continue by itself. The person can ask for one continuation after seeing the count (changed, new and deleted on each side), and the consent covers only that count. The agent can be asked too.',
  lines: [
    'A Row: the stop shows on OneDrive\'s own row like production\'s failures, with a button in the row. The count and the consent are in a dialog.',
    'B Notice: the stop is a notice at the top of the card with the explanation and two buttons (look and continue, ask the agent). The count and the consent are in a dialog.',
    'C Panel: the stop opens a panel under OneDrive\'s row, and the count fills in there. The dialog only confirms.',
  ],
  recommend: 'Recommendation: B. The stop is the most important thing on the card and waits for a decision, so it belongs at the top like production\'s other notices that wait for the person. The dialog keeps the count and the consent together, so consent is given to exactly the count shown. A gets lost among five service rows. C makes the card heavy and leaves the count on screen even if the files change.',
  away: 'Would open in a new tab:',
  statusStopped: 'Stopped: every file changed at once',
  stopLead: 'OneDrive sync stopped.',
  stopWhy: 'Every file in the folder seems to have changed at the same time. That happens when an agent edits each file, but also when something has gone wrong. So sync does not continue by itself. Your files are kept both in Habitat and in OneDrive.',
  stopShort: 'Sync does not continue by itself. Your files are kept both in Habitat and in OneDrive.',
  panelTitle: 'Sync stopped',
  look: 'See what continuing would do…',
  lookAgain: 'Look again…',
  count: 'Count what continuing would do',
  countAgain: 'Count again',
  askAgent: 'Ask the agent',
  askToast: 'A new conversation would open with a message ready for the agent: “OneDrive sync stopped because every file changed. Look into what happened.” The agent can make the same count and continue once when you say yes in the conversation.',
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
  showDeleted: (v: number) => `Show the files to delete (${ne(v)})`,
  andMore: (v: number) => `and ${ne(v)} more`,
  manyLead: (v: number, total: number) => `Continuing deletes ${ne(v)} of ${ne(total)} files from OneDrive.`,
  manyBody: 'They were deleted in Habitat. If you did not delete them on purpose, do not continue. Ask the agent what happened.',
  agree: 'I deleted these files on purpose',
  confirm: 'Continue once',
  confirmDelete: (v: number) => `Delete ${ne(v)} files and continue`,
  dontContinue: 'Don\'t continue',
  continueOnce: 'Continue once…',
  confirmTitle: 'Continue once?',
  cancelled: 'Not continued. Sync is still waiting for your decision.',
  running: 'Continuing once with your consent. After that, sync carries on as usual, and the next stop like this asks again.',
  doneFew: (up: Counts) => `${[up.changed ? `${ne(up.changed)} changed` : '', up.added ? `${ne(up.added)} new` : ''].filter(Boolean).join(' and ')} files were sent to OneDrive.`,
  doneMany: (up: Counts) => `${ne(up.deleted)} files were deleted from OneDrive.`,
  doneAt: (time: string) => `Continued once at ${time}.`,
  doneTail: 'Sync carries on as usual again.',
  refused: 'Not continued: the files changed after you looked, so your consent does not cover them. Nothing was changed.',
  failed: 'Continuing stopped because OneDrive could not be reached. Some files may have been transferred. Sync is still stopped and does not continue by itself.',
};

export const TEXT: Record<Lang, Text> = {fi, en};
