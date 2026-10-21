---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: open
priority: normal
lane: agent-cli
lane_seq: 1
collision: [internal/daemon/host-context]
preparation: ready
size: S
---

# Agent does not know it can leave a notice with open-habitat agent notice create

## Description

Jari 2026-10-21 on the test server: asked the agent 'jätä minulle muistutus tähän keskusteluun'; the agent wrote the reminder into its reply and said it cannot schedule reminders. It did not use 'open-habitat agent notice create'. Likely cause (conductor): internal/daemon/host-context.md tells the agent only about 'agent environment show' and 'agent conversation show'; the notice command (and other agent CLI commands from ADR 0027) are not mentioned, so the model has no way to know. Fix so the agent discovers the agent CLI's capabilities natively and uses notices when asked for a reminder/notice; verify with a real Pi turn in the lab if feasible. Screenshot: /var/tmp/oh-shots/notice-unknown.png on Alder.
