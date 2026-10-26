# Result

The Tekoäly page's default model is now an Asetusrivi: *Oletusmalli /
Uusille keskusteluille* on the left, and on the right a select-style button
at the row control's size (32 px, 40 px on touch), not Valintakenttä's page
size. The button shows the provider's letter tile, the model, the route
(`ChatGPT-tilaus`, `Anthropic API` …), the thinking level and ⇕. It opens
the existing default-model selector (`PiModelSelector`, Ponnahdus content
unchanged) as a popover under the button on desktop and as a bottom sheet
with a scrim on phones (≤ 760 px). Escape and the close button close it and
return focus to the button. An outside pointer closes it without taking focus,
and a link inside it (the Claude sign-in) closes it before landing on its row.
Opening it focuses the current default's radio, as a select does. A choice
shows on the row at once through the existing optimistic `usePiModels`
overlay. A default whose model recently refused gets a red border and a
warning icon on the button, with a line under the row saying what to fix.

Code: `web/src/components/DefaultModelRow.tsx` (+ story), styles in
`Settings.css`, an `updown` icon, and `Account.tsx` uses the row in place of
the old inline block. No daemon, contract or session-state change.

Screens: `evidence/default-model-{desktop,phone}-{row,open}.png`.

## Checks

On Birch: `./scripts/test-focused.sh --area web` (774 passed); browser specs
`settings-model-picker` (5, including the new desktop and phone test of
opening, choosing, Escape, close button, outside click, focus return, sheet
placement and no horizontal overflow), `account-settings` (17),
`settings-three-pages` (10) and `lab-sidebar-default` (3) all pass. One
whole-suite run (`npm run test:browser --prefix web`) finished with 394
passed and 6 failed. Each of the 6 was a 30 s timeout under load (one with
"session closed"). All of them (account-settings administration,
site-ai-key, attachment-documents, the browser-conversation warm return and
both browser-editor-concurrent cases) pass when rerun alone, and none of
them asserts on this row. Another worker's browser run held the shared
4183 port during part of this work.

The old "no alert" assertion in `settings-model-picker` failed on untouched
main too, but only because `internal/daemon/pi-device-test` dependencies had
not been installed (the API-key list showed *Tunnuksia ei voitu tarkistaa*).
With them installed it passes, so it is not a product defect.

Self-review instead of `/llm-review`: no daemon, contract or session state
changed.

## Decisions for later review

- **Route on the button, without the site-key suffix.** The button names
  the route by provider (`Anthropic API`). The round 3 prototype also
  showed `· ylläpitäjän avain` for an administrator's key copy. That fact
  lives in `PiCredentials`' own read of `/api/v1/pi/credentials`, and
  passing it up to the row would add a second reader or lift that state
  into `Account`. It was left out to keep the change narrow. The API-key
  list just below already says *Ylläpitäjän antama*.
- **The broken-default line is generic.** It says the model (via its route)
  did not answer last time and asks to choose another default or fix the
  sign-in or key below. It does not split the cause into rejected or quota,
  because the browser has only the per-model refusal record. Round 2 marked
  that split as a proposal.
- **The selector stays mounted while closed.** Its confirmation ("Agentti
  vahvistaa valintaa…") and a refusal alert survive closing and reopening,
  but they are not shown on the row itself. A refusal that arrives after
  the chooser is closed shows on the row only as the reverted value.
- **Focus without a default.** When Pi has no default, opening the chooser
  focuses the panel itself (labelled *Oletusmalli*) rather than the first
  model, so no model looks preselected.
- **"Ei valittu"** is the button text when Pi has no default and
  *Ladataan…* while the catalog loads; the prototype did not show either
  state.
