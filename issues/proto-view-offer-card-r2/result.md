# Result: one visibility control, one press, one address

Prototype: `prototypes/nakymakortti-r2.html`, built from
`prototypes/page.src.html` by `python3 prototypes/build.py`, the same page
and machinery as round 1 (`issues/proto-view-offer-card/prototypes/`). The
picker offers *Lähtö · kierroksen 1 suunta 3* (Jari's choice, unchanged) and
three riffs. Every view has light and dark, desktop and phone, site links on
and off, and a descriptive or file-name title. The riffs add an **Osoite**
toggle that switches between the two host models of the architecture
question below; the card looks the same in both, and the line under the
simulation shows the address the browser would open or copy and who can
open it. Jari's guide in Finnish is `prototypes/NOTES.md`; screenshots
(device scale factor 2, AVIF) are in `prototypes/kuvat/`, made by
`prototypes/shoot.mjs`, which also runs the picker check and presses every
card control in every riff, theme, device, link setting and address model
with a clean console.

## What the riffs share

Everything Jari asked for that has one answer:

- A view starts **Vain sinä** and stays there until the person changes it.
- Choosing **Julkinen** makes it public at once: no dialog, no expiry choice.
  The link is created with the default expiry the dialog already uses,
  `min(30, max_days)` (`defaultExpiry` in `web/src/app/viewLinks.ts`), and the
  date shows in the control (*Julkinen 1.12. asti*).
- A public card gains **Kopioi linkki** among its buttons.
- **Avaa omalle välilehdelle** on a public view opens the same address that
  *Kopioi linkki* copies, so the owner sees exactly what a recipient sees.
- Back to **Vain sinä** revokes at once, without confirmation.
- The panel's link icon becomes a *Kopioi linkki* icon, shown only when the
  view is public; visibility is changed on the card.
- A site without links shows neither the control nor *Kopioi linkki*.

What the riffs drop from round 1's direction 3: the link dialog from the
card (*Linkin asetukset…*), its expiry choice, and the menu items
*Kopioi linkki* and *Lopeta jakaminen*. Extending, re-pointing and a new
address remain in Settings › Jaetut linkit, which already lists every link.

## The axis: what the control is and where it sits

| | Riff | Presses to publish | Private card | Public card | Phone | Cost |
|---|---|---|---|---|---|---|
| — | **Lähtö** (round 1, 3) | 4 (pill, *Kuka tahansa linkillä…*, *Luo linkki*, *Sulje*) | *Vain sinä ⌄* | *Linkillä 28.11. asti ⌄* | pill under the title | a dialog; the link and the tab are different addresses |
| A | **Valikko otsikkorivillä** | 2 | *Vain sinä ⌄* | *Julkinen 28.11. asti ⌄* + *Kopioi linkki* | pill under the title | still a menu for a two-valued choice |
| B | **Kytkin otsikkorivillä** | 1 | *Julkinen* switch off | switch on, *28.11. asti* beside it, + *Kopioi linkki* | stays in the title row | a switch that publishes is easy to press by accident (see below) |
| C | **Valitsin painikerivillä** | 1 | *Vain sinä \| Julkinen*, first selected | second selected with date, + *Kopioi linkki* | its own full row | the public row is too long for the card even on desktop and wraps; the most visible control on every card |

## Host facts each needs

| Fact | Where today | Exists? | Used by |
|---|---|---|---|
| Site allows links, `max_days` | `GET /api/v1/view-links` (`useViewLinks`) | **yes** | all |
| The view's link, expiry and URL | `linkFor(view_id)` → `url`, `expires_at` | **yes** | all |
| Publish in one press with the default expiry | `POST /api/v1/view-links {view_id, days: defaultExpiry(max_days)}` | **yes** | all |
| Make private in one press | `POST /api/v1/view-links/revoke {link_id}` | **yes** | all |
| Copy the link | `ViewLink.url`, clipboard write on the app origin | **yes** | all |
| *Avaa omalle välilehdelle* opens the public address when public | browser only: open `link.url` instead of `/view?id=` | **yes** (option 1) | all |
| One address before and after publication | — | **no**: needs option 2 below | all, only under option 2 |

Under option 1 no riff needs a new host fact, store, route or contract
field: the changes are in `ViewOffer.tsx`, `viewOffer.ts`, `ViewHost.tsx`
(the tab target), `ViewPanel.tsx` and the texts.

## How view addresses work today

Read from `internal/gateway/views_linux.go`, `view_links_linux.go`,
`web/src/app/views.ts`, `ViewOpenPage.tsx` and ADR 0033
(`docs/decisions/adr-0033-view-capability-links.md`).

- **The owner's own tab.** *Avaa omalle välilehdelle* opens
  `https://<app>/view?id=<view id>`, an app-origin page. It needs the app
  session: it mints, with the session's CSRF, a one-minute single-use
  handoff to the per-view host `https://<sha256(identity, view id)>.<view
  template>/_open-habitat/handoff?token=…`, whose redemption sets a
  host-only `SameSite=None` view cookie living as long as the app session
  (at most 12 h). The page then frames the view host. The app always frames,
  even in its own tab, because a browser that blocks third-party cookies
  drops the view cookie from a top-level sandboxed document. Anyone else who
  opens `/view?id=…` gets the sign-in.
- **The share link.** `https://<sha256(link id)>.<view template>/<token>/`,
  a 256-bit bearer token as the first path segment of every request, no
  cookie, opened top-level. The gateway keeps the record (owner, view, title,
  token, created, expires) in `view-links.json`; expiry is 1–`max_days`
  (operator's `views.link_max_days`, ≤ 365), checked on every read with
  revocation and the owner's withdrawal. Revoke removes the record; *Uusi
  osoite* replaces the token. The agent never learns a link's address.
- **The view ID** (`v` + 26 base32, random) is not a secret: the agent gets
  it from `view offer`, uses it for `view remove`, and it is in the
  conversation's offer record and the tab's address.

So today the owner's address and the public address are different by design:
one carries the owner's session, the other a bearer token. "One address"
cannot mean the owner's address simply starts working for others without
changing who decides access to it.

## The question for Jari: what is "one address"?

Jari's wish is that the public address is the address *Avaa omalle
välilehdelle* opens. Two models satisfy it; the prototype's **Osoite**
toggle shows both.

### Option 1 · The address is born public (recommended)

While a view is private, the tab opens the owner-only page as today. When the
person makes it public, a link is created and from then on the tab, *Kopioi
linkki* and the recipient all use that one link address. Making it private
revokes the link; making it public again creates a new address.

- **Who can open an address seen while private:** no one. The private
  address (`/view?id=…`) always needs the owner's session; the public
  address did not exist before publication.
- **Making private again** revokes for everyone at once; republishing never
  revives an old copy.
- **Expiry:** as today, default `min(30, max_days)`; extend in Settings.
- **View origin isolation:** unchanged. The owner opening the link
  top-level gets the same sandbox CSP, no cookie and the same budgets as a
  recipient.
- **Architecture:** none. No new authority, store or route; ADR 0033 holds
  as written. The owner's own tab reads count against the link's public
  budgets, which is harmless at their size.
- **An accidental press** (the cost of riff B) exposes nothing: nobody holds
  the address that was just born, and pressing again kills it.

### Option 2 · Every view has one stable address

Each view gets one address from the start, for example
`https://<app>/n/<token>`, and visibility only decides who it admits: the
owner signed in while private, anyone while public.

- **Who can open an address seen while private:** everyone who ever saw it,
  the moment the view becomes public: the owner's synced browser history,
  a screenshot, a pasted chat, a link unfurler that fetched it, and the
  agent if the address derives from the view ID.
- **Making private again** stops access, but **making public again revives
  every copy** ever made. Starting over needs a separate *Uusi osoite*,
  which brings back the step the riffs remove.
- **Expiry** fits awkwardly: either the stable address expires and a view
  loses its address, or expiry only bounds the public state.
- **View origin isolation:** an anonymous visitor and the owner arrive at the
  same address, so the gateway must branch per request on the session. The
  app origin itself (`/n/…`) would serve anonymous people for the first time
  (today only sign-in and `/link` do), or the owner would have to
  authenticate on a link host, which needs a cookie there and fails under
  third-party-cookie blocking, the very reason the app frames views.
- **Architecture:** the gateway gains a record per view, private ones
  included (a view→owner index, today deliberately absent: "no registry maps
  hosts to views"), or the view ID becomes the capability, which hands it to
  the agent and contradicts ADR 0033's "the agent never learns a link's
  address". Either way it is a new ADR amending ADR 0032/0033.

### Recommendation

**Option 1, with riff B.** Option 1 gives Jari everything he asked for (one
press, no dialog, *Kopioi linkki*, the tab opens the public address) and
keeps the security property that matters: an address someone saw while the
view was private never becomes a key. It needs no architecture change.
Option 2's only gain is that the address is the same *before* publication,
and that is exactly the property that turns old copies into keys.

Riff B is the fewest presses and the quietest private card: a private view
shows only a switch in off position, which answers round 1's concern that a
lock on every card makes views look less private than the rest of the
conversation. Its risk, publishing by accident, is harmless under option 1.
A costs a menu for two values; C is the most legible but the widest, and
wraps on every public card.

## Questions for Jari

1. Option 1 or option 2 (above)? Option 2 needs an ADR before it can be
   built.
2. *Julkinen* or *Kuka tahansa linkillä* as the control's word? *Julkinen*
   is shorter and is Jari's word, but the view is not listed or indexed
   anywhere; only the address opens it. The riffs say this in the tooltip
   and A says it in the menu.
3. Should the publish-without-dialog lose the dialog's sentence "revoking
   does not recall what has already been opened or copied", or should it
   appear once, inline, the first time a person makes a view public?

No production code was changed.
