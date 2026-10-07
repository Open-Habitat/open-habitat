# Keskeytysten viitetiedot

Tämä tiedosto kokoaa rupeaman kahden keskeytyksen lähteet, jotta toinen
agentti voi jäljittää, kuka asetti kunkin rajan ja millä ohjeilla. Tulkinta
ja alustavat havainnot ovat [result.md](result.md):ssä; tässä on vain
viitteet. Ajat ovat UTC.

## Tiedostot ja miten niitä luetaan

**Kapellimestari** (Claude Code, tämä `/stint-start`-sessio):

- Session id `7f74f33c-9b8a-452d-814d-8e8fdcbcba47`
- Transkripti
  `~/.claude/projects/-home-jari-Sources-native-agent-host/7f74f33c-9b8a-452d-814d-8e8fdcbcba47.jsonl`
  (alder). Sisältää jokaisen brief-tiedoston kirjoituksen ja `taskfleet run create`
  -kutsun sekä Jarin viestit.
- Ohjeet, joita kapellimestari noudatti: `~/.claude/skills/stint-start/SKILL.md`,
  `~/.claude/skills/worktree-spinoff/SKILL.md`, repon `CLAUDE.md` / `AGENTS.md`,
  `AGENTS-WORKFLOW.md` ja `TODO.md` handoff-tilassa `e370c87`.

**Jokainen Taskfleet-ajo** (workerit ovat Pi-sessioita) alderlla hakemistossa
`~/.taskfleet/runs/<run-id>/`:

| Tiedosto | Sisältö |
|---|---|
| `prompt.md` | Workerin koko prompt: Taskfleetin generoima ajokonteksti ja kapellimestarin tai emoajon brief |
| `evidence/n-0001/pi-session.original.jsonl` | Workerin Pi-sessio kokonaisuudessaan (viestit, työkalukutsut, tulokset) |
| `evidence/n-0001/final-pane.log` | Päätteen viimeinen näkymä |
| `evidence/n-0001/terminal-report.json` | Lopullinen raportti |
| `agent.log` | Päätteen raakatallenne |
| `events.jsonl`, `manifest.json`, `nodes/n-0001.json` | Ajon tapahtumat ja tila |
| `worker-handshake-n-0001-attempt-0.json` | Pi-session id |

Raportin lukeminen: `taskfleet run show <run-id> --output json | jq '.data.report'`.

**Emo–lapsi-suhde.** Workerien käynnistämillä Fleetrepo-ajoilla ei ole
Taskfleetin `parent_run_id`:tä. Alla oleva hierarkia on päätelty siitä, minkä
ajon Pi-sessiossa lapsen run id esiintyy ensimmäisenä:

```sh
grep -l <child-run-id> ~/.taskfleet/runs/*/evidence/n-0001/pi-session.original.jsonl
```

Myöhemmät uusintayritykset mainitsevat aiempien ajojen id:t briefissään,
joten ne näkyvät myös tässä haussa.

## Keskeytys 1: ensimmäinen kierros pysähtyi 5.10. klo 18.40 UTC

Rajat, joihin työ pysähtyi: kontrollitiloja ei mergetty (vajaa kuvavertailu,
puuttuvat host-faktat, puuttuva visuaalinen hyväksyntä), otsikko-issue jäi
auki nimenmuutoskilvan takia, Northwind jäi `pending`-tilaan, eikä mitään
julkaistu, koska kaikki ajot eivät olleet laskeutuneet.

```
kapellimestari 7f74f33c-9b8a-452d-814d-8e8fdcbcba47
├── 01m46b26e4h6q3sfrm0n70wnjp  compare-draft-fidelity           done    (Pi 7b202fe1-2eb5-45bb-bfa9-ca4d9ab3af4e)
├── 01m46b273t6y80xj0cn412azfh  recover-sends                    done    (Pi cb691ea4-1310-4180-81b4-78e78ce5e408)
├── 01m46b27na102a8k8ya7ars2x2  prove-jit-isolation              failed  (Pi aae748a0-f253-41ec-bd16-279f72395be5)
│   └── 01m46b6rs6v3jnv1a0wg8eqp5n  fleetrepo-jit-reboot-smoke    failed  (Pi 55652e89-4e0c-4a00-827f-25a4361c24e3)
├── 01m46b28761m2f4h47jxw90x3s  evaluate-northwind-adoption         done, issue jätetty pending (Pi a6f1cade-8100-408e-aca7-6293c5d8f8ba)
├── 01m46ejsy4eyx4krx1hy2fqsqe  generate-conversation-titles     done, issue jätetty auki; awaiting-input 17:31 (Pi e8d461bb-9015-4bc4-948b-dd122a556642)
├── 01m46jmze4mdckddxwdjtrx5n9  apply-control-state-design       failed, ei mergeä (Pi de94ef0c-60dd-45e5-92b4-049b00d0b3c8)
└── 01m46jn046z5gbjk7brywpt2qv  remove-workspace-entry-cutoff    done    (Pi 4d445556-6ab0-4274-98b0-3b588526349b)
```

Jäljitettävät lähteet:

- **Brief-pohjan ehto,** jonka kapellimestari liitti kaikkiin näihin
  promptteihin: *"If the work legitimately cannot fully meet the acceptance
  criteria (missing human participation, a decision for Jari), do not close…
  set `preparation` back to `pending` if Jari must decide"*. Se näkyy kunkin
  ajon `prompt.md`:n "Issue lifecycle" -kohdassa. Pohja muutettiin 6.10.
  (`01m47nwmwe0r3574bk4jwtq5ev`:n prompt sisältää uuden version).
- **Kontrollitilojen briefin oma lause:** *"The visual verdict stays Jari's;
  say so in result.md"* (`01m46jmze4mdckddxwdjtrx5n9/prompt.md`).
- **Issuen hyväksymiskriteeri:** *"Every primitive state matches the
  designer's frame in both themes"* (`issues/apply-control-state-design/item.md`
  tilassa `e370c87`).
- **Ristiriitainen repo-ohje:** `AGENTS-WORKFLOW.md` *"Jari reviews
  screenshots in batches, so an outstanding visual verdict can coexist with
  progress"* (tilassa `e370c87`).
- **Kapellimestarin oma pysähdys:** `stint-start/SKILL.md`:n ehdot *"Do not
  enter Phase 3 until every owned run has settled and each landed flag is
  true"* ja *"One invocation of this skill runs one bounded round"*, sekä
  handoffin järjestys (`TODO.md` @ `e370c87`: *"Kun reboot-näyttö on
  kirjattu…"*, *"Älä käynnistä UI-töitä…"*). Kapellimestarin päättely on
  transkriptissä kohdassa, jossa se kirjoittaa raportin *"Round report: 5
  October"*.
- **Otsikkoworkerin kysymys:** `taskfleet run show 01m46ejsy4eyx4krx1hy2fqsqe`
  → `awaiting_input_detail` ja `issues/generate-conversation-titles/result.md`.
- **Kontrollitilojen jatko:** `01m47nwmwe0r3574bk4jwtq5ev` (Pi
  e06e4c27-b830-452d-9835-6cc11476e5cc), joka mergesi saman työn Jarin
  6.10. linjauksen jälkeen.

## Keskeytys 2: loppujulkaisu 6.10. klo 16.57–18.40 UTC

Rajat, joihin työ pysähtyi: ei paikallaan päivityksen operaattoria, OS:n
uudelleenasennus vaatii Jarin luvan, uuden host-avaimen varmistus Hetznerin
konsolista, vanhentunut egress-tarkistus `.27/32`, jaetun `cloudflared`:n
uudelleenkäynnistys kielletty.

```
kapellimestari 7f74f33c-9b8a-452d-814d-8e8fdcbcba47
├── 01m492bskxwezcdw6crzy2bjvr  stint-release-deploy             failed  16:57  (Pi 983b3e14-77d0-4013-9def-149ab15abe8b)
│   ├── 01m492d1jnwn99af4jtrt70sfd  Open Habitat VM operator     done    (Pi d2b631cb-de93-42c6-bdc7-857343f4e3b3)
│   ├── 01m4931bap9e5wvmyctj9zzrdv  In-place VM product reset    done    (Pi 109962be-6426-42cb-b2cf-a893dca15502)
│   └── 01m4938x793h5qbna4kkkf8tsy  Implement in-place VM reset  failed  (Pi 1cca5308-5f14-4f2c-a31d-7392c0ec81a9)
├── 01m493ev4rrjcq1kt0jaav68xf  stint-deploy-fresh-install       failed  17:16  (Pi 4147cf4e-4a29-4c2f-94d0-a950e66034f1)
│   └── 01m493htq5meqr8cgpwspjj2fj  Rebuild Open Habitat test guest  failed (Pi 8bdd75b6-90a8-4053-be37-cd3d85e46641)
├── 01m495bjj4q3rpb5wsrh02vbxk  stint-deploy-same-os             failed  17:49  (Pi 91ee4e3f-0fda-46b0-96a7-b992816be18c)
│   ├── 01m495d07x2j1d3hh9s3j3zhmr  correct guest egress guard   done    (Pi 941d78ff-5fa6-47aa-a04c-62203bebee7c)
│   ├── 01m495g0mdmb2kx85avtqyagx6  same os product reset operator  failed (Pi 2f130b78-1391-4cae-84f6-03d20bb960b8)
│   ├── 01m495js6n43wp9zdwd5q3fzkq  deploy pilot twenty guest    failed  (Pi ed5757ea-dd11-47de-8a0d-dcce0c197e39)
│   └── 01m496dzjjtvfdycy1hcdsdjtr  harvest partial guest receipts  done (Pi 65310ba7-2632-455d-bd56-1d80a39f665d)
├── [kapellimestari käynnisti aldern cloudflared-palvelun uudelleen 18:11]
└── 01m496m13bwa9aa5trkyj9fvhg  stint-deploy-finish              done    18:11  (Pi 48164d29-333b-4477-8b6f-9b87dbf4985e)
    ├── 01m496n9whgp7bs8dr6b4k7fp4  Finish pilot guest policy    failed  (Pi 3f2f7df4-2e70-43e5-938c-9a2f37096429)
    ├── 01m496xydv0qjbye0sqcmcjc7n  Harvest guest journal policy done    (Pi e039d43b-0dce-43d2-9acd-d1bf375f24ad)
    └── 01m4971bpw73y3wx0207jmf7cn  Install guest journal limits done    (Pi 2c10deca-e579-4461-8377-5483c4a4f0a4)
```

Fleetrepo-ajojen repo on `~/Sources/fleetrepo`; niiden promptit ja sessiot
ovat samassa `~/.taskfleet/runs/`-hakemistossa.

Jäljitettävät lähteet:

- **Fleetrepon testipalvelinohjeet ennen muutosta** (`06c20692`, eli
  `e28b6a11^`), polussa `infra/native-agent-host-test/`:
  - `AGENTS.md`: *"Trust reaches only as far as the evidence…"* ja *"deleting
    or rebuilding it… that decision is the user's"*
  - `REBUILD.md`: *"Do not run this path until Jari authorizes an OS
    rebuild"*, *"Rebuilding the OS is Jari's call"*, *"The destructive
    request is made by Jari in the console"* ja osio *"Authenticating the
    rebuilt guest"*
  - `RELEASE-UPGRADE.md`: *"a changed host key is an identity question to
    settle through the console, not a new key to accept"*
  - `OMEGA-ACCESS.md`: *"Never accept a new host key"*
  - `PROVISIONING.md`: Hetznerin konsolivahvistus ennen jokaista operaatiota

  Näiden historia: `git -C ~/Sources/fleetrepo log -- infra/native-agent-host-test/`,
  erityisesti `d807bb75`, `d247b413` (24.9.), `c006ddad`, `cce7bc3a` (27.9.),
  `94fdb133` (1.10., REBUILD.md:n uudelleenkirjoitus, jonka viesti perustelee
  säännöt) ja `018204d4` (6.10.). Muutos Jarin päätöksen mukaiseksi:
  `e28b6a11`.
- **Ensimmäinen ehdotus host-avaimen varmistuksesta:**
  `taskfleet run show 01m492bskxwezcdw6crzy2bjvr` → `report.discussion_items`
  (*"request Jari's explicit OS-rebuild authorization and reauthenticate a new
  guest host key before secrets transfer"*).
- **Kapellimestari muutti ehdotuksen käskyksi:**
  `01m493ev4rrjcq1kt0jaav68xf/prompt.md`, kohta *"Authorization… new SSH host
  key pinned and reauthenticated before any secret transfer"*.
- **Ehto tiukentui lapsiajolle:** `01m493htq5meqr8cgpwspjj2fj/prompt.md`
  (*"Reauthenticate the new SSH host key independently via Hetzner console…
  If independent console authentication is not feasible, stop"*).
- **Egress-raja:** `infra/native-agent-host-test/rebuild.py` ja
  `ssh_egress.py` Fleetrepossa sekä lapsiajon raportti
  (`taskfleet run show 01m493htq5meqr8cgpwspjj2fj`); korjaus ajossa
  `01m495d07x2j1d3hh9s3j3zhmr`.
- **Jaetun tunnelin kielto:** kapellimestarin briefit ajoille
  `01m492bskxwezcdw6crzy2bjvr` (*"Alder itself, its shared Cloudflare tunnel
  route… are not disposable"*) ja `01m495bjj4q3rpb5wsrh02vbxk` (*"Never touch
  alder's own services or its shared tunnel route"*); taustalla Jarin
  globaali `AGENTS.md` (*"A reboot, a service restart… here affects the whole
  household"*). 502-pysähdys: `taskfleet run show 01m495bjj4q3rpb5wsrh02vbxk`
  ja Fleetrepo `issues/markedly-witty-brick/result.md`.
- **Kapellimestarin välitys Jarille:** transkriptin viesti 6.10. noin klo
  17.45 UTC (*"Loppujulkaisu pysähtyi taas, kahteen asiaan"*), jossa
  host-avain ja egress-raja esitettiin Jarille valintana. Ajon
  `01m492bskxwezcdw6crzy2bjvr` pysähdystä ei välitetty; kapellimestari käynnisti
  suoraan uusintayrityksen.

## Muut pysähdykset samassa rupeamassa

- **Admission-worker jäi tyhjäkäynnille:** `01m47pbesrjq7cfmy6zwnpy04q` (Pi-sessio
  sen `evidence`-hakemistossa). Fleetrepo-lapset: `01m47pd5e742k0ngr4zjsnsrcp`,
  `01m47pnv6ef8a4p1998yh1g669`, `01m47q8dqp1ddzjv9zwjkxajn0`,
  `01m47v2h86axpwpbp6v430sht1`, `01m47wrkd9ze72xxvwasjdwe81`,
  `01m47x0s0rj75dkzqnk7zs0zap`, `01m47y0bavb8fgy77h94bz44kw`. Kapellimestari
  herätti workerin kirjoittamalla tmux-paneeliin `headless:2.1` noin klo
  11.36 UTC.
- **Työtilan poisto:** `01m47qc0zmy17zv9hs09dpqn48` ja
  `01m47vfaep5htkxk4vdadnr5d5`.
- **Kiintiöt:** `01m48ycrybsv49pztfwfembhvf`.
- **Ylläpitoasetusten worker kuoli** (exit 129): `01m48n4sf63jbd3h59e38f9k63`.
