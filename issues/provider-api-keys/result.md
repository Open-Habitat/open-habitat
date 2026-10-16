# OpenAI API key as Pi's native credential

The mapped-user daemon writes, replaces and removes only the `openai` entry in
Pi's own `~/.pi/agent/auth.json`. The gateway authenticates Origin/CSRF and proxies
requests to the session's daemon; it never parses credentials or selects a user
from browser input. There is no host key store, broker or preference cache.

The pinned Pi is now **1.3.0**, not the architecture sketch's 0.85.1.
Its native `AuthStorage.modify/delete` provide the same locked entry updates.
The key is piped on stdin, never passed through argv or a new environment value.
The daemon and helper both require the literal `sk-` syntax with a bounded length;
Pi command/environment references are not accepted as browser input. Reads use
native `readStoredCredential` for the raw entry and `ReadOnlyAuthStorage.list`
for metadata without resolving SSH-configured references. Only
presence and a literal key's last four characters reach the browser (`sk-…abcd`).
Inputs are cleared before awaiting the write; neither drafts nor browser storage
receive keys. Native errors/stderr never reach responses or logs.

## Decisions for later review

- Jari's 2026-10-16 accepted architecture and suffix choice supersede the older
  presence-only proposal text in `architecture.md`.
- Credential reads and writes check ownership, regular files, symlinks, private
  auth mode and non-group/other-writable `.pi`/`agent` directories. Unsafe existing state is
  refused, not repaired. Native Pi may create 0755 directories under an SSH
  umask of 022; read/traverse bits do not disclose the 0600 credential file, so
  these use the same owned/nonwritable rule as device login instead of a new
  incompatible mode policy. The existing settings-path checks also protect writes
  to Pi defaults. New native files retain Pi's own 0600 mode and mapped owner.
- The provider switch defaults to ChatGPT (`openai-codex`) when Pi has no native
  default. Adding the first API key explicitly selects `openai`, as the accepted
  architecture requires; replacement preserves the native default. First add
  keeps the current model if the API provider has it, otherwise Pi's built-in
  provider default. Removal from an API-key default selects Pi's built-in
  subscription default when that OAuth entry exists; without it, the model stays
  and aggregate readiness returns to onboarding. There is no remembered prior
  host preference.
- Supported provider/model pairs propagate through settings and explicit new
  conversation launches, including per-child startup intent before native history
  exists. Existing conversations keep their native provider. Their details/chip
  use the native provider/model string; no key metadata enters conversation events.
- The existing readiness endpoint remains aggregate; the new credential reply
  carries per-provider presence. API-only accounts can pass first load and Pi
  onboarding offers the same working key entry without a subscription login.
- API-key suffixes are only derived for literal keys matching the accepted syntax.
  A native SSH-configured reference is shown as present without a fabricated
  suffix, and is never executed by the credential read helper.
- Per-model answer/refusal observations remain subscription-specific. API rows
  never inherit a refusal from an identically named ChatGPT model. Grouping is
  per provider, not across colliding model ids.
- Mutation failures are unknown outcomes. The browser clears the secret and
  offers a credential reread, never an automatic second POST or DELETE. Removal
  confirmation says the key is not revoked at OpenAI and existing key-based
  conversations need a replacement credential.

## Evidence

Disposable-home Go tests exercise the real pinned native credential helper:
reject command/environment syntax before any write; preserve the OAuth entry;
create 0600 files owned by the executing UID; refuse unsafe modes and symlinks;
read raw references without executing them; replace without changing defaults;
remove with subscription fallback; and pass/fail API-only readiness correctly.

The existing real-Pi RPC synthetic-provider test now stores the key through the
production daemon helper and requires that credential at a loopback fake OpenAI
provider. Pi answers and writes `openai/fake` into its native session history;
explicit model/thinking startup still leaves native global settings unchanged.
No real provider, credential or personal home is used, and request traces are
disabled for the browser credential journey.

Focused and final gate/review evidence is appended after final verification.

## Review and assessment

`/llm-review` (critical credential/billing surface) used finder
**claude-fable-5-1** and independent verifier **gpt-6-astra**, two calls.
`/assess-findings` classified three confirmed FIX rows; all were corrected:

1. Pi 1.3's `ReadOnlyAuthStorage.read` still expands environment references.
   Suffix reads now use native `readStoredCredential`; native list validation
   remains before mutations and after writes. Regressions cover `$VAR`, `${VAR}`
   and command references. This was a literal-display defect, not evidence of
   cross-user disclosure or a complete key leak.
2. Registry order is not Pi's native default. First-add/removal now consult
   `defaultModelPerProvider`; tests assert the exact default model ids.
3. An extra private-directory read-bit check rejected native 0755 state. It was
   removed while retaining the existing ownership, nonsymlink, nonwritable-parent
   and private-file rules. Disposable tests accept 0755 and still reject writable
   directories. No live-server prevalence claim is made.

Local follow-through also made provider toggles obey refusal/unavailable marks
and publish provider changes into explicit new-session intent. The review and
assessment are local scratch (`history/review-settings-credentials.md` and
`history/assessment-settings-credentials.{json,md}`); the durable conclusions
are above. No residual warranted another issue. Optional model-performance
logging was attempted but failed with SSH-to-self permission denied on alder;
no corpus write is claimed.

Eight paired AVIF/static HTML captures under `visual/` show the saved literal
suffix and confirmation dialog on desktop/phone, light/dark. No complete key
is in those artifacts.


## Final clean gate

`OH_PORT_BASE=29700 OH_BROWSER_WORKERS=2 OH_GATE_SERIAL_HEAVY=1
./scripts/ci-local.sh --clean --json` **passed**, without reused phases, on
commit `8387d29187c4b60610d473bbfddf8f496ac4a703`, tree
`12880fb81e02763569a857350e71c31721d901db`. The receipt is in the shared
git directory at `open-habitat-gate-receipts/12880fb81e02763569a857350e71c31721d901db.json`.
All 128 app tests, 118 component tests, 168 normal browser cases and 24 lab cases
passed; the two normal browser skips are the existing opt-in capture-only cases.
The gate also passed all Go packages/race checks, native SDK tests, 33 schemas,
generated drift, docs, Storybook and packaging/socket/reproducibility checks.
Total 320s: setup 7s, dependencies 11s, web checks 15s, browser 227s,
Go/contracts 51s and packaging 9s. Available memory was 8 GB before the run;
build scratch stayed on disk-backed `/var/tmp`.

The first clean attempt stopped on formatter output in the new identity test;
that fixture was normalized. The next full parallel attempt passed browser/lab
and the feature tests but failed the existing live-`/proc`
`TestKnownControllerChildInSameWorkspaceDoesNotBlockOtherSession` with an
uncertain observation under process churn (not a claimed timeout). It passed
ten isolated race-enabled repetitions. The final run used the documented serial
heavy-phase option and passed every unchanged check. No test was skipped or
weakened, and no partial run is called a pass.

The following closing/evidence commit changes documentation only. It does not
claim a clean-gate receipt for a different tree. The watcher release is
explicitly ungated under the disposable-test policy.

## Closing sequence

The bounded one-shot continuation
`/var/tmp/settings-finish-01m51fmtb8any0a0dqre9tf3wh.py` uses the exact full
Taskfleet run id for `/worktree-merge`, then fetches/rebases/pushes main without
force. It waits for unrelated main edits without stashing or touching them.
After the watcher and operator receipts agree on an exact descendant source,
tree, version, gate and artifact digests, it checks public/origin HTTP routes,
closes both issues and pushes their own result/metadata only. It also verifies
the resulting evidence-only deployment. Its log is
`/var/tmp/settings-finish-01m51fmtb8any0a0dqre9tf3wh.log`, with sanitized summaries
at `/var/tmp/settings-deployed.json` and `/var/tmp/settings-final-deployed.json`.
A post-stage or ambiguous release failure stops instead of being blindly retried.
The receipt validator and read-only public/origin probes were exercised against
the already verified pilot.131 before starting it. Signed-in and real-provider
checks remain for Jari; no household service is restarted.
