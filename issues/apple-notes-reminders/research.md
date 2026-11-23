# Apple Notes and Reminders through the person's Mac

Research for discussion, 23 November 2026. No product implementation or permission changes.

## Summary for Jari

**Yes. The best starting point is the person's Mac through Omat koneet, not a new iCloud login in Habitat.** Reminders has a public Apple API and a suitable existing command-line tool. Notes is harder: basic text and folder operations are practical, but preserving rich notes, attachments and checklists involves more permissions and more OS-dependent tooling. [A1, T1, T3]

My recommendation is a small, consented Mac trial: **remindctl for Reminders; a deliberately limited Notes surface**, initially reading selected notes and creating plain notes rather than rewriting existing rich ones. Evaluate `sweetrb/apple-notes-mcp` for Notes, without its optional private-framework helper. Do not promise all Notes features or unattended availability yet.

The biggest uncertainty is not SSH connectivity. It is **whether the selected tools can use their macOS permissions from the actual SSH launch path**, without enabling broad disk access for every remote command. Our current Mac setup explicitly tells people to leave that broad permission off. A successful test in Terminal does not establish that SSH works. [P1–P3, A3–A5, T4]

There are now Linux tools that automate iCloud's website without a Mac. They retain a signed-in browser session and are dependent on Apple's web UI, not a public Notes/Reminders API. They are a real alternative, but not the reliability or authority model I recommend for Habitat's first integration. [T7, A7]

## What was checked, and what remains unproved

Read the product's daemon, settings flow, conversation machine indicator, agent instructions and existing Apple/DAV integration at repository base `236e188e5`. Consulted Apple documentation and upstream code, releases and open issues. Release dates below are GitHub publication dates, checked against the repositories' API on 23 November 2026; they can differ from changelog dates. [P1–P5, T1–T8]

This was desk research on Linux. **No tool was installed on a person's Mac; no real notes, reminders or credentials were read; no TCC, locked-screen, restart or sync test was run.** Upstream capability claims and bug reports are not our own compatibility results. “Maintained” below means visible releases/code activity, not a support guarantee.

## 1. Apple's supported surfaces

- **Reminders:** EventKit provides read/write access, including creating, editing and deleting reminders. Permission is full Reminders access, not a read-only or one-list grant. Calendar has a separate entity permission and can offer write-only access; that distinction must not be carried over to Reminders. Modern access APIs and usage-description keys matter on macOS 14 and later. [A1, A2]
- **Notes:** AppleScript application automation and Shortcuts are usable local mechanisms, but neither means unrestricted, lossless access to every Notes feature. Existing tools combine them with reverse-engineered local database reads for richer content. Apple's public CloudKit SDK is for containers a developer's app is entitled to use; it is not a general API into Apple's Notes container. No public server-side Notes or modern iCloud Reminders API was found in the reviewed documentation. [A3, A6, A9, T3]
- **The iOS 13 change needs precise wording:** Apple documents that upgraded reminders need iOS 13/macOS 10.15 or later, and remain available on iCloud.com. Apple does not establish the CalDAV wire-protocol change in that article. The headless tool's maintainer reports that legacy CalDAV writes no longer appear in the modern Reminders store. Therefore do not extend Habitat's calendar DAV integration to claim modern iCloud Reminders support. This does not mean every third-party CalDAV task account stopped working. [A8, T7]

## 2. Tools worth evaluating

### Shortlist and capability limits

| Tool | Capability relevant here | Maintenance, licence and judgment |
| --- | --- | --- |
| **openclaw/remindctl** | macOS 14+, Swift/EventKit. Read/search; create/edit/complete/delete; list creation/rename/delete; date-only and timed due dates, alarms, simple recurrence including every N days/weeks/months/years. JSON and noninteractive output. No native sections/tags/smart lists, file/image attachments or private Urgent toggle. | MIT. Latest published release **v0.3.9, 21 Oct 2026**; main commit **21 Nov 2026**. Strongest Reminders candidate for agents. [T1] |
| **keith/reminders-cli** | Swift/EventKit; lists, add/edit/delete/complete/uncomplete, due dates and priority. Recurrence remains an open request with proposed PRs; do not treat those as released support. | MIT. Latest published release **2.5.1, 7 May 2024**; main changed **2 Oct 2026**. Established alternative, but release/main divergence and narrower demonstrated recurrence support favour remindctl. [T2] |
| **sweetrb/apple-notes-mcp** | Node-based stdio MCP. AppleScript core reads HTML/text/Markdown and creates/updates/moves/deletes notes and folders, including account targeting and nested folders. Rich reads/exports and attachment extraction use the local Notes database with Full Disk Access. Shortcuts add richer operations; attachment insertion and native content have separate capability checks. | MIT. **v2.16.11, 21 Nov 2026**, following releases on 20 Nov: visibly active but fast-moving. Best Notes evaluation candidate, not a blanket production endorsement. Optional private-framework inspection is a separate, unnecessary opt-in. [T3, T4] |
| **antoniorodr/memo** | Python/AppleScript CLI. Notes browsing/search, Markdown reading, editor-based add/edit, folders/moves, HTML/Markdown export; also reminder viewing/completion. Image preservation uses placeholders and moves retained images to the end. Not a lossless rich-note round trip. | Current repository licence **Apache-2.0**. **v0.7.0, 16 Nov 2026**; main changed **17 Nov**. Maintained, but interactive editor workflow and open link/style-loss reports make it a weaker unattended writer. Historical MIT references are stale for the reviewed current tree. [T5] |

A prominent older all-in-one, **supermemoryai/apple-mcp**, is MIT but archived; its last release is **1.0.0, 11 August 2025**. It is not a maintained default simply because many integration lists still link to it. [T6]

### Reliability evidence that changes the recommendation

- `remindctl` has recent fixes for invalid dates, ambiguous mutations, repeated targets and bounded system calls. Its shared-list move limitation is explicit: it does not silently copy/delete to bypass EventKit. There is nevertheless an **open report #120** of a due-date crash with an ISO-8601/non-Gregorian system calendar. Treat this as an upstream report to reproduce with synthetic reminders, not proof every installation is affected or already fixed. [T1a, T1b]
- Notes MCP **#337** reports Markdown being saved literally on macOS 26.6.2. Subsequent releases address related behaviour, but the issue is still open. This illustrates why “supports Markdown” is insufficient: test the exact OS, bridge and operation, including the saved result. **#220** reports different Full Disk Access outcomes between launchers using the same Node binary. [T3a, T3b, T3c]
- Memo **#33/#34** report link and semantic-style loss on editing. Their reports concern older versions and remain open; this research did not reproduce them on v0.7.0. Even its current image-preservation documentation acknowledges layout changes. Do not route rich-note edits through a simpler tool merely because a safer tool refuses them. [T5a, T5b]

**Practical coverage boundary:** plain-note creation and selected reads are plausible first scope. Arbitrary HTML is not equivalent to Notes' native model. Existing checklists, tables, drawings, PDFs, shared notes and locked notes need individual capability tests; do not promise to unlock protected notes or preserve unsupported content. For attachments, distinguish original bytes from a preview or exported rendering. For Reminders, test recurrence completion, timezone/all-day semantics and shared-list behaviour rather than just the presence of command flags. These are proposed acceptance criteria, not verified outcomes. [T1, T3, T5]

## 3. Fit with Omat koneet

### Reuse the connection and its authority

The existing feature already gives the person's Linux account ordinary SSH access to an approved Mac account through their own userspace Tailscale node. SSH configuration is the machine list; host keys are pinned. The generated grant uses `restrict`, a source-address restriction and optionally an expiry, **not a forced command restricting execution to Notes**. There is no reason for this proposal to add another machine registry, shared service credential or gateway route. [P1]

The natural shape is:

```text
person's Habitat agent → existing SSH alias → Mac-side tool
                                           → EventKit / Notes automation
                                           → normal Apple sync
```

For a CLI, invoke the installed Mac binary noninteractively. For a stdio MCP server, an account-owned client configuration could launch it through SSH with stdin/stdout forwarded and no pseudo-terminal. That is a proposed transport arrangement, not a tested product integration. Keep protocol stdout clean and use a pinned installed executable rather than downloading “latest” on each request. No network MCP listener or shared proxy is needed.

The settings UI owns giving/removing access; the skill requires naming the machine before first use and stopping on refusal, changed keys or unreachable hosts. Preserve those rules. The conversation UI recognises SSH commands and shows machine/connection state; an MCP connection should not be assumed to appear there automatically. Nor does “connection open” mean Notes permissions or iCloud sync are healthy. [P2, P3]

### What must be on the Mac

The intended user's Apple account and data must already be available there. The user installs the selected tool and, for richer Notes operations, its chosen Shortcuts bridges. Ordinary EventKit operations need no new Linux-side Apple credentials. A running GUI login should be the initial trial baseline, especially for Notes/Shortcuts, rather than a claim that a logged-out Mac will work. Apple's documentation distinguishes GUI sessions from SSH-launched processes. [T1, T3, A9, A10]

### Privacy permissions: not “grant Terminal once and forget it”

There are separate permissions:

1. **Remote Login** permits SSH as the selected account. Habitat currently instructs users to leave **Allow full disk access for remote users off**. Keep that default. [P2, A4]
2. **Automation → Notes** permits the responsible program to control Notes. This is not the same as permission to read the Notes database. [A3, A5]
3. **Reminders** permits EventKit access. Use the tool's permission status/authorization facilities, but approval must happen on the Mac in the correct execution context. [A1, A2, T1]
4. **Full Disk Access**, where needed for Notes database/attachment reads, is much broader than Notes. It is a separate human grant, not something an SSH script should silently enable. Shortcuts may also need first-use consent. [A5, T4]

**Recommended consent trial:** while the person is at the Mac, install a fixed version, invoke read-only diagnostics from the actual Habitat SSH path, and identify which app/executable macOS attributes the request to. Let the person approve only the intended permissions in System Settings, then repeat the same remote read. Test again after restarting the tool and after a Mac login/restart. EventKit remembers an application's decision, but a different launcher or changed executable identity must not be assumed to inherit it. [A2–A5, T3c, T4]

If an SSH-launched CLI cannot receive a usable scoped grant, stop rather than widening SSH to Full Disk Access. A signed, user-session helper/broker is the next candidate: SSH forwards a request to that helper, whose identity owns the permission. This may improve permission attribution, but requires validating the local IPC access rules and lifecycle. It is **not yet an approved Habitat component**. The upstream Notes tool already documents an optional permission broker worth evaluating before writing another one. Its socket excludes other Unix users but deliberately trusts every process running as the same Mac user: it is permission consolidation, not per-agent authentication. It also pins its Node runtime and needs setup repeated after relevant updates. [T4]

Do not edit TCC databases, disable protections or automate clicking consent dialogs. A normal Automation grant does not require adding Accessibility access for UI scripting; avoid that extra authority unless a separately chosen feature actually needs it. [A3, A5]

### Sleep, offline and uncertain writes

A powered-off or unreachable Mac cannot execute this bridge. Apple offers network-wake settings, but they do not establish reliable wake across this Tailscale/SSH path. Budget for a reachable, awake Mac, not a wake-on-demand promise. A locked screen, a sleeping computer and a logged-out account are different test cases. [A10, A11]

Proposed behaviour: fail promptly with the affected machine and whether the failure is transport, permission or application access. Do not create a second notes cache or silently queue a write for later. After a timeout, inspect the exact target before retrying: the Mac may have saved a change before the connection failed. Report local save separately from verified cross-device sync. This is a design recommendation, consistent with the existing UI's treatment of uncertain writes and the tools' readback warnings. [P2, T1, T4]

## 4. Consent and security

**Omat koneet is account-level access, not a Notes-only capability.** A tool's folder filter or “read-only” mode can constrain normal use, but is not a security boundary when the same agent can run arbitrary commands as that Mac user. A genuinely enforced per-folder/operation grant would require a different restricted access design; adding a broker alone does not narrow the already granted SSH authority. [P1, P3]

Before enabling the trial, explain separately:

- which Mac and account the agent will use;
- which app permissions are added, and whether access can include other configured accounts or shared material;
- whether the task allows reading only, creation, editing, completion or deletion;
- that returned note/reminder content enters the agent conversation and potentially its configured model provider, even though Apple credentials stay on the Mac;
- how to revoke both the Mac permission and the SSH key grant. Removing Habitat's connection entry alone does not remove the remote authorized-key line. [P1–P3, A1, A3, A5]

Recommended trial policy: selected content rather than a whole-library export, a disposable folder/list for writes, and explicit confirmation before destructive or bulk changes. Treat retrieved text as data, not instructions. No credentials, personal content or diagnostic dumps belong in public issues. These are proposed usage safeguards, not additional enforcement claimed of the existing tools.

## 5. Calendar, Contacts and Mac-free alternatives

### Calendar and Contacts

The same Mac transport can serve Calendar through EventKit and Contacts through `CNContactStore`, with separate consent. It is useful for on-device data or accounts not reachable from Habitat. Contacts' `note` field has a special entitlement on current macOS; generic Contacts access does not guarantee every field. [A1, A12]

But Habitat already connects Apple Calendar/Contacts through CalDAV/CardDAV. Its Apple setup produces ordinary per-account native client configuration; agents use curl directly, with ETags/conditional writes and no mirrored store. **Keep DAV as the default for those cloud services:** it avoids the Mac availability dependency. A Mac route should add access to otherwise unavailable data, not create two competing writers for the same calendar/address book by default. [P4, P5]

### Can anything work with no Mac on?

| Route | What is possible | Cost/limitation |
| --- | --- | --- |
| **iCloud.com and headless browser tooling** | Apple's web apps work without a Mac. `sjdonado/icloud-headless-mcp` documents Notes read/create/update and Reminders read/create/complete, including due times. MIT; latest release **27 Sep 2026**. | Signed-in resident Chrome profile, interactive Apple login/2FA renewal, slow calls and web-UI breakage. Its app-specific password covers DAV/mail, **not** Notes/Reminders browser authentication. A retained session is sensitive authority even without storing the primary password. Its separate-service-account installer should not be imported into Habitat's per-user model unchanged. [T7] |
| **iPhone/iPad Shortcuts** | A user-triggered or configured automation can execute on that device instead of a Mac. Suitable for bounded capture/export or “send this to Habitat” flows. | Still device-side, not Apple-hosted cloud execution. Trigger availability and individual action consent matter. A bidirectional request queue would be new product infrastructure, not an existing Omat koneet capability. [A13, P1] |
| **Companion app** | An iOS app could use EventKit for Reminders; a Mac companion could stabilise permission identity and mediate local operations. | iOS background execution is discretionary, not an always-on request server. No reviewed public API makes a companion a general Notes-library client on iOS. A Mac companion still needs its Mac running. [A1, A6, A14] |

Advanced Data Protection disables iCloud web access by default; users can re-enable it and approve temporary access using a trusted device. Therefore neither headless browser persistence nor “no Mac” guarantees an unattended, no-device-approval workflow. Do not recommend turning off Advanced Data Protection to make integration easier. [A7]

## Source register

Product paths refer to the inspected base, not a separate product specification:

- **P1:** `internal/daemon/own_machines_linux.go`: `tailnetUnitText`, `machineConfig`, `grant`, `probe`, removal handling.
- **P2:** `web/src/app/OwnMachines.tsx`, `web/src/text/ownMachines.tsx` (especially `macSteps`), `web/src/app/ownMachineUse.tsx`.
- **P3:** `internal/cli/agent/SKILL.md`, “The person's own machines”.
- **P4:** `internal/daemon/integrations/apple_linux.go`.
- **P5:** `internal/daemon/integrations/dav_linux.go`, especially `Skill`.

Apple primary sources:

- **A1:** [Accessing the event store](https://developer.apple.com/documentation/eventkit/accessing-the-event-store).
- **A2:** [Requesting Reminders access](https://developer.apple.com/documentation/eventkit/ekeventstore/requestfullaccesstoreminders(completion:)) and [TN3152: Calendar access levels](https://developer.apple.com/documentation/technotes/tn3152-migrating-to-the-latest-calendar-access-levels).
- **A3:** [Allow apps to control other apps](https://support.apple.com/guide/mac-help/mchl07817563/mac).
- **A4:** [Remote Login](https://support.apple.com/guide/mac-help/mchlp1066/mac).
- **A5:** [Privacy & Security settings](https://support.apple.com/guide/mac-help/mchl211c911f/mac); [Apple DTS discussion of executable/FDA attribution and OS regressions](https://developer.apple.com/forums/thread/806187). Forum reports are contextual evidence, not a universal permission recipe.
- **A6:** [Designing with CloudKit](https://developer.apple.com/icloud/cloudkit/designing/) and [Enabling CloudKit](https://developer.apple.com/documentation/cloudkit/enabling-cloudkit-in-your-app).
- **A7:** [Manage web access to iCloud data](https://support.apple.com/en-us/102630).
- **A8:** [Upgrade your reminders](https://support.apple.com/guide/iphone/apd151b374b6/ios).
- **A9:** [Run Shortcuts from the command line](https://support.apple.com/en-jo/guide/shortcuts-mac/apd455c82f02/mac).
- **A10:** [Apple DTS: LaunchAgent without a GUI session](https://developer.apple.com/forums/thread/696859).
- **A11:** [Mac sleep and wake settings](https://support.apple.com/en-tm/guide/mac-help/-mchle41a6ccd/mac).
- **A12:** [Contacts](https://developer.apple.com/documentation/contacts) and [Accessing the contact store](https://developer.apple.com/documentation/contacts/accessing-the-contact-store).
- **A13:** [Shortcuts automations](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios).
- **A14:** [Background execution strategies](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app) and [WWDC25: Finish tasks in the background](https://developer.apple.com/videos/play/wwdc2025/227/).

Tool sources (release/commit endpoints also checked directly to avoid stale search indexes):

- **T1:** [remindctl README/licence](https://github.com/openclaw/remindctl), [releases](https://api.github.com/repos/openclaw/remindctl/releases?per_page=3), [main commit](https://github.com/openclaw/remindctl/commit/7cae240978216c871bfc4e2127e5256c8903baa6).
- **T1a:** [remindctl changelog](https://github.com/openclaw/remindctl/blob/main/CHANGELOG.md).
- **T1b:** [Due-date locale crash report #120](https://github.com/openclaw/remindctl/issues/120).
- **T2:** [reminders-cli README/licence](https://github.com/keith/reminders-cli), [EventKit source](https://github.com/keith/reminders-cli/blob/bdf049743cb4d7b513b2efefa466c36864030065/Sources/RemindersLibrary/Reminders.swift), [releases](https://api.github.com/repos/keith/reminders-cli/releases?per_page=2), [recurrence request #104](https://github.com/keith/reminders-cli/issues/104).
- **T3:** [Apple Notes MCP README/licence](https://github.com/sweetrb/apple-notes-mcp), [release history](https://api.github.com/repos/sweetrb/apple-notes-mcp/releases?per_page=3).
- **T3a:** [Markdown bridge report #337](https://github.com/sweetrb/apple-notes-mcp/issues/337).
- **T3b:** [v2.16.11](https://github.com/sweetrb/apple-notes-mcp/releases/tag/v2.16.11).
- **T3c:** [Permission inheritance report #220](https://github.com/sweetrb/apple-notes-mcp/issues/220).
- **T4:** [Notes MCP permission guide](https://github.com/sweetrb/apple-notes-mcp/blob/main/docs/FULL-DISK-ACCESS.md) and [current setup/permission/broker sections](https://github.com/sweetrb/apple-notes-mcp/blob/69d2edb89720a7111c7b4fe140ec91411dbfa49d/README.md).
- **T5:** [Memo README](https://github.com/antoniorodr/memo), [current licence](https://github.com/antoniorodr/memo/blob/d32c955849d0391890b505aa62563b7e81cad09a/LICENSE), [v0.7.0](https://github.com/antoniorodr/memo/releases/tag/v0.7.0).
- **T5a:** [Link loss #33](https://github.com/antoniorodr/memo/issues/33).
- **T5b:** [Style loss #34](https://github.com/antoniorodr/memo/issues/34).
- **T6:** [Archived supermemoryai/apple-mcp](https://github.com/supermemoryai/apple-mcp), [repository metadata](https://api.github.com/repos/supermemoryai/apple-mcp), [releases](https://api.github.com/repos/supermemoryai/apple-mcp/releases?per_page=3).
- **T7:** [icloud-headless-mcp capabilities, authentication and limits](https://github.com/sjdonado/icloud-headless-mcp), [release history](https://api.github.com/repos/sjdonado/icloud-headless-mcp/releases?per_page=3).
- **T8:** [Memo release metadata](https://api.github.com/repos/antoniorodr/memo/releases?per_page=3), [Notes MCP current commit](https://api.github.com/repos/sweetrb/apple-notes-mcp/commits?per_page=1).

## Candidate approaches, costs and recommendation

These are comparative engineering estimates, not delivery commitments; all await scope and permission testing.

1. **Existing Mac tools over Omat koneet — recommended trial.** Use remindctl and narrowly scoped Notes operations from a pinned existing tool. **Low initial cost:** several focused days for a synthetic-data compatibility trial and consent guidance, rather than a new service. Continuing cost is Mac availability and tool/OS regression checks. If Notes cannot work without broader permissions, deliver the Reminders result separately rather than broadening access silently.
2. **User-session Mac helper/broker.** Evaluate an existing broker first; consider a signed Habitat companion only if permission attribution or policy needs justify ownership. **Medium/high cost:** packaging, signing, updates, local authentication and per-user lifecycle introduce a separately maintained component. Weeks rather than days for a supported product surface. It improves permission UX, not Mac availability, and does not by itself narrow existing SSH authority. Requires a recorded architecture decision before implementation.
3. **Mac-free iCloud web automation.** Evaluate an existing headless tool rather than inventing an iCloud client. **Moderate experimental cost but high, uncertain ongoing support cost:** browser sessions, 2FA/ADP recovery, UI changes and stronger tenant/session handling. Recommend only if working while every Mac is off is essential and Jari accepts that maintenance/security trade-off. A phone Shortcut is a lower-automation alternative for bounded capture, not an equivalent always-available backend.

**Recommendation:** approve approach 1 as a bounded experiment, not a general integration promise. Test the actual SSH permission path first, then Reminders dates/recurrence and Notes read/create using synthetic content. Do not add a service, claim rich-note editing, change the Omat koneet Full Disk Access default, or replace working DAV integrations in this step.

## Questions for Jari

1. Is “works while my chosen Mac is awake and logged in” sufficient, or is use while all Macs are off essential?
2. For the first useful Notes workflow, do you need selected-note reading and new text notes, or must it preserve/edit existing checklists, rich formatting and attachments?
3. Is the existing account-wide Omat koneet trust acceptable with explicit app consent, or do you require an enforced selected-folder/list, read-only or confirmation-only boundary? The latter is a different access design, not just another tool flag.
