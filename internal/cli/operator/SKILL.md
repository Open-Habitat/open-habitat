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
Storage checks require a separate writable ext4 /home with no nested mounts,
matching the declared UUID at both the device and superblock. Journaled quota
qualification requires the ext4 quota feature, a journal and internal user quota
inode; external aquota files are not qualified. Missing features require
customer-performed offline maintenance; never format, move homes or convert a
mounted filesystem. The read-only enforcement check queries kernel accounting
AND enforcement flags on the pinned mount; it never writes a quota or runs a
probe. It is not a disposable-UID EDQUOT test or a boot acceptance certificate.
Boot policy, pool, authenticated release, pinned runtime and generation
acceptance remain unavailable. Use host prepare --site
/etc/open-habitat/site.json --dry-run --json for the executable maintenance plan.
A supported storage/platform/policy baseline returns a planned result with
policy_files and would actions. A blocked baseline exits 1 with typed checks in
stderr error.result.data. No lock, probe or file creation occurs in dry-run.
Preparation IDs use host.prepare.v2, separate from host plan's apply IDs. An
optional --approved-plan is checked even in dry-run. The non-dry form requires
--approved-plan <prepare-ID>, --approve-disruption and --output=jsonl (not --json).
Approval is revalidated under the shared host lock before operation intent,
quota writes or policy installation. The bounded disposable-UID probe requires
actual EDQUOT and verified cleanup; incomplete operations remain fenced for
inspection, never automatic replay. Services are NOT reloaded/restarted/enabled.
Preparation also establishes the fixed empty open-habitat-proc exemption group
before installing any policy that names it. This is explicit approved maintenance,
not broker-user provisioning; direct/primary membership and GID aliases refuse. Ubuntu's
conditional boot sysusers unit is not relied on to create a newly declared group.
Quota, runtime-directory ACL, proc and narrow session drop-in policy files are
installed without activation, including the read-only storage boot guard required by the
broker and both listener templates. A missing policy, wrong/missing dedicated
home UUID or unenforced quota refuses activation. Preparation does not reload
systemd, enable services or restart sessions. Named per-user binding/ACL gates
and effective proc/logind/polkit restart acceptance remain separate requirements;
storage ordering alone is not an operational installation.
A successful preparation is not host readiness or authorization for apply.
Obtain a fresh dry-run plan before rerunning: unchanged verified policy/evidence
on the same mount and boot yields no_change without another probe or file write.
Customer offline feature work is reported separately and never performed.
Checksums alone are not authentication;
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
