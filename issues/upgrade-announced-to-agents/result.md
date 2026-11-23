# Design result

Revised on 23.11.2026 to Jari's decisions of that day. Two parts:

- [stop-behaviour.md](stop-behaviour.md) records what an upgrade's daemon stop does to a
  person's main agent: its Pi, turn, history, background processes started in each way,
  `/tmp` and `/var/tmp`, and what the agent can find and sees after the restart.
  Each row names the code path or the experiment behind it.
- [design.md](design.md) is revised to the decisions. The announcement goes only to
  the agents of person-started conversations, two minutes ahead by default. There is no
  worker or other-harness machinery. The pre-stop and post-restart texts are written out in full.
  Turns cut by the stop are woken after the restart, and idle conversations are not.
  The operator path, the fixed deadline, the advisory record and the failure behaviour are kept from the earlier design.
  Two questions remain for Jari.

No product code, contract, service or harness changed. `preparation` is back to
`pending`: implementation waits for Jari's approval of the revised design.

## Key findings

- Everything the agent starts from its own tools dies at the stop, however it is
  detached (`&`, `nohup`, `setsid`, `tmux`). `KillMode=mixed` kills the daemon's
  whole cgroup. Only work under the user manager survives: Taskfleet, the shell tab,
  SSH, scheduled wakes, and `systemd-run --user`. From Pi, `systemd-run --user` needs
  `XDG_RUNTIME_DIR=/run/user/$(id -u)`, because the daemon does not pass it.
- `/tmp` is lost. `/var/tmp` is kept, but a user unit sees the host's `/var/tmp`, not
  the conversation's, so shared logs belong under the home directory.
- After the restart the process tool's list is empty. The catch-up names the cut-off
  process-tool processes.
- Today a turn cut mid-work is not woken. Only cut-off waits wake. The
  `oh-restart-stop` mark already exists, so the new wake can work from the first
  upgrade into a release that has it.

## Decisions taken in the revision

- **Who is told:** a running turn by steering; an idle Pi only when it has live
  process-tool processes; a Pi started during the countdown in its first turn; no one else.
  An idle agent with nothing running would lose nothing and is not woken, so a message
  would only cost a turn.
- **Wake rule:** an `oh-restart-stop` mark followed by an aborted or unfinished turn,
  within today's wake bounds (person stop, archive, read-only history, browser origin,
  24 h, cooldown, live limit). The wake applies to every graceful restart, which is
  question 2 for Jari.
- **Default lead two minutes,** for Jari's "a couple of minutes". This is question 1.
- **Kept:** the operator-owned `host upgrade` countdown with a fixed deadline and no
  extension; the read-only advisory record as the one new host-to-daemon signal; the
  receiver-first rollout (the announcement starts from the second upgrade, the wake from the first);
  the failure table.
- **Dropped:** the worker adapter, the coverage accounting for unsupported harnesses, and
  agent-created resume wakes. The automatic wake of cut turns replaces them.

## Verification

The experiment ran in a throwaway transient system unit with the daemon unit's process
and tmp properties, on the agent host. No Habitat service was restarted, and the
experiment's units and processes were removed afterwards. No real upgrade was run, and
no daemon was restarted with a live Pi. The Pi-internal rows rest on code and the
existing native tests. Logs are in `/var/tmp/agent-keep/upgrade-announced-to-agents/`.
Validators: `python3 scripts/validate-project-view.py` (13 pages), `issuectl doctor --json`
(no findings) and `git diff --check` passed.
