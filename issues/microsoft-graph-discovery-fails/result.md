# Discovery diagnostics; historical cause still open

## What is established

Read the predecessor's item, result and redacted live journal evidence. A new
read-only journal query through Fleetrepo's pinned `release_test.ssh` helper
recovered the same two `graph_discovery / tool_failed` events at 12:24:45Z and
12:25:29Z on 2026-10-22. It supplies no additional native/provider response.
No VM or Fleetrepo file was changed; no live sign-in or token read was attempted.

**Graph discovery does not invoke rclone or ms-365-mcp-server.** It sends
Graph HTTP requests directly from the mapped-user daemon. rclone configuration
is assembled only after discovery; the second Outlook device code comes later.
The remaining candidates are the OneDrive request, SharePoint scope admission,
followed sites, each site's libraries, or bounded response/metadata validation.
The evidence cannot choose among them. A 403 alone would not establish that
administrator consent is the cause, so no speculative Finnish account-side
explanation or permission workaround was added.

A verified diagnostic bug was reproduced: the HTTP helper decoded the response
into its success shape before retaining status. HTML, malformed or oversized
Graph failures therefore collapsed to `tool_failed`, losing even HTTP status.
Graph error JSON was also discarded. Status is now retained before decoding;
404 remains recognizable through wrapping, preserving mail-only account support.

## What the next attempt reveals

After the conductor ships this change, Jari should start Microsoft sign-in once
and approve the first device code. If discovery fails again, its existing
`integration_login` event now includes:

- `step`: `onedrive`, `followed_sites`, `site_drives`, or a specific local
  rejection (`sharepoint_scope`, `followed_sites_limit`, `site_drives_limit`,
  `site_url`, `remote_limit`, `onedrive_metadata`, `site_drive_metadata`,
  `config_limit`). No URL, site/drive ID or account address is recorded.
- `tool=direct_http`, `exit_status=not_applicable`: no subprocess ran here.
- `http_status`: the failing request's response status, including a malformed
  200; zero means local validation or no HTTP response, not HTTP success.
- `graph_code`, `graph_message`: exact allowlisted non-identifying values;
  arbitrary text/unknown codes are `redacted`, absent/not relevant is
  `not_applicable`. Request IDs and inner errors never enter the journal.
- `tenant_kind`: `personal` or `business` when driveType established it,
  otherwise `unknown`. This is not an inferred tenant ID or a claim that the
  initial `common` audience identifies the person's account kind.

For example the synthetic licence-error regression produces
`step=onedrive tool=direct_http exit_status=not_applicable http_status=400
 graph_code=BadRequest graph_message="Tenant does not have a SPO license."
 tenant_kind=unknown` (beside the existing phase/reason/provider fields).
This example is **not** the observed live response.

The next event distinguishes provider denial, malformed response, transport
failure, missing scope, pagination/size caps and unsafe remote metadata.
An unknown response stays redacted; this intentionally cannot promise recovery
of arbitrary provider prose. Account-side action and live acceptance remain
unverified. The second acceptance criterion stays unchecked and issue open.

## Presentation

No production UI, new browser state, contracts, authority or native token store
changed. Context cancellation/expiry now retains its existing fixed failure code
instead of being mislabeled as a generic transport failure. The production dialog still shows the generic Finnish failure rather
than inventing a tenant diagnosis. Added Storybook state
`DialogMicrosoftUnclassifiedFailure` using the production component.

`evidence/failure-{1280,390}-{light,dark}.{avif,html}` contains four paired,
synthetic lab captures of that unchanged dialog. The capture script is
`web/lab/microsoft-graph-discovery.mjs`; its temporary Playwright registration
was removed after capture (it added no behavior regression beyond Go's
request-to-relay checks). The capture uses an intercepted fixed failure code,
not real Graph data, and runs axe at all four sizes/themes with reduced motion.
This is presentation evidence, not live-provider acceptance or UID isolation.

Compared against the dialog idiom in
`design-system/drafts/Navigaatio ja asetukset.dc.html` and existing production
component: centered bounded surface, icon/title, inline alert, explicit close
and retry, token colors, and readable wrapping at 390 px. No design or token
change was needed; screenshots are human review material, not pixel tests.

## Validation

Runnable source and capture evidence: commit `4cdf4b22`. All build/test scratch
used `/var/tmp`; commands ran with restrictive umask.
No push, deployment, full clean gate, or real-provider acceptance was performed.

- `npm ci --prefix web` and Pi SDK fixture install: passed.
- `go test -race -count=1 ./internal/daemon/integrations`: passed, including
  final request-to-relay diagnostics tests. Cases cover 400 licence, 403
  permission, 429 library throttling, unknown/private codes and messages, HTML,
  oversize, malformed success, pagination, invalid metadata, transport and
  missing scope. Existing personal, mail-only, both-code and sync tests remain.
- `go test -race -count=1 ./internal/daemon`: passed (152.430 s package time).
- Negative control: overlaying the old HTTP helper fails the new licence-error
  diagnostic regression: HTTP status, Graph code and message are missing.
  This is expected defect evidence, not an incomplete deliverable.
- `./scripts/test-focused.sh --area web`: passed static/format checks and
  500 tests in 89 files after formatting the capture script.
- `./scripts/test-focused.sh --area contracts`: passed generated drift and
  validation (63 schemas, 68 fixture files, 40 scenarios, 17 negative checks).
- `./scripts/test-focused.sh --area browser --spec integrations.spec.ts`:
  six journeys passed, including desktop/phone axe; final post-review rerun
  also passed all six (16.3 s).
- Four-view synthetic capture: passed, including axe in all four combinations.
  Its temporary lab spec invoked the committed capture script; pinned warm
  execution ran it on Cedar and the synthetic files were retrieved through
  the same authenticated runner route.

Transient logs, negative-control overlay and review output:
`/var/tmp/oh-graph/` on Alder. The partial-delivery decision is the task brief's
explicit authorization, not a claim that the original sign-in failure is fixed.

## Tool/sub-workflow failure inventory

- Capture attempt: axe initially ran during a theme color transition and
  reported intermediate button contrast (capture.log). The capture now requests
  reduced motion, then passed all four audits and snapshots. No production
  style was changed to hide a real contrast defect.
- Final web attempt: formatting check rejected the newly added capture script
  before later web checks ran (web-final.log). Biome formatted it and the final
  focused web run was restarted; the failed run is not passing evidence.
- Read-only discovery: a guessed refreshed skill path was absent; the install
  JSON supplied `.pi/agent/skills/issue/SKILL.md`, which was read. Two guessed
  execution-runner directories were absent; the actual command dispatcher
  resolved its installed module location. No tool was installed or changed.
  These failed lookups did not leave an acceptance step incomplete.

- Reviewer exploratory checks: the reviewer ran package tests with a different
  scratch/umask setup and saw unsafe-home and interrupted-renewal failures,
  reproduced on main as well. Those exploratory runs are not passing delivery
  evidence; our restrictive-umask package/caller race runs supply that evidence.

## Targeted review and assessment

One bounded reviewer, `claude-fable-5-1`, one complete call. No correctness or
secret-disclosure defect found in the new logging. Its three actionable notes
were checked locally:

1. **CONFIRMED / FIX:** a deadline/cancelled Graph request was flattened into
   `ServerUnreachable`, making its reason indistinguishable from a transport
   outage. The HTTP helper now preserves `ctx.Err()` (also on interrupted body
   reads); synthetic discovery tests prove cancellation and expiry retain
   `cancelled`/`expired`. This is a verified classification bug, not evidence
   that Jari's historical attempt expired.
2. **DROP (outside this delivery):** Graph identity failures do not get the new
   discovery-only attributes. True, but historical evidence is exclusively
   discovery; broadening other phases is not needed to diagnose this report.
3. **FIX (coverage):** extended the existing mail-only test to HTML/non-JSON 404
   as well as Graph JSON 404. The wrapped HTTP status still permits Outlook.

No speculative issue was filed. Raw review: `/var/tmp/oh-graph/review.txt`.

- Post-review regression attempt: the synthetic HTTP transport ignored an
  already-expired request context, unlike the native HTTP transport, so the
  new deadline case incorrectly completed (go-reviewed-final.log). The fixture
  now honors request cancellation; only the affected package needs rerunning,
  since production bytes were unchanged by this fixture repair.
- Staged diff check found trailing whitespace in the browser's serialized CSS
  snapshots. Trailing line whitespace was stripped from the four inert HTML
  files without changing rendered content, then the check was rerun.

Final integration package rerun after the deadline-fixture correction passed
(`integrations-deadline-final.log`). All four capture images were visually
inspected; paired HTML differs only by trailing-whitespace normalization from
the browser serializer. `python3 scripts/validate-project-view.py`,
`issuectl doctor --json` and `git diff --check` passed; doctor retains existing
unrelated image advisories. No required implementation check is waived by the
explicitly allowed unresolved live cause.

The post-review combined Go command exited nonzero for the deadline-fixture
failure described above; **its daemon package passed** (146.607 s), exercising
the final production bytes. The corrected integration package subsequently
passed separately (12.727 s). Neither result is presented as a passing combined
command. Final browser rerun passed all six journeys (16.3 s). No required check
remains incomplete; the explicitly allowed live retry remains outstanding.
