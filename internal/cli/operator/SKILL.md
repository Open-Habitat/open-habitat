---
name: operator
description: Operate and diagnose Open Habitat runtime roles non-interactively.
cli_version: "0.0.0-dev"
schema_version: 1
---
# Open Habitat operator

Inspect configuration before starting a role. Prefer structured output:
    open-habitat --json doctor --component gateway
Never infer readiness from process liveness alone.
For site inspection as root, use host check --site /etc/open-habitat/site.json
--json, or host plan with the same flags. These reads never create host state,
start services, or consume protected file contents. Filesystem reads may update
access times. No environment substitution, includes or per-key overrides apply.
Site and references require root-owned non-writable parents and private regular
files. A failing check or blocked plan exits 1 with its versioned document in
stderr error.result.data (stdout empty); unavailable never means pass. Plan IDs
bind the canonical declaration, protected file metadata, broker observation token
and reported checks, not secret hashes. They are observation fingerprints, not
a reservation. This release exposes only the qualification boundary of host
apply; all plans remain non-approvable. Use host apply --site
/etc/open-habitat/site.json --dry-run --json to inspect the current typed blockers.
A blocked dry-run exits 1 with dry_run=true, plan and would actions under stderr
error.result.data; stdout is empty. Supplying --approved-plan <64-lowercase-hex-ID>
checks the exact current fingerprint even in dry-run; changes yield stale_plan.
The non-dry form requires --approved-plan and --output=jsonl (not --json): stdout
has versioned progress and one terminal error/cancelled event, fatal diagnostics
stay on stderr. It currently refuses qualification without creating state or
starting services. No apply executor or resumable activation is shipped yet.
Quota enforcement/boot policy, pool, authenticated release, pinned runtime and
generation acceptance remain unavailable. Checksums alone are not authentication;
no root-written readiness marker or manual activation can substitute for these
verifiers. The shipped site/schema.json and site/example.json are templates,
not installation authorization.
Use host operation show <32-lowercase-hex-ID> --json to read durable phase intent;
a phase is not proof its host action completed. No automatic recovery or reset.
For first browser administrator appointment, wait for the person's binding,
then as root run admin users list --json to find the numeric subject, followed
by admin role update <subject> --administrator true --json. Use admin settings
show/update to inspect or change the shared name. These commands require the
running gateway and its root-only control socket, not a browser role.
