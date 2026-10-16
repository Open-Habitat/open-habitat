---
created: 2026-10-15
updated: 2026-10-16
type: feature
reporter: jari
status: done
priority: normal
lane: pi-runtime
lane_seq: 4
collision: [internal/daemon, contracts/v1, web/src/app/]
preparation: ready
blocked_by: ['@implement-settings-osiot']
closed: 2026-10-16
closed_by: agent
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

- [x] Account settings let the person add, replace and remove an OpenAI API key;
      the key never appears in responses, logs or the DOM after saving.
- [x] Pi uses the key for a new conversation (disposable native-home fixture
      with a fake provider); removal returns Pi to its previous sign-in state.
- [x] Which provider credential a conversation uses is visible in its details.

## Decisions

### 2026-10-16T04:09:18Z · @jari

Jari 2026-10-16: architecture.md accepted. The key is Pi's own auth.json entry, written by the daemon as the mapped user, with no host store. The UI shows sk-…abcd.
