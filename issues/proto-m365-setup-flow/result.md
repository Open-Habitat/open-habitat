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
