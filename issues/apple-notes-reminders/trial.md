# Trial: Apple Notes and Reminders through the person's own Mac

Bounded trial, 23 November 2026, on the person's desktop Mac (macOS 26.6.2 build 25G83,
arm64), reached over SSH as the logged-in user. Defaults from the approved decision:
the Mac is awake and logged in, Notes means reading plus new plain notes, and access
uses the existing Omat koneet trust with per-app consent. Only synthetic objects were to
be touched. Raw logs are kept outside the tree, under
`/var/tmp/agent-keep/apple-notes-reminders/` on the agent host.

## Summary in plain language

**The SSH path answers the key question, and the answer changes the design.** When an
agent runs a tool on the Mac over SSH, macOS does not treat the tool as asking for
permission. It holds **the SSH server itself (`sshd-keygen-wrapper`)** responsible. So
any permission granted on the SSH path goes to "everything that arrives over SSH as this
user", not to remindctl or to the Notes tool.

What that means per app:

- **Reminders through remindctl (EventKit) cannot be granted over SSH at all.** macOS
  refuses at once, shows nothing on screen, and leaves no switch for the person to turn
  on in System Settings. This is Apple's policy for the SSH server identity, not a
  remindctl fault. remindctl works only when something running in the person's own
  desktop session (Terminal, or a small helper app) launches it.
- **Notes and Reminders through AppleScript automation do ask.** A request over SSH puts
  a dialog on the Mac's screen ("sshd-keygen-wrapper wants to control Notes" / "…
  Reminders"). Once the person allows it, every later SSH session as that user can
  automate that app.
- **Nobody was at the Mac during the trial.** The screen was locked and idle for the
  whole run, so neither dialog was answered within the 30-minute window. The functional
  tests (creating the list and folder, dates, recurrence, reading notes back, sync)
  therefore **did not run**. They are scripted and staged for one short attended session.

A side finding matters for the product: on this Mac, SSH already has **Full Disk
Access** (the "Allow full disk access for remote users" switch is on) and SSH already
holds **Calendar** access. Habitat's own Mac guidance says to leave the disk-access
switch off. With it on, any SSH key that reaches the account can read the Notes and
Reminders databases directly, without any of the dialogs above. That is broader than
this trial needed, and the FDA-free behaviour of the Notes tool could not be observed on
this Mac.

**Proposal in one line:** keep the Omat koneet transport, add an explicit per-machine
capability check that tells the person exactly which dialog to expect and that the grant
belongs to SSH as a whole, use AppleScript automation for Notes, and for Reminders
choose between AppleScript (works over SSH with one dialog, but no recurrence) and a
small desktop-session helper (full EventKit, but a new component that needs an
architecture decision).

## Setup

Both tools were installed only under `~/Library/Caches/habitat-trial/` on the Mac. No
Homebrew or global install, shell configuration, launch agent or system setting was
changed, and no permission database was read or written.

| Tool | Source | Verification |
| --- | --- | --- |
| remindctl 0.3.9 | GitHub release asset `remindctl-macos.zip` | SHA-256 `6db69578…27ad` matches the release `checksums.txt` and GitHub's asset digest; `codesign --verify --strict` valid; `spctl` "accepted, Notarized Developer ID", OpenClaw Foundation (FWJYW4S8P8), identifier `com.steipete.remindctl`, matching the release `SIGNING-MANIFEST.json` |
| apple-notes-mcp 2.16.11 | npm tarball `apple-notes-mcp-2.16.11.tgz` (the upstream GitHub release has no assets) | SHA-512 integrity matches npm's published `dist.integrity`; `build/index.js` is a self-contained bundle, so no `npm install` and no install scripts ran. Run in process with `APPLE_NOTES_MCP_BROKER=off`; the private helper, public helper, broker and Shortcuts bridges were not installed |

Node came from the Mac's existing installation; nothing was added for it.

## 1. The SSH permission path (the key unknown)

**Process chain of an SSH command:** `launchd` → `sshd-session: user [priv]` (root) →
`sshd-session: user@notty` → shell → tool. The launchd job is
`/System/Library/LaunchDaemons/ssh.plist` with program `/usr/libexec/sshd-keygen-wrapper`
(Apple platform binary, identifier `com.apple.sshd-keygen-wrapper`).

**What macOS attributes the request to.** The privacy daemon's own log
(`log show --predicate 'process == "tccd"'`) records an attribution chain for every
request:

```text
responsible = com.apple.sshd-keygen-wrapper (/usr/libexec/sshd-keygen-wrapper)
accessing   = com.steipete.remindctl        (…/habitat-trial/remindctl/remindctl)
requesting  = com.apple.calaccessd
```

The same responsible identity appeared for `/bin/ls` (Full Disk Access check) and for
`/usr/bin/osascript` (Automation). Neither the tool binary nor Terminal is involved. The
permission belongs to the SSH server, so it is shared by every SSH session, key and
program running as that user.

### Reminders through EventKit (remindctl)

```text
remindctl status --json     → {"authorized": false, "status": "not-determined"}
remindctl authorize --json  → "Reminders access denied…"  (returned in about 5 ms)
remindctl status --json     → still "not-determined"
```

The privacy daemon logged `promptPolicy = 3; isApplePlatformBinary = 1` for the SSH
server identity and answered the real prompt request with `result=false, auth_reason=5`
without showing a dialog or recording a decision. Nothing appeared on screen, and nothing
appeared for the person to switch on afterwards. As far as we know, System Settings'
Reminders pane lists only apps that have asked and offers no way to add one by hand, so
the person cannot add the SSH server there either (not checked on screen in this trial).

So: **consent cannot be given for EventKit Reminders on the SSH path on macOS 26.**
remindctl's own error text points this out ("If running over SSH, grant access on the
Mac that runs the command"), but no grant exists to make there.

The same log shows that **Calendar** (also EventKit) is already allowed for the SSH
server identity on this Mac (`auth_value=4`, full access). How that grant arose is not
known from the Mac. It shows that such a grant can exist, but not how a person would
create one today.

### Notes and Reminders through Automation (AppleScript)

```text
osascript -e 'tell application "Notes" to count folders'
  → after 120 s: "Notes got an error: AppleEvent timed out. (-1712)"
osascript -e 'with timeout of 600 seconds' -e 'tell application "Reminders" to count lists' -e 'end timeout'
  → after 600 s: "Reminders got an error: AppleEvent timed out. (-1712)"
```

Here the log shows `osascript` holds Apple's `allow-prompting` entitlement, and the
privacy daemon raised an indirect Automation request
(`kTCCServiceAppleEvents … com.apple.Notes` / `com.apple.reminders`, target identifier
`/usr/libexec/sshd-keygen-wrapper`). `UserNotificationCenter` then drew the consent
dialog. The timeouts are the client waiting for a click that never came: the screen was
locked (`CGSSessionScreenIsLocked = true`) and input had been idle since before the trial
began. A poll of the privacy log for 30 minutes after the first Notes request saw no
decision.

**What the person sees** when they unlock: two standard macOS dialogs, roughly
"“sshd-keygen-wrapper” wants access to control “Notes”. Allowing control will provide
access to documents and data in “Notes”, and to perform actions within that app." and
the same for "Reminders", with "Don't Allow" and "Allow". The name shown is the SSH
server, not remindctl or Habitat, which is confusing without guidance. If they are
answered later, the answer is stored and applies to all later SSH sessions. It can be
revoked under System Settings → Privacy & Security → Automation → sshd-keygen-wrapper.

**Whether one consent holds for later SSH runs** could not be tested without a click.
The attribution makes the expected answer clear: the grant is keyed to the SSH server's
code identity, not to the session, so it should hold across sessions, tool upgrades
and reboots, and break only if Apple changes that binary's identity. This is the first
thing to confirm in the attended session.

### Full Disk Access on the SSH path

`ls ~/Library/Mail`, `ls ~/Library/Messages` and listing the Notes group container all
succeeded over SSH (exit codes only; no content listed). The privacy log reports
`kTCCServiceSystemPolicyAllFiles … Auth Right: Allowed (System Set)` for the SSH server,
which is the "Allow full disk access for remote users" switch under Remote Login.
`remindctl doctor --json` likewise reported the Reminders database as readable over SSH
(it printed only table counts). This is the person's existing setting and was left
unchanged.

## 2. Reminders with remindctl — not run

Blocked by step 1: remindctl stops at `status: not-determined` over SSH, and no consent
can change that. `bin/remindctl-steps.sh` on the Mac performs the planned checks on the
synthetic list `Habitat-koe` only:

- create the list; add a date-only reminder (`--due 2026-12-01`), a timed one with an
  alarm (`--due "2026-12-01 09:00" --alarm "2026-12-01 08:45"`), a weekly recurring one
  and an "every 3 days" one;
- read the list as JSON under the system time zone, `TZ=UTC` and `TZ=America/New_York`,
  to see whether date-only reminders stay on their day and timed ones shift;
- complete the recurring reminder and read the list again to check that the next
  occurrence appears with the following week's date;
- edit the title, due date, notes and priority; clear a due date; `info` one reminder.

It writes a log, refuses to continue without authorization, and can run either from SSH
(where it will stop) or from a Terminal window in the person's session (`… ssh` or
`… terminal` as its argument names the log).

`bin/reminders-jxa.js` is the SSH-reachable alternative through Automation: it creates
the list and two reminders (an all-day due date and a timed due date with a "remind me"
time), reads them back, completes one, and deletes the list. Reminders' scripting
dictionary has no recurrence, so that route cannot set or test repeating reminders.

## 3. Notes with apple-notes-mcp — not run

Blocked by step 1: the AppleScript core needs the Notes Automation grant that was not
answered. The server started and listed its 90 tools over stdio without any permission.
`bin/notes-steps.mjs` drives it through MCP with:

- `get-capabilities`, `create-folder Habitat-koe`;
- three `create-note` calls in that folder: plain text with Finnish characters and a
  marker word, `format: "html"` with bold, a link and a list, and `format: "markdown"`
  (on this macOS build the server says it routes Markdown through HTML because Notes
  4.13's Shortcuts action lacks "Interpret as Markdown");
- `list-notes` in the folder, then `get-note-content` (HTML), `get-note-plaintext` and
  `get-note-markdown` for each note;
- `search-notes` by title and by content (`searchContent: true`), and `get-sync-status`;
- cleanup mode deletes only notes listed in `Habitat-koe`, using the content hash from a
  fresh read, then the folder.

**What fails without Full Disk Access** could not be observed on this Mac, because SSH
holds it. From the tool's documentation and parameter descriptions: content search falls
back from the database to AppleScript (slower, bounded by a default limit of 50),
attachment export and rich reads (checklist state, tables, drawings, audio transcripts)
need the database, and deletion guards that check a second note need it. Basic folder
and plain-note operations are AppleScript only.

## 4. Sync — not run

Nothing was created, so there is nothing to look for on the phone yet. After the
attended session, the person should look for a Reminders list **Habitat-koe** containing
items starting with "Koe" (due 1–2 December 2026, one repeating weekly) and a Notes
folder **Habitat-koe** with three notes titled "Habitat-koe …", within a few minutes, on
their iPhone. The Mac-side check is `get-sync-status` for Notes and, for Reminders,
whether the list belongs to the iCloud account in `remindctl list --json`.

## What needs the person

One attended session of about ten minutes, with the Mac unlocked:

1. Answer the two pending dialogs for sshd-keygen-wrapper (Notes, Reminders), or decide
   not to. **Allowing them grants Notes and Reminders automation to every SSH login as
   this user, not to one tool.** If they were already answered after the trial, the
   choice is in System Settings → Privacy & Security → Automation.
2. For remindctl's EventKit features, allow one launch from their own session, for
   example a Terminal window an agent opens with
   `open -a Terminal ~/Library/Caches/habitat-trial/bin/remindctl-steps.sh`, which
   prompts "Terminal would like to access your Reminders". This gives Terminal (not SSH)
   full Reminders access, and is only for testing the tool's date and recurrence
   behaviour; it does not make remindctl usable over SSH.
3. Decide whether to keep "Allow full disk access for remote users" on. Habitat's Mac
   steps recommend off. Turning it off would let the trial show what the Notes tool does
   without disk access, and would stop SSH from reading Notes, Reminders, Mail and
   Messages databases directly.
4. Check the phone for the synthetic list and folder afterwards.

The trial directory `~/Library/Caches/habitat-trial/` is **kept** on the Mac for that
session: it holds the verified binaries, the step scripts and their logs, and nothing
else. When the session is over, remove it by its exact path; if the session is not
wanted, remove it anyway. Nothing was created in Notes or Reminders, so there is nothing
else to clean up.

## Proposal for the product surface

**1. Agent skill guidance (no product code).** In the Omat koneet section of the agent
skill, state the macOS facts the trial established:

- Over SSH, macOS attributes privacy requests to `sshd-keygen-wrapper`. EventKit tools
  (remindctl, and Calendar/Contacts tools) cannot obtain a Reminders grant there. Do not
  ask the person to "allow remindctl"; there is nothing to allow.
- Notes and Reminders automation through `osascript` triggers one on-screen dialog
  naming sshd-keygen-wrapper. Before the first such call, tell the person which dialog
  will appear and that it grants the app to all SSH sessions. A call that blocks for the
  AppleEvent timeout (error -1712) means the dialog is unanswered, locked away or
  dismissed; report that instead of retrying.
- A locked screen blocks first-time consent (observed). Whether automation keeps
  working on a locked screen once granted is expected but not yet tested.
- Treat writes as uncertain after a timeout and read back before retrying (the Notes
  tool already enforces this with content hashes).

**2. An Omat koneet capability check.** A read-only probe that the daemon or the agent
runs on a Mac connection, reported per capability rather than as "connected":

| Capability | Probe | States |
| --- | --- | --- |
| Notes automation | `osascript` with a short `with timeout` counting folders | granted / waiting for consent / denied |
| Reminders automation | same against Reminders | granted / waiting / denied |
| Reminders EventKit over SSH | `remindctl status --json` if installed | normally `not-determined`; explain that SSH cannot get it |
| Remote disk access | exit status of a directory listing under `~/Library/Mail` | on / off, with a warning when on |
| Screen locked | `CGSSessionScreenIsLocked` | locked / unlocked, to explain a pending dialog |

This needs no new store or service: it reads native state each time. Whether the daemon
should run it on its own, or only the agent on request, is an open question because the
probe is itself an SSH command that can raise the dialogs.

**3. Reminders route: a choice for Jari.**

- *AppleScript over SSH:* works with one dialog and no new component. Covers lists,
  titles, notes, priority, completion, all-day and timed due dates and a reminder time.
  **No recurrence**, no sections or tags.
- *remindctl through a desktop-session helper:* full EventKit (recurrence, alarms, JSON
  output, locations). Needs something in the person's login session that owns the grant,
  for example a small signed app that SSH asks to run remindctl. That is a new
  component with lifecycle, signing and same-user trust questions, and research.md's
  approach 2 already says it needs an architecture decision first. The Notes tool's
  optional broker is the same pattern; its documentation is explicit that every process
  of the user can use it.

**4. Notes route:** AppleScript through apple-notes-mcp, in process, plain notes and
reading, as approved. The attended session should still confirm the HTML and Markdown
round trip on this macOS build before guidance promises more than plain text.

### Open questions

Jari's answers of 23.11. (Mac awake and logged in is enough; reading plus new plain
notes; account-wide Omat koneet trust with per-app consent is acceptable) cover the
consequence found here that a Notes or Reminders grant applies to every SSH session as
that user: that is the same account-wide trust, so it needs no helper on its own.

1. Is recurrence needed for Reminders? If not, AppleScript over SSH may be enough and no
   helper is needed.
2. Should the Habitat Mac steps detect remote disk access being on and warn, given that
   it silently grants far more than Notes or Reminders?
3. Should the capability check run automatically on connection, or only when the agent
   is about to use Notes or Reminders, so that dialogs appear only when the person
   expects them?
