# Result: Microsoft 365 setup flow, round 1

Round `design-system/prototypes/rounds/2026-11-06-m365-asetus/` (its
`NOTES.md` is the Finnish walk-through). Screenshots at device scale factor 2
are in `evidence/`: every step of every direction at 1440 and 390 in light,
plus one dark capture per direction and width.

## Axis and directions

Axis: how the Entra work is told, and how many steps it takes.

- **Nyt**: production's four steps; paths small and muted, permissions as one list behind one copy.
- **A Lista**: the same four steps as a readable list; path at body size, each Entra field its own row, permissions one at a time with ticks, and "Valmis, kun" on every step.
- **B Rinnakkain**: beside each instruction a sketch of the Entra page, with the value and its copy in the field it belongs to.
- **C Kolme**: no permissions step; credentials first, then the consent link, which grants the permissions in one go.

All three directions fix both absorbed bugs. The path line is 14.5 px
(`--ah-size-body`) in full ink, with no arrow; today it is 12.5 px in
`--ah-ink-2` (measured by `check.mjs`). Permissions copy one name at a time
(A, B), or the permissions step is gone (C).

## What each Entra field does with a paste

From Microsoft Learn (register an app, add a redirect URI, configure
permissions, admin consent protocols, scopes and `.default`; pages updated
2026-06/09).

| Where in Entra | What it takes |
| --- | --- |
| New registration › Name | Free text; a paste works. |
| New registration › Supported account types | A drop-down. Its first option reads "Single tenant only - <tenant>". Nothing to paste. |
| New registration › Redirect URI | Left empty. |
| Authentication › Settings › Allow public client flows | A switch: Enabled/Yes, then Save. Nothing to paste. |
| Authentication › Redirect URI configuration › Add Redirect URI › Mobile and desktop applications | Suggested redirect URIs come as checkboxes, `…/common/oauth2/nativeclient` among them; Custom redirect URIs takes a paste. Ticking the suggestion is the shorter route. |
| API permissions › Add a permission › Microsoft Graph › Delegated permissions › Select permissions | A filter over the list. One name narrows it to that permission; a space- or newline-separated list matches nothing. This is why today's single copy does not work. User.Read is already there after registration. |
| API permissions › Grant admin consent for <tenant> › Yes | Grants what Configured permissions lists. The Status column then reads "Granted for <tenant>". The button is disabled when nothing is configured. |
| Overview | Application (client) ID and Directory (tenant) ID, each with Entra's own copy button. |
| `…/{tenant}/v2.0/adminconsent?client_id&scope&redirect_uri` | Grants the permissions named in `scope`, whether or not they are configured. `redirect_uri` must be registered (the nativeclient one is). Success lands on the nativeclient page, which is blank, with `admin_consent=True` in the address. |
| Sign-in with `https://graph.microsoft.com/.default` (the daemon's `microsoftRequest`) | Once consent exists, the token carries every Graph permission granted to the app, "regardless of the contents of the client application's registered permissions" (scopes-oidc, example 1). |

C rests on the last two rows. The daemon already builds exactly that v2 link
(`microsoftConsent` in `internal/daemon/integrations/microsoft_linux.go`) for
the level's permission set. The production wizard links the v1 form
(`/adminconsent?client_id=`), which only grants what API permissions lists.

## Host facts the view assumes

- The permission lists per level and the redirect are production's
  (`microsoftPermissions`, `microsoftRedirect`), which mirror the daemon's
  `microsoftLevelScopes`. Nothing new is read from the host.
- The guide cannot see Entra. The ticks in A and B, and C's "Hyväksyntä
  tehty", only record what the administrator did on this page; nothing is
  stored and nothing is claimed about the tenant. The daemon still finds
  missing consent at sign-in and words it as today.
- C needs no new contract or command. The wizard builds the same v2 link
  the daemon builds, from the two typed ids and the level.

## Recommendation

**C Kolme.** The permissions step is the one Jari tripped on, and C removes
it rather than making it tolerable. The link fixes the exact set of
permissions, so no row can be mistyped or left out, and the admin approves
them on Microsoft's own page, which lists them in words. The first two steps
use A's readable rows and "Valmis, kun" lines.

Before it is built, try C once on a real tenant: register, Authentication
only, consent through the v2 link, then connect an account. The
documentation says the token from `.default` carries the dynamically
granted permissions; the live check confirms our tenant agrees. If it does
not, A is the fallback: same steps as today, with the path and permission
fixes.

B was the most expensive to keep true. Each sketch is a second description
of Entra's pages, and it goes stale whenever Microsoft redesigns a page,
which it did to Supported account types and Authentication in 2025–26.

## Decisions for later review

- **C uses the daemon's v2 consent link in the wizard**, not production's
  v1 link. Alternative: keep v1 and the permissions step (A). Why: v1 cannot
  grant what is not configured.
- **C's hand-off copies the link without showing it.** The v2 link runs to
  six lines; the copy button is labelled "Kopioi hyväksyntälinkki". A and B
  show the shorter v1 link as today.
- **The redirect URI is ticked from Entra's suggestions** rather than pasted.
  The copy stays for the Custom redirect URIs field.
- **The ticks are not kept** across closing the dialog. Keeping them would
  be a second record of Entra state that the guide cannot verify.
- **The Entra sketches in B are drawn, not screenshots**, so they carry no
  Microsoft imagery and follow the theme.

## Not verified

- Whether the Delegated permissions picker keeps earlier ticks while the
  search changes (A's sentence "Rastit säilyvät…"). This is common
  experience; the docs do not say it.
- C on a live tenant (above).
- Jari's screenshot `/var/tmp/oh-ms-wizard.png` was not found on Birch or
  Alder. Step 2/4 was reproduced from the production component instead
  (`evidence/nyt-2-public-*`).
- Google and Dropbox permission inputs, which `ms-permissions-copy-one-by-one`
  also asks about, are outside this round.

## Questions for Jari

1. Which direction: `nyt-3-permissions`, `a-lista-3-permissions-1-kesken`,
   `b-rinnakkain-3-permissions-1-kesken` or `c-kolme-3-consent-0-tunnukset`
   (all `-1440-light`)?
2. In C, the permissions show in Entra under *Other permissions granted for
   <org>*, not under Configured permissions. Is that acceptable
   (`c-kolme-3-consent-0-tunnukset`), or should they still be added by hand
   (`a-lista-3-permissions-2-valmis`)?
3. Is the "Valmis, kun" line worth its room on every step
   (`a-lista-2-public-1440-light`)?

## View

```
node design-system/prototypes/rounds/2026-11-06-m365-asetus/build.mjs
tw browser-open design-system/prototypes/dist/m365-asetus/m365.html
```

`check.mjs` (in the round) passes 368 checkpoints with a clean console.

# Round 2: riffs on A Lista

Round `design-system/prototypes/rounds/2026-11-06-m365-riffi/` (its
`NOTES.md` is the Finnish walk-through). Screenshots at device scale factor 2
are in `evidence/` with the prefix `r2-`. They cover every step of every riff
at 1440 and 390 in light, plus one dark capture per riff and width.

## What changed in all three

Jari and Aino's findings, and his five Entra screenshots, changed the
instructions themselves:

- One link only, in step 1, labelled *Avaa App registrations*: it lands on
  *All applications*, so the step continues from there (*New registration*
  above the list). After *Register*, Entra opens the app itself. Every later
  step names the app's left-menu item and the *Authentication (Preview)* tab
  instead of linking.
- A "Jos sivu ehti sulkeutua" line tells how to get back in: *All
  applications*, then the name in the filter, then exactly that name. Jari's
  list has both *Open Habitat* and *Open Habitat (testi)*.
- Entra's real order: *Authentication (Preview)* opens on *Redirect URI
  configuration*, so the redirect comes before *Settings* (round 1 had them
  the other way round).
- Entra's real words: *Redirect URI (optional)*; *Single tenant only -
  <domain>* and *Grant admin consent for <domain>* (Entra names the tenant by
  its domain); the permissions step is done when *Configured permissions*
  reads *Microsoft Graph (10)*. On Overview, Entra's copy button only shows on
  hover, and *Object ID* is named as the one not to take.

## Riffs

- **A1 Valikkopala**: A's four steps, with a redrawn crop of the real Entra
  page beside each one. It shows the left-menu row, the tab or the toolbar
  button highlighted, and on the last step Overview's Essentials with the two
  needed rows.
- **A2 Valikon järjestyksessä**: no steps. One checklist down the app's left
  menu, one item open at a time, each headed by its menu path. Tallenna
  works at any time; with ids missing it opens the Overview item.
- **A3 Olet nyt**: every step opens with Entra's own page heading ("Olet nyt
  Entrassa: Open Habitat | Authentication (Preview)") and the one move to
  make next. The ids are step 2, taken from Overview where Entra has just
  landed, each field beside its Essentials row with an immediate format check.
  The consent hand-off link is then already filled in step 5.

The Entra crops are redrawn, not cut from the screenshots, so no tenant,
client or object id and no organisation name reaches the tree;
`check.mjs` fails if any crop shows a GUID. The originals stay in
`~/.local/state/oh-conductor/m365-shots/`.

## Host facts the view assumes

The same as round 1, with nothing new read from the host: production's
permission lists and redirect, the v1 consent link built from the two typed
ids, and ticks that only record what the administrator did on this page.

## Recommendation

**A3 Olet nyt.** What tripped Jari and Aino was losing their place in Entra,
not the wording of a field. A3 answers that on every step with the heading
Entra itself shows, which is the one thing on that page they can always find.
That heading stays true as long as Microsoft keeps the menu names, whereas
A1's crops are a second picture of Entra that goes stale with every redesign,
the same cost that ruled out round 1's B. Taking the ids at the moment Entra
is already on Overview removes one round trip back to Overview. It also lets
the last step offer a filled consent link to an administrator who lacks the
role. A2 reads well as a single list, but on a phone its open item and the
list around it make a long page. It also gives up the step count, which the
production dialog's progress bar relies on.

One idea from A1 is worth keeping in A3: the crop of the *App registrations*
page in step 1, where the administrator is not yet inside the app and the
heading alone does not show where *New registration* is.

## Decisions for later review

- **Crops are redrawn, not cropped images.** They follow the theme and cannot
  leak an id; the cost is that they are our drawing of Entra.
- **Supported account types says "Valitse, jos ei ole jo valittuna".** Jari's
  screenshot shows Single tenant already selected; the docs do not say
  whether that is the default for every tenant.
- **A2's ticks are not kept,** like round 1's.

## Not verified

- That the *Mobile and desktop applications* panel in the new *Authentication
  (Preview)* experience still offers the nativeclient address as a
  suggestion. Jari's screenshot shows the empty tab, not the panel.
- That the Overview copy button appears on hover in every browser. In
  Jari's screenshot no copy button is visible.

## Questions for Jari

1. Which riff: `r2-a1-valikkopala-2-public`, `r2-a2-valikon-jarjestys-0-lista`
   or `r2-a3-olet-nyt-3-public` (all `-1440-light`)?
2. Should the ids come right after registration
   (`r2-a3-olet-nyt-2-ids-1-liitetty-1440-light`) or last, as in A
   (`r2-a1-valikkopala-4-consent-1-tunnukset-1440-light`)?
3. Should step 1 keep the App registrations crop
   (`r2-a1-valikkopala-1-register-1440-light`) in whichever riff is chosen?

## View (round 2)

```
node design-system/prototypes/rounds/2026-11-06-m365-riffi/build.mjs
tw browser-open design-system/prototypes/dist/m365-riffi/m365.html
```

`check.mjs` (in the round) passes 732 checkpoints with a clean console.
