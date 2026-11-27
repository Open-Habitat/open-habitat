// Round 2's own words in Finnish and English. Production components keep
// their own catalogs (setPersonalLanguage switches them). Each text says only
// what a person must read to act; the explanations round 1 showed open are
// behind one "Lisätietoja" per view (`more*`). wordcount.mjs counts these
// against round 1's text.ts, so a text that moves keeps its key's meaning.
// Entra's own names stay in English as the portal shows them. Every
// organisation, person and identifier is synthetic.

export type Lang = 'fi' | 'en';
export type LevelId = 'full' | 'nosend' | 'drafts' | 'read';

const fi = {
  title: 'Microsoft 365 usealle organisaatiolle · kierros 2',
  personSame: 'Henkilön näkymä on sama kaikissa suunnissa.',
  lines: [
    'Nyt: tuotanto tänään, yksi organisaatio.',
    'A1 Yhteenveto: rivillä "3 organisaatiota" ja Näytä, joka avaa listan rivin alle.',
    'A2 Painike: rivin painike Organisaatiot avaa listan ponnahdusikkunaan paikalleen.',
    'A3 Sirut: rivillä nimet siruina ja Hallitse…, joka avaa ikkunan.',
  ],
  view: 'Näkymä',
  views: {admin: 'Ylläpitäjä', person: 'Henkilö'},
  show: 'Näytä',
  scenarios: {
    lista: 'Integraatiot',
    auki: 'Organisaatiot auki',
    lisaa: 'Lisää organisaatio',
    hyvaksynta: 'Hyväksyntä ja viesti',
    poisto: 'Poisto',
    henkilo: 'Tiedot agenteille',
    taso: 'Yhdistä: taso',
    koodi: 'Yhdistä: laitekoodi',
    valmis: 'Yhdistetty',
    kielto: 'Kieltäytyminen',
  } as Record<string, string>,
  language: 'Kieli',
  theme: 'Teema',
  themes: {light: 'Päivä', dark: 'Yö'},
  reset: 'Alusta',
  wouldOpen: 'Avautuisi uuteen välilehteen:',
  copied: 'Kopioitu.',
  adminKicker: 'Palvelimen ylläpito',
  adminTitle: 'Integraatiot',
  personKicker: 'Asetukset',
  personTitle: 'Tiedot agenteille',
  notInRound: 'Ei kuulu tähän kierrokseen.',
  more: 'Lisätietoja',
  lessMore: 'Piilota lisätiedot',
  cancel: 'Peruuta',
  close: 'Sulje',
  done: 'Valmis',

  // The row and the list
  own: 'Oma',
  guest: 'vieraana',
  orgsCount: (n: number) => `${n} organisaatiota`,
  orgsShow: 'Näytä',
  orgsHide: 'Piilota',
  orgsButton: 'Organisaatiot',
  orgsManage: 'Hallitse…',
  orgsTitle: 'Organisaatiot',
  consentOpen: 'Hyväksyntä',
  removeOpen: 'Poista',
  addOrg: 'Lisää organisaatio',
  moreList: [
    'Näiden organisaatioiden ihmiset voivat yhdistää Microsoft 365:n. Nimet näkyvät kaikille palvelimen käyttäjille.',
    'Lista ei ole tietoturvaraja: sovellukset ovat yhteiset, ja oma agentti voi kirjautua Habitatin ohi. Asiakkaan tietoja rajaa asiakkaan Entra (Assignment required, hyväksynnän tai vierastilin poisto).',
  ],

  // Add
  addTitle: 'Lisää organisaatio',
  labelField: 'Nimi',
  labelHint: 'Näkyy palvelimen käyttäjille.',
  tenantField: 'Tenant ID',
  errLabel: 'Anna nimi.',
  errTenant: 'Anna tenant ID (GUID).',
  errDuplicate: (label: string) => `Jo listalla: ${label}.`,
  limitShort: 'Asiakkaan tietoja rajaa asiakkaan oma Entra, ei tämä lista.',
  moreAdd: [
    'Tenant ID löytyy asiakkaan Entra admin centeristä: Overview › Tenant ID.',
    'Lista ohjaa vain Habitatin omaa polkua. Sovellukset ovat kaikille organisaatioille yhteiset, ja ihmisen oma agentti tai komentorivi voi käyttää kirjautumistaan Habitatin ohi.',
  ],
  addSave: 'Lisää',
  addedToast: (label: string) => `${label} lisätty.`,

  // Consent
  consentTitle: (label: string) => `Hyväksyntä: ${label}`,
  consentLead: 'Lähetä viesti asiakkaan pääkäyttäjälle.',
  consentOwn: 'Oma organisaatiosi hyväksyi sovellukset, kun loit ne.',
  messageCopy: 'Kopioi viesti',
  linksTitle: 'Pelkät linkit',
  linkCopy: (level: string) => `Kopioi tason ${level} linkki`,
  moreConsent: [
    'Palvelin ei näe, onko organisaatio hyväksynyt. Ensimmäinen kirjautuminen kertoo sen; puuttuvasta hyväksynnästä kirjautuja saa viestin ja linkin.',
    'Osan tasoista voi jättää hyväksymättä.',
  ],
  levelShort: {full: 'Täysi', nosend: 'Ei lähetystä', drafts: 'Luonnokset', read: 'Vain luku'} as Record<LevelId, string>,
  message: (p: {org: string; publisher: string; links: {level: string; url: string}[]}) =>
    [
      'Hei,',
      '',
      `pyydämme hyväksymään organisaatioonne ${p.org} sovelluksen, jolla ihmisemme antavat tekoälyagenteilleen pääsyn heille jaettuihin Microsoft 365 -tietoihin.`,
      '',
      `Julkaisija on ${p.publisher}; Microsoft voi näyttää sen vahvistamattomana. Oikeudet ovat delegoituja: sovellus näkee vain sen, minkä kirjautunut henkilö näkee.`,
      '',
      'Hyväksykää yksi tai useampi taso:',
      ...p.links.map((l) => `${l.level}: ${l.url}`),
      '',
      'Hyväksyntään tarvitaan rooli Cloud Application Administrator. Lopuksi Microsoft näyttää tyhjän sivun. Sovelluksen voi rajata (Assignment required) tai poistaa kohdassa Enterprise applications.',
      '',
      'Terveisin',
      p.publisher,
    ].join('\n'),

  // Remove
  removeTitle: (label: string) => `Poistetaanko ${label}?`,
  removeBody: 'Organisaation Microsoft-yhteydet pysähtyvät tällä palvelimella. Microsoftissa ei peruta mitään.',
  removeOwn: 'Myös omien ihmistesi yhteydet pysähtyvät.',
  moreRemove: [
    'Ihmisten kortit kertovat syyn. Tiedostot jäävät koteihin. Jos lisäät organisaation takaisin, yhteydet jatkuvat ilman kirjautumista.',
    'Pääsyn katkaisee kokonaan vain organisaation oma pääkäyttäjä.',
  ],
  removeConfirm: 'Poista',
  removedToast: (label: string) => `${label} poistettu.`,

  // Person
  rowNot: 'Ei yhdistetty',
  connectShort: 'Yhdistä',
  orgChosen: (label: string) => label,
  orgGuestLine: 'Kirjaudu omalla työtililläsi.',
  simTitle: 'Kierroksen ohjaus:',
  simDone: 'Onnistui',
  simDoneGuest: 'Onnistui, ei postilaatikkoa',
  simRefuse: 'Kieltäytyy',
  guestFiles: 'Ei postilaatikkoa: vain tiedostot.',
  cardOrg: (label: string, how: string) => `${label} · ${how}`,
  guestOff: 'Posti, kalenteri ja yhteystiedot: ei vierastilillä.',

  // Refusals at connect
  refusals: {
    consent_required: {
      lead: (label: string, level: string) => `${label} ei ole hyväksynyt tasoa ${level}.`,
      body: 'Pyydä pääkäyttäjältä hyväksyntä ja yhdistä sitten uudelleen.',
      askCopy: 'Kopioi pyyntö',
      ask: (label: string, level: string, url: string) =>
        `Hei, hyväksyisittekö organisaatiollenne ${label} Habitatin Microsoft 365 -sovelluksen tasolle ${level}?\n${url}`,
    },
    not_in_organisation: {
      lead: (label: string) => `Sinulla ei ole tiliä organisaatiossa ${label}.`,
      body: 'Hyväksy ensin vieraskutsu.',
    },
    device_code_blocked: {
      lead: (label: string) => `${label} estää laitekoodilla kirjautumisen.`,
      body: 'Asiasta päättää heidän pääkäyttäjänsä.',
    },
    organisation_unavailable: {
      lead: (label: string) => `${label} ei ole sallittu tällä palvelimella.`,
      body: 'Kysy palvelimen ylläpitäjältä.',
    },
    expired: {
      lead: 'Koodi vanheni.',
      body: 'Aloita alusta.',
      client: 'Jos Microsoft pyysi pääkäyttäjän hyväksyntää, kopioi pyyntö.',
    },
  },
  restart: 'Aloita alusta',
};

export type Text = typeof fi;

const en: Text = {
  title: 'Microsoft 365 for several organisations · round 2',
  personSame: 'The person’s view is the same in every direction.',
  lines: [
    'Now: production today, one organisation.',
    'A1 Summary: the row says "3 organisations" with Show, which opens the list under the row.',
    'A2 Button: the row’s Organisations button opens the list in a popover in place.',
    'A3 Chips: the row shows the names as chips and Manage…, which opens a dialog.',
  ],
  view: 'View',
  views: {admin: 'Administrator', person: 'Person'},
  show: 'Show',
  scenarios: {
    lista: 'Integrations',
    auki: 'Organisations open',
    lisaa: 'Add organisation',
    hyvaksynta: 'Approval and message',
    poisto: 'Removal',
    henkilo: 'Data for agents',
    taso: 'Connect: level',
    koodi: 'Connect: device code',
    valmis: 'Connected',
    kielto: 'Refusal',
  } as Record<string, string>,
  language: 'Language',
  theme: 'Theme',
  themes: {light: 'Day', dark: 'Night'},
  reset: 'Reset',
  wouldOpen: 'Would open in a new tab:',
  copied: 'Copied.',
  adminKicker: 'Server administration',
  adminTitle: 'Integrations',
  personKicker: 'Settings',
  personTitle: 'Data for agents',
  notInRound: 'Not part of this round.',
  more: 'More information',
  lessMore: 'Hide more information',
  cancel: 'Cancel',
  close: 'Close',
  done: 'Done',

  own: 'Own',
  guest: 'guest',
  orgsCount: (n: number) => `${n} organisations`,
  orgsShow: 'Show',
  orgsHide: 'Hide',
  orgsButton: 'Organisations',
  orgsManage: 'Manage…',
  orgsTitle: 'Organisations',
  consentOpen: 'Approval',
  removeOpen: 'Remove',
  addOrg: 'Add organisation',
  moreList: [
    'People in these organisations can connect Microsoft 365. The names are visible to everyone on this server.',
    'The list is not a security boundary: the applications are shared, and a person’s own agent can sign in around Habitat. A client’s data is limited by the client’s Entra (Assignment required, removing the approval or the guest account).',
  ],

  addTitle: 'Add organisation',
  labelField: 'Name',
  labelHint: 'Visible to this server’s users.',
  tenantField: 'Tenant ID',
  errLabel: 'Enter a name.',
  errTenant: 'Enter a tenant ID (GUID).',
  errDuplicate: (label: string) => `Already listed: ${label}.`,
  limitShort: 'The client’s own Entra limits access to its data, not this list.',
  moreAdd: [
    'The tenant ID is in the client’s Entra admin center: Overview › Tenant ID.',
    'The list only steers Habitat’s own path. The applications are shared by every organisation, and a person’s own agent or command line can use their sign-in around Habitat.',
  ],
  addSave: 'Add',
  addedToast: (label: string) => `${label} added.`,

  consentTitle: (label: string) => `Approval: ${label}`,
  consentLead: 'Send the message to the client’s administrator.',
  consentOwn: 'Your own organisation approved the applications when you created them.',
  messageCopy: 'Copy message',
  linksTitle: 'Links only',
  linkCopy: (level: string) => `Copy the ${level} link`,
  moreConsent: [
    'The server cannot see whether the organisation has approved. The first sign-in shows it; a missing approval gives the person a message and the link.',
    'Some levels can be left unapproved.',
  ],
  levelShort: {full: 'Full', nosend: 'No sending', drafts: 'Drafts', read: 'Read only'},
  message: (p) =>
    [
      'Hello,',
      '',
      `we ask you to approve, for ${p.org}, an application our people use to give their AI agents access to Microsoft 365 data shared with them.`,
      '',
      `The publisher is ${p.publisher}; Microsoft may show it as unverified. The permissions are delegated: the application sees only what the signed-in person sees.`,
      '',
      'Approve one or more levels:',
      ...p.links.map((l) => `${l.level}: ${l.url}`),
      '',
      'Approving needs the Cloud Application Administrator role. Microsoft then shows a blank page. You can restrict the application (Assignment required) or remove it under Enterprise applications.',
      '',
      'Best regards',
      p.publisher,
    ].join('\n'),

  removeTitle: (label: string) => `Remove ${label}?`,
  removeBody: 'The organisation’s Microsoft connections stop on this server. Nothing is revoked at Microsoft.',
  removeOwn: 'Your own people’s connections stop too.',
  moreRemove: [
    'People’s cards say why. Files stay in their homes. Adding the organisation back resumes the connections without a sign-in.',
    'Only the organisation’s own administrator can cut access completely.',
  ],
  removeConfirm: 'Remove',
  removedToast: (label: string) => `${label} removed.`,

  rowNot: 'Not connected',
  connectShort: 'Connect',
  orgChosen: (label: string) => label,
  orgGuestLine: 'Sign in with your own work account.',
  simTitle: 'Round control:',
  simDone: 'Succeeds',
  simDoneGuest: 'Succeeds, no mailbox',
  simRefuse: 'Refuses',
  guestFiles: 'No mailbox: files only.',
  cardOrg: (label: string, how: string) => `${label} · ${how}`,
  guestOff: 'Mail, calendar and contacts: not for guest accounts.',

  refusals: {
    consent_required: {
      lead: (label, level) => `${label} has not approved the ${level} level.`,
      body: 'Ask their administrator to approve, then connect again.',
      askCopy: 'Copy request',
      ask: (label, level, url) => `Hello, could you approve Habitat’s Microsoft 365 application for ${label} at the ${level} level?\n${url}`,
    },
    not_in_organisation: {
      lead: (label) => `You have no account in ${label}.`,
      body: 'Accept the guest invitation first.',
    },
    device_code_blocked: {
      lead: (label) => `${label} blocks device code sign-in.`,
      body: 'Their administrator decides this.',
    },
    organisation_unavailable: {
      lead: (label) => `${label} is not allowed on this server.`,
      body: 'Ask the server’s administrator.',
    },
    expired: {
      lead: 'The code expired.',
      body: 'Start again.',
      client: 'If Microsoft asked for administrator approval, copy the request.',
    },
  },
  restart: 'Start again',
};

export const TEXT: Record<Lang, Text> = {fi, en};
