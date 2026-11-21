# Implementation result — 2026-11-21

Both views are implemented as Jari decided on 21.11.: the admin guide from
direction A "Kysymys ensin" and the person's flow from A "Muistutus", made
shorter. Google's screens use the Microsoft guide's screenshot band. Until real
captures arrive, the images are synthetic placeholders. The research result
this file replaces is in git history (`scripts/from-history.sh
issues/google-personal-accounts/result.md`).

## What changed

- **Admin guide** (`web/src/components/GoogleGuide.tsx`, wired into
  `AppSetupDialog`). Step 1 asks whose accounts may connect. Nothing is
  preselected, and Next and "Minulla on jo asiakas" wait for an answer.
  - Personal path: apis, External branding (contacts, links, privacy
    obligation, domain, warning band), scopes with the restricted-scope note,
    publishing (Testing / In production as the administrator reads it, with
    bands), the user cap, then the client.
  - Organisation path: apis, app name with Internal, scopes, client.
  - After a definite save (`changed`), the guide continues. On the personal
    path it shows the message for another organisation's administrator, with
    the saved client ID, then what to try. On the organisation path it shows
    what to try. An uncertain save closes as before.
  - Habitat stores no audience. No app-name field. The privacy-policy URL is
    not required before Save; the guide states the obligation.
- **Row menu "Kenen tilit…"** (`GoogleAudienceDialog`). This walks an existing
  client through the same choice: what to check, Make external, publishing,
  work accounts, and the post-switch checks marked unconfirmed. It asks for no
  secret and writes nothing, so it stays available when browser setup is
  locked.
- **Person's flow** (`GoogleConnectHelp.tsx`).
  - Before Google: one note, and a link that opens a panel with seven cases
    (warning with two bands, unfamiliar name, and five refusals).
  - While waiting for the return address: the same panel behind one link.
  - The client ID shown in the organisation-block case is read from the sign-in
    address.
- **Stopped at Google.**
  - Browser: a pasted address with Google's own `error` and this sign-in's
    state is not sent. The dialog says the person stopped at Google, and the
    sign-in stays open.
  - Daemon (`google_linux.go`): `error=access_denied` with the right state and
    no code ends the attempt as `cancelled` with no token exchange. The
    contract is unchanged.
- **Connected dialog** lists the services the grant reached. It uses only a
  list read that started after this sign-in completed (review finding).
- **Screenshot band** extracted from `MicrosoftLevels.tsx` into
  `ShotBand.tsx`. Google's crops are in `web/src/assets/google/crops.ts`.
- `docs/operations.md`: new Google subsection "Whose accounts can connect:
  Internal or External" (publishing, 100-user lifetime cap, warning, branding
  and privacy obligations, Workspace trust, migration checks).
- Implemented prototype rounds removed from the tree.

## Screens the conductor must capture

Capture with a consenting synthetic test account and a synthetic Cloud project
on the staging installation. Never capture a real person's account or a real
installation. Mask the project ID, client ID, project name, account email and
domain in the image, as the Entra captures are masked. Replace the three
files in `web/src/assets/google/` under the same names: AVIF like
`assets/entra/` (update the imports from `.svg`), or keep SVG if redrawn from
the capture. Set each crop's `box` and `targets` in `crops.ts` in the new
image's pixels. When all three are real, set `googlePlaceholders = false` in
`crops.ts`.

1. **`warning`**: Google's unverified-app warning before the permissions, in
   its first state (Advanced collapsed), signed in with a personal test
   account, for the published External app. Targets: `heading` (the warning
   heading), `advanced` (the Advanced link), `back` (the back-to-safety
   button). Capture once in English and once with the Google account's
   language set to Finnish. The Finnish capture is needed to confirm the
   Finnish labels that the help now calls unconfirmed.
2. **`warningOpen`**: the same screen after pressing Advanced. Target `goto`:
   the "Go to … (unsafe)" link. Note which identifier Google shows there
   (project name, app name, or domain). The help and `docs/operations.md` say
   this is unconfirmed.
3. **`audience`**: Google Auth platform → Audience for a synthetic project in
   Testing with User type Internal, so both buttons are visible. Targets:
   `menu` (Audience in the left menu), `publish` (Publish app), `external`
   (Make external), `cap` (the OAuth user cap section). If one project cannot
   show both buttons at once, capture two images and split the `audience` crop
   into `audienceTesting` and `audienceInternal` in `crops.ts` and
   `GoogleGuide.tsx`.

Also verify while capturing, and update the texts if Google differs:

- whether cancelling on the warning screen (not the consent screen) redirects
  to `http://localhost/?error=access_denied&state=…` at all;
- the exact Branding field names;
- whether a Workspace-trusted app still shows the warning for that
  organisation's people.

When confirmed, remove the "varmistamatta" badges (`Unconfirmed` in
`GoogleGuide.tsx`) and the unconfirmed sentences in `googleGuide.tsx`,
`googleConnect.ts` and `docs/operations.md`.

## Decisions for later review

- **Placeholder images are hand-drawn SVGs with an on-image watermark and a
  caption**, not cropped mock HTML. Alternative: show no band until a capture
  exists. Chosen so that layout, crop logic and tests already run on the real
  mechanism, and so that a capture only replaces files and coordinates.
- **The stop at Google is caught in the browser and keeps the attempt open.**
  Alternative: send it and show the daemon's `cancelled` result. Keeping the
  attempt open lets the person reopen Google and continue within the
  5-minute prompt lifetime. The daemon mapping remains for any client that
  sends it. Only Google's paste check does this; Dropbox and the MCP providers
  are unchanged.
- **Any `error` value with this sign-in's state is caught in the browser**, as
  "stopped" for `access_denied` and as "Google ended the sign-in with error X"
  otherwise. The daemon maps only `access_denied` to `cancelled`; other values
  stay `redirect_rejected`. That matches the decision's scope while still
  telling the person the truth in the browser.
- **The granted-services list is shown for Google only.** Other providers'
  connected dialogs are unchanged. Alternative: every provider with `access`
  data. Jari's decision named Google.
- **The audience menu item stays enabled when browser setup is locked**,
  because it writes nothing.
- **The existing-client walk includes the Branding step** (External
  requirements) before publishing. It does not repeat the app name for
  Internal.
- **`MicrosoftLevels.tsx` now uses the extracted `ShotBand`.** Behaviour and
  test IDs are unchanged; the CSS classes are renamed `shot-*`.

## Verification

All runs used `umask 077`.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`:
  ok, including the new `TestGoogleStoppedAtGoogleIsCancelled`. It checks
  through the catalog's HTTP handler that the failure is `cancelled` and that
  no token exchange happens.
- `./scripts/test-web-fast.sh` after the review fix: 232 files and 1886
  tests passed. This includes the new stale-grant regression in
  `IntegrationsSettings.test.tsx`, which fails without the fix.
- Browser: `google-personal-accounts.spec.ts` (new: admin and person flows,
  fi-FI and en-US, 1440 and 390, axe, overflow) and `server-integrations.spec.ts`
  (updated). First focused run: 7/8 passed, and the lost-reply spec's step
  count was then fixed. Then `npx playwright test … --repeat-each 3
  --workers 2` with the focused runner's environment: **24/24 passed**.
  After the review fix: the new spec ×3, 12/12 passed, and the two Google
  paste cases of `integrations.spec.ts` passed.
- Review screenshots, outside the repository:
  `/var/tmp/agent-keep/google-personal-accounts/run2/` (admin and person, fi
  and en, 1440 and 390). Logs are in the same directory.
- Review: an independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-2 on the daemon redirect boundary) and `/assess-findings`.
  It found one finding, the grant summary from a stale list on renewal,
  which was fixed with a regression test. The verifier found no defect in
  the daemon change.
- Not run: the Storybook build, the clean gate, the whole browser suite, and
  any live Google sign-in (real screens remain to be captured, listed above).
