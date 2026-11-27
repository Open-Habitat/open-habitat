# Result: guest mailbox probe

## What changed

- **The probe** (`internal/daemon/integrations/microsoft_linux.go`): after a
  Microsoft sign-in whose grant reaches both mail and files, the daemon asks
  Graph once for `/me/mailFolders/inbox?$select=id` with the sign-in's own
  access token, bounded to 15 s. A 200 with an id is *present*. A 404 with
  `MailboxNotEnabledForRESTAPI`, `MailboxNotFound`, `ErrorNonExistentMailbox`
  or `ResourceNotFound`, or a 401 with `OrganizationFromTenantGuidNotFound`
  (a tenant without Exchange Online) is *absent*. Every other answer
  (outage, timeout, throttling, 403, another 404, a body without a code)
  is *undecided* and never fails the sign-in. The outcome is journaled as
  `transition: mailbox_probe` with `mailbox`, `http_status` and an
  allowlisted `graph_code`, nothing of the person's.
- **The record is the registration.** *Absent* registers the files area
  alone (`ms-files` / `msN-files`) in Pi's `mcp.json`. *Present* registers
  all five. *Undecided* keeps what the connection already had, and a new
  connection gets five. No new store: `microsoftServer.filesOnly()` reads
  the entries, `microsoftNative.mcpFilesOnly` carries it, and Align and the
  reshape check keep a files-only registration as it is instead of
  rewriting it to five. The prefix is still chosen with all five names
  free, so a connection that later gets a mailbox gets its other areas
  under the same prefix.
- **Services, level, skill.** For a files-only connection, `CheckGrant`
  drops mail, calendar and contacts and keeps the files row even before
  the grant is read. `Level` is the signing-in application's level while
  the files' access matches it, because files alone cannot tell drafts
  from read. The skill describes one files area, says the account has no
  mailbox in this organisation, and lists `Kinds: ["files"]`.
- **Browser.** No contract or UI change. The files-only card and the
  completion notice from step 3 already showed for a Microsoft connection
  without mail, calendar and contacts. The real daemon now reports exactly
  that for a files-only connection; before this, its services always
  listed all three. The browser stand-in (`test/browser-host`) now records
  the probe at sign-in the same way and its `Check` follows the record.
  A new `/fixture/integrations?action=mailbox&tenant=` gives the tenant a
  mailbox.

## Tests

- Go `microsoft_mailbox_linux_test.go`: mailbox present (five areas, mail
  services, full skill). No mailbox, for three Graph answers: files area
  alone, services `onedrive` only (also when the grant is refused), level,
  files skill, not misaligned, Align keeps it, binding runs. Undecided, for
  seven answers including a timeout: a new connection gets five, a guest's
  renewal stays files-only. A grant without mail does not ask. A connection
  that later gains a mailbox gets five areas at its next sign-in under the
  same prefix, and goes back to files alone if a later sign-in finds no
  mailbox. A second connection does not take a files-only connection's
  prefix. The journal line is checked too.
- Playwright `microsoft-organisations.spec.ts`: the guest card stays
  files-only after the tenant gains a mailbox, until a renewal that finds
  it; then the card shows mail and loses the files-only lines.
- Run: `scripts/test-focused.sh --area go` for `./internal/daemon/integrations`,
  `./internal/daemon`, `./internal/provision`; `go test ./test/browser-host`;
  `scripts/test-focused.sh --area browser --spec microsoft-organisations.spec.ts`.
  All pass. Focused checks only: no contract change and nothing crosses the
  daemon–gateway boundary, so the full gate was not run. Review was a
  focused self-review, since the change stays inside the daemon's Microsoft
  adapter.

## What only a real guest account shows

Design section 7, item 5: what Graph actually answers for a B2B guest's
inbox. The no-mailbox codes come from Graph's documented and commonly
reported answers, not from a real tenant. If a real guest gets another
code, the probe returns *undecided* and the connection keeps five areas,
which is how it behaved before. The journal's `mailbox_probe` line (status
and code) shows which code arrived, and that code then goes into
`microsoftNoMailbox`. A real guest is also needed to show that the
files-only connection is usable (item 4).

## Decisions for later review

- **The probe runs at every sign-in, not at checks.** As the design says,
  it is asked once per sign-in, while the token is at hand. A guest who
  later gets a mailbox gets mail, calendar and contacts at their next
  renewal or level change, and the skill tells the agent so. A periodic
  re-probe would mean extending the native adapter's verify; it is not
  built.
- **The same codes apply to members.** An unlicensed member, or one whose
  mailbox is still being provisioned (this can take hours after a licence
  is assigned), also answers *no mailbox*. Such a connection is files-only
  until its next sign-in. The card's line says "ei vierastilillä",
  which is not quite true for a member.
- **Undecided keeps the current form** rather than always registering five.
  An outage during a guest's renewal therefore does not bring back mail
  tools that can only fail. A new connection gets five, as before.
- **The probe needs files too.** A grant with mail but no files is not
  asked: a files-only connection without files would have nothing.
- **The grant list still shows the mail permissions**, because the tenant
  granted them. Only the services and the Pi areas drop them.
- **The files-only skill text is new agent-facing prose**
  (`microsoftFilesAreaSkill`) for Jari to proofread, like the search skill.
- `internal/msmcp` failed once in an unrelated run and then passed twice.
  This change does not touch that package; the failing test was not
  captured.
