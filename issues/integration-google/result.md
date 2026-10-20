# Landing completed — 2026-10-20

Run `01m5crxfjeqzj89hhxkt4wmdtn` cherry-picked preserved commits `4b268085`
and `f0e5bb63` onto main `aaa7aab6` as `64df42bc` and `57b2f79b`.
No runnable source was changed in this retry. Main's tmux 3.4 parsing fix
resolves the former five daemon terminal failures.

## Final evidence

All remote jobs captured clean revision `57b2f79ba66f29b3054680625d243d3332ca76ad`,
tree `d438b80c85fdf21c47f258dc1a8defa8b5ca0032`. Commands used
`umask 077` and `TMPDIR=/var/tmp`. Each job reached terminal **success**:

- `python3 scripts/browser-focused.py --task oh-go --task-arg=./internal/daemon --task-arg=./internal/daemon/integrations --task-arg=./test/browser-host`
  — `170688a5c00356cc7a37dd51079886196b119d6de89d5becedf8236971451508`.
  Vet and race tests passed for all three packages, including the previously
  failing terminal suite. The guest prepared the pinned Pi fixture itself.
  Evidence: `/var/tmp/oh-browser-vxwkq8lm`.
- `./scripts/test-focused.sh --area contracts`
  — `cdc94633cfe5a7ae65e2010b1de74fcb40074787062f7e095b36d3a3e19c02be`.
  Drift checks passed: 56 schemas, 56 fixtures, 37 scenarios, 17 negative checks.
  Evidence: `/var/tmp/oh-browser-0qc770ip`.
- `./scripts/test-focused.sh --area web`
  — `0b060c27b804aeccee99dc5029dccc47c740fe441b7ad4d7ca6d34580bc6c08a`.
  Static checks and 196 tests across 32 files passed.
  Evidence: `/var/tmp/oh-browser-tpa81oll`.
- `./scripts/test-focused.sh --area browser --spec integrations.spec.ts`
  — `516567c6d836d77e1de5cd73c11b5d6eb9d4b7d067887b82beee941e3b5fd1ab`.
  All five integration cases passed, including pasted-redirect/quota and
  desktop/phone axe checks. Evidence: `/var/tmp/oh-browser-bi4zar0x`.

These are synthetic Linux ARM64 checks, not live Google, native amd64 packaging
or distinct-UID isolation evidence. The full clean gate was not run under the
worker policy. Lab captures were deferred under Alder's remote-only capture
policy. Live consent, sync, agent usage, second account and removal remain the
conductor's post-deployment verification with Jari; no live pass is claimed.

## Review and failure inventory

The credential/sync surface warrants independent review. Retained the original
finder `claude-fable-5-1`, verifier `gpt-6-astra`, assessment and critical repair
verification from the preserved implementation. This retry changes no reviewed
runtime bytes; focused self-review of Google storage, OAuth, relay, fixture and
operator instructions found no further change needed. No new authority or
Unix-user boundary change was introduced. Earlier finder local-test claims
remain excluded; the remote jobs above supply fresh acceptance evidence.

No required check failed or remains blocked in this retry. A convenience script
parsing the process tool's bounded log text as JSON failed on a truncated line;
reading retained structured `*-logs.json` responses instead recovered the full
web and browser summaries. No test was rerun or result inferred from that parse
failure. Issue skill refresh succeeded; issue doctor reports only pre-existing
image advisories. Historical runner-quota failures and terminal failures are
superseded by the four fresh successful jobs, not hidden or treated as passes.
No issues were filed. No push, deployment, server access or Fleetrepo edit occurred.

## Exact operator handoff

1. Through Fleetrepo, install root-owned, non-user-writable **gog v0.39.1** and
   **rclone v1.71.2**, readable/executable by mapped users. Expose pinned gog
   to agents, for example via a trusted `/usr/local/bin/gog` symlink.
2. Merge these keys into `/opt/open-habitat/integrations.json`, preserving
   existing settings: `tools.gog` (absolute pinned gog executable path),
   `tools.rclone` (absolute pinned rclone executable path), `google.client_id`
   and `google.client_secret`. Use the Desktop client already held in Fleetrepo
   `infra/secrets/open-habitat-test-integrations.yaml` under `google`; do not
   put its values into product git or command arguments. Apply the existing
   integration config ownership/readability checks.
3. Enable Drive, Gmail, Calendar and People APIs. Use redirect `http://localhost`
   with no port; permit every tester/additional account on the consent screen.
   Testing-mode refresh tokens expire after seven days.
4. Deploy and restart the affected per-user daemons deliberately, accounting
   for interrupted active turns. In Settings → Integrations, exercise consent,
   initial sync, local upload/cloud download, gog mail/calendar/contacts,
   daemon restart, a second account and removal with Jari.

Ordinary My Drive files sync to `~/cloud/google-drive/<lowercase-email>/`.
Google-native documents/shortcuts stay online via gog; Shared Drives are not
selected. Removal removes native tokens, not Google's app grant; local files
remain unless Trash is selected. `docs/operations.md` carries the operator rules.

Final evidence-only checks: `git diff --check`,
`python3 scripts/validate-project-view.py` and `issuectl doctor --json` passed
(doctor retains pre-existing image advisories). Issue closure was explicitly
requested for this landing; the CLI's nonblocking all-criteria warning is retained:
the live-provider criterion stays unchecked rather than claiming an unauthorized
live test. This is a deployment verification handoff, not a failing synthetic check.
