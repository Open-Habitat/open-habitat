# Folder access in attachments and integrations

Implemented the selected Liitteet direction. The composer attachment opener now
shows individual-file and own-computer-folder choices. Folder guidance lives in
an anchored, dismissible panel; × and Escape return focus to Liitä without
changing the draft. Brave guidance is a conditional disclosure, not browser
detection. The same browser-local state and share/change/stop controls appear
in Integraatiot, even if the remote integration catalog cannot load.

The existing LocalFiles service, native handles, identity-scoped persistence,
permission checks, requested-file uploads and host contracts are unchanged.
There is no permanent folder banner. Picker-refusal/subfolder guidance and
retention of an earlier grant after a failed replacement remain intact.

## Evidence

Runnable implementation: `ce1eafd5` (the final checks use its runnable inputs).

- `./scripts/test-web-fast.sh`: passed, format/lint/typecheck and 482 tests after the editor rebase (481 before it).
- `npx playwright test --config playwright.lab.config.ts tests/lab-composer-area.spec.ts`
  from `web/`: 11 passed, including 1440/390 px × light/dark, keyboard open,
  Escape/× focus restoration, active-panel axe, viewport bounds, no draft-field
  overlap, retained draft,
  individual-file fallback and shared state across composer/Integraatiot.
- `npx playwright test tests/local-files.spec.ts tests/attachments.spec.ts tests/browser-conversation.spec.ts`
  from `web/`: 72 passed, including persisted grants, CSRF refusal, picker recovery,
  uploads and conversation/composer keyboard/layout regressions.
- `npm run storybook:test --prefix web`: passed. Production-component stories
  cover ready, shared, refused replacement, unavailable and the attachment opener.

Browser commands are routed through Fleetrepo to the disposable warm browser
runner, not run locally on Alder. Browser evidence is host-backed synthetic
state and a fake Pi controller, not real Brave/macOS picker or distinct-UID
isolation evidence. No Go or contracts changed, so their checks and independent
Unix-boundary review are not applicable. The full gate is left to the conductor.

Four paired AVIF/offline-HTML captures are under `evidence/`, 1440 and 390 px in
both themes with the conditional Brave disclosure expanded. Inspected all four;
the final panel leaves the draft visible and does not cross the viewport. These
are the synthetic lab, never live data. Final lab/capture log:
`/var/tmp/folder-above-field.log`; final regression and Storybook logs:
`/var/tmp/folder-above-field-browser.log`, `/var/tmp/folder-above-field-stories.log`.

## Review

One focused final-diff self-review is proportionate to this presentation-only
change: checked ownership of state/handles, retained permission/refusal behavior,
attachment upload entry, focus, constrained scrolling, theme tokens and
integration visibility independent of catalog loading. During review, moving
from attachment choices to help was made to focus the dialog explicitly because
the previously focused choice is removed. Browser checks prove that focus path.
Visual inspection then caught the popup covering the draft: its positioning
anchor was changed from the attachment button to the whole field, without changing the
focus-return owner. The final four captures and geometry checks confirm the
panel sits above the draft. No new dependencies, file reads or host authority
were introduced.

## Decisions for later review

- Integraatiot shows the folder as an always-visible browser-local card, separate
  from remote-provider accounts. It does not pretend to be a host integration.
- The two-choice attachment popup uses a labelled React Aria dialog with ordinary
  buttons (Tab/Enter), not arrow-key menu items. Folder help expands in that same
  anchored surface, keeping a single opener and focus-restoration owner.
- Native permission restoration retains its existing behavior: a stored handle
  without a current grant is not used; the person selects a folder again.

## Failure and incomplete-work inventory

- First fast check failed on formatting after a test assertion edit. Formatted
  the file; final fast checks pass. Logs: `/var/tmp/folder-web-fast.log`,
  `/var/tmp/folder-above-field-fast.log` on Alder.
- Initial lab matrix and diagnostic retries audited the entire page while React
  Aria made the app inert; axe reported the hidden page heading and outer
  dismiss sentinels rather than the active dialog. Scoped the audit to the
  active dialog, set its modal semantics, and reran all 11 lab cases successfully.
  Logs: `/var/tmp/folder-lab.log`, `/var/tmp/folder-panel-diagnosis.log`,
  `/var/tmp/folder-lab-final.log`, `/var/tmp/folder-lab-verified.log`.
- Discovery tried old/absent component, settings and package-source paths, and a
  direct runner SSH alias whose restricted command returned no output. Located
  the real sources and used the Fleetrepo runner's pinned nested SSH route for
  evidence retrieval. No dependency on those lookups remains.
- The first evidence retrieval returned no files because a later browser suite
  had already replaced the warm workspace's test-results. Evidence is retrieved
  immediately after the final lab run instead.
- Initial `issuectl ready` reported no acceptance checklist in the supplied issue.
  Added the verified checklist before delivery; readiness then passes.

- First merge stopped on the concurrent KOKEILTAVAA.md edits. Preserved the
  editor trial, kept main’s removal of already-decided prototype prompts, and
  added the folder trial. No implementation conflict occurred. Merge log:
  `/var/tmp/folder-merge.log`. Revalidated after rebasing over the editor worker: fast checks (482 tests),
  the 72 browser cases and all 11 lab cases. Final rebased logs are
  `/var/tmp/folder-rebased-fast.log`, `/var/tmp/folder-rebased-browser.log`,
  `/var/tmp/folder-rebased-lab.log`, `/var/tmp/folder-rebased-stories.log`. Refreshed paired evidence from that run.
