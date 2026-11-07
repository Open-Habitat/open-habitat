import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Settings › Käyttäjät ja pääsy (components/ServerAccess.tsx,
// app/ServerAccessSettings.tsx, app/serverAccess.ts).
const fi = {
  githubId: (id: string) => `GitHub-id ${id}`,
  noLogin: "GitHub-käyttäjätunnus ei saatavilla",
  uncertain: "Tila epävarma",
  pending: {
    remove: "Poistetaan · odottaa palvelinta",
    restore: "Palautetaan · odottaa palvelinta",
    add: "Lisätään · odottaa palvelinta",
    grant: "Nimetään ylläpitäjäksi · odottaa palvelinta",
    revoke: "Poistetaan ylläpitäjyys · odottaa palvelinta",
    forget: "Kuitataan · odottaa palvelinta",
  } as Record<string, string>,
  removing: "Poisto kesken",
  noAccess: "Ei pääsyä",
  removed: "Pääsy poistettu",
  adminFromFirst: "Ylläpitäjä ensimmäisestä kirjautumisesta",
  notSignedIn: "Ei vielä kirjautunut",
  admin: "Ylläpitäjä",
  user: "Käyttäjä",
  unix: "Unix:",
  allowedOn: (day: string) => `Sallittu ${day}`,
  lastSeen: (day: string) => `Viimeksi ${day}`,
  adminFromServer: "Ylläpitäjä palvelimen asetuksista",
  named: "Nimetty ylläpitäjäksi",
  removedOn: (day: string) => `Poistettu ${day}`,
  left: {
    no_access: "ei pääsyä",
    check_failed: "ei tarkistettu",
    unknown: "ei vastausta",
  } as Record<string, string>,
  aiKey: {
    seeded: "AI-avain annettu",
    already_present: "oma AI-avain",
    failed: "AI-avain epäonnistui",
    unknown: "AI-avain: ei vastausta",
  } as Record<string, string>,
  defaults: (done: number, total: number, preselected: boolean) =>
    `${done}/${total} oletusrepoa${preselected ? " tarjolla" : ""}`,
  onboarding: (day: string) => `Käyttöönotto ${day}`,
  refresh: "Päivitä",
  fromServer: "Palvelimen asetuksista",
  restore: "Palauta pääsy",
  removeNamed: (who: string) => `Poista ${who}`,
  removeAccess: "Poista pääsy",
  remove: "Poista",
  revokeNamed: (who: string) => `Poista ${who} ylläpitäjyys`,
  revoke: "Poista ylläpitäjyys",
  grantNamed: (who: string) => `Tee ${who} ylläpitäjäksi`,
  grant: "Tee ylläpitäjäksi",
  shapeHint: "Kirjaimia, numeroita ja yksittäisiä yhdysmerkkejä, enintään 39.",
  githubUnreachable: "GitHubiin ei saatu yhteyttä.",
  batch: {
    checking: "Tarkistetaan…",
    invalid: "Ei kelpaa GitHub-tunnukseksi.",
    problem: "",
    found: "Sallitaan",
    restore: "Pääsy palautetaan",
    duplicate: "",
    sending: "Lisätään…",
    added: "Lisätty",
    restored: "Palautettu",
    refused: "",
    uncertain: "Tila epävarma: päivitä lista.",
  } as Record<string, string>,
  previousPending: "Edellinen muutos on kesken.",
  alreadyUserUnix: (username: string) => `On jo käyttäjä (Unix: ${username}).`,
  alreadyUser: "On jo käyttäjä.",
  alreadyAllowed: "On jo sallittu.",
  closedOnServer: "Pääsy on suljettu palvelimella.",
  maxBatch: (n: number) => `Enintään ${n} nimeä kerralla.`,
  sameAccount: (login: string) => `Sama tili kuin @${login}.`,
  allowTitle: "Salli GitHub-tunnus tai tiimi",
  placeholder: "github-tunnus tai organisaatio/tiimi",
  allowN: (n: number) => `Salli ${n}`,
  allow: "Salli",
  check: "Tarkista",
  separators:
    "Useita nimiä voi erottaa pilkulla, välilyönnillä tai rivinvaihdolla. Tiimi muodossa organisaatio/tiimi: sen jäsenet pääsevät sisään niin kauan kuin kuuluvat siihen.",
  addTeam: "Lisää tiimi",
  teamFound: (name: string) =>
    `Tiimi ${name}: sen aktiiviset jäsenet voivat kirjautua ilman erillistä sallimista. Jäsenyys tarkistetaan GitHubista jokaisella kirjautumisella. Lähtijän seuraava kirjautuminen estetään; avoin istunto jatkuu.`,
  teamAlready: "Tiimi on jo pääsyn lähde.",
  teamMixed: "Lisää tiimi yksinään, ei muiden nimien kanssa.",
  teamShape:
    "Tiimi muodossa organisaatio/tiimi. Tiimin nimi kirjoitetaan kuten sen GitHub-osoitteessa: pienin kirjaimin, välilyönnit yhdysmerkkeinä.",
  teamUncertain: "Tiimin muutoksen tila on epävarma. Päivitä lista.",
  teamLine: (name: ReactNode, members: number, day: string): ReactNode => (
    <>
      Tiimi {name} · {members === 1 ? "1 jäsen" : `${members} jäsentä`} ·
      lisätty {day}
    </>
  ),
  teamWaiting:
    "Kukaan tiimin jäsen ei ole vielä kirjautunut. Ensimmäinen kirjautuminen sitoo tiimin sen GitHub-tunnisteeseen.",
  teamUnavailable: (day: string) =>
    `GitHub ei vastannut jäsenyyskyselyyn (${day}). Tarkista, että organisaatio on hyväksynyt Open Habitatin OAuth-sovelluksen (organisaation asetukset › Third-party access).`,
  detach: "Irrota…",
  detachNamed: (name: string) => `Irrota tiimi ${name}`,
  detachQuestion: (name: string) => `Irrota ${name}?`,
  detachEnds:
    "Tiimin kautta tulleiden pääsy päättyy heidän seuraavalla kirjautumisellaan. Avoimet istunnot jatkuvat; Poista pääsy päättää ne heti.",
  detachKeeps:
    "Henkilönä sallitut pitävät pääsynsä. Unix-tilit ja tiedostot jäävät.",
  detachConfirm: "Irrota",
  detaching: "Irrotetaan · odottaa palvelinta",
  chipServer: "palvelimen asetukset",
  chipIndividual: "henkilönä",
  chipIndividualRemoved: "henkilönä – poistettu",
  chipLeft: (name: string) => `${name} – lähti`,
  chipUnconfirmed: (name: string) => `${name} – ei vahvistettu`,
  leftMark: "Pääsy päättyi",
  unconfirmedMark: "Jäsenyys vahvistamatta",
  leftOn: (day: string) => `Lähti ${day}`,
  unconfirmedFact:
    "GitHub ei vastannut viimeisimmällä kirjautumisella; kirjautuminen estettiin.",
  leaverTitle: (who: string, teams: string) => `${who} lähti tiimistä ${teams}`,
  leaverDetail: (day: string) =>
    `Kirjautuminen estettiin (${day}). Avoin istunto jatkuu, kunnes se päättyy tai poistat pääsyn. Unix-tili ja tiedostot jäivät palvelimelle.`,
  allowAsPerson: "Salli henkilönä",
  dismiss: "Selvä",
  checkingGithub: "Tarkistetaan GitHubista…",
  sameUnix: "Palaa samalle Unix-tilille.",
  removeAccessQuestion: (who: string) => `Poista ${who} pääsy?`,
  removeQuestion: (who: string) => `Poista ${who}?`,
  cannotSignIn: "Ei voi enää kirjautua.",
  sessionsEnd: " Avoimet istunnot päättyvät.",
  unixStays: (username: ReactNode): ReactNode => (
    <>
      Unix-tili{username} ja tiedostot jäävät. Tilin voi poistaa komentorivillä.
    </>
  ),
  cancel: "Peruuta",
  grantQuestion: (who: string) => `Tee ${who} ylläpitäjäksi?`,
  grantEffect: "Voi hallita palvelimen asetuksia, pääsyä ja muita ylläpitäjiä.",
  grantWaiting: (id: string) =>
    `Rooli tulee voimaan, kun GitHub-tili ${id} kirjautuu ensimmäisen kerran. Se kuuluu tilille, ei nimelle: jos tunnus vaihtuu, rooli ei siirry.`,
  addDisabled: "Lisäys selaimesta on poissa käytöstä palvelimen asetuksissa.",
  open: "Pääsy on avoin: kuka tahansa GitHub-käyttäjä voi kirjautua.",
  people: "Henkilöt",
  person: "Henkilö",
  role: "Rooli",
  show: "Näytä",
  all: "Kaikki",
  joined: (n: number) => `Liittyneet ${n}`,
  allowed: (n: number) => `Ei kirjautuneet ${n}`,
  withdrawn: (n: number) => `Poistetut ${n}`,
  aiGiven: (day: string) => `AI-avain annettu ${day}`,
  earlierKey: " (aiempi avain)",
  unixRemains: (username: ReactNode): ReactNode => (
    <>Unix-tili {username} jää palvelimelle.</>
  ),
  nobody: "Ei henkilöitä.",
  sessionEnded: "Istunto on päättynyt. Kirjaudu uudelleen.",
  listFailed: "Käyttäjälistaa ei voitu ladata.",
  reload: "Lataa uudelleen",
  loading: "Ladataan käyttäjiä…",
  refreshFailed: "Listaa ei voitu päivittää.",
  refusals: {
    github_user_not_found: "GitHub-käyttäjää ei löydy.",
    github_not_user: "Tunnus ei ole henkilön GitHub-tili.",
    runtime_admission_disabled: "Lisäys selaimesta on poissa käytöstä.",
    runtime_admission_full: "Sallittujen lista on täynnä.",
    admission_open: "Pääsy on avoin kaikille.",
    operator_owned: "Tämä tulee palvelimen asetuksista.",
    not_admitted:
      "Henkilöllä ei ole pääsyä, joten häntä ei voi nimetä ylläpitäjäksi.",
    binding_drift:
      "Palvelin ei voinut vahvistaa käyttäjätiliä. Tarkista se komentorivillä.",
    admin_required: "Vain ylläpitäjä voi muuttaa pääsyä.",
    github_org_not_found: "GitHub-organisaatiota ei löydy.",
    github_lookup_unavailable: "GitHubiin ei saatu yhteyttä.",
    invalid_team:
      "Tiimi muodossa organisaatio/tiimi, pienin kirjaimin kuten sen GitHub-osoitteessa.",
  } as Record<string, string>,
  refused: "Palvelin ei tehnyt muutosta.",
};

export const serverAccessText = catalog(
  fi,
  {
    githubId: (id) => `GitHub id ${id}`,
    noLogin: "GitHub username not available",
    uncertain: "State uncertain",
    pending: {
      remove: "Removing · waiting for the server",
      restore: "Restoring · waiting for the server",
      add: "Adding · waiting for the server",
      grant: "Naming as administrator · waiting for the server",
      revoke: "Removing administrator role · waiting for the server",
      forget: "Acknowledging · waiting for the server",
    },
    removing: "Removal unfinished",
    noAccess: "No access",
    removed: "Access removed",
    adminFromFirst: "Administrator from the first sign-in",
    notSignedIn: "Not signed in yet",
    admin: "Administrator",
    user: "User",
    unix: "Unix:",
    allowedOn: (day) => `Allowed ${day}`,
    lastSeen: (day) => `Last seen ${day}`,
    adminFromServer: "Administrator from the server's settings",
    named: "Named administrator",
    removedOn: (day) => `Removed ${day}`,
    left: {
      no_access: "no access",
      check_failed: "not checked",
      unknown: "no answer",
    },
    aiKey: {
      seeded: "AI key given",
      already_present: "own AI key",
      failed: "AI key failed",
      unknown: "AI key: no answer",
    },
    defaults: (done, total, preselected) =>
      `${done}/${total} default repositories${preselected ? " offered" : ""}`,
    onboarding: (day) => `Onboarding ${day}`,
    refresh: "Refresh",
    fromServer: "From the server's settings",
    restore: "Restore access",
    removeNamed: (who) => `Remove ${who}`,
    removeAccess: "Remove access",
    remove: "Remove",
    revokeNamed: (who) => `Remove ${who}'s administrator role`,
    revoke: "Remove administrator role",
    grantNamed: (who) => `Make ${who} an administrator`,
    grant: "Make administrator",
    shapeHint: "Letters, digits and single hyphens, at most 39.",
    githubUnreachable: "GitHub could not be reached.",
    batch: {
      checking: "Checking…",
      invalid: "Not a valid GitHub username.",
      problem: "",
      found: "Allowing",
      restore: "Access is restored",
      duplicate: "",
      sending: "Adding…",
      added: "Added",
      restored: "Restored",
      refused: "",
      uncertain: "State uncertain: refresh the list.",
    },
    previousPending: "The previous change is under way.",
    alreadyUserUnix: (username) => `Already a user (Unix: ${username}).`,
    alreadyUser: "Already a user.",
    alreadyAllowed: "Already allowed.",
    closedOnServer: "Access is closed on the server.",
    maxBatch: (n) => `At most ${n} names at a time.`,
    sameAccount: (login) => `The same account as @${login}.`,
    allowTitle: "Allow a GitHub account or team",
    placeholder: "github-username or organization/team",
    allowN: (n) => `Allow ${n}`,
    allow: "Allow",
    check: "Check",
    separators:
      "Separate several names with commas, spaces or line breaks. A team as organization/team: its members can sign in as long as they belong to it.",
    addTeam: "Add team",
    teamFound: (name) =>
      `Team ${name}: its active members can sign in without being allowed one by one. Membership is checked with GitHub at every sign-in. A leaver's next sign-in is refused; an open session continues.`,
    teamAlready: "The team is already an admission source.",
    teamMixed: "Add a team on its own, not with other names.",
    teamShape:
      "A team as organization/team. Write the team name as in its GitHub address: lowercase, spaces as hyphens.",
    teamUncertain: "The team change's state is uncertain. Refresh the list.",
    teamLine: (name, members, day) => (
      <>
        Team {name} · {members === 1 ? "1 member" : `${members} members`} ·
        added {day}
      </>
    ),
    teamWaiting:
      "No team member has signed in yet. The first sign-in binds the team to its GitHub identifier.",
    teamUnavailable: (day) =>
      `GitHub did not answer the membership question on ${day}. Check that the organization has approved Open Habitat's OAuth app (organization settings › Third-party access).`,
    detach: "Detach…",
    detachNamed: (name) => `Detach team ${name}`,
    detachQuestion: (name) => `Detach ${name}?`,
    detachEnds:
      "Access through the team ends at each member's next sign-in. Open sessions continue; Remove access ends them at once.",
    detachKeeps:
      "People allowed one by one keep their access. Unix accounts and files stay.",
    detachConfirm: "Detach",
    detaching: "Detaching · waiting for the server",
    chipServer: "server settings",
    chipIndividual: "one by one",
    chipIndividualRemoved: "one by one – removed",
    chipLeft: (name) => `${name} – left`,
    chipUnconfirmed: (name) => `${name} – not confirmed`,
    leftMark: "Access ended",
    unconfirmedMark: "Membership unconfirmed",
    leftOn: (day) => `Left ${day}`,
    unconfirmedFact:
      "GitHub did not answer at the latest sign-in; the sign-in was refused.",
    leaverTitle: (who, teams) => `${who} left the team ${teams}`,
    leaverDetail: (day) =>
      `Their sign-in was refused on ${day}. An open session continues until it ends or you remove access. The Unix account and files stayed on the server.`,
    allowAsPerson: "Allow one by one",
    dismiss: "OK",
    checkingGithub: "Checking with GitHub…",
    sameUnix: "Returns to the same Unix account.",
    removeAccessQuestion: (who) => `Remove ${who}'s access?`,
    removeQuestion: (who) => `Remove ${who}?`,
    cannotSignIn: "Can no longer sign in.",
    sessionsEnd: " Open sessions end.",
    unixStays: (username) => (
      <>
        The Unix account{username} and the files stay. The account can be
        removed on the command line.
      </>
    ),
    cancel: "Cancel",
    grantQuestion: (who) => `Make ${who} an administrator?`,
    grantEffect:
      "Can manage the server's settings, access and other administrators.",
    grantWaiting: (id) =>
      `The role takes effect when the GitHub account ${id} signs in for the first time. It belongs to the account, not the name: if the username changes, the role does not move.`,
    addDisabled:
      "Adding from the browser is turned off in the server's settings.",
    open: "Access is open: any GitHub user can sign in.",
    people: "People",
    person: "Person",
    role: "Role",
    show: "Show",
    all: "All",
    joined: (n) => `Joined ${n}`,
    allowed: (n) => `Not signed in ${n}`,
    withdrawn: (n) => `Removed ${n}`,
    aiGiven: (day) => `AI key given ${day}`,
    earlierKey: " (earlier key)",
    unixRemains: (username) => (
      <>The Unix account {username} stays on the server.</>
    ),
    nobody: "No people.",
    sessionEnded: "The session has ended. Sign in again.",
    listFailed: "The user list could not be loaded.",
    reload: "Reload",
    loading: "Loading users…",
    refreshFailed: "The list could not be refreshed.",
    refusals: {
      github_user_not_found: "The GitHub user was not found.",
      github_not_user: "The account is not a person's GitHub account.",
      runtime_admission_disabled: "Adding from the browser is turned off.",
      runtime_admission_full: "The list of allowed people is full.",
      admission_open: "Access is open to everyone.",
      operator_owned: "This comes from the server's settings.",
      not_admitted:
        "The person has no access, so they cannot be named administrator.",
      binding_drift:
        "The server could not confirm the user account. Check it on the command line.",
      admin_required: "Only an administrator can change access.",
      github_org_not_found: "The GitHub organization was not found.",
      github_lookup_unavailable: "GitHub could not be reached.",
      invalid_team:
        "A team as organization/team, lowercase as in its GitHub address.",
    },
    refused: "The server made no change.",
  },
  {
    placeholder: "github-username or organisation/team",
    separators:
      "Separate several names with commas, spaces or line breaks. A team as organisation/team: its members can sign in as long as they belong to it.",
    teamShape:
      "A team as organisation/team. Write the team name as in its GitHub address: lowercase, spaces as hyphens.",
    teamUnavailable: (day) =>
      `GitHub did not answer the membership question on ${day}. Check that the organisation has approved Open Habitat's OAuth app (organisation settings › Third-party access).`,
    refusals: {
      github_org_not_found: "The GitHub organisation was not found.",
      invalid_team:
        "A team as organisation/team, lowercase as in its GitHub address.",
    },
  },
);
