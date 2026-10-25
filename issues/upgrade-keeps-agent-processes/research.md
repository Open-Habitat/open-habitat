# Upgrades that do not kill running agent processes: research and recommendation

## Jarin yhteenveto

1. Nyt jokainen päivitys katkaisee selain-Pi:n keskustelut: Pi on daemonin lapsi, ja daemonin pysäytys tappaa koko sen cgroupin, myös bash-työkalusta käynnistetyt prosessit ja tmux-palvelimet.
2. Selainpäätteet ja Taskfleet-workerit asuvat henkilön omassa systemd-käyttäjämanagerissa ja selviävät daemonin uudelleenkäynnistyksestä. Testipalvelimella ne selviävät myös oikeasta päivityksestä.
3. Birchn päivitys (tuotteen oma `host upgrade`) on pahempi: se pysäyttää jokaisen tilin *kaikki* käyttäjäpalvelut, myös selainpäätteen, Taskfleet-workerit ja Fleetrepon ajastimen.
4. Lisäksi se yrittää sen jälkeen käynnistää ne uudelleen, eikä se onnistu `systemd-run`-yksiköille. Jos Birchn päivityksen aikana on käynnissä yksikin Taskfleet-ajo tai selainpääte, päivitys jää kesken suljettuun tilaan. Toistin tämän testipalvelimella.
5. Tämä rikkoo myös 19.10. tekemäsi päätöksen, että pääte ja editori elävät daemonin uudelleenkäynnistysten ja päivitysten yli.
6. Suositus 1 (pieni, ennen seuraavaa Birchn päivitystä): `host upgrade` pysäyttää vain tuotteen järjestelmäyksiköt eikä koske käyttäjämanageriin. Workerit, päätteet ja SSH-tmux jatkavat vanhalla, muuttumattomalla generaatiollaan.
7. Suositus 2 (arkkitehtuuri, sinun päätöksesi): jokainen Pi-keskustelu ajetaan omana käyttäjäyksikkönään pienen pitäjäprosessin (`pi-host`) alla, ja uusi daemon kytkeytyy siihen uudelleen. Silloin käynnissä oleva vuoro jatkuu päivityksen yli, ja selaimessa näkyy vain hetken katko.
8. Automaattista "jatka"-viestiä katkenneelle vuorolle en suosittele: katkennut `run wait` on voinut jo palata, ja agentti on voinut aloittaa jotain muuta.
9. Ennen suositusta 2 pitkäkestoinen kapellimestari kannattaa ajaa Birchn selainpäätteessä tai SSH-tmuxissa (Claude Code tai `pi`), ei selain-Pi:ssä, jos päivitys ei saa katkaista sitä.
10. Testipalvelimella jokainen tuotemuutoksen push katkaisee testaajien käynnissä olevat selain-Pi-vuorot (noin 5–15 minuutin välein aktiivisina päivinä). Sama korjaus auttaisi siihenkin.

Research date: 2026-10-25. Product inspected at `46a05063` (worktree base);
test server on pilot.412 (`d72d588f`), Birch on 0.1.0-pilot.11. For
`upgrade-keeps-agent-processes`; the issue stays open. **Recommendation only:
Jari decides before an ADR or implementation.** The recommendation was reviewed
by GPT Astra (`gpt-6-astra`); its corrections are folded in (section 5).

## 1. Where the processes live

The per-user daemon is a system unit
([systemd/open-habitat-daemon@.service](../../systemd/open-habitat-daemon@.service)):
`User=%i`, `KillMode=mixed`, `PrivateTmp=yes`, `NoNewPrivileges=yes`,
`Restart=on-failure`. `internal/daemon/pi_rpc_linux.go` starts each Pi
conversation as the daemon's direct child, in RPC mode over stdin/stdout pipes,
with `Pdeathsig: SIGKILL` and its own process group. Pi's process directory
(`oh-process-*`, the processes bridge socket and the host-context extension) is
in the daemon's private `/tmp`. Integration sync clients (rclone loops) are also
daemon children.

The browser shell's tmux server (`internal/daemon/terminal_linux.go`) and the
workspace editor (`editor_linux.go`) are started with
`systemd-run --user --collect --unit=open-habitat-tmux|open-habitat-editor`
when the account lingers and its user manager runs. Otherwise they fall back
to daemon children. Taskfleet starts its supervisors
(`taskfleet-supervise-*.service`) and its worker tmux servers
(`taskfleet-tmux-*.service`) the same way, as transient user services. tmux
3.4 puts every pane in its own `app-tmux.slice/tmux-spawn-*.scope`.

**Birch, read-only, 2026-10-25 (account `maintainer`, UID 32000):**

| Process | cgroup |
| --- | --- |
| Browser conductor Pi (PID 629034, parent = daemon 40188, separate mount namespace) | `system.slice/system-open\x2dhabitat\x2ddaemon.slice/open-habitat-daemon@maintainer.service` |
| Its five `taskfleet run wait <id> --check-in 45m` bash-tool calls | same daemon cgroup |
| Taskfleet supervisors (5) | `user@32000.service/app.slice/taskfleet-supervise-<run>-<node>.service` |
| Taskfleet worker tmux server | `user@32000.service/app.slice/taskfleet-tmux-30c4…-….service` |
| Worker shells, Pi and Claude Code, and their tool children | `user@32000.service/app.slice/app-tmux.slice/tmux-spawn-<uuid>.scope` |
| Browser shell tmux server | `user@32000.service/app.slice/open-habitat-tmux.service` |

This research worker itself runs in
`…/app-tmux.slice/tmux-spawn-92dbadc6-….scope` under that Taskfleet tmux
server. Nothing on Birch was restarted.

## 2. What a daemon restart and an upgrade do

### Test server, synthetic probes

On `open-habitat-test-nbg1`, as root over Alder's pinned SSH route, I placed
synthetic `sleep` probes (argv renamed `oh-probe-*`) under the disposable test
account `maintainer` (UID 21032). No conversation content was read and no
model turn was run. A real conversation's bash-tool child is modelled by moving
a detached process into the daemon cgroup, which is where every Pi descendant
lands. Probes:

- P1, a detached long-lived child in the daemon cgroup;
- P1b, a tmux server and pane started from inside the daemon cgroup (Taskfleet
  or tmux started from a conversation);
- P2, the browser shell: `open-habitat-tmux.service` started with the daemon's
  exact `systemd-run` arguments, with a pane in a `tmux-spawn-*.scope`;
- P3, a transient user service (`systemd-run --user --collect`, the Taskfleet
  supervisor shape);
- P4, a user scope (`systemd-run --user --scope`).

**(a) `systemctl restart open-habitat-daemon@maintainer.service`** (18:16:08Z,
5.0 s; daemon MainPID 921253 → 924658):

```text
systemd[1]: Stopping open-habitat-daemon@maintainer.service ...
systemd[1]: open-habitat-daemon@maintainer.service: Killing process 923653 (sleep) with signal SIGKILL.        # P1
systemd[1]: open-habitat-daemon@maintainer.service: Killing process 923686 (tmux: server) with signal SIGKILL. # P1b
systemd[1]: open-habitat-daemon@maintainer.service: Killing process 923687 (sleep) with signal SIGKILL.        # P1b pane
systemd[1]: Started open-habitat-daemon@maintainer.service ...
```

P2 (tmux server and pane), P3 and P4 survived with unchanged PIDs and cgroups.
`KillMode=mixed` sends SIGTERM to the daemon alone and then SIGKILLs whatever is
left in its cgroup. Setsid, nohup or double forking does not help, and a real
Pi would die even earlier from its `Pdeathsig`.

**(b) A real watcher install**, pilot.412 → pilot.413 (`94e113fe`), installed by
the Alder watcher at 18:43Z with status `verified`. Probes were placed again
after (a); nothing was pushed for this:

```text
18:43:01 systemd[1]: Stopping open-habitat-daemon@maintainer.service ...
18:43:01 systemd[1]: ...: Killing process 924977 (sleep) with signal SIGKILL.        # P1
18:43:01 systemd[1]: ...: Killing process 925003 (tmux: server) with signal SIGKILL. # P1b
18:43:01 systemd[1]: ...: Killing process 925004 (sleep) with signal SIGKILL.        # P1b pane
18:43:01 systemd[1]: ...: Killing process 928214 (sleep) with signal SIGKILL.        # sync-client loop child
18:43:01 systemd[1]: ...: Killing process 928336 (sleep) with signal SIGKILL.        # sync-client loop child
18:43:01 systemd[1]: Closed open-habitat-daemon@maintainer.socket ...
18:43:09 systemd[1]: Started open-habitat-daemon@maintainer.service ...             # MainPID 924658 → 930044
```

After the install, P2 (tmux server 924480 and pane 924484 in
`tmux-spawn-d8e0….scope`), P3 (924096, `oh-probe-svc.service`) and P4
(924251, `oh-probe-scope.scope`) were still running with the same PIDs and
cgroups. All probes were then removed, and the browser-shell server that I had
started was stopped again, because none had been running before. Raw output is
in the worker's scratch directory and is not committed.

**(c) The product upgrade's user-unit steps**, replayed on separate probes (a
transient tmux service with a pane in its own scope, and a transient service):

```text
--- before
925268 /usr/bin/tmux -D -S /var/tmp/oh-probe-tm <user@21032>/app.slice/oh-probe-tmux2.service
925272 oh-probe-c-pane 86400  <user@21032>/app.slice/app-tmux.slice/tmux-spawn-7b44….scope
925276 oh-probe-c-service 86400  <user@21032>/app.slice/oh-probe-c-svc.service
stop rc=0                                      # systemctl --user stop -- <units>, as quiesce() does
--- after stop
(none survive)                                 # the pane in its own scope died with its server
start: Failed to start oh-probe-tmux2.service: Unit oh-probe-tmux2.service not found.
start: Failed to start oh-probe-c-svc.service: Unit oh-probe-c-svc.service not found.
start rc=5                                     # systemctl --user start -- <units>, as activate() does
```

### Two upgrade paths, two behaviours

The test server and Birch do not upgrade the same way.

- **Test server:** Fleetrepo's `infra/open-habitat-test/release_fresh_next.py`
  `stop()`/`start()` stop and restart only the system product units: revoke,
  gateway, broker and every `open-habitat-daemon@`/`-agent@` instance. It does
  not touch the user managers. So an install cuts the daemon cgroup and leaves
  the browser shell and Taskfleet running, as observed in (b). Each install also
  restarts the gateway, which drops every browser connection.
- **Birch:** the product's `host upgrade` (`internal/host/upgrade_native_linux.go`).
  `observeUpgradeWork` → `userServices` lists **every** active
  service/socket/timer/path unit of every account's user manager except D-Bus.
  `quiesce` stops each daemon and then runs `systemctl --user stop --` on that
  whole list. `activate` runs `systemctl --user start --` on the same list.
  `verify` requires exactly the same set to be active again. pilot.11's
  upgrade preview on Birch (Alder
  `/var/tmp/agent-keep/birch-pilot11-01m5rsmv/upgrade-preview.json`) listed
  for `maintainer`: `dirmngr.socket`, `gpg-agent*.socket`,
  `gpg-agent.service`, `fleetrepo-agent-converge.timer`, `keyboxd.socket`,
  `launchpadlib-cache-clean.timer`, `pk-debconf-helper.socket` and
  `snapd.session-agent.socket`. It needed `--approve-interruption` because the
  daemon was live, even though no conversation was busy.

Today the same list on Birch would also contain `open-habitat-tmux.service`,
the five `taskfleet-supervise-*` services and `taskfleet-tmux-*`. From (c) it
follows that `host upgrade` would kill every Taskfleet worker and browser
shell. Its `activate` would then fail with `ErrNativeApply` after the selectors
had already switched, and `verify` could never pass, because those units no
longer exist. The documented recovery is same-input fix-forward, and that
cannot succeed either. This is a defect beside the design question, and the
first follow-up below fixes it. (This conclusion comes from the code plus the
replayed steps in (c). I did not run a real `host upgrade` with live transient
units; the test server is not installed by the product's apply, so it cannot
run one.)

`docs/operations.md` says "Native SSH/tmux sessions outside the product daemon
and recorded user services are not killed". The code stops the recorded user
services, so the sentence is wrong for them. It also contradicts the decision
behind `broker-enable-linger` (Jari, 2026-10-19, `research-shell-editor`
decision 2): tmux and the editor run as `systemd-run --user` services "that
outlive daemon restarts and upgrades".

SSH logins (`session-N.scope`) and their tmux are not in the inventory and are
not stopped by either path.

## 3. What an in-flight turn experiences today

From the code, not from a cut browser turn. I ran no model turn.

- Pi receives SIGKILL with the daemon, so the reply being streamed is lost.
  Native history keeps what Pi had already written to its session file (whole
  messages and tool results). A tool call that was running has no result.
  Everything the tool started is killed with the cgroup (2a).
- The gateway also restarts on every upgrade, so the browser loses its
  connection and reconnects. The new daemon's event journal starts from
  scratch and the browser resnapshots, as after any gap.
- The conversation is idle after the restart. It does not continue by itself.
  Background processes that `pi-processes` saw start and never saw end are
  listed as "Katkesi palvelimen uudelleenkäynnistyksessä"
  (`process_interrupted_linux.go`, reason `server_restart`; `processes.ts`).
  The person's next message carries the catch-up message
  (`oh-resume-catch-up`), which tells the agent which processes were cut. For a
  `taskfleet run wait` it includes the run IDs, so the conductor can wait again.
- Ordinary foreground bash-tool calls are not tracked as processes. Their loss
  shows only as a missing tool result.
- Taskfleet workers in the user manager keep running through a daemon restart
  and, on the test server, through an install. A conductor that is told to continue
  can reattach to them with `taskfleet run wait`. On Birch today they would die
  too (section 2).

## 4. Options

| Option | What survives an upgrade | Boundary and operator | Cost |
| --- | --- | --- | --- |
| **A. `host upgrade` leaves user managers alone** | Workers, browser shells, editor, SSH and Taskfleet; not browser Pi | Unchanged. Same-UID user units hold no product authority. The fence still closes product entry. Daemon work still needs `--approve-interruption`. | Small: remove the user-unit stop, start and exact-set verify; inventory reports them as left running. |
| **B. Per-conversation Pi holder in the user manager** (`open-habitat-pi-<id>` running `open-habitat pi-host`) | Also in-flight Pi turns and their tools | Same UID, no new authority. The daemon checks the holder by `SO_PEERCRED` and the socket's trusted directory (`udssecure`). Unit names are not proof. Hardening is reapplied per unit. | Large: lifecycle, reattach protocol and compatibility across generations |
| C. Automatic resume of turns cut only in `run wait` | Nothing; re-executes | Agent action without the person | Small, but **unsafe** (section 5) |
| D. Drain: wait for idle turns before stopping | Short turns only | Unchanged | Small, but a conductor's turn never goes idle |
| E. `KillMode=process` plus systemd FD store handover to the new daemon | Pi in the old unit's cgroup | A restarted unit with leftover processes. Old and new main split across PrivateTmp namespaces. The operator's adoption proof (MainPID) and quiescence become unclear. | Medium, fragile; rejected |
| F. Pi under tmux or dtach | Pi as a TUI only | — | RPC framing and acknowledgements do not fit a terminal; rejected |

B in more detail. The daemon starts `systemd-run --user --collect
--unit=open-habitat-pi-<id> -p NoNewPrivileges=yes -p UMask=0077 --
<generation>/open-habitat pi-host …`. The holder listens on a mode-0600 socket
in `/run/user/<uid>/open-habitat/pi/` and receives the ownership flock and
workspace descriptor from the daemon by `SCM_RIGHTS`. It then starts Pi with
pipes, as `launchPiRPCSession` does today, and owns the process directory and
bridge socket that now live in the daemon's private `/tmp`. It keeps draining
Pi's output while no daemon is attached. A new daemon finds holders from that
directory, which is native filesystem state and not a new registry. It
reattaches with a cursor and rebuilds conversation state from the holder and
Pi's native history. The browser resnapshots as after any event gap. The
upgrade operator leaves the holder units running, as in A. A holder runs its
own generation's binary until its conversation ends; the next launch uses the
new generation.

Lingering and a running user manager are already the precondition for shells
and the editor (`terminalHost.survives`). Without them B falls back to today's
daemon children.

## 5. Recommendation

1. **Do A before the next Birch upgrade.** It fixes the stuck-upgrade defect,
   restores the 2026-10-19 decision and keeps Taskfleet workers alive. Also
   correct the `docs/operations.md` sentence. Keep requiring interruption
   approval for live daemons and report their active turns as today. User
   services alone no longer require it.
2. **Until B exists, run the conductor where an upgrade cannot reach it** if a
   Birch upgrade must not cut it: Claude Code or `pi` in the browser shell or
   SSH tmux. A browser Pi conductor is cut and needs a "jatka" message after
   each upgrade. Its workers survive.
3. **Decide B as the architecture** for in-flight turns. It is the only option
   in which a running turn continues, and it also makes daemon crashes and
   test-server pushes harmless to running turns.
4. **Do not build C.**

GPT Astra's review (`gpt-6-astra`) agreed with A and B and corrected the
following, which this report adopts:

- **A** must also drop the exact-set verification, because surviving workloads
  legitimately start and stop units during the upgrade. It is not a universal
  no-interruption promise: later executions through `current`, the profile
  links or `PATH` see the new generation, and `installRuntimePackages` runs
  host apt. Old editors and agents keep old code, so a security fix may still
  need an explicitly disruptive upgrade.
- **B** is a correctness protocol, not buffered output. Command acceptance
  frames must not be dropped while no daemon is attached, an ambiguously
  accepted prompt must never be resent, and a disconnected holder is never an
  abandoned conversation: no second Pi writer may start beside it.
  Compatibility must cover every still-live holder protocol, not one release,
  because a conductor can outlive dozens of test-server pushes. Otherwise the
  upgrade must require interruption explicitly instead of silently killing.
  Daemon disappearance must stop implying Pi death in `server_restart`
  inference. Under the fence, surviving agents see product API failures and
  must not read them as "nothing happened".
- **C** is unsafe because the cut wait may already have returned and the agent
  may have started a consequential action. The process scan is not a complete
  execution ledger.

Open questions for B: whether `PrivateTmp`/`ProtectSystem` work in user units
on Ubuntu 24.04 (they need user namespaces, which AppArmor restricts by
default). `PrivateTmp` is isolation hygiene, not the cross-user boundary.
Another is whether Pi itself should one day listen on a socket and make the
holder unnecessary.

## Proposed follow-up issues (not filed)

1. `host-upgrade-leaves-user-units`: stop/start/verify only product system
   units; report user units as left running; fix the operations guide; a test
   with transient units active.
2. `pi-host-holder`: ADR and implementation of option B (holder,
   reattach protocol, multi-generation compatibility, hardening check on
   Ubuntu 24.04), after Jari's decision.
