---
created: 2026-10-20
updated: 2026-10-25
type: feature
reporter: jari
status: done
priority: high
lane: attachments
lane_seq: 1
collision: [attachments]
closed: 2026-10-20
---

# Attach files and screenshots to a message (drag and drop, paste, picker)

_Source: chat:ville-requests-2026-10-20_

## Description

Ville (2026-10-20): 'Miten tähän saa screenshotteja?' Jari: screenshots and files must be drag-and-droppable into the conversation, and the agent must accept attachments. Jari uses CleanShot (copy to clipboard / drag the thumbnail), Ville keeps screenshots in Downloads/Documents.
Deliver: drop onto the conversation or composer, paste from clipboard (images), and an attach button with a file picker, also on phone (camera/photos via the picker). Files are uploaded through the gateway to the person's own daemon and stored as the person outside repositories (e.g. ~/attachments/<conversation-or-date>/, decide and justify; never inside a git working tree unless the person asks), with size limits and quota respected. The message carries the attachment: images go to Pi as native image input where the model supports it, other files as paths the agent can read; the bubble shows thumbnails/chips. No new store of truth: the files on disk are the record. Contract changes in contracts/v1. Security: uploads are per-user, content-type sniffed, no path traversal, no serving back without auth. Done: browser tests for drop, paste, picker; Pi receives an image and answers about it in the synthetic lab where available; host context tells the agent where attachments live.

## Acceptance Criteria

- [x] A conversation-independent authenticated upload endpoint stores files as the mapped person outside repositories and returns their disk path.
- [x] Uploads and authenticated downloads enforce generated IDs, confinement, sniffed content types, per-file limits and quota; active content downloads rather than executes.
- [x] Composer picker, image paste and conversation drop use that endpoint; message bubbles retain attachment chips/thumbnails from native message references.
- [x] Native Pi prompts receive supported image content and readable file paths, including held messages; oversized native image echoes preserve the RPC transport.
- [x] Final host-backed browser interaction and accessibility checks pass.
- [x] An independent critical review is assessed and its confirmed defects are repaired.

## Result

Chose a flat `~/attachments/<generated UUID>` directory: files remain independent
of conversations and workspace lifetimes, and the browser cannot choose a server
directory or overwrite a name. The filesystem is the record; original display
names and attachment references travel in ordinary native Pi message text, not a
host metadata database. `POST /api/v1/attachments` accepts raw file bytes and returns
`id`, `path`, sniffed `content_type` and `size`; a future browser-granted local
folder can use it unchanged. No local-files-access functionality was implemented.

Limits are 20 MiB per upload, eight distinct attachments totaling 20 MiB per
native prompt, a 1 GiB attachment-directory budget (including regular files moved
into subfolders), and any tighter native filesystem quota. Files are created
0600. Image serving is authenticated and limited to sniffed PNG/JPEG/GIF/WebP;
other content is forced to download with `nosniff`. GETs are not blocked by slow
uploads. Native Markdown image prefixes are never treated as `!` shell commands.

Final focused checks passed on the worker's runnable inputs:

- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web` — format, lint,
  TypeScript, client unit and production-component checks.
- With `umask 077` and `TMPDIR=/var/tmp`,
  `./scripts/test-focused.sh --area go --go-package ./internal/daemon`,
  the same command for `./internal/gateway`, and `go test ./test/browser-host`.
  These include per-home denial, symlink/active-content/size/quota boundaries,
  slow-upload/read concurrency, native image and tool-result echoes, oversized
  aggregate framing continuity, and gateway authentication/CSRF/body forwarding.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area contracts` — generated drift,
  56 schemas, 56 fixture files, 37 scenarios and 17 negative checks.
- Final remote `attachments.spec.ts` job passed (one Chromium journey, 16.5 s):
  `db1c206f22c2e29cfb0735b3d6718584c03db86de97cf56aa3f309e71ccd8576`,
  captured input SHA-256
  `a9684426a2cb4b1af5d3467c7b93b3346f0534f7dbd9a2ca7cae9aa9da0d8e6b`.
  It covers picker, pasted image, conversation drop, authenticated image bytes,
  CSRF refusal, original download filename, Axe accessibility, send and thumbnails
  surviving reload. The capture was marked stale because this result was added
  while it ran: comparison against all 2,514 manifest entries found only this
  issue file changed; all captured runnable input hashes still match. Local
  receipt/artifacts: `/var/tmp/oh-browser-laiofx8m/`.

Review was critical because this adds authenticated external file input at the
Unix-user boundary. Claude Fable 5.1 supplied seven candidates; local source and
regression checks confirmed their triggers, and all were repaired. GPT-6 Astra
then inspected the final source and pinned Pi event serializers, refuted those
candidates against the fixes and found no remaining boundary defect. The
assessment and raw reports are local scratch under `history/`; the repairs and
tests are the durable record. Model agreement is not claimed as runtime proof.

Failure inventory: initial formatter/linter failures were repaired, including a
pre-existing malformed capture-script format. An initial runner create used
`--untracked` for already staged inputs and was definitively refused; corrected
capture calls omit those flags. Two superseded queued captures were explicitly
cancelled rather than counted as evidence. The first executed attachment browser
case caught a test fixture using the OS account home instead of its invented
home; the fixture now explicitly supplies its synthetic home. Exploratory file
lookups with guessed paths were corrected. The finder reported a diagnostic shell
terminated by its own `pkill`; the overall review completed, no unexpected project
changes were observed, and the final verifier ran source-only.

Limits of evidence: all test data is synthetic. No real provider image answer,
separate-kernel-UID installation isolation or live-server behavior is claimed.
Alder's focused pilot prohibits manual lab/capture runs and the full gate, so
before/after screenshot+HTML captures and a lab image-answer journey were deferred
without bypassing that policy. No clean-gate receipt was produced. Review corpus
logging was disabled because this run forbids Fleetrepo edits and pushes. No test
server, Fleetrepo installation or persistent application binary was changed.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
