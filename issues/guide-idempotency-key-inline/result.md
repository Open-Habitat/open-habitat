# Guidance keeps the idempotency key: implemented

The agent guide (`internal/daemon/host-context.md`), the agent skill
(`open-habitat skill print agent`) and the `--idempotency-key` help of
`agent notice create`, `agent view offer` and `agent file offer` now:

- make the key before the command and print it
  (`KEY=$(cat /proc/sys/kernel/random/uuid); echo "key $KEY"`), because each
  bash call's shell forgets its variables and the printed key is what a later
  retry can still use;
- pass that same printed key, with the same content, to retry the same card;
- check `notice list --current`, `view list` or `file list` first after an
  uncertain result (timeout, no reply);
- name `data.result.notice.persistence` for notices and
  `data.result.offer.persistence` for both offers.

The help examples remain literal argv (they are rendered as JSON `argv`
arrays, so a shell variable cannot appear there); the key-keeping instruction
sits in each of the three commands' `--idempotency-key` flag description. The
guide grew by about 440 bytes (2 %).

## Verification

- `TestHostContextKeepsIdempotencyKeys`, `TestAgentSkillKeepsIdempotencyKeys`
  and three new cases in `TestAgentHelpDescribesProcessLifetimeAndCommandSpecificIO`
  pin the guidance and refuse an inline `$(...)` key or `--idempotency-key UUID`.
- `scripts/test-focused.sh --area go --go-package ./internal/cli` and
  `--go-package ./internal/daemon` passed.
