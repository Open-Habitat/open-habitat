# Architecture sketch: OpenAI API key as Pi's own credential

Status: proposal for Jari, written with the settings prototype
(`design-system/prototypes/rounds/2026-10-15-asetukset/`, issue
`proto-settings-admin`). It is not an accepted ADR. Credential handling is
part of the security model, so the decision belongs to Jari.

## Summary

The key is a Pi credential like any other: it lives in the mapped user's
`~/.pi/agent/auth.json` under the provider `openai`, written by Pi's own
`AuthStorage` code running as that user, exactly as Pi's `/login` would
write it. The browser sends it once; nothing on the host keeps another
copy, and nothing returns it. Which credential a new conversation uses is
not a separate host setting. It is Pi's default provider: `openai-codex`
is the ChatGPT subscription, `openai` is the API key. The settings view
switches between them by writing Pi's default provider and model, the same
way the current model selector already does.

## Facts this rests on (Pi 0.85.1, the pinned version)

- `docs/providers.md`: API keys for OpenAI are stored in `auth.json` under
  `openai` as `{ "type": "api_key", "key": "sk-..." }`; the file is created
  `0600`; `auth.json` takes priority over `OPENAI_API_KEY`.
- `dist/core/auth-storage.js`: `modify(provider, fn)` and `delete(provider)`
  update one provider entry under a file lock and leave the others, such as
  the `openai-codex` OAuth record, untouched. `list()` returns only provider
  and type, without resolving key values.
- `dist/core/resolve-config-value.js`: a stored key is not necessarily a
  literal. A value beginning with `!` is **run as a shell command**, and
  `$NAME` / `${NAME}` are expanded from the environment, whenever Pi resolves
  the credential.
- The existing model helper (`internal/daemon/pi_models_helper.mjs`) lists
  only `openai-codex` models and writes the default with
  `SettingsManager.setDefaultModelAndProvider`.

## Write path

1. The browser posts `{ "provider": "openai", "key": "<value>" }` to a new
   `POST /api/v1/pi/credentials` over the authenticated session, with the
   usual Origin and CSRF checks. The gateway proxies it to the mapped daemon
   socket like other account writes; it does not parse the body, and its log
   records only route, outcome and user, as `proxy_linux.go` already does.
2. The daemon, running as the mapped user, validates the value as a literal
   key: `^sk-[A-Za-z0-9_-]{20,200}$`. This refuses `!` and `$` outright, so
   the value Pi later resolves is exactly the value the person typed. Without
   this check, a request that reaches this route (a stolen session, a CSRF
   gap, an XSS) becomes command execution as that user on the next Pi start.
3. The daemon runs an embedded Node helper, like the model helper, with the
   key on **stdin**, never in argv or the environment: argv is readable by
   other users in `/proc`, and the environment is inherited by children. The
   helper uses Pi's `AuthStorage.modify('openai', () => ({ type: 'api_key',
   key }))`, then reads back with `list()` that an `api_key` entry for
   `openai` exists. It prints only `{ "present": true }` or a fixed error
   code, never Pi's error text, which may contain the key.
4. Before writing, the daemon applies the same path checks as the device
   login (`pi_device_linux.go`): `~/.pi`, `~/.pi/agent` and `auth.json` are
   not symlinks, are owned by the UID, and have owner-only modes. An unsafe
   existing file refuses the write instead of being followed or rewritten.
5. On the first key, the daemon also sets Pi's default provider to `openai`
   with the model the person picks (the prototype keeps the same model id).
   Replacing a key does not change the default.

## Readiness and model selection need contract changes

Two existing host paths assume the subscription is the only credential, and
both must change with this feature:

- **Readiness gate.** The Pi status action (`pi_device_helper.mjs`) reports
  `missing` unless an `openai-codex` OAuth record exists, and the browser's
  first load (`App.tsx`) sends `missing` to subscription onboarding. An
  account with only an API key, for example one added over SSH with Pi's
  `/login`, would never get past it. The status reply should say per
  provider what is present (`openai-codex`: oauth usable/missing/unknown,
  `openai`: api_key present/absent), and the browser treats the person as
  ready when either supported credential is present. Pi onboarding then
  offers both routes: subscription sign-in or adding a key.
- **Model selection.** `POST /api/v1/pi/models` accepts only `{model}`, the
  helper matches by id alone after requiring `openai-codex` auth, and the
  returned models carry no provider. In Pi 0.85.1 every `openai-codex` model
  id also exists under `openai` (`gpt-5.4`, `gpt-5.5` and others), so an id
  cannot say which credential is meant. The update becomes
  `{provider, model}`, each listed model carries its `provider`, and the
  helper lists models for every supported provider whose credential is
  present, validating the selected pair against that list.

## What the browser and the contract see

- `GET /api/v1/pi/credentials` returns, per provider the host supports
  (`openai-codex`, `openai`), whether a credential is present and its type:
  `{ "openai": { "present": true, "type": "api_key" } }`. It is read with
  `list()`, so no key is resolved or loaded into the response path.
- No last four characters, no hash, no creation date. Pi stores none of
  these and producing a suffix means reading the key back into the
  response path. This is a question for Jari below.
- `GET /api/v1/pi/models` gains models for `openai` when a key is present,
  so `default_provider` already in the contract tells the browser which
  credential new conversations will use. The conversation details show the
  provider of that session's model, which Pi records in the session file.
- After saving, the input is cleared and the value is dropped from browser
  state; the DOM shows only "Avain tallennettu". It is never put in
  `localStorage`, drafts or the event stream.

## Switching and removal

- Switching between subscription and key is a write of Pi's default
  provider and model through the model helper with the `{provider, model}`
  pair above. Running conversations keep their own model and credential.
- Removal is `DELETE /api/v1/pi/credentials/openai`: the helper calls
  `AuthStorage.delete('openai')`, which leaves the `openai-codex` OAuth
  record in place. If Pi's default provider was `openai` and a subscription
  credential is present, the daemon sets the default back to
  `openai-codex` with Pi's default model for that provider. Without a
  subscription the default is left alone and the readiness gate sends the
  person to Pi onboarding. The host does not remember the earlier model;
  keeping that would be a second store of Pi settings.
- Conversations started with the key cannot continue after removal: Pi
  fails the next request with a missing-credential error, which the
  conversation shows like any provider error. Adding the key again restores
  them.
- Removing the key from the host does not revoke it at OpenAI. The
  confirmation text says so, because a leaked key must be revoked there.

## What does not change

- No host key store, broker, encryption layer or cache. The gateway never
  holds the key beyond the proxied request, and the broker is not involved.
- SSH and browser see the same credential: `pi` started over SSH by the
  same user uses the same `auth.json`, and a key added there with `/login`
  shows up in the browser as present.
- `OPENAI_API_KEY` in the daemon's environment would be used by Pi only
  when `auth.json` has no `openai` entry. The daemon should not set it.

## Risks

- **Command and environment expansion in Pi.** The main risk, covered by
  the literal-key check in the daemon. A test must prove that `!id`,
  `$HOME` and `${X}` are refused before any write. A later Pi version could
  add new reference syntax; the helper's existing pinned-version check
  (`0.85.1`) makes an upgrade a deliberate review point.
- **Secret in transit.** The key crosses TLS to the gateway and the Unix
  socket to the daemon, then a pipe to the helper. Any request logging,
  error envelope or crash dump on that path must not include bodies. The
  test sends a recognisable synthetic key and searches gateway, daemon and
  journal output for it.
- **Permissions of an existing `auth.json`.** Pi writes with `0600` but does
  not tighten an existing `0644` file (finding in `add-pi-device-adapter`).
  The pre-write check refuses such a file and tells the person what to fix.
- **Billing surprise.** An API key bills per use. The settings view says
  which credential new conversations use, and the conversation details show
  it per conversation.
- **Provider terms.** ADR 0016 notes that API-key billing is the
  commercially clean route compared with subscription sign-in; this sketch
  does not change that analysis.

## Questions for Jari

1. Is presence-only enough, or should the view show `sk-…abcd` so a person
   with several keys knows which one is stored? The suffix requires the
   daemon to read the key back and return part of it.
2. On removal while the key is the default, falling back to Pi's default
   subscription model (not the model used before the key) is proposed.
   Acceptable?
3. Other providers (Anthropic, OpenRouter) would follow the same pattern by
   adding their provider id to an allowlist. Keep OpenAI only for now?
