---
created: 2026-10-15
updated: 2026-10-15
type: feature
reporter: jari
status: open
priority: normal
lane: agents
lane_seq: 2
collision: [internal/daemon, contracts/v1, web/src/app/]
preparation: pending
---

# Use an API key instead of the ChatGPT subscription

Jari, 2026-10-15: a person can run Pi with a provider API key (OpenAI first)
instead of the ChatGPT subscription sign-in.

Conductor's recommendation, awaiting Jari's agreement (credential handling is
part of the security model): the key is Pi's own native credential. The
browser sends it once over the authenticated connection, the daemon running as
the mapped user writes it where Pi itself keeps API keys (Pi's `auth.json` or
its documented mechanism) with the same file permissions, and nothing else
stores, logs or returns it. The browser only shows whether a key is present and
lets the person replace or remove it. No host-level key store or broker.

## Acceptance Criteria

- [ ] Account settings let the person add, replace and remove an OpenAI API key;
      the key never appears in responses, logs or the DOM after saving.
- [ ] Pi uses the key for a new conversation (disposable native-home fixture
      with a fake provider); removal returns Pi to its previous sign-in state.
- [ ] Which provider credential a conversation uses is visible in its details.
