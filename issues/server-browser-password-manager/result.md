# Bitwarden in the server browser

## Saatesanat

**Bitwardenin voi asentaa, mutta nykyisessä palvelinselaimessa sitä ei voi
luotettavasti eristää agentilta.** Sama Unix-käyttäjä pääsee selaimen tiedostoihin
ja näyttöön. Lisäksi nykyinen CDP-yhteys välittää muutakin kuin nimetyt
selainkomennot. Pelkkä laajennuksen osoitteen estäminen ei riitä.

Suosittelen pitämään holvin omalla laitteella ja siirtämään palvelinselaimeen
vain tarvittavan salasanan *Kirjoita näppäilyinä* -toiminnolla. Näin koko holvi
ja sen avausavain eivät tule palvelimelle. **Siirretty salasana ja kirjautunut
istunto eivät silti ole agentilta eristettyjä.** Tämä vastaa leikepöydälle
valittua tasoa: hygieniaa, ei eristystä.

Jos palvelimella oleva Bitwarden on välttämätön, tarvitaan ensin päätös:
riittääkö käytännön varovaisuus vai pitääkö holvin todella olla agentin
ulottumattomissa? Jälkimmäinen edellyttää erillistä käyttöjärjestelmätason
rajaa ja sen ulkopuolella toimivaa ohjausta, ei vain lisäasetusta Chromeen.
Alla on toteutusehdotus kummallekin tasolle; mitään niistä ei ole toteutettu.

## Scope and answer

Research date: 2026-11-22. Local source inspected at
`73524a1b41686aab76b7648d31eec0d9ba2786e7`. External references [1–12]
are primary documentation or upstream protocol/announcement sources, read on
that date. This is a design assessment of documented same-UID authority, not
an exploit report or an installation qualification.

Separate three assets:

1. **The whole vault**, including unrelated passwords and its decryption keys.
2. **One credential after filling**, now also available to the destination page.
3. **The authenticated session**, which the agent is normally meant to use.

Keeping (1) off the server is feasible now. Keeping (2) secret from a process
that can evaluate arbitrary JavaScript in the receiving page is not. Giving
(3) to the agent intentionally grants account capabilities even without the
password. These are conclusions from the local access paths below, not claims
that a password manager's cryptography is broken.

## What the code actually permits

Local references are paths plus symbols at the inspected revision:

- `internal/browserhost/host_linux.go`, `Run`, `chromeArgs`: Chrome is a child
  of the same user's browser host, with `--remote-debugging-pipe`, a dedicated
  `--user-data-dir`, `--password-store=basic`, and `--disable-sync`. No extension
  disabling flag is supplied. Profile/cache are in that user's home; sockets
  are in a 0700 directory with 0600 permissions. This separates people, not
  the person's agent from their browser.
- `internal/cli/browser_linux.go`, `agentBrowserCommand`, dispatches actions
  implemented in `browser_actions_linux.go`. `goto` and `download` only accept
  HTTP(S); `type` refuses password inputs. **`eval` accepts arbitrary JS** and
  `browser_cdp_linux.go:evaluateGesture` sends it to `Runtime.evaluate`.
- `runBrowserAction` lists all targets of type `page`, not only HTTP(S) pages.
  Other schemes merely produce an empty `origin`. An explicit tab ID is
  attached without an origin check. Hiding extension entries in this list
  alone would not stop attachment by a known ID.
- `internal/browserhost/cdp_linux.go`, `fromAgent` / `forwardLocked`, provides
  a general CDP mux on `cdp.sock`, not a command allowlist. It remaps request
  IDs and tracks sessions, but does not reject extension targets or arbitrary
  protocol methods. Thus “the agent only has our named commands” is **not** an
  enforced boundary. The pipe removes a Chrome debug TCP port; the same-user
  socket still offers protocol access.
- `setControl` holds new agent commands while the person controls the browser
  and replays them on return. It does not undo JS already installed in a page,
  stop independent shell processes, or revoke the user's filesystem access.
- `host_linux.go:startXvnc` and `writeCookie` place the display credential and
  VNC socket under that same UID. `control_linux.go` also serves the host's
  status and page images to that UID. Human control is coordination, not
  authentication of a different principal.

The prior `issues/server-browser-control-clipboard/result.md` recommends the
same hygiene limit. Its phrase that the agent can do nothing in the browser
while the person signs in is only true of newly held mux commands, not of the
same-UID shell or already installed page code. This report uses the narrower,
source-supported interpretation.

## Installation: ordinary Chrome is sufficient

**Preferred if the weaker protection level is explicitly chosen:** the person
installs the official Bitwarden extension through Chrome Web Store while
controlling the remote browser. Its official Chrome ID is
`nngceckbapebfimnlniiiahkandclblb` [1,2]. Keep vendor updates; do not build a
vendored extension or an unpacked-extension distribution mechanism.

Managed installation is also supported on Linux. An operator-owned JSON file
under `/etc/opt/chrome/policies/managed/` can set `ExtensionInstallForcelist`
to the Bitwarden ID and Web Store update URL, or use `ExtensionSettings` with
`installation_mode: force_installed`. Bitwarden documents the Linux recipe;
Chrome documents the policy directories and precedence [2,3,4]. Example value:

```json
{
  "ExtensionInstallForcelist": [
    "nngceckbapebfimnlniiiahkandclblb;https://clients2.google.com/service/update2/crx"
  ]
}
```

This is an operator proposal, **not a command to install here**. Machine policy
is not scoped by `--user-data-dir`: it affects Chrome users on that machine.
Do not silently force a personal choice into every tenant's browser. Check
`chrome://policy` for actual effective policy/errors and account for an existing
`ExtensionSettings` policy, which overrides the older extension policies [3,4].
A machine-local policy file does not require enrolling the installation into
Google cloud management [3]. Force installation prevents ordinary removal;
it does not isolate the vault from the same UID.

Two different 2025 changes must not be confused:

- Chrome **136** stopped honoring remote debugging switches for the default
  data directory. Both port and pipe require a non-standard user-data directory.
  Habitat already supplies one; this is not an extension-installation ban [5].
- Chrome **137** removed `--load-extension` in official Chrome-branded builds.
  The upstream announcement preserves it for Chromium and Chrome for Testing.
  This does not remove Web Store or managed installation [2,6]. Do not change
  Habitat's browser distribution merely to work around that flag.

Documentation establishes a supported installation route, not proof that a
particular installed Chrome/policy/network combination succeeds. Qualify that
with a disposable profile and synthetic vault before shipping support.

## Access paths and what a host filter could do

| Path | Current consequence | Possible product guard; limit |
| --- | --- | --- |
| `goto chrome-extension://…` | CLI rejects the scheme | Keep it, but it does not govern raw CDP or existing targets |
| Extension page, popup, worker target | General mux permits discovery/attach requests; exact target visibility depends on Chrome/version/lifetime | Enforce target/type/origin allowlists at the mux, including events, existing sessions and navigation transitions |
| CDP `Target.attachToTarget`, auto-attach, nested routing | CDP has attachment and discovery machinery [7]; CLI is not the only client | Deny unsupported methods and indirect routing; filtering only `Page.navigate` is insufficient |
| `eval` after autofill | An ordinary password input's `.value` is readable even though rendering uses dots; local `eval` has no redaction | Masking `text` or screenshots is not protection against arbitrary JS; do not promise secrecy for a filled field |
| Page screenshot | CLI uses `Page.captureScreenshot`, not a desktop capture | It does not ordinarily include toolbar chrome; an extension page/pop-out can be a separate target. Target-specific popup capture needs native qualification |
| X/VNC desktop observation | Same UID can reach the display and see a visible popup or operate its UI | A CDP filter cannot refuse these independent display connections |
| Human takes control | New mux commands wait | Previously injected listeners/timers or raw display clients can survive; merely pausing commands cannot create a private login interval |

An ordinary website is not automatically allowed to read an extension's private
origin. The concern here is debugger authority and OS ownership, not ordinary
cross-origin JavaScript. Conversely, once autofill places a secret into the
website's form it has deliberately crossed into that website's context [8].

A hygiene filter can reduce accidental exposure: hide extension metadata from
agent lists/events, deny extension/internal targets and attachment routes, and
never return popup images through agent-facing status. It must check response
and event streams too, not just requests. A protocol allowlist is safer than a
few forbidden strings. None of this proves isolation while the same UID can
connect to VNC, call the control socket or modify the owned profile. Do not
spend a large protocol-firewall project to imply otherwise.

## Same UID outside the browser commands

**At rest.** Bitwarden stores the local vault encrypted and decrypts it in
memory when unlocked [9]. For a normal master-password account, the master
password derives protection for the account encryption key; it is not a
plaintext vault file [10]. In this custom profile the usual Chrome storage
location is under `PROFILE/Default/Local Extension Settings/<extension-id>`
[9], with other extension/profile state alongside it. Same-UID access permits
copying encrypted storage for offline attacks and modifying owned browser
state; it does not by itself decrypt a properly locked vault. Chrome's
`--password-store=basic` is not a switch that disables Bitwarden's own vault
encryption. Avoid describing Chrome's built-in password storage as equivalent
to Bitwarden's storage.

**Unlocked memory.** Decryption keys and usable secrets must be accessible to
the running client [10]. Bitwarden describes best-effort memory clearing on
lock, not proof that every historical byte vanishes immediately. Do not claim
that locking revokes secrets already copied, filled into a page, or captured
by another process [10].

**ptrace.** Same UID does not mean unconditional memory access on Ubuntu.
Yama mode 0 permits attachment to dumpable same-UID processes; mode 1 normally
restricts it to descendants or explicitly allowed tracers. Modes 2 and 3
restrict further. Ubuntu documents the descendant restriction [11,12]. An
ordinary agent and already-running Chrome can be siblings, so “the agent can
just attach gdb” is not a sound blanket claim. Deployment review should observe
`kernel.yama.ptrace_scope`, capabilities, dumpability and process relationships;
none was probed against a real browser in this research. Yama does not protect
same-user profile files, authenticated X access or the current CDP socket.
Launching a browser under a process the agent controls also changes the
relationship. Stronger ptrace settings alone therefore do not solve this task.

**Display and writable state.** The local host source already establishes that
the agent UID can obtain the X cookie and connect to `vnc.sock`; no memory dump
is necessary to observe the desktop. Owned profile/process state also makes
persistence and later interception a relevant threat. This assessment does
not attempt a live vault read, a restart, or any attack against a person's
browser. Administrators/root remain outside any proposed same-host isolation
claim as well.

## If server Bitwarden is nevertheless chosen: hygiene configuration

These are risk reductions, not satisfaction of “the agent cannot reach it”:

- Set a short finite vault timeout and **Lock** action; manually lock before
  giving control back. Never choose **Never**, which Bitwarden warns stores an
  unencrypted encryption key on the device. Timeout measures interaction with
  Bitwarden, not the Habitat turn. Avoid popped-out extension windows: the
  vendor says their timeout behavior differs [10].
- Prefer PIN unlock off. At minimum keep **Require master password on browser
  restart** enabled: persistent PIN convenience weakens protection of local
  data and can interfere with memory purging [10]. Do not add synchronized
  unlock or a Bitwarden CLI session token on the server.
- Leave **autofill on page load off**, including item-level overrides. Require
  an intentional fill after checking the destination; no automatic release of
  credentials when an agent opens a matching site [8].
- Finish sign-in, leave the credential form, lock the vault and close its UI
  before hand-back. Clear clipboard copies. Leaving the page reduces residual
  exposure but is not proof against earlier instrumentation or retained data.
- Do not label a Done click “vault locked” without evidence. The reviewed
  vendor docs do not establish a supported external lock-and-ack API for
  Habitat. Manual lock is the initial honest route. A later automated hook
  requires qualification of lock acknowledgement, failure, every account,
  popup/pop-out behavior and updates; UI-click automation is not a security
  primitive. Never replay stale held commands into the just-completed login.

## Alternatives and architecture implications

### Recommended now: local vault, one selected credential crosses

Use Bitwarden only on the person's own device and the planned *Kirjoita
näppäilyinä* flow. The server receives no vault database, master password or
vault-unlock key. Selected text travels through the human viewer input path,
not an agent tool call or chat; do not log it, persist the input field, or sync
it through the remote clipboard. This builds on the clipboard proposal, not a
second credential store.

Its honest boundary is **vault minimization**, plus clipboard hygiene. The
selected password is still exposed to the server's page, display/input path
and same-UID agent. The whole vault remains off-server only if the local device
and vault are not separately reachable through the agent's other grants.
Signing in entirely on the local device is the alternative when even one
password must not enter the agent-controlled server; it does not automatically
provide the server agent a logged-in session.

### Stronger server vault: a separate protected browser principal

A separate browser UID could protect profile files, memory and display from an
unprivileged agent UID, but **changing Chrome's UID alone is not enough**.
The browser host, Chrome, X server, cookies and raw CDP/VNC endpoints must all
sit behind the new boundary. If the existing same-UID daemon relays the human
view/input or holds a reusable browser capability, the agent can still observe
or impersonate that path. A separate profile, same-UID container, or a
same-user service is not the required boundary.

A design decision must assign an independently authenticated human viewer path,
a narrow agent command interface, account provisioning/lifecycle, file transfer,
and ownership of control transitions. Preserve per-person separation: never
put all people's vaults in one shared browser account. Do not give the agent
sudo, writable service definitions, raw CDP/VNC, or an equivalent escalation to
the browser principal. This is a new authority arrangement across gateway,
daemon and provisioning, requiring maintainer approval before implementation,
not a small browserhost patch.

Even then, a shared page with agent `eval` can retain preinstalled code and
read subsequently filled credentials. A truly private login requires a fresh,
protected browsing context with no inherited agent instrumentation and an
explicit policy for what authenticated capability is later shared. Separate
UIDs can protect the **unrelated vault**, not make arbitrary page automation
and secret autofilled values coexist magically. Sharing sessions may permit
account takeover actions and must be part of the threat model.

## Decisions for later review

These are recommendations, not approved authority changes:

- **Keep the full vault local by default.** Alternative: install it server-side
  with hygiene warnings. Reason: avoids exposing all credentials to an agent's
  existing OS authority, while using the already planned manual input flow.
- **Do not auto-install machine policy for one person's preference.** Alternative:
  administrator opt-in deployment. Reason: machine policy affects other Chrome
  users and adds lifecycle ownership without improving isolation.
- **Do not claim automatic lock on hand-back yet.** Alternative: a qualified
  extension integration after explicit approval. Reason: a setting or simulated
  click is not a verified lock acknowledgement.
- **Take strict server-vault isolation to a separate architecture decision.**
  Alternative: explicitly accept hygiene. Reason: human and agent presently
  share an OS principal; implementation cannot invent a different authority
  without approval. This research makes no such decision or product change.

## Proposed follow-up issues (not filed or scheduled)

1. **Deliver local-vault credential entry with an honest exposure notice**
   (`spinoff`). Coordinate with the existing clipboard work rather than duplicate
   it: typed input bypasses the remote clipboard, clears transient viewer text,
   never enters logs/chat, and tells the person the page/agent may read it.
   Validate synthetic credentials, control loss and disconnect/error behavior.
2. **Decide whether server-browser vault isolation warrants a separate principal**
   (`technical-decision`, only if server installation remains necessary).
   Choose hygiene versus a protected browser service; specify human authentication,
   per-person UID ownership, no raw debug/display delegation, and filled-secret
   versus session-sharing guarantees. Record approval before implementation.
3. **Qualify an opt-in Bitwarden server-browser hygiene mode** (`research`, only
   after explicit acceptance of its weaker level). Disposable Chrome profile and
   synthetic vault; test Web Store/policy install, extension target visibility,
   popup capture, short timeout/PIN settings, manual lock/give-back and stale
   commands. Determine whether a supported lock acknowledgement exists before
   proposing automation. No real credentials and no machine-wide policy change.

## Validation and limits

Documentation-only change; focused source review and adversarial self-review
are proportionate. No session, contract, daemon state or authorization boundary
was changed, so an independent implementation review was not required. Checked
especially the tempting but false claims that the CLI is the only CDP client,
that password masking prevents `eval`, and that Yama invariably permits memory
reads. No product tests, native Chrome/Bitwarden install, screenshot capture,
live ptrace/display inspection or real-account verification were run; these
are qualification work explicitly proposed above, not required evidence for
the source-based conclusion. No private installation evidence was collected.

Checks for this report: `git diff --check`,
`python3 scripts/validate-project-view.py`, and `issuectl doctor --json`.
All passed: Project View validated 14 pages; issuectl doctor reported no
findings. The initial close emitted an advisory about missing acceptance
criteria; a checked research-deliverable criterion was added through issuectl.

## Primary references

[1] Bitwarden, browser extension getting started; official store listing:
`https://bitwarden.com/help/getting-started-browserext/`
and `https://chromewebstore.google.com/detail/bitwarden-password-manage/nngceckbapebfimnlniiiahkandclblb`.

[2] Bitwarden, deployment using Linux policies:
`https://bitwarden.com/help/browserext-deploy/`.

[3] Chromium, Linux Quick Start (policy paths, administrator ownership, machine scope):
`https://www.chromium.org/administrators/linux-quick-start/`.

[4] Google, Linux extension policies (`ExtensionSettings` precedence):
`https://support.google.com/chrome/a/answer/7517525`.

[5] Chrome Developers, Changes to remote debugging switches to improve security:
`https://developer.chrome.com/blog/remote-debugging-port`.

[6] Chromium Extensions, official Chrome 137 announcement, 2025-04-04:
`https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY`.

[7] Chrome DevTools Protocol, upstream browser protocol (`Target`, `Page`):
`https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json`.
The live protocol definition is capability documentation, not a claim that all
experimental methods exist in every installed Chrome.

[8] Bitwarden, Autofill From Browser Extensions:
`https://bitwarden.com/help/auto-fill-browser/`.

[9] Bitwarden, Data Storage:
`https://bitwarden.com/help/data-storage/`.

[10] Bitwarden, key handling and locking/settings:
`https://bitwarden.com/help/security-faqs/`,
`https://bitwarden.com/help/understand-log-in-vs-unlock/`,
`https://bitwarden.com/help/vault-timeout/`,
`https://bitwarden.com/help/unlock-with-pin/`.

[11] Linux kernel, Yama:
`https://docs.kernel.org/admin-guide/LSM/Yama.html`.

[12] Ubuntu, Process and memory protections (ptrace scope):
`https://documentation.ubuntu.com/security/security-features/process-memory/`.
