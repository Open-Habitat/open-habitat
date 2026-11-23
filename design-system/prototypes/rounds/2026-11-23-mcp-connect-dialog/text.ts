// The round's own words in Finnish and English. Production rows (the page,
// the Nyt direction) follow the same language through setPersonalLanguage.
export type Lang = 'fi' | 'en';
export type P = 'trello' | 'atlassian';
export type LevelId = 'read' | 'full';

const SITE = 'contoso-demo.atlassian.net';

const fi = {
  title: 'Atlassian- ja Trello-yhteys · kierros 1',
  roundLine: 'Akseli: missä Trellon ja Atlassianin suostumussivun valinnat selitetään – ennen sivua, vaiheina vai jälkeen kuittina. Kaikissa sama: tasokuvaus kerran, ylläpitäjän pyyntö vasta kun palvelu sitä vaatii, uudelleenvalinta samalla tasolla ja kapeampi lupa palvelun omin syin.',
  lines: [
    'Nyt: tuotannon dialogi ja tilikortti muuttamattomina.',
    'Esikatselu: ennen kirjautumista dialogi näyttää kaavion siitä, mitä palvelu kysyy, ja korostaa valinnan, joka ratkaisee tason.',
    'Vaiheet: dialogi on neljä lyhyttä vaihetta (taso, palvelussa, paluuosoite, valmis); palvelun valinnat ovat oma vaiheensa ennen sivun avaamista.',
    'Kuitti: alku on lyhyt ja painopiste lopussa: kuitti vertaa pyydettyä ja myönnettyä, ja sama vertailu Workspacen tai sivuston nimellä jää tilikortille.',
  ],
  scenario: 'Tilanne', provider: 'Palvelu', theme: 'Teema', light: 'Päivä', dark: 'Yö',
  motion: 'Liike', motionSystem: 'Järjestelmä', motionReduce: 'Vähennetty', language: 'Kieli', reset: 'Alusta',
  scenarios: {
    'uusi-luku': 'Uusi yhteys: vain luku',
    'uusi-kirjoitus': 'Uusi yhteys: luku ja muokkaus',
    paluuosoite: 'Paluuosoitteen liittäminen',
    odottaa: 'Odottaa ylläpitäjää',
    yhdistetty: 'Yhdistetty pyydetyllä tasolla',
    kapeampi: 'Myönnettiin vähemmän kuin pyydettiin',
    'kapeampi-kortti': 'Tilikortti: kapeampi lupa',
    korjaus: 'Väärä Workspace tai sivusto: valitse uudelleen',
  } as Record<string, string>,
  providers: { trello: 'Trello', atlassian: 'Atlassian (Jira, Confluence)' } as Record<P, string>,
  wouldOpen: 'Avautuisi uuteen välilehteen:',

  name: { trello: 'Trello', atlassian: 'Atlassian' } as Record<P, string>,
  inP: { trello: 'Trellossa', atlassian: 'Atlassianissa' } as Record<P, string>,
  titleConnect: (n: string) => `Yhdistä tili: ${n}`,
  titleAgain: (n: string) => `Valitse uudelleen: ${n}`,
  whatMay: 'Mitä agentit saavat tehdä?',
  levels: {
    trello: {
      read: { name: 'Vain luku', sum: 'Lukevat ja hakevat tauluja, kortteja ja kommentteja. Eivät muuta mitään.' },
      full: { name: 'Luku ja muokkaus', sum: 'Voivat myös luoda, siirtää ja muokata kortteja ja kommentoida. Workspacen asetuksiin eivät koske.' },
    },
    atlassian: {
      read: { name: 'Vain luku', sum: 'Hakevat ja lukevat Jira-tehtäviä ja Confluence-sivuja. Eivät muuta mitään.' },
      full: { name: 'Luku ja muokkaus', sum: 'Voivat myös luoda ja muokata tehtäviä ja sivuja ja kommentoida.' },
    },
  } as Record<P, Record<LevelId, { name: string; sum: string }>>,
  asksHead: (p: P) => `${p === 'trello' ? 'Trello' : 'Atlassian'} kysyy seuraavaksi`,
  asks: (p: P, level: LevelId) => p === 'trello' ? [
    'Kirjaudu Atlassian-tililläsi.',
    'Valitse Workspace. Yhteys pääsee yhteen Workspaceen; toiseen tarvitset toisen Trello-yhteyden.',
    level === 'full'
      ? 'Hyväksy oikeudet. Pidä muokkaus valittuna, muuten agentit voivat vain lukea.'
      : 'Hyväksy oikeudet. Trello voi tarjota enemmän kuin pyydettiin; näet lopuksi, mitä se myönsi.',
  ] : [
    'Kirjaudu Atlassian-tililläsi.',
    `Valitse sivusto, esimerkiksi ${SITE}.`,
    level === 'full'
      ? 'Hyväksy. Organisaatiosi voi silti rajata kirjoituksen; näet lopuksi, mitä Atlassian myönsi.'
      : 'Hyväksy. Näet lopuksi, mitä Atlassian myönsi.',
  ],
  endPage: 'Lopuksi selain näyttää sivun, joka ei aukea. Se on odotettu: kopioit sen osoitteen tänne.',
  schematic: 'Kaavio, ei palvelun oikea sivu',
  mock: {
    trello: { where: 'Workspace', pick: 'Valitse yksi', read: 'Lukea tauluja, kortteja ja kommentteja', write: 'Luoda, siirtää ja muokata kortteja' },
    atlassian: { where: 'Sivusto', pick: SITE, read: 'Hakea ja lukea Jiraa ja Confluencea', write: 'Kirjoittaa Jiraan ja Confluenceen' },
  } as Record<P, { where: string; pick: string; read: string; write: string }>,
  keepSel: 'Pidä valittuna', notAsked: 'Ei pyydetä', perms: 'Oikeudet',
  continueTo: (s: string) => `Jatka: ${s}`,
  next: 'Seuraava', back: 'Takaisin',
  open: (s: string) => `Avaa ${s}`,
  cancel: 'Peruuta', close: 'Sulje', done: 'Valmis',
  steps: (p: P) => ['Taso', p === 'trello' ? 'Trellossa' : 'Atlassianissa', 'Paluuosoite', 'Valmis'],
  stepsLabel: 'Vaiheet',
  inStepLead: (p: P) => `${p === 'trello' ? 'Trellossa' : 'Atlassianissa'} teet kolme valintaa`,
  pasteHead: (s: string) => `Liitä osoite, johon ${s} lopuksi ohjasi`,
  pasteHelp: 'Kopioi aukeamattoman sivun osoiteriviltä koko osoite ja liitä se tähän.',
  field: 'Paluuosoite',
  pasteFirst: 'Liitä ensin osoite.',
  notThat: (prefix: string) => `Tämä ei ole se osoite. Oikea alkaa ${prefix}.`,
  connect: 'Yhdistä',
  openAgain: (s: string) => `Avaa ${s} uudelleen`,
  validFor: 'Kirjautuminen on voimassa vielä 18 min.',
  stuck: (p: P) => `${p === 'trello' ? 'Trello' : 'Atlassian'} sanoo, että ylläpitäjän pitää hyväksyä`,
  adminHead: 'Pyydä ylläpitäjältä lupa',
  adminHelp: 'Organisaatiosi Atlassian-ylläpitäjän pitää sallia yhteys. Kopioi pyyntö ja lähetä se hänelle; Habitat ei lähetä mitään. Kun lupa on annettu, aloita yhdistäminen alusta.',
  request: {
    trello: 'Hei, haluan käyttää Trelloa Open Habitatin agenttien kautta omalla Atlassian-tililläni (Trellon MCP-palvelin https://mcp.trello.com/v1). Atlassian Administrationissa, Connectors › Atlassian MCP server: salli Trello, Read ja tarvittaessa Write. Kirjautuminen palaa osoitteeseen http://127.0.0.1:<portti>/callback; jos tuetut osoitteet eivät jo salli sitä, Atlassianin dokumentoima sääntö on http://127.0.0.1:*/** (se sallii myös muut natiivit asiakkaat). Jos IP-sallintalista on käytössä, salli Habitat-palvelimen ulospäin näkyvä osoite.',
    atlassian: 'Hei, haluan käyttää Jiraa ja Confluencea Open Habitatin agenttien kautta omalla Atlassian-tililläni. Atlassian Administrationissa, Connectors › Atlassian MCP server: Read ja Search päälle, Write tarvittaessa. Kirjautuminen palaa osoitteeseen http://127.0.0.1:<portti>/callback; jos tuetut osoitteet eivät jo salli sitä, Atlassianin dokumentoima sääntö on http://127.0.0.1:*/** (se sallii myös muut natiivit asiakkaat). Jos IP-sallintalista on käytössä, salli Habitat-palvelimen ulospäin näkyvä osoite.',
  } as Record<P, string>,
  copy: 'Kopioi pyyntö', copied: 'Kopioitu',
  startOver: 'Aloita alusta',
  againLead: (p: P) => p === 'trello'
    ? 'Trello kysyy Workspacen ja oikeudet uudelleen. Voit pitää saman tason tai vaihtaa sen.'
    : 'Atlassian kysyy sivuston ja oikeudet uudelleen. Voit pitää saman tason tai vaihtaa sen.',
  againOld: 'Vanha lupa poistuu, kun jatkat. Jos keskeytät, yhteys jää kirjautumatta, kunnes kirjaudut uudelleen.',
  current: 'nykyinen',
  connected: (lvl: string) => `Yhdistetty: ${lvl}.`,
  connectedRest: 'Uudet keskustelut näkevät yhteyden heti.',
  narrowHead: (p: P) => p === 'trello' ? 'Trello myönsi vain luvun.' : 'Atlassian ei myöntänyt kirjoitusta Confluenceen.',
  narrowWhy: (p: P) => p === 'trello'
    ? 'Pyysit myös muokkausta. Syitä on kaksi: suostumussivulla jäi muokkaus hyväksymättä, tai organisaatiosi ylläpitäjä on estänyt Trellon muokkauksen.'
    : 'Pyysit kirjoitusta Jiraan ja Confluenceen, ja Jira sai sen. Confluencen kirjoituksen on yleensä estänyt organisaatiosi ylläpitäjä Atlassianin MCP-asetuksissa, tai sinulla ei ole Confluencessa muokkausoikeutta.',
  narrowFix: (p: P) => p === 'trello'
    ? 'Valitse oikeudet uudelleen ja pidä muokkaus valittuna. Jos Trello myöntää taas vain luvun, syy on ylläpitäjän asetus.'
    : 'Valitse uudelleen, jos epäilet valinnan jääneen kesken. Muuten pyydä ylläpitäjää sallimaan kirjoitus.',
  chooseAgain: 'Valitse oikeudet uudelleen',
  keep: 'Pidä näin',
  askAdmin: 'Pyyntö ylläpitäjälle',
  asked: 'Pyysit', got: (p: P) => `${p === 'trello' ? 'Trello' : 'Atlassian'} myönsi`,
  rows: {
    trello: ['Luku ja haku', 'Muokkaus'],
    atlassian: ['Luku ja haku', 'Kirjoitus Jiraan', 'Kirjoitus Confluenceen'],
  } as Record<P, string[]>,
  where: { trello: 'Workspace', atlassian: 'Sivusto' } as Record<P, string>,
  yes: 'Kyllä', no: 'Ei', notRequested: 'Ei pyydetty',
  receipt: 'Kuitti',
  again: 'Valitse uudelleen…',
  change: 'Muuta…',
  changeLevel: 'Vaihda taso…',
  reconsentRow: (p: P) => p === 'trello'
    ? 'Väärä Workspace tai oikeudet? Valitse ne uudelleen samalla tasolla.'
    : 'Väärä sivusto tai oikeudet? Valitse ne uudelleen samalla tasolla.',
  chosenAt: (p: P) => p === 'trello' ? 'Valittu Trellon suostumussivulla' : 'Valittu Atlassianin suostumussivulla',
  check: 'Tarkista', remove: 'Poista',
  svc: { trello: 'Trello-taulut ja -kortit', jira: 'Jira-tehtävät', confluence: 'Confluence-sivut' } as Record<string, string>,
  can: { read: 'Vain luku.', full: 'Luku ja muokkaus.' } as Record<string, string>,
  checkedAt: 'Tarkistettu 9.12',
  grantList: (n: number) => `Myönnetyt oikeudet (${n})`,
  askedNot: 'pyydettiin, ei myönnetty',
  works: 'Toimii',
};

type T = typeof fi;
const en: T = {
  title: 'Atlassian and Trello connection · round 1',
  roundLine: 'Axis: where the choices on Trello\'s and Atlassian\'s consent page are explained – before the page, as steps, or afterwards as a receipt. The same in all: the level described once, the administrator request only when the service asks for it, choosing again at the same level, and a narrower grant explained with the service\'s own reasons.',
  lines: [
    'Now: the production dialog and account card unchanged.',
    'Preview: before sign-in the dialog shows a sketch of what the service asks and highlights the choice that decides the level.',
    'Steps: the dialog is four short steps (level, at the service, return address, done); the service\'s choices are a step of their own before the page opens.',
    'Receipt: a short start and the weight at the end: a receipt compares what was requested with what was granted, and the account card keeps the same comparison with the Workspace or site name.',
  ],
  scenario: 'Situation', provider: 'Service', theme: 'Theme', light: 'Day', dark: 'Night',
  motion: 'Motion', motionSystem: 'System', motionReduce: 'Reduced', language: 'Language', reset: 'Reset',
  scenarios: {
    'uusi-luku': 'New connection: read only',
    'uusi-kirjoitus': 'New connection: read and edit',
    paluuosoite: 'Pasting the return address',
    odottaa: 'Waiting for the administrator',
    yhdistetty: 'Connected at the requested level',
    kapeampi: 'Granted less than requested',
    'kapeampi-kortti': 'Account card: narrower grant',
    korjaus: 'Wrong Workspace or site: choose again',
  },
  providers: { trello: 'Trello', atlassian: 'Atlassian (Jira, Confluence)' },
  wouldOpen: 'Would open in a new tab:',
  name: { trello: 'Trello', atlassian: 'Atlassian' },
  inP: { trello: 'At Trello', atlassian: 'At Atlassian' },
  titleConnect: (n) => `Connect an account: ${n}`,
  titleAgain: (n) => `Choose again: ${n}`,
  whatMay: 'What may agents do?',
  levels: {
    trello: {
      read: { name: 'Read only', sum: 'Read and search boards, cards and comments. Change nothing.' },
      full: { name: 'Read and edit', sum: 'Can also create, move and edit cards and comment. Do not touch Workspace settings.' },
    },
    atlassian: {
      read: { name: 'Read only', sum: 'Search and read Jira issues and Confluence pages. Change nothing.' },
      full: { name: 'Read and edit', sum: 'Can also create and edit issues and pages and comment.' },
    },
  },
  asksHead: (p) => `${p === 'trello' ? 'Trello' : 'Atlassian'} asks next`,
  asks: (p, level) => p === 'trello' ? [
    'Sign in with your Atlassian account.',
    'Choose a Workspace. A connection reaches one Workspace; another needs another Trello connection.',
    level === 'full'
      ? 'Accept the permissions. Keep editing selected, or agents can only read.'
      : 'Accept the permissions. Trello may offer more than requested; you see at the end what it granted.',
  ] : [
    'Sign in with your Atlassian account.',
    `Choose a site, for example ${SITE}.`,
    level === 'full'
      ? 'Accept. Your organisation can still limit writing; you see at the end what Atlassian granted.'
      : 'Accept. You see at the end what Atlassian granted.',
  ],
  endPage: 'At the end the browser shows a page that does not load. That is expected: you copy its address here.',
  schematic: 'A sketch, not the service\'s real page',
  mock: {
    trello: { where: 'Workspace', pick: 'Choose one', read: 'Read boards, cards and comments', write: 'Create, move and edit cards' },
    atlassian: { where: 'Site', pick: SITE, read: 'Search and read Jira and Confluence', write: 'Write to Jira and Confluence' },
  },
  keepSel: 'Keep selected', notAsked: 'Not requested', perms: 'Permissions',
  continueTo: (s) => `Continue: ${s}`,
  next: 'Next', back: 'Back',
  open: (s) => `Open ${s}`,
  cancel: 'Cancel', close: 'Close', done: 'Done',
  steps: (p) => ['Level', p === 'trello' ? 'At Trello' : 'At Atlassian', 'Return address', 'Done'],
  stepsLabel: 'Steps',
  inStepLead: (p) => `${p === 'trello' ? 'At Trello' : 'At Atlassian'} you make three choices`,
  pasteHead: (s) => `Paste the address ${s} finally sent you to`,
  pasteHelp: 'Copy the whole address from the address bar of the page that did not load and paste it here.',
  field: 'Return address',
  pasteFirst: 'Paste the address first.',
  notThat: (prefix) => `This is not that address. The right one starts ${prefix}.`,
  connect: 'Connect',
  openAgain: (s) => `Open ${s} again`,
  validFor: 'The sign-in is valid for 18 more minutes.',
  stuck: (p) => `${p === 'trello' ? 'Trello' : 'Atlassian'} says an administrator must approve`,
  adminHead: 'Ask your administrator for permission',
  adminHelp: 'Your organisation\'s Atlassian administrator must allow the connection. Copy the request and send it to them; Habitat sends nothing. Once allowed, start connecting again.',
  request: {
    trello: 'Hi, I want to use Trello through Open Habitat agents with my own Atlassian account (Trello\'s MCP server https://mcp.trello.com/v1). In Atlassian Administration, Connectors › Atlassian MCP server: allow Trello, Read and, if needed, Write. Sign-in returns to http://127.0.0.1:<port>/callback; if the supported domains do not already allow it, Atlassian\'s documented rule is http://127.0.0.1:*/** (it also permits other native clients). If an IP allowlist is in use, allow the Habitat server\'s outgoing address.',
    atlassian: 'Hi, I want to use Jira and Confluence through Open Habitat agents with my own Atlassian account. In Atlassian Administration, Connectors › Atlassian MCP server: Read and Search on, Write if needed. Sign-in returns to http://127.0.0.1:<port>/callback; if the supported domains do not already allow it, Atlassian\'s documented rule is http://127.0.0.1:*/** (it also permits other native clients). If an IP allowlist is in use, allow the Habitat server\'s outgoing address.',
  },
  copy: 'Copy request', copied: 'Copied',
  startOver: 'Start over',
  againLead: (p) => p === 'trello'
    ? 'Trello asks for the Workspace and permissions again. You can keep the same level or change it.'
    : 'Atlassian asks for the site and permissions again. You can keep the same level or change it.',
  againOld: 'The previous grant is removed when you continue. If you stop, the connection stays signed out until you sign in again.',
  current: 'current',
  connected: (lvl) => `Connected: ${lvl}.`,
  connectedRest: 'New conversations see the connection at once.',
  narrowHead: (p) => p === 'trello' ? 'Trello granted read only.' : 'Atlassian did not grant writing to Confluence.',
  narrowWhy: (p) => p === 'trello'
    ? 'You also asked for editing. There are two reasons: editing was left unaccepted on the consent page, or your organisation\'s administrator has blocked editing in Trello.'
    : 'You asked for writing to Jira and Confluence, and Jira got it. Writing to Confluence is usually blocked by your organisation\'s administrator in Atlassian\'s MCP settings, or you cannot edit in Confluence.',
  narrowFix: (p) => p === 'trello'
    ? 'Choose the permissions again and keep editing selected. If Trello again grants read only, the reason is the administrator\'s setting.'
    : 'Choose again if you think the choice was cut short. Otherwise ask the administrator to allow writing.',
  chooseAgain: 'Choose permissions again',
  keep: 'Keep as is',
  askAdmin: 'Request to administrator',
  asked: 'You asked', got: (p) => `${p === 'trello' ? 'Trello' : 'Atlassian'} granted`,
  rows: { trello: ['Read and search', 'Editing'], atlassian: ['Read and search', 'Writing to Jira', 'Writing to Confluence'] },
  where: { trello: 'Workspace', atlassian: 'Site' },
  yes: 'Yes', no: 'No', notRequested: 'Not requested',
  receipt: 'Receipt',
  again: 'Choose again…',
  change: 'Change…',
  changeLevel: 'Change level…',
  reconsentRow: (p) => p === 'trello'
    ? 'Wrong Workspace or permissions? Choose them again at the same level.'
    : 'Wrong site or permissions? Choose them again at the same level.',
  chosenAt: (p) => p === 'trello' ? 'Chosen on Trello\'s consent page' : 'Chosen on Atlassian\'s consent page',
  check: 'Check', remove: 'Remove',
  svc: { trello: 'Trello boards and cards', jira: 'Jira issues', confluence: 'Confluence pages' },
  can: { read: 'Read only.', full: 'Read and edit.' },
  checkedAt: 'Checked 9:12',
  grantList: (n) => `Granted permissions (${n})`,
  askedNot: 'asked, not granted',
  works: 'Works',
};
export const TEXT: Record<Lang, T> = { fi, en };
