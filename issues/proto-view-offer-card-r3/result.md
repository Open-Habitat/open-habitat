# Result: the switch in the title row, and choosing when the link expires

Prototype: `prototypes/nakymakortti-r3.html`, built from
`prototypes/page.src.html` by `python3 prototypes/build.py`, round 2's page
and machinery with the address toggle removed (option 1 only) and an
**Enimmäisaika** toggle (7 / 90 / 365 days) added, so each riff shows how its
choices follow the site's maximum. The picker offers *Lähtö · kierroksen 2
riffi B* (Jari's choice, unchanged) and three riffs. Every view has light and
dark, desktop and phone, site links on and off, and a descriptive or
file-name title. The line under the simulation names the host write each
choice would make and the exact moment the link stops working. Jari's guide
in Finnish is `prototypes/NOTES.md`; screenshots (device scale factor 2,
AVIF) are in `prototypes/kuvat/`, made by `prototypes/shoot.mjs`, which also
runs the picker check and presses every card control in every riff, theme,
device, link setting and maximum with a clean console and no card overflow.

## What the host accepts today

Read from `internal/gateway/view_links_linux.go`, `internal/gateway/auth.go`,
`internal/host/site.go` and `web/src/app/viewLinks.ts`:

- An expiry is a whole number of **days from now**, 1 to `max_days`; the
  host stores `now + days × 24 h`. There is no date parameter and no
  "never".
- `max_days` is the operator's `views.link_max_days` (1–365); absent means no
  links. The test server sets 90.
- Creating a link takes `{view_id, days}`; the browser's default is
  `defaultExpiry = min(30, max_days)`.
- Changing it takes `{link_id, days}` on `/api/v1/view-links/change` and
  replaces the expiry with `now + days`: it can extend **or shorten**, and the
  address stays the same.
- The existing dialog's choices are `expiryChoices(max)`: 1, 7 and 30 within
  the maximum, plus the maximum.
- Revoking deletes the record; a later publication is a new link with the
  default expiry. Nothing remembers the earlier choice.

## What the riffs share

- Round 2's riff B card and option 1 addresses, unchanged otherwise.
- The sentence about revoking not recalling what was opened or copied is gone
  everywhere (Jari 1.11.).
- In the riffs the date is its own button left of the switch, so the switch
  never moves when the date appears or disappears; the baseline keeps the
  date as text inside the switch.
- A choice applies at once, counts from now, keeps the address, and may
  shorten as well as extend.
- On a phone the riffs put the date and the switch on their own line under
  the title, right-aligned; in the baseline, as in round 2, they share the
  title row and squeeze a long title into a narrow column
  (`kuvat/02-lahto-puhelin-tumma.avif`). This applies to whichever riff is
  chosen.

## The axis: what pressing the date opens

| | Riff | Presses | Choices | Layer | Phone | Cost |
|---|---|---|---|---|---|---|
| — | **Lähtö** | — | none on the card; Settings › Jaetut linkit | — | date in the switch, title squeezed | changing the expiry means leaving the conversation |
| A | **Kestot valikossa** | 2 | 1, 7, 30 days and the maximum, each with its date | small menu over the conversation | fits | only four choices; a link made earlier with another length shows no tick |
| B | **Kalenteri** | 2 (same month), more for later months | any day from tomorrow to the maximum | calendar over the conversation | fits, covers most of the screen | the link expires at the time of day of the choice, not at the end of the chosen day; a 365-day maximum is twelve months of paging |
| C | **Kestot kortissa** | 2 | as A | none: a row of the card | four equal chips fill the row | the card grows and pushes the conversation down; one more thing to close |

## Host facts each needs

| Fact | Where today | Exists? | Used by |
|---|---|---|---|
| The link's expiry | `ViewLink.expires_at` | **yes** | all |
| The site's maximum | `GET /api/v1/view-links` → `max_days` | **yes** | A, B, C |
| Change the expiry, address kept | `POST /api/v1/view-links/change {link_id, days}` | **yes** | A, B, C |
| The choices | `expiryChoices(max_days)` in the browser | **yes** | A, C |
| Any date up to the maximum | browser: `days = date − today` | **yes**, as whole days from now | B |
| Expiry at the end of the chosen day | — | **no**: needs `expires_at` (or an end-of-day rule) in the change and create requests, and the contract field | B, only if wanted |
| Remember the last chosen length for the next publication | — | **no**: the host forgets on revoke; would need a new per-person preference | none (question 2) |

No riff needs a new host fact as drawn. The changes are in `ViewOffer.tsx`,
`viewOffer.ts` and the texts, plus `ViewHost.tsx` and `ViewPanel.tsx` from
round 2.

## Recommendation

**A · Kestot valikossa.** It answers Jari's request directly: the date is
pressed, and the person picks when the link expires, seeing the resulting
date beside each choice. It uses exactly what the host and the dialog
already offer, two presses, nothing over the conversation that does not go
away by itself. B offers freedom nobody seems to need for a shared prototype
page and has a quiet mismatch (a chosen day is not "through that day"), and
C costs the conversation vertical space for a choice made rarely. Take the
riffs' phone layout (controls under the title) with it.

## Questions for Jari

1. **A or B?** Is choosing from four lengths enough, or do you want to pick
   any date? If a date, should the link work through the end of that day?
   That needs a small host change (an expiry date instead of days).
2. **Republishing** starts again from 30 days. Is that right, or should a
   view made public again get the length chosen last time? Remembering it is
   a new preference stored for the person, which we have avoided so far.
3. **Expiry near or passed:** when the link expires the switch simply turns
   off. Should the card say so ("Linkki vanheni 28.11.") instead, so a person
   who shared it notices why it stopped working?

No production code was changed.
