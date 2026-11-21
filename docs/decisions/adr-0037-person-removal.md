# ADR 0037: Removing a person

**Status:** Proposed. **Date:** 2026-11-21. **Decider:** Jari decided on
2026-11-21 that the product needs a real person removal instead of a quota
workaround; this record proposes what removal does and waits for his review
of the open questions at the end. It replaces ADR 0007, which deferred the
need without a design.

## Context

Today an administrator can only withdraw a person's access (Settings ›
Käyttäjät ja pääsy › Poista pääsy, `open-habitat admin access remove`). The
gateway records a deny and removes the person's sessions, the broker marks
the runtime entry `withdrawn` and stops `open-habitat-daemon@<name>`'s
service and sockets. Everything else stays: the Unix account and home, the
user manager with tmux, editor and Taskfleet units, lingering, SSH, the
quota and the broker binding. The Levytila view lists every binding with its
limit, so a withdrawn person's limit keeps counting in the sum of limits and
the space is never freed. An administrator who removes someone expects the
space back and the data gone.

What a person owns on the host:

- **In the home** (`/home/<name>`): workspaces and worktrees, Pi sessions,
  Claude and other agents' state, Taskfleet runs' records, integrations'
  tokens in each tool's own store, synced cloud folders under `~/cloud/`,
  frozen views and file offers under `~/.local/state/open-habitat/`, the
  search index, attachments, recaps, the trash, a seeded copy of the site AI
  key, the person's own Tailscale node state, `gh`'s token.
- **Outside the home, created by the broker:** the passwd and group entries
  (UID = GID from the broker's pool), `daemon-<name>.json` under
  `/etc/open-habitat-daemon/daemon/user-mappings/`, the socket directory
  `/run/open-habitat/users/<name>/`, the named `user:<uid>:--x` ACL entries on
  `/run/open-habitat` and `/run/open-habitat/users`, the enabled
  `open-habitat-daemon@<name>` and `open-habitat-agent@<name>` socket
  instances, logind's linger flag, the ext4 quota record for the UID, and the
  binding in the broker ledger (`bindings.json`).
- **Outside the home, created by the person's own processes:** the user
  manager and its units (`user@<uid>.service`, `/run/user/<uid>`), files in
  `/tmp`, `/var/tmp` and `/dev/shm`, a crontab or at job, a mail spool, the
  user journal files.
- **In the gateway:** sessions, the deny entry, view and offer addresses in
  `view-links.json`, the onboarding receipt, an administrator designation,
  the entry in the site AI key's copies record.
- **In the broker's admission file:** a runtime entry, a team member record,
  a `revoked` entry.
- **At outside providers:** grants behind the integrations' tokens (Google,
  Microsoft, Dropbox, IMAP app passwords, Gitea and GitLab tokens), the
  person's Tailscale node in their own tailnet, the Habitat OAuth app's
  authorization on their GitHub account.

## Decision

### 1. Three stages: removal scheduled, data removed, record kept

Removal is one administrator action that starts a fixed sequence.

1. **Scheduled** (immediate). The gateway records the deny and removes the
   person's sessions as on withdrawal, then, while the daemon still runs,
   asks it to disconnect the person's services (section 4). Then the broker
   withdraws and stops the daemon as today, and in addition closes the
   person out of the host: it expires the account
   (`usermod --expiredate 1`, which also refuses SSH key logins through PAM's
   account check), disables lingering, stops `user@<uid>.service` and
   terminates the user's remaining sessions and processes
   (`loginctl terminate-user`, then a kill of whatever is left in
   `user-<uid>.slice`). Nothing of the person runs or writes after this
   stage; the home is untouched. The binding gets a `removal` record with
   the due time, actor and stage.
2. **Data removed** (at the due time, or at once when the administrator
   chose immediate removal). The broker deletes everything listed above as
   the person's on the host and drops the binding (section 5).
3. **Record kept.** The gateway keeps a small removal record for the
   administrator (section 8). Nothing of the person's data is in it.

Between stages 1 and 2 the administrator may cancel. Cancelling ends the
schedule, unexpires the account and leaves access withdrawn; restoring access
is the existing, separate action. Integrations revoked in stage 1 stay
revoked and the person reconnects them; that is the honest cost of starting
removal, and the dialog says so.

Withdrawal ("Poista pääsy") stays as it is, as the reversible action that
keeps everything. Removal is a second, separate action ("Poista henkilö"),
offered on a withdrawn or admitted person.

### 2. What the administrator confirms

The dialog states what will happen in the person's terms and asks the
administrator to type the person's GitHub login:

- access ends now, and the person is signed out everywhere;
- connected services are disconnected now;
- on the due date the home is deleted for good, with its size (the usage
  the Levytila view already shows), and nothing can be recovered from the
  product afterwards;
- the person's shared links stop working now.

The administrator sees no workspace names, conversation titles, connected
accounts or file listings: what is in a home is the person's own, and the
current rule that showing administrator facts adds no home read on the
administrator's behalf stays. The broker refuses removing a person whom
root's `site.json` admits (`operator_owned`, as withdrawal does), the
gateway refuses an administrator removing themselves and removing a
`site.json` administrator, and the operator removes such a person from
`site.json` first.

### 3. Nothing is handed to the administrator

The product produces no archive or export of a home for the administrator.
A home holds the person's mail, synced cloud folders, provider credentials
and conversations with their agents; handing that to another person would
break the Unix-user boundary the product is built on. If the person needs
their data, the administrator cancels removal and restores access, and the
person takes it themselves (download, `git push`, the cloud services keep
their own copy). The operator's own backups of `/home` are outside the
product and are the operator's responsibility, which `docs/operations.md`
says.

A person-initiated "delete me" is not part of this decision; it would reuse
stages 1–3 with a different requester.

### 4. Provider grants: revoke what the person's own credential can

Before the account is closed, the gateway sends the person's daemon one
gateway-built request to disconnect everything. The daemon, as the person,
using only the person's own credentials:

- revokes integration tokens at providers that offer self-revocation with
  the token itself (Google's revoke endpoint, Dropbox `token/revoke`,
  GitLab's `personal_access_tokens/self`), then deletes the local entries
  the way each tool's own logout does;
- deletes the local entries where the provider has no such revocation
  (Microsoft public-client refresh tokens, IMAP and DAV app passwords,
  Gitea tokens), reported as `local_only`;
- logs the person's Tailscale node out of their own tailnet;
- leaves `gh`'s token alone: revoking the Habitat OAuth app's token needs the
  app's client secret, and the gateway must not receive a native credential.
  The token's only copy is deleted with the home.

It replies with counts per provider and outcome (`revoked`, `local_only`,
`failed`), never an account name. The gateway records the counts in the
removal record. A daemon that does not answer does not stop removal: the
record says `not_reached`, and the tokens are deleted with the home. The
person's own SSH keys on their machines are never touched (an existing rule).

### 5. Data removal by the broker, from committed state only

A new broker operation removes a binding whose `removal` record is due. It
acts only on the binding's committed UID and name, never on a name, path or
UID from the request, and refuses when any admission source admits the
subject. Each step observes before acting and is skipped when already done,
so the operation is repeated rather than resumed from a journal:

1. Recheck that the account is expired and nothing runs as the UID; stop and
   kill again if something does.
2. Remove the person's files outside the home: crontab and at jobs, mail
   spool, files owned by the UID on `/tmp`, `/var/tmp` and `/dev/shm`
   (`-xdev` walks that never follow symlinks), the user journal files.
3. Delete the home safely: open `/home` and the home by descriptor with
   `O_NOFOLLOW`, check the home is a directory owned by the committed UID
   and GID, rename it inside `/home` to a broker-reserved name
   (`.open-habitat-removing-<uid>`), and remove it with descriptor-relative
   `unlinkat` without crossing mounts. A later run finds the reserved name
   and continues it. No process of the UID exists, so nothing races the
   walk from inside.
4. Prove the space is free: under user quotas, the kernel's usage for the
   UID on the home filesystem must read zero blocks and zero inodes. A
   nonzero reading leaves the removal pending (`files_remain`) for the
   operator to inspect. Then the quota record is cleared.
5. Remove the broker's own artifacts: disable the socket instances, remove
   the socket directory, the named ACL entries and `daemon-<name>.json`,
   then `userdel` (without `-r`) and `groupdel`.
6. Drop the binding from the ledger (generation + 1) and the subject's
   runtime entry, member record and `revoked` entry from the admission file.

The UID returns to the pool only with step 6. The allocator's existing
availability check (no NSS entry, no paths, no unit instances) gains one
condition under user quotas: zero kernel usage for the candidate UID. That
replaces the permanent retired-UID record that ADR 0007 rejected.

Who runs a due removal: the broker itself, at start and on an hourly check,
because the due time is in its own ledger and only root may act on it. The
administrator's request scheduled it durably; reaching the due time needs no
second request. Immediate removal is the same operation with the due time
set to now.

### 6. Partial failure and idempotency

Every request in the sequence is safe to repeat. A failed or interrupted
stage leaves the binding in place with its `removal` record and the last
stage reached; the broker logs `broker_removal` with the stage and a fixed
reason, retries each hour and at start, and the access list shows the
person as "Poisto kesken" with the reason. While a binding carries a
`removal` record, `ensure` and `authorize` refuse the subject
(`removal_pending`), restoring access refuses until the administrator has
cancelled, and quota changes are refused. An uncertain gateway–broker reply
is reported as `outcome_uncertain`, as today, and repeating the action
continues from what the broker observes.

### 7. Disk space and the Levytila view

From stage 1 the person's row shows "Poistetaan pp.kk." and the sum of
limits counts the person's current usage instead of their limit: nothing of
theirs runs, so usage cannot grow. After stage 2 the binding is gone, so the
row disappears and the usage is free. This is what fixes the original report.

### 8. Audit

The broker journal logs every stage (`broker_removal`, with subject, stage,
outcome and fixed reason). The gateway keeps one removal record per removed
subject in its administration state: GitHub id, login hint, actor, scheduled,
cancelled and completed times, the final outcome and the provider counts of
section 4. It is shown on the access list as a "Poistettu" row and in
`admin access list --state removed`. It holds no username, path or content.

### 9. What the person sees

A person with an open session is signed out at stage 1, exactly as on
withdrawal, and every later sign-in is refused with the existing no-access
page. The product sends the person no notice; telling them, and offering a
chance to take their data, is the administrator's (the dialog reminds them).

### 10. Coming back is a new account

When the same GitHub id is admitted again after stage 2, the next sign-in
creates a new binding, account and empty home, possibly with the same name
and a reused UID; nothing of the removed person returns. The gateway removes
the subject's view addresses, onboarding receipt, designation, site-key copy
entry and deny entry at stage 2, so the new account starts with a new
onboarding and gets the site AI key seeded again. Admitting the id during
the grace period is refused until the removal is cancelled, so an
administrator cannot resurrect a half-removed account by accident.

## Authority changes

These are the architecture changes Jari is asked to accept.

- **The broker gains account deletion.** It now deletes a home, removes an
  account and drops a binding. The bounds: only a committed binding with a
  durable `removal` record, only a subject no source admits, only through
  the gateway's administrator request or root's control socket, and never a
  path or UID from a request. Its existing rule that it never adopts an
  account stays; removal is the only way an account leaves its ledger.
- **The broker stops the person's own user manager and kills their
  processes** at stage 1. Withdrawal deliberately keeps them; removal is the
  one case where the person's native work must end.
- **The broker acts on a due time by itself.** It already retries stops at
  start; this adds a timed deletion it was asked for earlier.
- **The daemon gains a disconnect-everything operation** reachable only from
  a gateway-built request, never the agent listener.

## Rejected alternatives

- **Leaving people without access out of the sum of limits** (option 2 of the
  report): the space stays used and the data lives on with no owner who can
  reach it.
- **Archiving the home to the administrator:** section 3.
- **The gateway revoking the GitHub OAuth grant:** it would need the token
  from the person's home.
- **Never reusing a UID (a retired-UID ledger):** a second permanent record
  of removed people; the kernel's zero-usage reading proves what matters.
- **A separate host-wide deletion journal:** the binding with its `removal`
  record already is the durable intent, and every step is observable.

## Open questions for Jari

1. **Grace period length.** Recommendation: a fixed 14 days, with "Poista
   heti" as a second explicit choice in the same dialog for when space is
   needed now. Alternatives: no grace period (one irreversible click), or an
   administrator-chosen length (one more setting nobody tunes).
2. **Data handed to the administrator.** Recommendation: none, ever
   (section 3). The alternative, an archive of the home for the
   administrator, would hand over the person's mail, cloud content and
   credentials.
3. **Revoking at the providers at stage 1.** Recommendation: yes, so a
   cancelled removal costs the person reconnecting their services.
   Alternative: revoke only at stage 2, which keeps cancel cheap but needs
   the daemon to run for a closed-out account at the due time.
4. **How long the removal record stays.** Recommendation: until the
   administrator clears it from the access list. Alternative: a fixed
   retention such as one year.
