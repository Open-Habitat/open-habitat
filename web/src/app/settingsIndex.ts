import type { IconName } from "../components/Icon";
import { currentLanguage, type Language } from "../i18n";
import { settingsIndexEnglish } from "../text/settingsIndex";

/** One setting row as the search knows it: its name, the words a person
 * might type for it, and a short description. This is a list of the rows'
 * names only; their values stay with the components that read them. */
type RowEntry = {
  /** The row's `data-settings-row`, which a result jumps to. */
  readonly id: string;
  readonly label: string;
  /** The h3 the row sits under, shown in the result's path. */
  readonly group?: string;
  /** Synonyms, Finnish and English. */
  readonly kw: readonly string[];
  readonly desc: string;
  /** The row shown in its place while this one is folded away (Oma's
   * number rows appear only when Oma is the chosen level). */
  readonly within?: string;
  /** Why the row is not always on the page; absent means it always is once
   * its section has read its data. */
  readonly when?: string;
};
type SectionEntry = {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  /** Palvelimen ylläpito: listed and searched only for an administrator. */
  readonly admin?: boolean;
  readonly kw: readonly string[];
  readonly intro?: string;
  readonly rows: readonly RowEntry[];
};

/** Every settings section in the sidebar's order, and every row in it. A
 * browser test checks this list against the rows the page draws. */
export const settingsSections = [
  {
    id: "tili",
    label: "Tili",
    icon: "user",
    kw: ["account", "profiili", "profile", "oma tili"],
    rows: [
      {
        id: "account",
        label: "Profiili ja uloskirjautuminen",
        kw: [
          "kirjaudu ulos",
          "uloskirjautuminen",
          "logout",
          "sign out",
          "nimi",
          "kuva",
          "avatar",
        ],
        desc: "Nimesi ja kuvasi GitHubista. Kirjaudu ulos tästä selaimesta.",
      },
      {
        id: "git-identity",
        label: "Git-identiteetti",
        kw: [
          "git",
          "commit",
          "author",
          "tekijä",
          "user.name",
          "user.email",
          "sähköposti",
          "email",
        ],
        desc: "Commitien tekijä. Tallentuu globaaliin ~/.gitconfig-tiedostoon.",
      },
      {
        id: "view-links",
        label: "Näkymien ja tiedostojen osoitteet",
        kw: [
          "linkki",
          "link",
          "jaa",
          "share",
          "julkinen",
          "public",
          "osoite",
          "address",
          "poista",
          "näkymä",
          "view",
          "tiedosto",
          "file",
        ],
        desc: "Näkymiesi ja tiedostojesi osoitteet: avaa, kopioi, tee yksityiseksi tai poista pysyvästi.",
        when: "the installation offers views",
      },
    ],
  },
  {
    id: "laitteet",
    label: "Laitteet",
    icon: "devices",
    kw: ["devices", "istunnot", "sessions"],
    rows: [
      {
        id: "device-link",
        label: "Kirjaudu puhelimella",
        kw: [
          "qr",
          "qr-koodi",
          "puhelin",
          "mobiili",
          "phone",
          "mobile",
          "toinen laite",
          "tabletti",
        ],
        desc: "Näytä koodi ja avaa Habitat toisella laitteella ilman uutta GitHub-kirjautumista.",
      },
      {
        id: "sessions",
        label: "Kirjautuneet laitteet",
        kw: ["istunnot", "sessions", "kirjaa ulos", "selain", "logout"],
        desc: "Selaimet ja puhelimet, joilla olet kirjautunut. Laitteen voi kirjata ulos.",
      },
    ],
  },
  {
    id: "avaimet",
    label: "Avaimet",
    icon: "key",
    kw: ["keys", "avain", "ssh", "age", "sops", "julkinen avain", "public key"],
    intro:
      "Tilin julkiset SSH- ja age-avaimet, jotka ylläpitäjä tarvitsee pääsyä tai salaisuuksia varten.",
    rows: [
      {
        id: "account-keys",
        label: "Tilin julkiset avaimet",
        kw: [
          "ssh",
          "ssh-avain",
          "ssh key",
          "id_ed25519",
          "age",
          "age-avain",
          "sops",
          "salaisuudet",
          "secrets",
          "sormenjälki",
          "fingerprint",
          "luo avain",
          "ylläpitäjä",
        ],
        desc: "SSH- ja age-avainten julkiset osat ja sormenjäljet. Puuttuvan avaimen voi luoda tililtä.",
      },
    ],
  },
  {
    id: "tekoaly",
    label: "Tekoäly",
    icon: "agent",
    kw: ["ai", "mallit", "models", "llm"],
    intro:
      "Mallit, joita agentit käyttävät, ja tilaukset tai avaimet, joilla ne saadaan.",
    rows: [
      {
        id: "default-model",
        label: "Oletusmalli",
        kw: [
          "malli",
          "model",
          "kielimalli",
          "llm",
          "ajattelu",
          "thinking",
          "reasoning",
          "päättely",
        ],
        desc: "Uusien keskustelujen malli ja ajattelun taso.",
      },
      {
        id: "agent-work",
        label: "Agentin työ",
        kw: [
          "näytä työ",
          "työkalut",
          "tool calls",
          "ajattelu näkyviin",
          "thinking",
        ],
        desc: "Ajattelu ja työkalut keskustelussa oletuksena.",
      },
      {
        id: "chatgpt",
        group: "Tilaukset",
        label: "ChatGPT-tilaus",
        kw: ["openai", "codex", "gpt", "tilaus", "subscription"],
        desc: "Kirjaudu ChatGPT-tilauksella (Codex), niin sen mallit tulevat mallivalitsimeen.",
      },
      {
        id: "claude",
        group: "Tilaukset",
        label: "Claude-tilaus",
        kw: ["anthropic", "claude max", "claude pro", "tilaus", "subscription"],
        desc: "Kirjaudu Claude-tilauksella, niin sen mallit tulevat mallivalitsimeen.",
      },
      {
        id: "api-keys",
        group: "API-avaimet",
        label: "API-avaimet",
        kw: [
          "api key",
          "token",
          "avain",
          "deepseek",
          "openrouter",
          "anthropic",
          "openai",
        ],
        desc: "Oma avain palveluntarjoajalle. Käyttö laskutetaan avaimen omistajalta.",
      },
    ],
  },
  {
    id: "tilannekatsaus",
    label: "Tilannekatsaus",
    icon: "recap",
    kw: ["recap", "yhteenveto", "summary", "tiivistelmä", "katsaus", "kortti"],
    intro:
      "Lyhyt katsaus keskustelun tilanteesta, kun palaat siihen. Se tallentuu keskustelun historiaan, mutta ei mene agentin muistiin.",
    rows: [
      {
        id: "recap-automatic",
        label: "Automaattinen tilannekatsaus",
        kw: ["automatic", "automaattinen", "pois", "off", "päälle"],
        desc: "Tee tilannekatsaus automaattisesti tai poista automaattinen katsaus käytöstä.",
      },
      {
        id: "recap-delay",
        label: "Hiljaisuus ennen katsausta",
        kw: ["viive", "delay", "odotus", "minuutit", "aika"],
        desc: "Kortti tulee keskustelun yläpuolelle itsestään, kun keskustelu on ollut näin kauan hiljaa.",
      },
      {
        id: "recap-model",
        label: "Malli",
        kw: ["model", "kielimalli", "taustamalli"],
        desc: "Malli, jolla katsaus tehdään. Ei koskaan Fable- tai Opus-malleja.",
      },
      {
        id: "recap-level",
        group: "Laajuus",
        label: "Katsauksen laajuus",
        kw: ["taso", "level", "lyhyt", "tavallinen", "perusteellinen", "oma"],
        desc: "Kuinka paljon katsaus lukee ja kirjoittaa.",
      },
      {
        id: "recap-messages",
        group: "Laajuus",
        label: "Luettavat viestit",
        kw: ["viestimäärä", "messages", "konteksti"],
        desc: "Viimeisimmät viestisi ja agentin vastaukset.",
        within: "recap-level",
      },
      {
        id: "recap-history",
        group: "Laajuus",
        label: "Luettava historia enintään",
        kw: ["tokenit", "tokens", "history", "konteksti"],
        desc: "Vanhimmat viestit jäävät pois, kun raja tulee vastaan.",
        within: "recap-level",
      },
      {
        id: "recap-message",
        group: "Laajuus",
        label: "Yhdestä viestistä enintään",
        kw: ["tokenit", "tokens", "viestin pituus"],
        desc: "Pitkästä viestistä luetaan alku.",
        within: "recap-level",
      },
      {
        id: "recap-turns",
        group: "Laajuus",
        label: "Ensimmäinen katsaus aikaisintaan",
        kw: ["vuorot", "turns", "kysymykset"],
        desc: "Kun keskustelussa on näin monta kysymystä ja vastausta.",
        within: "recap-level",
      },
      {
        id: "recap-words",
        group: "Laajuus",
        label: "Katsauksen pituus",
        kw: ["sanat", "words", "length", "lyhyt"],
        desc: "Yksi tai muutama virke siitä, mitä tehtiin.",
        within: "recap-level",
      },
      {
        id: "recap-next",
        group: "Laajuus",
        label: "Seuraavaksi-rivi",
        kw: ["seuraava askel", "next", "sanat", "words"],
        desc: "Yksi seuraava askel tai este.",
        within: "recap-level",
      },
      {
        id: "recap-response",
        group: "Laajuus",
        label: "Vastauksen yläraja",
        kw: ["tokenit", "tokens", "max tokens", "raja", "limit"],
        desc: "Mallin vastaus katkaistaan tähän.",
        within: "recap-level",
      },
    ],
  },
  {
    id: "sanelu",
    label: "Sanelu",
    icon: "mic",
    kw: ["dictation", "speech", "puhe", "ääni", "mikrofoni", "voice"],
    rows: [
      {
        id: "speech-key",
        label: "Soniox-avain",
        kw: ["soniox", "avain", "api key", "alue", "region", "eu", "usa"],
        desc: "Oma tai ylläpitäjän avain, jolla sanelu kirjoittaa puheesi viestikenttään.",
      },
    ],
  },
  {
    id: "koodipalvelut",
    label: "Koodipalvelut",
    icon: "code",
    kw: ["git", "code hosts", "repot", "repositories"],
    intro: "Palvelut, joista työtilat kloonataan ja joihin agentit pushaavat.",
    rows: [
      {
        id: "github",
        label: "GitHub",
        kw: ["gh", "repo", "push", "pull", "token", "git"],
        desc: "Kirjautuminen, jolla työtilat kloonataan ja agentit pushaavat.",
      },
      {
        id: "gitea",
        label: "Gitea",
        kw: ["forgejo", "tea", "oma git-palvelin", "pääsytunnus", "token"],
        desc: "Oman Gitea-palvelimen pääsytunnus.",
        when: "the installation ships tea or a connection exists",
      },
      {
        id: "gitlab",
        label: "GitLab",
        kw: ["gitlab.com", "glab", "pääsytunnus", "token"],
        desc: "GitLab-palvelimen pääsytunnus.",
        when: "the installation ships glab or a connection exists",
      },
      {
        id: "workspaces",
        group: "Tuodut työtilat",
        label: "Tuodut työtilat",
        kw: ["kloonatut", "repot", "workspaces", "työtilat"],
        desc: "Minkä palvelun tunnuksella kukin työtila synkronoi.",
      },
    ],
  },
  {
    id: "tiedot",
    label: "Tiedot agenteille",
    icon: "plug",
    kw: ["integraatiot", "integrations", "yhteydet", "tilit", "accounts"],
    intro:
      "Sähköposti, kalenterit, yhteystiedot ja tiedostot, joita agenttisi saavat käyttää.",
    rows: [
      {
        id: "google",
        label: "Google",
        kw: [
          "gmail",
          "google drive",
          "kalenteri",
          "calendar",
          "contacts",
          "yhteystiedot",
          "sähköposti",
          "mail",
        ],
        desc: "Gmail, Kalenteri, Yhteystiedot ja Drive.",
      },
      {
        id: "atlassian",
        label: "Atlassian",
        kw: ["jira", "confluence"],
        desc: "Jira ja Confluence. Ota kokeellinen ominaisuus ensin käyttöön.",
        when: "the atlassian-connect experimental feature is enabled",
      },
      {
        id: "trello",
        label: "Trello",
        kw: ["trello", "kanban", "kortit", "cards"],
        desc: "Trello-taulut ja -kortit. Ota kokeellinen ominaisuus ensin käyttöön.",
        when: "the trello-connect experimental feature is enabled",
      },
      {
        id: "microsoft",
        label: "Microsoft 365",
        kw: [
          "outlook",
          "onedrive",
          "sharepoint",
          "office 365",
          "m365",
          "kalenteri",
          "sähköposti",
          "mail",
        ],
        desc: "Outlook, kalenteri, yhteystiedot, OneDrive ja SharePoint.",
      },
      {
        id: "apple",
        label: "Apple (iCloud)",
        kw: [
          "icloud",
          "sovelluskohtainen salasana",
          "app-specific password",
          "kalenteri",
          "sähköposti",
          "mail",
        ],
        desc: "iCloud Mail, Kalenteri ja Yhteystiedot sovelluskohtaisella salasanalla.",
      },
      {
        id: "dropbox",
        label: "Dropbox",
        kw: ["tiedostot", "files", "pilvi", "cloud"],
        desc: "Tiedostot synkronoidaan kotihakemistoosi.",
      },
      {
        id: "imap",
        label: "Sähköposti (IMAP)",
        kw: ["imap", "smtp", "fastmail", "posti", "mail"],
        desc: "Postipalvelin käyttäjätunnuksella ja salasanalla.",
      },
      {
        id: "caldav",
        label: "Kalenteri (CalDAV)",
        kw: ["caldav", "calendar", "nextcloud"],
        desc: "Kalenteri muualta, esimerkiksi Fastmail tai Nextcloud.",
      },
      {
        id: "carddav",
        label: "Yhteystiedot (CardDAV)",
        kw: ["carddav", "contacts", "nextcloud"],
        desc: "Yhteystiedot muualta, esimerkiksi Fastmail tai Nextcloud.",
      },
    ],
  },
  {
    id: "omatkoneet",
    label: "Omat koneet",
    icon: "laptop",
    kw: ["own machines", "my computer", "oma kone", "tietokone", "mac", "kone"],
    intro:
      "Agentti voi käyttää omaa tietokonettasi SSH:lla oman Tailscale-verkkosi kautta.",
    rows: [
      {
        id: "own-machines-tailscale",
        label: "Tailscale",
        kw: ["tailscale", "tailnet", "vpn", "verkko", "network"],
        desc: "Habitatin oma laite Tailscale-verkossasi: yhdistä tai irrota.",
      },
      {
        id: "own-machines",
        label: "Koneet",
        kw: [
          "ssh",
          "etäkirjautuminen",
          "remote login",
          "authorized_keys",
          "lisää kone",
          "add machine",
          "macbook",
          "linux",
        ],
        desc: "Koneet, joille agentti pääsee: lisää, uusi pääsy tai poista.",
      },
    ],
  },
  {
    id: "ulkoasu",
    label: "Ulkoasu",
    icon: "eye",
    kw: ["appearance", "look", "näkymä"],
    rows: [
      {
        id: "theme",
        label: "Teema",
        kw: [
          "tumma tila",
          "dark mode",
          "vaalea tila",
          "light mode",
          "yötila",
          "väri",
          "värit",
          "theme",
        ],
        desc: "Järjestelmä seuraa laitteen asetusta. Koskee tätä selainta.",
      },
      {
        id: "language",
        label: "Kieli",
        kw: [
          "language",
          "kieli",
          "suomi",
          "finnish",
          "englanti",
          "english",
          "lang",
        ],
        desc: "Käyttöliittymän kieli. Koskee kaikkia laitteitasi.",
      },
    ],
  },
  {
    id: "editori",
    label: "Editori",
    icon: "editor",
    kw: ["editor", "muokkain"],
    rows: [
      {
        id: "editor",
        label: "Työtilan editori",
        kw: ["vscode", "vs code", "codemirror", "ide", "koodieditori"],
        desc: "Puhelimessa aina CodeMirror 6.",
      },
    ],
  },
  {
    id: "tila",
    label: "Tallennustila",
    icon: "disk",
    kw: ["storage", "levy", "disk", "tila"],
    rows: [
      {
        id: "usage",
        label: "Käyttö",
        kw: ["kiintiö", "quota", "levytila", "disk", "tilaa", "vapaana"],
        desc: "Kuinka paljon kotihakemistosi vie ja paljonko tilaa on jäljellä.",
      },
      {
        id: "trash",
        group: "Roskakori",
        label: "Roskakori",
        kw: ["poistetut", "deleted", "palauta", "restore", "trash", "tyhjennä"],
        desc: "Poistetut työtilat, jotka voi palauttaa.",
      },
    ],
  },
  {
    id: "kokeelliset",
    label: "Kokeelliset ominaisuudet",
    icon: "flask",
    kw: [
      "experimental",
      "kokeilu",
      "kokeellinen",
      "beta",
      "labs",
      "ominaisuus",
      "feature",
    ],
    intro:
      "Keskeneräisiä ominaisuuksia, joita voit kokeilla jo nyt. Valinnat koskevat kaikkia laitteitasi.",
    rows: [
      {
        id: "explain-mode",
        label: "Selitystila",
        kw: ["selitä", "explain", "opastus", "ohje", "help", "guide", "?"],
        desc: "Himmennä näyttö ja katso, mitä mikä tahansa sen kohta tekee.",
      },
      {
        id: "rewind-conversation",
        label: "Palaa tähän",
        kw: [
          "palaa",
          "rewind",
          "go back",
          "peru",
          "undo",
          "palauta tiedostot",
          "restore files",
        ],
        desc: "Palaa aiempaan viestiisi samassa keskustelussa ja palauta halutessasi agentin muuttamat tiedostot.",
      },
      {
        id: "shares-page",
        label: "Jaetut",
        kw: ["jaetut", "shares", "osoitteet", "addresses", "links"],
        desc: "Näkymien ja tiedostojen osoitteet omalla sivulla keskusteluittain.",
      },
      {
        id: "agent-resources-view",
        label: "Agentin käytössä",
        kw: [
          "agentin käytössä",
          "agent resources",
          "resurssit",
          "tiedostot",
          "files",
          "integraatiot",
          "integrations",
          "pääsy",
          "access",
        ],
        desc: "Selaa kaikkea, mitä agenttisi käyttävät, lajeittain: mikä on mukana, mikä ei ja mitä agentti saa tehdä.",
      },
      {
        id: "remote-browser",
        label: "Oma palvelinselain",
        kw: [
          "selain",
          "browser",
          "chrome",
          "kirjautuminen",
          "sign in",
          "mfa",
          "etänäkymä",
          "remote",
        ],
        desc: "Oma selain palvelimella: kirjaudu palveluun, ja agentti käyttää samaa selainta, jonka näet livenä.",
      },
      {
        id: "conversation-context-view",
        label: "Kontekstinäkymä ja tiivistys",
        kw: [
          "konteksti",
          "context",
          "tiivistys",
          "tiivistä",
          "compact",
          "compaction",
          "tokenit",
          "tokens",
        ],
        desc: "Katso, mihin keskustelun konteksti kuluu, ja tiivistä keskustelu omalla ohjeella.",
      },
      {
        id: "atlassian-connect",
        label: "Atlassian-yhteys",
        kw: ["jira", "confluence", "atlassian"],
        desc: "Yhdistä Jira ja Confluence agenttien käyttöön.",
      },
      {
        id: "trello-connect",
        label: "Trello-yhteys",
        kw: ["trello", "kanban"],
        desc: "Yhdistä Trello agenttien käyttöön.",
      },
      {
        id: "named-workers",
        label: "Avustajat",
        kw: [
          "avustaja",
          "helper",
          "nimetty worker",
          "named worker",
          "kierros",
          "round",
          "taskfleet",
        ],
        desc: "Nimetyt workerit tekevät työnsä kierroksina ja odottavat pääagentin seuraavaa viestiä.",
      },
      {
        id: "turn-changes",
        label: "Vuoron muutokset",
        kw: [
          "muutokset",
          "changes",
          "diffi",
          "diff",
          "aikajana",
          "timeline",
          "tiedostot",
          "files",
        ],
        desc: "Valmiin vuoron alla rivi siitä, mitä tiedostoja agentti muutti.",
      },
      {
        id: "terminal-copy-on-select",
        label: "Päätteen kopiointi valitsemalla",
        kw: [
          "pääte",
          "terminal",
          "kopioi",
          "copy",
          "valinta",
          "selection",
          "leikepöytä",
          "clipboard",
        ],
        desc: "Päätteessä valittu teksti menee heti leikepöydälle.",
      },
      {
        id: "terminal-open-urls",
        label: "Päätteen osoitteet selaimeen",
        kw: [
          "pääte",
          "terminal",
          "osoite",
          "url",
          "selain",
          "browser",
          "gh auth",
          "linkki",
          "link",
        ],
        desc: "Päätteen ohjelman avaama osoite näkyy Habitatissa ja avautuu uuteen välilehteen.",
      },
      {
        id: "storage-breakdown",
        label: "Tallennustilan erittely",
        kw: [
          "tallennustila",
          "storage",
          "välimuisti",
          "cache",
          "siivous",
          "clean",
          "levy",
          "disk",
        ],
        desc: "Mikä tilasi täyttää ja mitä voi vapauttaa, ja siivouspyyntö agentille.",
      },
    ],
  },
  {
    id: "palvelin",
    label: "Palvelin",
    icon: "server",
    admin: true,
    kw: ["server", "ylläpito", "admin"],
    rows: [
      {
        id: "server-name",
        label: "Palvelimen nimi",
        kw: ["nimi", "name", "otsikko"],
        desc: "Näkyy kaikille sivupalkissa.",
      },
      {
        id: "server-language",
        label: "Oletuskieli",
        kw: [
          "language",
          "kieli",
          "suomi",
          "english",
          "englanti",
          "default language",
        ],
        desc: "Kieli niille, jotka eivät ole valinneet omaansa.",
      },
      {
        id: "server-version",
        label: "Versio",
        kw: ["version", "päivitys", "release", "julkaisu"],
        desc: "Palvelimella nyt käynnissä oleva versio.",
      },
    ],
  },
  {
    id: "palvelinintegraatiot",
    label: "Palvelinintegraatiot",
    icon: "plug",
    admin: true,
    kw: ["oauth", "server integrations", "sovellukset"],
    rows: [
      ...(
        [
          ["google", "Google", ["gmail", "client id", "client secret"]],
          ["microsoft", "Microsoft 365", ["azure", "entra", "client id"]],
          ["apple", "Apple (iCloud)", ["icloud"]],
          ["imap", "Sähköposti (IMAP)", ["imap", "posti"]],
          ["caldav", "Kalenteri (CalDAV)", ["caldav"]],
          ["carddav", "Yhteystiedot (CardDAV)", ["carddav"]],
          ["dropbox", "Dropbox", ["app key"]],
        ] as const
      ).map(([id, label, kw]) => ({
        id: `server-${id}` as const,
        label,
        kw: ["oauth", "sovellus", "tunnukset", ...kw],
        desc: "Onko palvelu henkilöiden käytettävissä tällä palvelimella.",
      })),
    ],
  },
  {
    id: "aiavain",
    label: "AI-avain",
    icon: "key",
    admin: true,
    kw: ["site key", "yhteinen avain", "sivuston avain"],
    rows: [
      {
        id: "site-key",
        label: "Sivuston AI-avain",
        kw: ["api key", "avain", "anthropic", "openai", "jaettu", "token"],
        desc: "Avain henkilöille, joilla ei ole omaa tilausta tai avainta.",
      },
      {
        id: "site-key-copies",
        label: "Jo liittyneet",
        kw: ["kopiot", "anna avain", "liittyneet"],
        desc: "Henkilöt, jotka liittyivät ennen avainta tai saivat aiemman avaimen.",
      },
    ],
  },
  {
    id: "saneluavain",
    label: "Saneluavain",
    icon: "mic",
    admin: true,
    kw: ["speech key", "sanelu", "soniox", "dictation"],
    rows: [
      {
        id: "site-speech-key",
        label: "Yhteinen Soniox-avain",
        kw: ["soniox", "avain", "api key", "sanelu", "dictation"],
        desc: "Kaikki, joilla ei ole omaa avainta, sanelevat tällä.",
      },
    ],
  },
  {
    id: "kayttoonotto",
    label: "Käyttöönotto",
    // A turn on a route, not the chevron that marks a menu (Jari 24.10.2026).
    icon: "steer",
    admin: true,
    kw: ["onboarding", "uusi käyttäjä", "ensimmäinen kirjautuminen"],
    rows: [
      {
        id: "onboarding-route",
        label: "Käyttöönoton vaiheet",
        kw: [
          "reitti",
          "vaiheet",
          "steps",
          "oletusrepot",
          "repot",
          "ai-tili",
          "pakollinen",
          "voi ohittaa",
        ],
        desc: "Mitä uusi henkilö käy läpi ensimmäisellä kirjautumisella.",
      },
      {
        id: "onboarding-preview",
        label: "Henkilön näkymä",
        kw: ["esikatselu", "preview"],
        desc: "Käyttöönotto sellaisena kuin uusi henkilö sen näkee.",
      },
    ],
  },
  {
    id: "kayttajat",
    label: "Käyttäjät ja pääsy",
    icon: "users",
    admin: true,
    kw: ["users", "access", "pääsy", "kutsu", "invite"],
    rows: [
      {
        id: "access-add",
        label: "Salli GitHub-tunnus",
        kw: ["allowlist", "hyväksy", "kutsu", "invite", "lisää käyttäjä"],
        desc: "Kuka saa kirjautua palvelimelle.",
      },
      {
        id: "access-people",
        label: "Henkilöt",
        kw: ["käyttäjät", "users", "liittyneet", "poista"],
        desc: "Liittyneet, kirjautumattomat ja poistetut henkilöt.",
      },
      {
        id: "view-links-admin",
        label: "Jaetut linkit",
        kw: ["linkki", "link", "jaa", "share", "väärinkäyttö", "abuse"],
        desc: "Henkilöiden jakamat näkymälinkit; poista väärinkäytetty.",
        when: "the site offers shared view links or some remain",
      },
    ],
  },
  {
    id: "keskustelut",
    label: "Keskustelut",
    icon: "agent",
    admin: true,
    kw: ["conversations", "samanaikaiset", "raja", "limit", "muisti", "memory"],
    rows: [
      {
        id: "live-limit-memory",
        label: "Muisti",
        kw: ["memory", "ram", "arvio"],
        desc: "Palvelimen muisti ja paljonko rajat voisivat viedä.",
      },
      {
        id: "live-limit-default",
        label: "Raja henkilöä kohden",
        kw: ["samanaikaiset keskustelut", "työskentelee", "limit"],
        desc: "Montako keskustelua yksi henkilö voi pitää työssä yhtä aikaa.",
      },
      {
        id: "live-limit-people",
        label: "Henkilöt",
        kw: ["poikkeus", "oma raja", "exception"],
        desc: "Henkilön oma raja.",
      },
    ],
  },
  {
    id: "levy",
    label: "Levytila",
    icon: "disk",
    admin: true,
    kw: ["disk", "levy", "storage"],
    rows: [
      {
        id: "disk",
        label: "Levy",
        kw: ["levytila", "vapaana"],
        desc: "Kotihakemistojen levy.",
      },
      {
        id: "default-limit",
        label: "Oletusraja",
        kw: ["kiintiö", "quota", "raja", "limit"],
        desc: "Uusien käyttäjien raja. Ei muuta nykyisiä.",
        when: "per-user limits are in use",
      },
      {
        id: "user-limits",
        label: "Käyttäjien rajat",
        kw: ["kiintiö", "quota", "käyttäjät", "raja", "limit"],
        desc: "Kunkin käyttäjän tallennustila ja raja.",
      },
    ],
  },
] as const satisfies readonly SectionEntry[];

export type SettingsSection = (typeof settingsSections)[number];
export type SettingsRowId = SettingsSection["rows"][number]["id"];

/** A section as the page shows it: its names in the interface's language.
 * The ids, icon and synonyms are the same in every language; a search
 * also finds a section or row by its name in the other language. */
export type ShownSection = {
  readonly id: SettingsSection["id"];
  readonly label: string;
  readonly icon: IconName;
  readonly admin?: boolean;
  readonly kw: readonly string[];
  readonly intro?: string;
  readonly rows: readonly RowEntry[];
};

const english: readonly ShownSection[] = settingsSections.map((section) => {
  const en = settingsIndexEnglish[section.id] as {
    label: string;
    intro?: string;
    rows: Record<string, { label: string; desc: string; group?: string }>;
  };
  return {
    ...section,
    label: en.label,
    intro: en.intro,
    kw: [...section.kw, section.label],
    rows: section.rows.map((row) => ({
      ...row,
      ...en.rows[row.id],
      kw: [...row.kw, row.label],
    })),
  };
});
const finnish: readonly ShownSection[] = settingsSections.map((section) => {
  const en = settingsIndexEnglish[section.id] as {
    label: string;
    rows: Record<string, { label: string }>;
  };
  return {
    ...section,
    kw: [...section.kw, en.label],
    rows: section.rows.map((row) => ({
      ...row,
      kw: [...row.kw, en.rows[row.id].label],
    })),
  };
});

/** Every section in the sidebar's order, named in `language`. */
export function shownSettingsSections(
  language: Language = currentLanguage(),
): readonly ShownSection[] {
  return language !== "fi" ? english : finnish;
}

const rowOf = new Map<string, { row: RowEntry; section: SectionEntry }>(
  settingsSections.flatMap((section) =>
    section.rows.map((row) => [row.id, { row, section }] as const),
  ),
);

/** The row that stands in for `id` while it is folded away, if any. */
export function settingsRowWithin(id: string): string | undefined {
  return rowOf.get(id)?.row.within;
}

// ---- Matching ----

/** Lower case without accents, one character for one: "Ääni" → "aani".
 * Indices in the folded text are indices in the original. */
export function fold(text: string) {
  return [...text]
    .map(
      (c) =>
        c
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")[0] || " ",
    )
    .join("");
}
const terms = (query: string) => fold(query).split(/\s+/).filter(Boolean);

/** Where `term` (folded) starts in `text`. A short term must begin a word;
 * from four letters it may sit inside one, because Finnish compounds
 * ("Oletusmalli", "Saneluavain") hide the word a person types. */
function wordHits(text: string, term: string) {
  const folded = fold(text);
  const out: number[] = [];
  for (let i = folded.indexOf(term); i >= 0; i = folded.indexOf(term, i + 1))
    if (term.length >= 4 || i === 0 || /[^a-z0-9]/.test(folded[i - 1]))
      out.push(i);
  return out;
}

export type SettingsHit = {
  kind: "section" | "row";
  section: SettingsSection["id"];
  row?: SettingsRowId;
  icon: IconName;
  label: string;
  /** Where it is: "Tekoäly › API-avaimet". */
  path: string;
  /** The synonym that matched, when the name did not. */
  synonym?: string;
  /** The description, when only it matched. */
  desc?: string;
  score: number;
};

/** Sections and rows whose name, synonyms or description hold every typed
 * word, best first. Server sections are left out unless `admin`. */
export function searchSettings(
  query: string,
  {
    admin,
    language = currentLanguage(),
  }: { admin: boolean; language?: Language },
): SettingsHit[] {
  const ts = terms(query);
  if (!ts.length) return [];
  const hits: SettingsHit[] = [];
  const en = language !== "fi";
  for (const section of shownSettingsSections(language)) {
    if (section.admin && !admin) continue;
    const entries = [
      {
        kind: "section" as const,
        label: section.label,
        path: section.admin
          ? en
            ? "Server administration"
            : "Palvelimen ylläpito"
          : en
            ? "Settings"
            : "Asetukset",
        kw: section.kw,
        desc: section.intro ?? "",
        row: undefined,
      },
      ...section.rows.map((row) => ({
        kind: "row" as const,
        label: row.label,
        path: [
          section.admin ? (en ? "Administration" : "Ylläpito") : "",
          section.label,
          row.group,
        ]
          .filter(Boolean)
          .join(" › "),
        kw: row.kw,
        desc: row.desc,
        row: row.id,
      })),
    ];
    for (const e of entries) {
      let score = 0;
      let synonym: string | undefined;
      let byDesc = false;
      const ok = ts.every((t) => {
        if (wordHits(e.label, t).length) {
          score += fold(e.label).startsWith(t) ? 120 : 100;
          return true;
        }
        const k = e.kw.find((k) => wordHits(k, t).length);
        if (k) {
          score += 60;
          synonym ??= k;
          return true;
        }
        // A section's name alone finds the section, not every row in it;
        // with more words it narrows to the section's rows.
        if (
          e.kind === "row" &&
          ts.length > 1 &&
          wordHits(section.label, t).length
        ) {
          score += 30;
          return true;
        }
        if (t.length >= 3 && wordHits(e.desc, t).length) {
          score += 20;
          byDesc = true;
          return true;
        }
        return false;
      });
      if (!ok) continue;
      hits.push({
        kind: e.kind,
        section: section.id as SettingsSection["id"],
        row: e.row as SettingsRowId | undefined,
        icon: section.icon,
        label: e.label,
        path: e.path,
        synonym,
        desc: byDesc && !synonym ? e.desc : undefined,
        // The person's own settings come before the server's at an equal
        // match; a section before its own rows.
        score:
          score + (e.kind === "section" ? 5 : 0) - (section.admin ? 25 : 0),
      });
    }
  }
  // Array sort is stable: equal scores keep the sidebar's order.
  return hits.sort((a, b) => b.score - a.score);
}

/** `text` split into the parts the query matched and the rest. */
export function highlight(text: string, query: string) {
  const marked = new Array<boolean>(text.length).fill(false);
  for (const t of terms(query))
    for (const i of wordHits(text, t))
      for (let j = i; j < i + t.length; j++) marked[j] = true;
  const parts: { text: string; hit: boolean }[] = [];
  const chars = [...text];
  chars.forEach((c, i) => {
    const last = parts[parts.length - 1];
    if (last && last.hit === marked[i]) last.text += c;
    else parts.push({ text: c, hit: marked[i] });
  });
  return parts;
}
