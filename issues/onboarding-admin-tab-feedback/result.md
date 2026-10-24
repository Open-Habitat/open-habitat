# Result

All five findings are in production code with tests:

1. The Käyttöönotto tab icon is `steer` (a turn arrow on a path) from the
   existing icon set instead of `forward`, the chevron that marks menus.
2. The *Lisää oletusrepo* dialog has a fixed footer: the heading, the hint and
   the finder scroll in `.ob-finder-body`, and *Valmis* with the count stays
   below. The browser spec checks it at 390 px with a long catalog. The
   finder's lists also lost the bullets they had picked up outside the clone
   page.
3. A picked repository stays where it was picked (also in *Viimeksi
   päivitetyt*). It is marked *✓ valittu* and shown as current, and picking it
   again removes it (`?pois=owner/repo`, beside the existing `?lisaa=`). The
   footer still shows *N / 20 oletusrepoa* and the page lists the chosen set.
4. A site that never saved a configuration has no integration steps
   (`defaultOnboarding` in `internal/gateway/onboarding.go`).
5. The save bar is gone, so its spacing problem is gone too. Every change
   saves itself. See the decisions below.

No gateway or contract change was needed for autosave: the existing
`PUT /api/v1/server/onboarding` with `expected_version` already carries the
rule. Review: a focused self-review of the autosave state machine
(`OnboardingAdministration`), since no authority or contract moved.

## Decisions for later review

- **Autosave**: each change (segment, radio, add/remove button, a finder pick)
  is sent at once with the version this page last read or wrote. One write is
  in flight at a time. Changes made while it is on its way are sent together
  right after it, under the version it returned. No change is sent while the
  page already matches the host's version.
- **Status line** under the lede (and in the preview's side panel):
  *Muutokset tallentuvat heti.* before the first change, *Tallennetaan…*
  while a write is in flight, *✓ Tallennettu* after it.
- **Refusal** (the host rejects the document, or the administrator right or
  CSRF is no longer valid): nothing was written, so the page goes back to the
  host's version and an alert says *Muutosta ei tallennettu.* plus the
  reason. Editing stays open, and the next change clears the alert.
- **Conflict** (another administrator or tab saved in between): an alert says
  the latest change was not saved. Every control is disabled until *Lataa
  nykyinen versio* reads the host's version again. The unsaved change stays
  visible until then. The page never retries or overwrites.
- **Unconfirmed write** (network failure, 5xx, unreadable reply, ended
  session): handled like a conflict. The write may have happened, so the page
  locks and offers *Lataa nykyinen versio*.
- **Typed `owner/repo`**: there is no free text field on the tab. In the
  finder, typing only searches and looks the repository up; the write happens
  when the found row is picked.
- **Tab icon**: `steer` was the closest route-like icon in the set. A
  dedicated route or flag icon would need a new glyph.
