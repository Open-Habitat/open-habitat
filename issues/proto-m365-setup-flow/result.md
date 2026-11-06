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

# Round 3: riffs on A1 Valikkopala

Round `design-system/prototypes/rounds/2026-11-06-m365-leikkeet/` (its
`NOTES.md` is the Finnish walk-through). Screenshots at device scale factor 2
are in `evidence/` with the prefix `r3-`: every step of every riff at 1440 and
390 in light, plus dark captures of step 1 and step 4 of every riff (and A1a's
step 2) at both widths.

## What changed in all three

- **The Entra pieces are real crops of Jari's five screenshots**, not
  redrawings. `crops.py` paints an opaque box over every tenant, client and
  object id, over the domain (*Single tenant only - …*, *Grant admin consent
  for …*) and over the other applications' names in the App registrations
  list. It paints them on the original before scaling, and writes only
  60 %-scale AVIF crops (28–55 kB each) and their record (`crops.json`: box,
  masks, targets, sha256). The originals stay in
  `~/.local/state/oh-conductor/m365-shots/`. `check.mjs` fails if a crop file
  is unrecorded or changed, has an original's size, is a PNG, or decodes to
  anything but the flat mask colour inside a mask.
- **No checkboxes on the permissions.** Each permission is its own row with
  its own copy button. The line below says "9 oikeutta · User.Read on siellä
  valmiina".
- The guide writes `<domain>` where Entra shows the tenant's domain, because
  the host does not know it.

## Riffs

The axis is crop size and placement, together with how the target is marked
and how the dark theme frames a light screenshot:

- **A1a Vieressä**: a whole-page crop beside the steps in a wider dialog
  (1160 px, crop column 470 px). Each target row and its place on the crop
  carry the same number inside an accent frame. Dark: the screenshot sits on
  a white 6 px mat, like a print.
- **A1b Kaistale**: a dialog-wide band of the page above the rows, near
  Entra's own text size, with one target lit through a scrim. Each target
  row has an eye button, and the band has arrows. Dark: the band is dimmed.
  On a phone the band narrows to the target's neighbourhood.
- **A1c Rivissä**: no page by default. Each target row carries the one
  button, field or menu row it names, cut tight at Entra's own size. "Näytä
  koko sivu" opens the step's page crops with the targets framed. Dark: a
  stronger line is frame enough for small cuts.

## Host facts the view assumes

The same as rounds 1 and 2, with nothing new read from the host. The crops
are static assets of the guide; nothing about the tenant is shown or claimed.

## Recommendation

**A1a Vieressä.** It keeps what Jari chose in round 2: the place on the real
page, visible without a click, and the numbers tie each instruction row to
its spot. A1b shows the text larger, but only one place at a time and only
after a click, and its scrim greys out the very page the admin is trying to
recognise. A1c is the best at "what does the button look like" and the best
on a phone, but it drops the "where on the page" that the round-2 choice was
about; its whole-page toggle brings that back only on request. A1a's cost is
the wider dialog and small text in the crop. The frame and number carry the
target, so the admin matches shapes rather than reads the crop.

## Decisions for later review

- **The domain is a grey box and the guide says `<domain>`**, rather than a
  painted placeholder name. A box cannot be mistaken for a real value.
- **Other applications' names are masked** in the App registrations crop;
  *Open Habitat* and *Open Habitat (testi)* stay, because the "Jos sivu ehti
  sulkeutua" line is about telling them apart.
- **Crops are 60 % of the 2x screenshots**: sharp in A1a and A1c, slightly
  soft in A1b's band on desktop.

## Not verified

- The *Mobile and desktop applications* panel and the Delegated permissions
  picker have no screenshot, so those rows have no crop.
- How long the crops stay true: Microsoft redesigned Authentication in
  2025–26 and labels it Preview.

## Questions for Jari

1. Which riff: `r3-a1a-vieressa-1-register`, `r3-a1b-kaistale-1-register` or
   `r3-a1c-rivissa-1-register` (all `-1440-light`)?
2. Dark theme: A1a's white mat (`r3-a1a-vieressa-2-public-1440-dark`) or
   A1b's dimmed screenshot (`r3-a1b-kaistale-1-register-1440-dark`)?
3. For production, are crops of your own tenant (masked as here) fine, or
   should the shipped images come from a clean test tenant with no boxes?

## View (round 3)

```
node design-system/prototypes/rounds/2026-11-06-m365-leikkeet/build.mjs
tw browser-open design-system/prototypes/dist/m365-leikkeet/m365.html
```

`check.mjs` (in the round) passes 991 checkpoints with a clean console.

# Round 4: riffs on A1b Kaistale

Round `design-system/prototypes/rounds/2026-11-06-m365-alakohdat/` (its
`NOTES.md` is the Finnish walk-through). Screenshots at device scale factor 2
are in `evidence/` with the prefix `r4-`. They are viewport captures, not
whole pages, so each one shows what fits without scrolling. In light, every
riff has the first sub-item of every step, Register's *Valmis*, *Add Redirect
URI*, the permission list, the tenant id, the filled consent link, the saved
row and *Minulla on jo sovellus*, at 1440×900 and 390×844. Dark captures cover
step 1 (first and last sub-item) and the permission list at both sizes.

## What changed in all three

- **A step shows one sub-item at a time, and the band lights its place.**
  Round 3's rows are grouped into sub-items, each with its own target on a
  crop. A row with no place of its own joins the sub-item whose page it is on:
  the redirect value goes under *Add Redirect URI*, *Allow public client
  flows* under *Settings*, and the permission list gets its own sub-item,
  lighting *Configured permissions*, where the permissions will appear.
  The steps have 6, 4, 4 and 4 sub-items.
- **"Valmis, kun" is the last sub-item**, and the band shows what done looks
  like: after Register, the app's menu with Overview selected; after the
  public client, the two tabs; after permissions, the *Microsoft Graph (1)*
  row that should read (10). In the consent step the line stays on *Grant
  admin consent*, because the next sub-items move to Overview.
- **The band keeps one height within a step** (3.7:1 on a desktop, 2.3:1 on
  a phone). The view is cut around the target to that shape, so the
  instruction below does not jump when the sub-item changes.
- **A permission is a chip that is one copy button**, with the whole name and
  a copy icon. Nine fit in three rows on a desktop and in five rows of two on
  a phone. There are still no checkboxes, and each copy is one name.
- **The two id fields are their own sub-items**, under Overview's matching
  rows. A save with a missing or bad id opens that field's sub-item. The
  consent hand-off sits with the admin role on *Grant admin consent* and fills
  once the ids are in.
- The crops are round 3's, imported from its directory unchanged. This round
  holds no image. Its `check.mjs` re-runs round 3's crop verification (sha256,
  no original size, no PNG, every mask decodes flat) and fails if an image
  file appears here.

## Riffs

The axis is how a sub-item is reached and who moves the walk forward:

- **A1b1 Välilehdet**: tabs under the band, in Entra's words and numbered.
  The reader picks any of them, and arrow keys, Home and End move along the
  list. *Seuraava* moves to the next step. On a phone only the selected tab
  keeps its name, and the others are numbers on the same line.
- **A1b2 Askeleet**: a numbered stepper under the band, with a tick on the
  sub-items passed. One primary button walks every sub-item of every step
  (*Seuraava: Name* … *Seuraava vaihe*), and *Takaisin* walks back one,
  across a step boundary too. The progress bar fills per sub-item, and
  *Tallenna* appears on the last one.
- **A1b3 Nuolet**: numbered segments above the band, with the selected
  sub-item's name beside them, and ‹ › in the band's lower right corner.
  Below the band there is only the sub-item's text, so this is the most
  compact of the three. *Seuraava* moves to the next step.

## Host facts the view assumes

The same as rounds 1–3. Nothing new is read from the host. The stepper ticks
in A1b2 only record what was pressed on this page; nothing is stored and
nothing is claimed about the tenant.

## Recommendation

**A1b2 Askeleet.** The admin works in two windows, and each time they come
back from Entra they need to know where they were and what comes next. A1b2
answers both: ticks on what is behind, and the one button names the next
thing (*Seuraava: Settings*). A sub-item cannot be skipped by accident, which
in A1b1 and A1b3 *Seuraava* allows, since it moves whole steps. On a desktop
the stepper still shows every sub-item's name, so the overview that round
3's list gave is kept. The cost is presses: 16 instead of 4 to reach the
ids, though each press replaces a scroll. If Jari prefers to read in his own
order, A1b1 is the alternative, with the same names as tabs. A1b3 is the
tightest, but it hides the names behind numbers.

## Decisions for later review

- **A permission chip copies on a press anywhere on it**, instead of a
  separate copy button. Two chips fit side by side on a phone only this way.
- **The permission sub-item lights *Configured permissions***, the table
  the permissions will appear in. The *Delegated permissions* picker itself
  has no screenshot.
- **Only the current riff's line is in the review bar**, to leave the 900 px
  height to the dialog.

## Not verified

- The same as round 3: no screenshot of the *Mobile and desktop
  applications* panel or of the Delegated permissions picker.
- On a phone the band shows wide targets (*Name*, *Configured permissions*)
  at small text sizes. It still marks the place, but the text in it cannot
  be read at 390 px.

## Questions for Jari

1. Which riff: `r4-a1b1-valilehdet-2-public-2`, `r4-a1b2-askeleet-2-public-2`
   or `r4-a1b3-nuolet-2-public-2` (all `-1440-light`)?
2. Should *Valmis, kun* be its own sub-item with the band showing the
   finished state (`r4-a1b2-askeleet-1-register-6-1440-light`), or a line
   under every sub-item as in round 3?
3. Are the permission chips right, with the whole chip copying
   (`r4-a1b1-valilehdet-3-permissions-3-1440-light`,
   `…-390-light`)?

## View (round 4)

```
node design-system/prototypes/rounds/2026-11-06-m365-alakohdat/build.mjs
tw browser-open design-system/prototypes/dist/m365-alakohdat/m365.html
```

`check.mjs` (in the round) passes 2076 checkpoints with a clean console.
