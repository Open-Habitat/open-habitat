# Tuotantodesign v1 — toteutusvalmiuden katselmointipaketti

Tämä paketti on `review-implementation-plan`-katselmoinnin päätettäväksi. Se ei
ole hyväksyntä eikä runtime-toteutus. Tarkastettava revision merkitään tähän
landauksen jälkeen; työn sisältävä commit on tämän tiedoston Git-historiassa.

## Katso nämä

1. [Yhdistetty tuotantodesign](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/production-v1.md)
2. [Komponenttikatalogin sopimus](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/component-catalog-v1.md)
3. [Staattinen korjauskierros](https://github.com/maintainer/native-agent-host/blob/7520760f16f98d7f0f1face7b997897ed9143d41/design-system/ui_kits/production-v1/index.html)
4. [Käyttökulujen yhteenveto](https://github.com/maintainer/native-agent-host/blob/90ef1565f1df46da9ade73b885db2d5bb2c4a837/docs/ui.md)
5. [Design systemin opas](https://github.com/maintainer/native-agent-host/blob/79a911fb364562a0a15e525934a7840cf352a56f/docs/design-system.md)
6. [V1-host-sopimuksen merkitys](../../docs/interfaces.md) ja
   [koneellinen sopimus](../../contracts/v1/AGENTS.md)

Alkuperäiset [keskustelu-](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v1/vedokset) ja
[workspace-referenssit](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v1/workspaces) säilyvät
muuttamattomina. Staattinen kierros ei sisällä mock-backendia tai toimivia
komentoja.

## Täsmälliset korjaukset vastaanotettuihin referensseihin

- **Teema:** vaalea ja tumma ovat molemmat v1:n tuotantolaajuutta; oletus seuraa
  järjestelmää ja paikallinen valinta on vain laitekohtaista esitystilaa.
- **Agentin tila:** piste/hover ei riitä. Agenttirivi näyttää aina tilan ja
  huomiotarpeen tekstinä; väri on toisteinen.
- **Otsikko:** UI näyttää hostin `title`-objektin eikä kovakoodaa 3./5./10. vuoroa.
  Failed/unknown säilyttää edellisen displayn. Regenerointi näkyy vain capabilityn
  sallimana.
- **Fokus:** ei jokaisesta taustamuutoksesta tai uudelleenjärjestyksestä. Fokus
  siirtyy vain käyttäjän valinnasta tai vahvistetusta create/start/resume/unarchive-
  tuloksesta.
- **Jono:** kaksi Pi:n omaa ryhmää ja vain koko jonon tyhjennys. Yksittäinen
  cancel ja reorder poistuvat tuotantosopimuksesta.
- **Yhteys:** yksi app-banneri, stale sisältö jää luettavaksi ja kirjoitukset
  estyvät. Reconnect ei uusi viime komentoa.
- **GitHub:** mockin `ghLinked`/“Kytke tili” ei ole backend-kyky. Unknown tai
  unsupported näkyy valmiina tilana. Remote create, origin, transport ja push
  ovat erillisiä vaiheita.
- **Workspace create:** native basename ja valinnainen display name erotellaan.
  Automaattinen agent start on näkyvä seuraava vaihe, ei hakemiston luonnin
  piilotettu onnistumisoletus.
- **Taskfleet:** lomake käyttää sopimuksen source branch-, title- ja task-arvoja.
  UI ei lupaa final branchia/nimeä eikä hallitse manual worktreeitä.
- **Arkisto:** stop, archive, unarchive ja resume ovat erillisiä komentoja ja
  osatuloksia; arkisto ei ole historiatietokanta.
- **Poisto:** täsmävahvistus käyttää `workspace.name`-arvoa, näyttää kaikki
  vaikutukset ja valmistuu vain tuoreesta source-absent-faktasta. Partial ei
  väitä rollbackia.
- **Liike ja saavutettavuus:** tuotanto käyttää 120–200 ms liikettä, ei hidasta
  380–900 ms sisältöliikettä. Reduced motion poistaa pulssin/transformit.
  Streaming-announcementit batchataan eikä token-deltaa lueta.

## Hyväksyttävä komponenttilaajuus

Yleisiä primitivejä ovat Button/Link, kentät, Checkbox/Radio/Select, Dialog ja
AlertDialog, Menu/Tabs/Disclosure, status/progress, banner/notice/toast sekä
form error summary. Tuoteosia ovat AppShell/login, workspace rail/section,
agent nav/header/facts/attention, timeline/viestit/Markdown, code/diff,
tool row/group/output, unknown event, supported question, composer/queue,
command receipt/uncertain card, operation progress/capability sekä create,
Git integration/settings, GitHub, Taskfleet, archive, transfer ja delete -dialogit.

Tätä laajempi yleiskirjasto ei kuulu v1:een. Tuotekomponentti saa valmiin
näyttömallin ja lähettää intentin; se ei omista HTTP/SSE:tä, Pi-ohjausta,
capability-päätelmää, command ID:tä, retryä, snapshot/event reconciliationia,
draft-repositorya tai natiivilähteen muutosta.

Pakollinen state coverage on loading, pending/running, disabled syyllä,
read-only, empty, error/failed, stale, unknown, unsupported ja tarvittaessa
partial/skipped. Katalogin story-matriisi sisältää myös dark, 200 % zoom,
keyboard/focus, reduced motion, pitkän suomenkielisen sisällön ja hostile text -
fixturet.

## Päätettävät asiat

`review-implementation-plan` hyväksyy tai muuttaa nämä täsmällisesti:

1. hyväksytäänkö tuotantodesign ja yllä oleva correction set v1:n UI-sopimukseksi;
2. hyväksytäänkö katalogin rajattu komponenttijoukko ja domain/view-erottelu;
3. hyväksytäänkö molemmat teemat, system-default ja laitekohtainen theme override;
4. hyväksytäänkö route-taulu, identity-scoped return route,
   missing/unknown-selection-käytös ja operation deep linkit ehdolla, että
   operation-retention/query täsmennetään;
5. hyväksytäänkö draft-, focus-, reading anchor-, live-region-, virtualisoinnin
   sivutettu saavutettava fallback- ja copy-säännöt;
6. hyväksytäänkö epävarman komennon, Pi-jonon, TUI-siirron ja vaiheistettujen
   host-operaatioiden esitys suoraan `contracts/v1/`-sopimuksesta;
7. hyväksytäänkö Proposed ADR 0002:n React/component-kokonaisuus ja Proposed ADR
   0003:n host-kokonaisuus erikseen niiden omilla ehdoilla — tämä design ei
   itsessään hyväksy kumpaakaan.

## Avoin adapteri- ja proof-työ

Design säilyttää käyttökelpoisen unknown/unsupported-tilan seuraaville eikä
muuta koneellista sopimusta niiden helpottamiseksi:

- Pi one-off title adapter, malli, cost bound ja milestone-trigger;
- operation-ID query tai terminal-operation retention deep linkin palautumiseen;
- queue clear -tulokseen todella poistetut tekstit/järjestys (kontrolli on siihen
  asti estetty, jotta toimitettua viestiä ei palauteta ja lähetetä kahdesti);
- GitHub-create confirmation challengen odotettu arvo/vertailu sekä supported
  question -cancelin `null`→native-mapping;
- GitHub credential UX sekä kahden käyttäjän write-probe;
- Taskfleet create/partial teardown -adapteri;
- prosessi-/tmux-/mount-/worktree-havainnon kattavuus ja history settlement;
- variable-height-virtualisointi + ruudunlukija + lukukohta oikeassa selaimessa;
- pitkän historian/outputin memory, chunk, SSE-ring ja ledger-budjetit;
- React Aria -wrapperien keyboard/focus ja Finnish content;
- sanitisoitu Markdown, URL-policy, Shiki-worker, malformed diff ja deployed CSP.

Avoin proof ei oikeuta pudottamaan hyväksyttyä MVP-toimintoa. Tekninen este
palautetaan katselmointiin.

## Suositeltu hyväksymisteksti

> Hyväksyn `design-production-ui`-toimituksen Git-revision [REVISION] v1:n
> tuotantodesigniksi: `design-system/production-v1.md`,
> `component-catalog-v1.md` ja staattinen `ui_kits/production-v1/index.html`.
> Hyväksyn dokumentoidut poikkeamat vastaanotettuihin HTML/JSX-referensseihin,
> vaalean ja tumman teeman tuotantolaajuuden, komponenttikatalogin rajauksen,
> route/draft/focus/reading/accessibility-säännöt sekä host-sopimuksen unknown,
> uncertain ja partial -esitykset. Referenssit pysyvät muuttamattomina eikä
> hyväksyntä väitä niitä backend-näytöksi. Hyväksyn / muutan erikseen Proposed
> ADR 0002:n ja 0003:n sekä tässä paketissa luetellut retention-, adapteri-,
> credential-, deployment- ja proof-valinnat. Avoin kyky näkyy UI:ssa unknown-
> tai unsupported-tilana; hyväksyttyä MVP-toimintoa ei poisteta ilman uutta
> päätöstä.
