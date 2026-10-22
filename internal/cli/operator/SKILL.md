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
approval or a reservation: this release has no host apply, and all plans are
non-approvable. Quota enforcement, pool, signed release and generation acceptance
remain explicit unavailable checks. Do not bypass them with manual activation.
Use host operation show <32-lowercase-hex-ID> --json to read durable phase intent;
a phase is not proof its host action completed. No automatic recovery or reset.
For first browser administrator appointment, wait for the person's binding,
then as root run admin users list --json to find the numeric subject, followed
by admin role update <subject> --administrator true --json. Use admin settings
show/update to inspect or change the shared name. These commands require the
running gateway and its root-only control socket, not a browser role.
