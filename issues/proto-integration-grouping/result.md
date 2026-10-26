# Grouping of AI, code-host and data integrations — round 1

Prototype: `issues/proto-integration-grouping/prototypes/settings-grouping/index.html`
(offline, one file). Notes for Jari: [NOTES.md](prototypes/settings-grouping/NOTES.md).
Screens: `prototypes/settings-grouping/evidence/`.

## For Jari

**Suosittelen vaihtoehtoa 1, Kolme sivua:** *Tekoäly*, *Koodipalvelut* ja
*Tiedot agenteille*. Se vastaa suoraan kysymykseesi: AI-integraatioilla ja
git-integraatioilla on omat sivunsa. Navigaatiossa on silti yhtä monta kohtaa kuin nyt
(Agentit, Yhteydet ja Integraatiot korvautuvat). Perusteet:

- Jokainen linkki muualta osuu yhdellä siirtymällä oikealle sivulle ja riville.
  Mallivalitsimen Claude-linkki ja oletusmalli vievät samalle Tekoäly-sivulle,
  Uusi työtila -sivun Gitea-virhe Koodipalveluihin ja käyttöönoton
  integraatiovaihe Tietoihin agenteille.
- Tilaukset ja oletusmalli ovat samalla sivulla, joten Claude-kirjautumisen
  vika näkyy heti oletusmallin vieressä. Agentit-sivun ”Hallitse kirjautumisia”
  -välilinkkiä ei enää tarvita.
- GitHub ja Gitea ovat samassa paikassa niistä tuotujen työtilojen kanssa,
  joten koodipalvelun virheen vaikutus työtiloihin näkyy siinä, missä virhe
  korjataan.
- Henkilön sivu ei ole enää nimeltään ”Integraatiot”, joten se ei sekoitu
  ylläpidon Palvelinintegraatioihin.

Vaihtoehto 2 (*Agentit ja mallit* + yksi *Yhteydet*-sivu) lyhentää
navigaatiota, mutta Yhteydet-sivusta tulee pitkä, ja koodipalvelut ja posti
jäävät samalle sivulle. Vaihtoehto 3 (*Yhteydet*-keskus) näyttää kaikkien
tilien tilan yhdellä silmäyksellä. Hintana on lisänapsautus, ja tekoälytilaukset
jäävät eri sivulle kuin oletusmalli. Keskuksen yhteenvetoa kannattaa harkita
myöhemmin vaihtoehdon 1 lisäksi, jos tilejä tulee paljon.

**Valitaanko Kolme sivua pohjaksi?** Kokeile ainakin Virheitä-tilannetta,
Mistä linkataan -näkymää sekä 390 px:n ja tummaa näkymää. Issue jää avoimeksi,
preparation=pending.

## What was compared

The axis is **which page owns an external account**. The account rows,
states, copy and synthetic data are the same in all three variants; only the
pages, navigation and link targets differ.

| Variant | Pages | Model selector → | Onboarding (later in settings) → | New workspace Gitea error → |
| --- | --- | --- | --- | --- |
| 1 · Kolme sivua | Tekoäly · Koodipalvelut · Tiedot agenteille | Tekoäly (Claude row; default model on the same page) | Koodipalvelut › GitHub · Tiedot agenteille › Google · Tekoäly › ChatGPT | Koodipalvelut › Gitea |
| 2 · Kaksi sivua | Agentit ja mallit · Yhteydet (Koodipalvelut, Tiedot agenteille as sections) | Agentit ja mallit | Yhteydet › GitHub / Google · Agentit ja mallit › ChatGPT | Yhteydet › Gitea |
| 3 · Keskus | Agentit · Yhteydet hub → Tekoälypalvelut / Koodipalvelut / Tiedot agenteille | Claude: Yhteydet › Tekoälypalvelut; default model: Agentit | Yhteydet › (group) › row | Yhteydet › Koodipalvelut › Gitea |

States shown: connected, not connected and needs-action for ChatGPT, Claude,
API keys, GitHub (partial `gh` authorization), Gitea (token rejected), Google
(server app credentials missing), Microsoft 365, iCloud, Dropbox and generic
IMAP/DAV, plus the administrator-provided AI key for a new person. Navigation
carries an error dot per page; workspaces show what their host's error means
for pull/push.

## Grounding

Read `web/src/components/Account.tsx` (settings sections and the current
Yhteydet card), `Integrations.tsx`/`.css`, `Settings.css`,
`GiteaConnection.tsx`, `app/PiModelSelector.tsx` (links to
`settingsHref("yhteydet")` and `("agentti")`), `OnboardingSettings.tsx` and
`IntegrationOnboarding.tsx` (onboarding says only "myöhemmin asetuksissa",
naming no page), `app/NewWorkspacePage.tsx` ("Tarkista se Integraatioista") and
`SiteKeyCopies.tsx` ("Asetukset › Yhteydet"). The onboarding "Valmis" links in
the prototype are a proposal, not current behaviour.

An implementation of the chosen variant would touch those link targets and
texts, the section list and icons in `Account.tsx`, and move `GiteaCard` out of
`IntegrationsSettings`. No contract, daemon or authority change is implied.
Workspaces under Koodipalvelut would read the existing snapshot; no new store
is needed.

## Verification

`check.mjs` (repository Playwright, Chromium, on Birch) passed: every page of
every variant (including the hub's three group pages) at 390 and 1440 px in all
three scenarios renders without horizontal overflow; every "Mistä linkataan"
link lands on the page it names and marks the row; connect, fix and disconnect
work; error dots follow the scenario; picker keys work and a switch keeps the
subject; no console errors and no network requests (CSP `default-src 'none'`).
Screens cover desktop and phone in light and dark.

## Kierros 2 · Tekoäly page: default model and API keys

Prototype: `issues/proto-integration-grouping/prototypes/settings-riff/index.html`
(offline, one file). Notes for Jari: [NOTES.md](prototypes/settings-riff/NOTES.md).
Screens: `prototypes/settings-riff/evidence/`.

### For Jari

**Suosittelen vaihtoehtoa 2, Ponnahdus.** Oletusmallin rivi on sama pilleri ja
ponnahdusvalikko kuin kirjoituskentässä (puhelimessa alhaalta nouseva arkki),
joten oletus ja keskustelun malli valitaan samalla kontrollilla. API-avaimet
ovat oma listansa, ja jokaisella rivillä on palvelu, `sk-…loppu`, *Oma* tai
*Ylläpitäjän antama*, tila (toimii, hylätty tai kiintiö täynnä) ja avattavat
mallit. *Lisää API-avain* avaa dialogin, jossa valitaan ensin palvelu.
Vaihtoehto 1 (*Paikallaan*) ryhmittelee tilaukset ja avaimet
palveluntarjoajittain ja avaa kaiken rivin sisään. Vaihtoehto 3
(*Mallit edellä*) tekee mallilistasta oman alisivun, jossa jokainen reitti
malliin on painike. Valitaanko 2? Kokeile ainakin Virheitä-tilannetta ja
puhelinleveyttä.

### What was compared

The axis is **where the default-model chooser opens and how keys are organised**:
in place with keys per provider company (1); the composer's popover/sheet with
keys as their own list (2); a models subpage where each route to a model is a
choice (3). All three use production's `ModelPicker` behaviour (provider tabs,
radio rows, older models, thinking levels, optimistic save with Pi's
confirmation) except variant 3's subpage, which is a new list. Scenarios: all
working; errors (ChatGPT fine, Claude sign-in unverified, OpenAI key quota
exhausted, Anthropic site copy rejected after the site changed its key, and the
default on that key); a new person with only the administrator's Anthropic key.

### Grounding

Read `app/PiModelSelector.tsx`, `components/ModelPicker.tsx`,
`ComposerModelPicker.tsx`, `ModelChip.tsx`, `ConversationModelDetails.tsx`,
`app/NewConversationModelDialog.tsx`, `app/PiCredentials.tsx`,
`components/AIOfferList.tsx` (the Ch/Cl/OA/An/DS tiles already exist there),
`SiteKeyCopies.tsx` and the Agentit/Yhteydet sections of `Account.tsx`.

Facts the prototype relies on: Pi holds one key per provider, so the
administrator's key is a copy in the person's own slot ("Vaihda omaan…"
replaces it); the browser knows presence, last four characters, the site
copy's current/earlier state, the models per provider and per-model refusals.
**Proposals, not current behaviour:** splitting a refusal into
rejected (401) / quota (429) on the key row (probably derivable from the
per-model refusal record; to be confirmed), and a provider check before a key
is stored ("Tarkista ja tallenna"), which would be a new daemon call made as
the person. No authority moves; the gateway and provisioning are untouched.

### Verification

`check.mjs` (repository Playwright, Chromium, on Birch) passed: 18 renders
(3 variants × 390/1440 × 3 scenarios) fit without horizontal overflow with the
default chooser open; choosing a default confirms and shows on the page; the
error scenario's default row leads to a working choice; a wrong-provider key is
caught, a rejected key is not stored, a good one is and makes its first model
the default; removal confirms and names the default it breaks; the site key is
replaced by one's own; Escape closes the popover and returns focus; Koodipalvelut
shows the GitHub/Gitea tiles; no console errors and no network requests.

## Kierros 3 · The default-model row

Prototype: `issues/proto-integration-grouping/prototypes/settings-riff-3/index.html`
(offline, one file). Notes for Jari: [NOTES.md](prototypes/settings-riff-3/NOTES.md).
Screens (device scale factor 2): `prototypes/settings-riff-3/evidence/`.

Jari accepted Ponnahdus but found the row it opens from odd: round 2 put the
composer pill, with a provider tile and a focus halo, at the far right of a
two-line explanation. Round 3 varies only that row; the popover/sheet content
and the rest of the page are round 2's. Every form names the model, the route
(`Claude-tilaus`, `Anthropic API · ylläpitäjän avain` …) and the thinking level,
because production's `ModelChip` omits the route, and the route is usually
where a broken default is broken.

| Variant | Form | How it reads as clickable | Relation to a conversation's model |
| --- | --- | --- | --- |
| 1 · Valintakenttä | Form field under a label: tile, model, route, thinking, ⇕ | A select-like bordered field | Helper line under the field |
| 2 · Asetusrivi | Whole row is the button; value right-aligned (model, then route · thinking) | ⇕ and row hover | "Uusille keskusteluille" only |
| 3 · Peili | Sketch of a new conversation's composer with production's exact chip | The chip itself, as in the composer | Shown by the mirror, plus one line |
| 4 · Erittely | Three labelled cells (Malli, Palvelu with status, Ajattelutaso) and **Vaihda…** | An explicit button | ⓘ line under the cells |

### Conductor's recommendation

**Asetusrivi (2).** The oddity in round 2 was a control sitting in the middle
of a settings page. Asetusrivi shows the default as a value, like every other
setting, makes the whole row the target, and adds the route the pill lacked.
In the error state the model turns red with a warning icon and the reason sits
under the row, so a broken default stays visible. Its cost is a subtle
affordance (⇕ and hover only), which an implementation can strengthen without
changing the form. Peili explains the default-versus-conversation relation
best; its one sentence can move into the popover footer if Jari wants that
said. Valintakenttä is the safe fallback if clickability matters more than
calm. Erittely is the heaviest, and its three boxes compete for attention.

**Which row form does Jari want?** Issue stays open, preparation=pending.

### Verification

`check.mjs` (repository Playwright, Chromium, on Birch) passed: all four
variants in all three scenarios at 390 and 1440 px render without horizontal
overflow, with the chooser open too, and with the popover inside the viewport.
Every row names the model and the route. Choosing a model is confirmed and
shown on the row; Escape and an outside click close the chooser, and Escape
returns focus to the trigger. The error scenario's row leads to a working
choice, and a first API key changes the row at once. Picker keys work, there
are no console errors, and the page makes no network requests
(CSP `default-src 'none'`). No production code changed.
