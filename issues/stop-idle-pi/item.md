---
created: 2026-10-19
updated: 2026-10-19
type: improvement
reporter: jari
status: open
priority: high
lane: pi-lifecycle
lane_seq: 2
collision: [internal/daemon/pi-lifecycle]
preparation: ready
---

# Stop idle Pi processes after an idle period

Jari, 2026-10-19 (after `idle-pi-holds-slots` landed): "Minusta niitä vanhoja tarpeettomia, mitään tekemättömiä Pi-prosesseja pitäisi sulkea." Today an idle Pi only yields its slot when a fifth conversation needs one, or stops on archive; otherwise idle Pi processes stay alive indefinitely (on pilot.231 four lived over an hour, using memory).

The daemon should stop a conversation's Pi process after it has been idle for a while: no turn in progress, no queued input, no live process the agent started through the processes tool, no spinoff wait or other pending work the busy definition from `idle-pi-holds-slots` covers. The next message resumes lazily as today, so the person loses nothing. Choose the idle period (suggestion: 10 minutes) and record it; stop gracefully (as archive does), never kill a busy Pi, and keep it observable in the daemon log.
