import { catalog } from "../i18n";

// Palvelinintegraatiot › Microsoft 365 › Organisaatiot: the row's two count
// buttons and the organisations dialog with its add, approval and removal
// steps (components/MicrosoftOrganisations.tsx), as prototype round 4
// (2026-11-27-entra-organisaatiot-4) approved them. Entra's own names stay in
// English as the portal shows them. The approval message is sent as it is to
// another organisation's administrator.
//
// Agent note: the list is root's integrations file's microsoft_tenants; the
// server cannot see whether an organisation approved the shared applications,
// so the dialog never claims it did. Removing an organisation stops its
// connections on this server at their next use and revokes nothing.
const fi = {
  // The row
  orgsButton: "Organisaatiot",
  /** The buttons' accessible names and tooltips carry what the count stands for. */
  orgsName: (n: number, names: string) => `Organisaatiot, ${n}: ${names}`,
  levelsName: (set: string, missing: boolean) =>
    missing ? `Tasot, ${set}. Aseta puuttuvat.` : `Tasot, ${set}`,

  // The list
  dialogTitle: "Microsoft 365: organisaatiot",
  own: "Oma",
  /** The operator's own organisation when the allowed list does not name it. */
  ownUnnamed: "Oma organisaatio",
  stateOwn: "Hyväksytty, kun loit sovellukset",
  stateUnknown: "Hyväksyntä ei näy palvelimelle",
  consentOpen: "Hyväksyntä",
  consentOf: (label: string) => `Hyväksyntä: ${label}`,
  removeOf: (label: string) => `Poista ${label}`,
  addOrg: "Lisää organisaatio",
  done: "Valmis",
  back: "Takaisin",
  cancel: "Peruuta",
  more: "Lisätietoja",
  lessMore: "Piilota lisätiedot",
  moreList: [
    "Näiden organisaatioiden ihmiset voivat yhdistää Microsoft 365:n. Nimet näkyvät kaikille palvelimen käyttäjille.",
    "Lista ei ole tietoturvaraja: sovellukset ovat yhteiset, ja oma agentti voi kirjautua Habitatin ohi. Asiakkaan tietoja rajaa asiakkaan Entra (Assignment required, hyväksynnän tai vierastilin poisto).",
  ],
  /** No shared (multi-tenant) application is set, so a listed client
   * organisation cannot connect yet. */
  noShared:
    "Muiden organisaatioiden ihmiset voivat yhdistää vasta, kun usean organisaation sovellukset on asetettu (Tasot › Useita organisaatioita).",
  listInvalid:
    "Palvelimen organisaatiolista on virheellinen, joten mitään organisaatiota ei palvella yhteisillä sovelluksilla. Sen voi korjata vain palvelimella.",
  setupOff:
    "Organisaatioiden muuttaminen selaimesta on poissa käytöstä palvelimen asetuksissa.",

  // Add
  addTitle: "Lisää organisaatio",
  labelField: "Nimi",
  labelHint: "Näkyy palvelimen käyttäjille.",
  tenantField: "Tenant ID",
  errLabel: "Anna nimi.",
  errTenant: "Anna tenant ID (GUID).",
  errDuplicate: (label: string) => `Jo listalla: ${label}.`,
  limitShort: "Asiakkaan tietoja rajaa asiakkaan oma Entra, ei tämä lista.",
  moreAdd: [
    "Tenant ID löytyy asiakkaan Entra admin centeristä: Overview › Tenant ID.",
    "Lista ohjaa vain Habitatin omaa polkua. Sovellukset ovat kaikille organisaatioille yhteiset, ja ihmisen oma agentti tai komentorivi voi käyttää kirjautumistaan Habitatin ohi.",
  ],
  addSave: "Lisää",
  added: (label: string) => `${label} lisätty.`,

  // Approval
  consentTitle: (label: string) => `Hyväksyntä: ${label}`,
  consentLead: "Lähetä viesti asiakkaan pääkäyttäjälle.",
  consentOwn: "Oma organisaatiosi hyväksyi sovellukset, kun loit ne.",
  consentNone:
    "Tälle organisaatiolle ei ole vielä sovelluksia, joten hyväksyttävää ei ole.",
  /** The message's publisher when the allowed list does not name the
   * operator's own organisation: the administrator fills it in. */
  publisherUnknown: "<organisaationne nimi>",
  messageLabel: "Viesti asiakkaan pääkäyttäjälle",
  messageCopy: "Kopioi viesti",
  linksTitle: "Pelkät linkit",
  linkCopy: (level: string) => `Kopioi tason ${level} linkki`,
  copied: "Kopioitu.",
  moreConsent: [
    "Palvelin ei näe, onko organisaatio hyväksynyt. Ensimmäinen kirjautuminen kertoo sen; puuttuvasta hyväksynnästä kirjautuja saa viestin ja linkin.",
    "Osan tasoista voi jättää hyväksymättä.",
  ],
  message: (p: {
    org: string;
    publisher: string;
    links: { level: string; url: string }[];
  }) =>
    [
      "Hei,",
      "",
      `pyydämme hyväksymään organisaatioonne ${p.org} sovelluksen, jolla ihmisemme antavat tekoälyagenteilleen pääsyn heille jaettuihin Microsoft 365 -tietoihin.`,
      "",
      `Julkaisija on ${p.publisher}; Microsoft voi näyttää sen vahvistamattomana. Oikeudet ovat delegoituja: sovellus näkee vain sen, minkä kirjautunut henkilö näkee.`,
      "",
      "Hyväksykää yksi tai useampi taso:",
      ...p.links.map((l) => `${l.level}: ${l.url}`),
      "",
      "Hyväksyntään tarvitaan rooli Cloud Application Administrator. Lopuksi Microsoft näyttää tyhjän sivun. Sovelluksen voi rajata (Assignment required) tai poistaa kohdassa Enterprise applications.",
      "",
      "Terveisin",
      p.publisher,
    ].join("\n"),

  // Remove
  removeTitle: (label: string) => `Poistetaanko ${label}?`,
  removeBody:
    "Organisaation Microsoft-yhteydet pysähtyvät tällä palvelimella. Microsoftissa ei peruta mitään.",
  removeOwn: "Myös omien ihmistesi yhteydet pysähtyvät.",
  moreRemove: [
    "Ihmisten kortit kertovat syyn. Tiedostot jäävät koteihin. Jos lisäät organisaation takaisin, yhteydet jatkuvat ilman kirjautumista.",
    "Pääsyn katkaisee kokonaan vain organisaation oma pääkäyttäjä.",
  ],
  removeConfirm: "Poista",
  removed: (label: string) => `${label} poistettu.`,

  // A write's outcome
  waiting: "Odotetaan palvelinta…",
  uncertain:
    "Palvelin ei vastannut, joten muutoksen tila ei ole varma. Lue tiedot uudelleen ennen kuin yrität uudelleen.",
  reread: "Lue uudelleen",
};

export const microsoftOrganisationsText = catalog(
  fi,
  {
    orgsButton: "Organizations",
    orgsName: (n, names) => `Organizations, ${n}: ${names}`,
    levelsName: (set, missing) =>
      missing ? `Levels, ${set}. Set the missing ones.` : `Levels, ${set}`,
    dialogTitle: "Microsoft 365: organizations",
    own: "Own",
    ownUnnamed: "Your organization",
    stateOwn: "Approved when you created the apps",
    stateUnknown: "Approval not visible to the server",
    consentOpen: "Approval",
    consentOf: (label) => `Approval: ${label}`,
    removeOf: (label) => `Remove ${label}`,
    addOrg: "Add organization",
    done: "Done",
    back: "Back",
    cancel: "Cancel",
    more: "More information",
    lessMore: "Hide more information",
    moreList: [
      "People in these organizations can connect Microsoft 365. The names are visible to everyone on this server.",
      "The list is not a security boundary: the apps are shared, and a person's own agent can sign in around Habitat. A client's data is limited by the client's Entra (Assignment required, removing the approval or the guest account).",
    ],
    noShared:
      "People in other organizations can connect only once the multi-organization apps are set (Levels › Several organizations).",
    listInvalid:
      "The server's organization list is invalid, so no organization is served with the shared apps. Only the server can fix it.",
    setupOff:
      "Changing organizations from the browser is turned off in the server's settings.",
    addTitle: "Add organization",
    labelField: "Name",
    labelHint: "Visible to this server's users.",
    tenantField: "Tenant ID",
    errLabel: "Enter a name.",
    errTenant: "Enter a tenant ID (GUID).",
    errDuplicate: (label) => `Already listed: ${label}.`,
    limitShort:
      "The client's own Entra limits access to its data, not this list.",
    moreAdd: [
      "The tenant ID is in the client's Entra admin center: Overview › Tenant ID.",
      "The list only steers Habitat's own path. The apps are shared by every organization, and a person's own agent or command line can use their sign-in around Habitat.",
    ],
    addSave: "Add",
    added: (label) => `${label} added.`,
    consentTitle: (label) => `Approval: ${label}`,
    consentLead: "Send the message to the client's administrator.",
    consentOwn:
      "Your own organization approved the apps when you created them.",
    consentNone:
      "There are no apps for this organization yet, so there is nothing to approve.",
    publisherUnknown: "<your organization's name>",
    messageLabel: "Message to the client's administrator",
    messageCopy: "Copy message",
    linksTitle: "Links only",
    linkCopy: (level) => `Copy the ${level} link`,
    copied: "Copied.",
    moreConsent: [
      "The server cannot see whether the organization has approved. The first sign-in shows it; a missing approval gives the person a message and the link.",
      "Some levels can be left unapproved.",
    ],
    message: (p) =>
      [
        "Hello,",
        "",
        `we ask you to approve, for ${p.org}, an application our people use to give their AI agents access to Microsoft 365 data shared with them.`,
        "",
        `The publisher is ${p.publisher}; Microsoft may show it as unverified. The permissions are delegated: the application sees only what the signed-in person sees.`,
        "",
        "Approve one or more levels:",
        ...p.links.map((l) => `${l.level}: ${l.url}`),
        "",
        "Approving needs the Cloud Application Administrator role. Microsoft then shows a blank page. You can restrict the application (Assignment required) or remove it under Enterprise applications.",
        "",
        "Best regards",
        p.publisher,
      ].join("\n"),
    removeTitle: (label) => `Remove ${label}?`,
    removeBody:
      "The organization's Microsoft connections stop on this server. Nothing is revoked at Microsoft.",
    removeOwn: "Your own people's connections stop too.",
    moreRemove: [
      "People's cards say why. Files stay in their homes. Adding the organization back resumes the connections without a sign-in.",
      "Only the organization's own administrator can cut access completely.",
    ],
    removeConfirm: "Remove",
    removed: (label) => `${label} removed.`,
    waiting: "Waiting for the server…",
    uncertain:
      "The server did not answer, so whether the change was made is not certain. Read the details again before trying again.",
    reread: "Read again",
  },
  {
    orgsButton: "Organisations",
    orgsName: (n, names) => `Organisations, ${n}: ${names}`,
    dialogTitle: "Microsoft 365: organisations",
    ownUnnamed: "Your organisation",
    addOrg: "Add organisation",
    moreList: [
      "People in these organisations can connect Microsoft 365. The names are visible to everyone on this server.",
      "The list is not a security boundary: the apps are shared, and a person's own agent can sign in around Habitat. A client's data is limited by the client's Entra (Assignment required, removing the approval or the guest account).",
    ],
    noShared:
      "People in other organisations can connect only once the multi-organisation apps are set (Levels › Several organisations).",
    listInvalid:
      "The server's organisation list is invalid, so no organisation is served with the shared apps. Only the server can fix it.",
    setupOff:
      "Changing organisations from the browser is turned off in the server's settings.",
    addTitle: "Add organisation",
    moreAdd: [
      "The tenant ID is in the client's Entra admin center: Overview › Tenant ID.",
      "The list only steers Habitat's own path. The apps are shared by every organisation, and a person's own agent or command line can use their sign-in around Habitat.",
    ],
    consentOwn:
      "Your own organisation approved the apps when you created them.",
    publisherUnknown: "<your organisation's name>",
    consentNone:
      "There are no apps for this organisation yet, so there is nothing to approve.",
    moreConsent: [
      "The server cannot see whether the organisation has approved. The first sign-in shows it; a missing approval gives the person a message and the link.",
      "Some levels can be left unapproved.",
    ],
    removeBody:
      "The organisation's Microsoft connections stop on this server. Nothing is revoked at Microsoft.",
    moreRemove: [
      "People's cards say why. Files stay in their homes. Adding the organisation back resumes the connections without a sign-in.",
      "Only the organisation's own administrator can cut access completely.",
    ],
  },
);
