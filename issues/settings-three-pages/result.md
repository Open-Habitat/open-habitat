# Settings: Tekoäly, Koodipalvelut and Tiedot agenteille — result

Agentit, Yhteydet and Integraatiot are replaced by three pages, as accepted in
`proto-integration-grouping` (round 1 *Kolme sivua*, round 2 *Ponnahdus* for
API keys):

| Page | URL | What is on it |
| --- | --- | --- |
| Tekoäly | `/settings/ai` | Default model (today's selector, unchanged), Agentin työ, **Tilaukset** (ChatGPT, Claude) and **API-avaimet** as their own list |
| Koodipalvelut | `/settings/code-hosts` | GitHub, Gitea (moved out of Integraatiot) and **Tuodut työtilat**: each workspace with the host it syncs with and what that host's trouble means for it |
| Tiedot agenteille | `/settings/agent-data` | The former Integraatiot without Gitea |

Every service row carries its letter tile (GH, Gt, Ch, Cl, OA, An, DS), as Jari
asked after round 1.

API keys follow *Ponnahdus*: one row per stored key with the provider tile, the
key's ending (`sk-…abcd`, `sk-ant-…`), *Oma* or *Ylläpitäjän antama*, the models
it opens (from Pi's catalog; a model Pi saw refused is struck through), and
*Vaihda…* / *Poista…*. *Lisää API-avain* opens a dialog that asks for the
provider first, then the key, using the format check that already existed.

## Entry points

A link names a page and a row as a URL fragment (`/settings/ai#claude`). The
page scrolls the row into view, focuses it and marks it for a moment. The
fragment never reaches the server, so the gateway's exact settings allowlist
only had its three slugs renamed.

| From | Goes to |
| --- | --- |
| Model selector, Claude unavailable | Tekoäly › Claude-tilaus (`#claude`) |
| Model selector, *Muuta oletusmallia* | Tekoäly › Oletusmalli (`#default-model`) |
| Model selector, catalog unavailable | Tekoäly |
| New workspace, Gitea list failed | Koodipalvelut › Gitea (`#gitea`), new *Tarkista yhteys* link |
| New workspace, clone refusals (Gitea, GitHub auth) | Text names Asetukset › Koodipalvelut |
| Onboarding AI step, integration step and admin preview | Text names the page (Tekoäly, Tiedot agenteille or Koodipalvelut) |
| Admin AI-avain dialog | Text names Asetukset › Tekoäly |
| Palvelinintegraatiot note, Apple uncertain-result text | Tiedot agenteille |

Because the default model and the key list now share a page, two behaviours
had to change. Saving or removing a key re-reads Pi's catalog, since the first
key of a provider makes its model the default. A Claude sign-in finished on
the page also re-reads the catalog, and the selector re-checks Claude's sign-in
on every catalog read, so the Claude tab opens without a reload.

## Checks

- `./scripts/test-focused.sh --area web` passed.
- `go test ./internal/uiroutes ./internal/gateway` passed (short TMPDIR).
- Whole `npm run test:browser --prefix web`: 392 passed, 3 skipped.
- New `web/tests/settings-three-pages.spec.ts` covers the split, the key
  dialog, the landings and the workspace list, plus axe and overflow on all
  three pages at 1280 and 390 px, light and dark.
- Touched lab specs passed: picker-declutter, english-url-paths,
  sidebar-default, imap-dav-forms, integration-trash, integration-progress,
  microsoft-login and integration-inventory.
- No daemon, contract or session state changed, so this got a focused
  self-review rather than `/llm-review`.

Screenshots at device scale factor 2 are in `evidence/`:
`{tekoaly,koodipalvelut,tiedot}-{desktop,phone}-{light,dark}.png`,
`tekoaly-add-key-desktop-light.png` and `koodipalvelut-landed-gitea.png`.

## Decisions for later review

- **The default-model row is today's selector.** Round 3 (the row form) waits
  for Jari. The whole row is one `s-model` block in `Account.tsx`, marked with
  a comment, so a round-3 form replaces it in one place. The selector is still
  tall on the page.
- **Key status shows only what the host knows.** A row says *Ei vastaa* only
  when Pi refused every model of that key on its latest attempt. Round 2's
  split into rejected (401) and quota (429), and its "Tarkista ja tallenna"
  pre-save check, are not built. Both would need new host facts or a new
  daemon call made as the person. Alternative: derive 401/429 from the refusal
  record, which needs a contract change.
- **No error dots in the settings navigation.** Round 1 marked pages that need
  attention. Doing that would mean reading the credentials, Claude, the
  integration catalog and tea on every settings visit. Left out until there
  is a cheaper summary.
- **Imported workspaces come from the snapshot.** GitHub workspaces are those
  with `git_summary.github_repo` and Gitea ones those with `gitea_origin`. A
  Gitea workspace is marked as in trouble only when none of the person's
  usable tea logins has that server; unreadable tea settings show no trouble.
  Rows do not open workspaces: the sidebar still does that, as in the
  prototype.
- **Onboarding names the page but does not link out.** A link would leave the
  onboarding flow halfway through. The prototype's links on the "Valmis" step
  were a proposal and are not built.
- **Old URLs are not redirected.** `/settings/agents`, `/connections` and
  `/integrations` fall back to the settings list, as any unknown slug does
  (pre-release, no compatibility code).
- **The *Agentit* page and its "Hallitse kirjautumisia" button are gone.**
  *Agentin työ* is on Tekoäly, and the account menu keeps its own toggle.
- **Subscription rows list their models** ("3 mallia: …") from Pi's catalog,
  as round 2 did. The ChatGPT row is "not signed in" whenever only an OpenAI
  key exists, since that key is listed under API-avaimet.
- **The site key's label** changed from *Sivuston avain* to *Ylläpitäjän
  antama*, the prototype's wording, and the admin dialog's text now matches it.
