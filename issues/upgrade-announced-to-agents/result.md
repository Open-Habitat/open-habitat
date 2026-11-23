# Result

Implemented on 23.11.2026 as [design.md](design.md) describes, with Jari's two
answers (two-minute default lead; cut turns woken after any graceful restart).
The investigation behind the texts is in [stop-behaviour.md](stop-behaviour.md).

## What was built

- **Host and CLI.** `host upgrade` gains `--lead-time` (1m–60m, default 2m) and
  `--immediate`. Neither grants an approval. The countdown runs in the
  immutable successor owner after staging and requalification, under the
  operation lock, before the journal records the operation. A begun operation
  that never recorded quiescing intent counts down again on retry. At the
  deadline only the cheap local facts are rechecked (the input binding and,
  without `--approve-interruption`, whether a daemon is active per systemd);
  nothing waits for an agent. The JSONL stream emits `phase: "announced"` with
  the schedule as soon as it is published. The result carries `announcement`
  (mode, lead, state, schedule ID, UTC deadline, `reach`) apart from `outcome`.
- **Advisory record** (`internal/upgradenotice`, `/opt/open-habitat/upgrade-notice.json`).
  It is root-owned, 0644 and versioned. It holds the schedule ID, revision,
  target version, announcement time, deadline, state and renewal time, and
  names no account or conversation. The owner renews it every 10 s. It
  withdraws the record when cancelled or failing before the stop, and removes
  it once the stop has begun. A reader trusts it only when it is root's
  regular file with one link, in root-owned directories that only root can
  write, and strictly parsed. A record not renewed for 45 s reads as
  `unknown`, never as "restart now".
- **Daemon.** It watches the record (inotify plus a 5 s reread) and hands an
  announced schedule to each live, person-started Pi it runs, through the
  companion op `upgrade_notice`.
  - A running turn is steered.
  - An idle agent with live process-tool processes gets a short turn, with
    those processes listed.
  - An idle agent with nothing to lose holds the announcement and gets it as
    a steer if a turn starts before the deadline.
  - A resting conversation is not started.
  - An announcement counts as told only when Pi gives it to the model
    (`message_end`). A steer that a long tool holds is `queued` and is
    reported as not delivered.
  - A withdrawal takes back held announcements.
  - The work census reports reach, and the snapshot carries `upgrade` for the
    banner.
- **Wake of a cut turn.** After any graceful daemon restart, a conversation is
  woken with the reason `turn_cut` when its branch ends in a turn cut by the
  daemon's own stop: an `oh-restart-stop` mark followed by an aborted or
  unfinished turn. The wake carries the daemon's version. The person's stop,
  a catch-up already given, archive, read-only history, a non-browser origin,
  the 24 h horizon and the cooldown all rule it out, as for today's wakes.
  The companion's catch-up variant is design.md's post-restart text.
- **Contracts.** `snapshot.upgrade`, `history.upgradeNotice` (and its event
  field), `restart.woke: turn_cut`, and `agent-work.upgrade_notice`.
- **Web.** A non-modal page banner shows the countdown in local time. The
  banner changes to "Päivitys alkaa" at the deadline, never "complete", and it
  keeps the last schedule through the downtime. It shows "peruttiin" when the
  upgrade is cancelled and "ei tiedossa" when the owner is lost. Drafts and
  sending are untouched. A conversation shows Habitat's line where its agent
  was told, and the rest card shows the new wake reason.
- `docs/operations.md`, the operator skill, `CHANGELOG.md` and a rule in
  `internal/AGENTS.md` describe the read-only host-to-daemon signal.

## Text changes from design.md, and why

- `{deadline}` is given as HH:MM UTC only. The daemon does not know the
  person's time zone; the browser banner shows local time.
- The announcement says "minute" or "minutes" to match the number.
- The idle variant is the full announcement with the list of processes that
  will be killed inserted after the first paragraph. The rest of the guidance
  applies to an idle agent too.
- In the post-restart text, the "as today" lists are indented under their
  bullet. A rearm hint replaces today's separate paragraph.

## Decisions for later review

- Flag names are `--lead-time <duration>` and `--immediate`.
- No reschedule command exists. A new attempt is a new schedule ID with a full
  lead, and the revision stays 1. The field is kept so that a later reschedule
  needs no format change.
- A cancelled countdown does not tell the agents that already heard about it.
  Nothing restarts, and the text already tells them to keep working.
- A withdrawn record or one with a lost owner is shown for 15 minutes, then
  read as no schedule.
- Recap-only helper Pis are not told.
- "Not persisted" is not reported separately. A failed native write stops Pi
  through the companion's existing write guard, and that conversation then
  counts as not delivered.
- Reach comes from the stop's own census, taken after entry closes and before
  the daemons stop. If the stop fails before taking it, reach is reported as
  unknown (absent), not as zero.

## Review

An independent `/llm-review` used gpt-6-astra as finder and claude-fable-5-2
as verifier, followed by `/assess-findings`. It found four defects, all
confirmed and fixed:

1. Wake eligibility survived a person's stop or a catch-up.
2. A full requalification ran after the deadline.
3. A retry after a failure before the stop skipped its announcement.
4. Queued steers were counted as told.

The verifier also found two regressions in the first fix, both fixed: a
cancelled countdown left an operation in the journal, and the consent check
was lost before entry closes. One uncertainty remains: an aborted tool batch
may still drain the steer, which can count a notice as told when the model
never answered it. This affects only the count.

## Verification

All tests run under `umask 077`.

- `./scripts/test-focused.sh --area go` passed for `internal/host`,
  `internal/cli`, `internal/upgradenotice` and `internal/daemon` (full
  package).
  - `TestAgentConversationControls` failed once with `writer_conflict` under
    load. It passed three times alone, and in the next full run.
- `node --test internal/daemon/pi-device-test/*.test.mjs`: 160 passed.
- `scripts/validate-contracts.py` passed, and `scripts/check-generated.sh` is
  clean.
- `./scripts/test-focused.sh --area web`: 264 files and 2227 tests passed.
- Browser specs `upgrade-notice` (new), `rest-card` and
  `rail-interrupted-turn` passed.
- `python3 scripts/validate-project-view.py` passed.
- No systemd unit or socket changed, so no installation-tooling change and no
  `verify-release.sh` run.

Covered with synthetic users and fakes:

- Countdown order, cancellation, withdrawal, removal after the stop, and a
  retry after a cancelled or failed countdown.
- A daemon started during the lead.
- Stale inputs at the deadline.
- Reach from the census.
- Record trust checks: owner, mode, directory, symlink, hard link and strict
  parsing.
- Delivery once per revision, the held and queued outcomes, withdrawal,
  unknown owner, and no start of resting conversations.
- The cut-turn wake, and no wake for finished or person-stopped
  conversations.
- The catch-up texts.

## Live check

Not done here, and it needs a person:

- A real predecessor-to-successor upgrade on the test server.
- A native Pi showing a steer reaching a running model.
- A distinct-UID check that no mapped user can write the record. The trust
  checks are unit-tested; `agent.sock` was not touched.

The first upgrade into this release cannot announce, because its
predecessor's daemons do not read the record. That upgrade already gets the
cut-turn wake. The release after it shows the whole feature. Steps are in
KOKEILTAVAA.md under "Päivityksen ennakkoilmoitus".
