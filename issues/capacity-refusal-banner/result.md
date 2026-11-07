# Result

The refusal uses the shared inline danger WarningBanner, including its mark,
body and actions. The holder window, per-holder stops, retry, administrator link
and non-administrator explanation remain. Room after a stop uses the same
component in success tone. WarningBanner now permits block content without
nesting paragraphs inside a paragraph.

The refusal follows the start page inside the conversation scroll. Its initial
appearance and asynchronous capacity read reveal its bottom; scrolling back
still reaches the start page. The stream supplies the same column gutters as
the composer. No shared warning gutter change was needed.

## Why the controls were missing

The host refused creation before issuing a native conversation ID. App therefore
kept BrowserConversation in its creation view, whose header supplied neither
archive/close nor the normal workspace tools. The refused view now offers Close,
the workspace editor and terminal, disabled retitling, and the existing details
control. Controls dependent on an existing conversation remain conditional.
Close returns to the workspace without inventing an archive entry or calling a
host mutation. It does not discard the draft.

## Decisions for later review

- **Close, not Archive, for this refusal.** There is no conversation/history on
  the host to archive. Reusing the empty-conversation Close action is truthful
  and lets the person leave. Alternatives were a misleading archive operation
  or a new dismiss button inside the warning. Existing native conversations
  retain their ordinary archive behavior.
- **Keep the holder window and all three existing actions.** The brief asks to
  retain these interactions; converting it into a permanently expanded list or
  removing actions would change the agreed capacity-management flow.
- **Keep draft storage when closing the refused view.** Close is navigation, not
  deletion of the person's unsent text. Discarding it would introduce a new
  destructive behavior and require a separate choice.

## Verification

Based on c33a0e0da plus this issue's committed diff. Focused self-review of the
final diff: no daemon, contract, session/identity state, or authority change.
Checked native-vs-local close semantics, refusal/retry/room rendering, modal
lifetime, column gutters and other WarningBanner consumers.

All commands ran locally on Birch, with private /var/tmp scratch, umask 077,
OH_BROWSER_WORKERS=2 and OH_PORT_BASE=18300 for browser checks:

- Before implementation, the extended live-conversation-limit.spec.ts failed on
  both real capacity refusals (installation/person limit 1, one working turn):
  the existing card was not a danger banner.
- `./scripts/test-focused.sh --area web`: pass, 187 files / 1400 tests,
  catalog checks, lint and TypeScript.
- `./scripts/test-focused.sh --area browser --spec live-conversation-limit.spec.ts`:
  2 pass; includes exact column edges, Close availability, holder stop, room,
  retry and administrator/non-administrator behavior.
- `./scripts/test-focused.sh --area browser --lab --spec lab-capacity-refusal.spec.ts`:
  4 pass; 1440/390 × light/dark, limit 1 with a held turn, no overlap,
  both edges within 1 CSS px of the composer, start page scrollable, header
  controls and actual Close navigation; axe checks pass in all four views.
- `./scripts/test-focused.sh --area browser --spec github-connection-warning.spec.ts`:
  6 pass, including its independent composer-alignment checks.
- `./scripts/test-focused.sh --area browser --spec ai-sign-in-window.spec.ts`:
  2 pass for the other shared warning use path.
- `npm run storybook:test --prefix web`: pass; new CapacityRefusal stories cover
  installation limit 1, personal refusal after retry, and room after stop.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
  `git diff --check`: pass. Doctor lists PNG-format advisories, including the
  requested paired captures, but no parse/schema/transition failures.

The four screenshot/HTML pairs in evidence/ were regenerated with
OH_VISUAL_CAPTURE=1 at device scale factor 2 and inspected. They are synthetic
lab evidence using the real gateway/controller with fake Pi, not live-provider,
separate-UID or deployment evidence. No full browser suite or clean gate run;
the conductor owns integrated-main testing and deployment.

## Development failures resolved

The first layout test selected an obsolete composer class and timed out; it now
measures the actual .ah-cbox. Early header tests confused the model/details chip
with the always-present details button and expected a conversation-specific
file shelf before a conversation existed; they now test the available editor
and open the details popover. A proposed shared-gutter removal broke three
GitHub warning alignment cases; it was reverted and all six cases passed.
Repeated --spec arguments selected only the last spec; the affected specs were
rerun individually, and the new lab spec uses --lab. Initial exploratory reads
of guessed file paths failed; scoped discovery located the actual files.
All these failures were safe local development attempts, not deployment steps.
