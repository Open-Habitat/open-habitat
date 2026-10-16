# HTTP API

The browser reads native work, sends commands and follows changes through the
same-origin HTTPS gateway. The gateway handles web sessions itself and routes
native operations to the signed-in person's daemon. The daemon interprets those
operations and returns their results. This keeps browser authentication separate
from access to native files and processes.

```mermaid
flowchart LR
  B["Browser"] -->|"login and session requests"| G["Gateway"]
  B -->|"native reads, commands and event connection"| G
  G -->|"session selects the user's socket"| D["User's daemon"]
  D -->|"JSON replies and SSE events"| G
  G -->|"results"| B
```

## Requests and responsibilities

Native reads use `GET`; native writes use `POST` or `DELETE`. Gateway-owned
administrator changes to server settings and storage limits use `PUT`. The
gateway checks the session cookie and, for writes, the configured origin and
session's CSRF header.
It checks the route and bounds the request before forwarding it. The daemon
validates native operation inputs. [Identity and trust](identity-and-trust.md)
explains how the session selects the daemon and how the socket peers are checked.

JSON replies carry finite results. Server-Sent Events (SSE) carry the user's
ongoing updates and, separately, progress within a clone request. The gateway
forwards native daemon replies without interpreting their application content;
it bounds finite replies and forwards streams incrementally. Server
administration and personal storage read native quota state through the root
broker, not a gateway accounting store or another user's daemon.

## Route map

Authentication and probes are served by the gateway:

| Route | Meaning |
|---|---|
| `GET /auth/github/start`, `GET /auth/github/callback` | begin and complete GitHub login |
| `GET /auth/session` | read the web session, CSRF secret and display-only GitHub profile ([contract](../../contracts/v1/account-session.schema.json)); this does not expose a Unix route |
| `POST /auth/profile` | supply missing name/email during onboarding ([input contract](../../contracts/v1/account-profile-update.schema.json)); requires session, origin and CSRF, and cannot overwrite supplied GitHub fields or change the identity binding |
| `POST /auth/logout` | end the web session; native `gh` authorization stays |
| `GET /api/v1/server` | session-scoped server name and current browser administrator role ([contract](../../contracts/v1/server.schema.json)); does not expose another person's native work |
| `GET /api/v1/server/administration` | administrator-only name, default storage limit and bound-user role list ([contract](../../contracts/v1/server-administration.schema.json)); broker reads the binding ledger, not daemon sockets |
| `PUT /api/v1/server/administration` | administrator-only name, default storage limit or browser role update ([input](../../contracts/v1/server-administration-change.schema.json)); requires Origin and CSRF; role target must already be bound |
| `GET /api/v1/account/storage` | signed-in person's own kernel quota usage and limit ([contract](../../contracts/v1/account-storage.schema.json)); no other user's files or UID are exposed |
| `GET /api/v1/server/storage` | administrator-only bound-user quotas, home filesystem capacity/free space and overcommit warning ([contract](../../contracts/v1/server-storage.schema.json)) |
| `PUT /api/v1/server/storage` | administrator-only change of a bound subject's hard limit ([input](../../contracts/v1/server-storage-change.schema.json)); Origin and CSRF required; the broker resolves the committed UID |
| `GET /healthz`, `GET /readyz` | fixed gateway probe responses |

Native operations are forwarded to the user's daemon. In this table `<id>` is
the Pi session UUID: history routes include the `pi:` harness prefix, while
conversation control routes use the UUID alone.

| Route | Meaning |
|---|---|
| `GET /api/v1/snapshot` | workspaces, native and controlled conversations, event cursor and native `gh` state |
| `POST /api/v1/workspaces` | create a local directory (optionally initialize Git), edit its display name, initialize Git later, or hide/restore it. The mapped daemon reobserves the source and target; deletion is disabled. [Workspaces](workspaces.md) describes the safety boundary. |
| `GET /api/v1/events?after=<cursor>` | the user's event stream; `Last-Event-ID` takes precedence over the query cursor |
| `GET /api/v1/agents/pi:<id>/history` | a history page; `limit` bounds entry count, `before` pages back and `after` supports forward reads |
| `GET /api/v1/agents/pi:<id>/entries/<key>/blocks/<index>` | read part of a selected block using `revision`, `offset` and `limit_bytes` |
| `GET`, `POST /api/v1/conversations` | list controlled conversations or start Pi in a workspace; [create input](../../contracts/v1/pi-conversation-create.schema.json) optionally selects an `openai-codex` model and supported thinking level for this session only, without changing Pi defaults. Controller replies retain optional [startup choice](../../contracts/v1/pi-startup-choice.schema.json) intent while this child is alive, so an empty session does not falsely inherit a later/different default before Pi writes history |
| `GET /api/v1/conversations/<id>/status` | observe a controlled conversation; `continuation=true` also checks whether it can be continued |
| `GET /api/v1/conversations/<id>/eligibility` | read process observation and continuation eligibility for native history without a daemon handle; the answer is not a reservation |
| `GET /api/v1/conversations/<id>/receipt?command_id=<uuid>` | look up an earlier command's receipt |
| `POST /api/v1/conversations/<id>/send`, `.../steer`, `.../follow_up` | send a message with a client-chosen `command_id` |
| `POST /api/v1/conversations/<id>/clear_queue`, `.../abort`, `.../stop`, `.../continue`, `.../question` | queue, lifecycle and question controls |
| `POST /api/v1/conversations/<id>/close` | empty body; only a verified empty browser-started, idle conversation without another observed writer; stops and reaps its Pi child, removes empty native history, or refuses without unlinking |
| `POST /api/v1/workspaces` with `action: conversation_archive` | archive or restore presentation with `workspace_id`, `observation_token`, `previous_archive` and `archived`; checks native history and workspace, rejects active writers and stale state; never moves Pi history |
| `POST /api/v1/conversations/<id>/regenerate_title` | request a new native Pi name for a browser-controlled session; empty body, bounded synchronous `done` or `failed` result; failures include a fixed `reason` code, not provider diagnostics |
| `POST /api/v1/conversations/<id>/history_title` | request a new native Pi name for settled history without a controller; requires `workspace_id`, checks the writer again and uses a temporary Pi child without granting browser control |
| `POST /api/v1/conversations/<id>/recap` | request a tool-free recap on a settled browser-controlled Pi session; empty body; bounded `done` or `failed`, concurrent requests refused; a lost response is resolved by reading the native result |
| `GET /api/v1/agents/pi:<id>/recap` | read the latest native recap and latest conversation message for staleness, including terminal sessions; no Pi process is started |
| `GET /api/v1/account/git-identity` | read `git config --global` as the mapped user and offer GitHub profile suggestions when native `gh` is available ([reply](../../contracts/v1/git-identity.schema.json)) |
| `POST /api/v1/account/git-identity` | explicit confirmation in onboarding (only when both values are unset) or explicit settings edit, written by the mapped daemon to global Git config ([input](../../contracts/v1/git-identity-update.schema.json)); existing values are never overwritten by onboarding |
| `GET /api/v1/onboarding/github/repos` | list GitHub repositories through the user's `gh`, using `page` and `limit` |
| `POST /api/v1/onboarding/github/clone/stream` | clone a repository and stream progress in the response |
| `POST /api/v1/onboarding/github/clone` | clone with a single JSON result |
| `GET /api/v1/onboarding/github/checkout?full_name=<owner/repo>` | observe the local checkout after cloning |
| `GET /api/v1/onboarding/pi/status` | resolve Pi's stored authorization; this does not test a model request |
| `GET`, `POST /api/v1/pi/models` | list the authenticated OpenAI Codex models Pi reports and read its global default, or choose a listed model ([input](../../contracts/v1/pi-model-update.schema.json)); Pi's settings manager writes and reads back the default as the mapped user ([reply](../../contracts/v1/pi-models.schema.json)); the catalog includes older models with grouping metadata and optional supported thinking levels. Per-model answered/refused observations are derived on demand from bounded recent native history, never entitlement; a running conversation retains its model |
| `POST`, `GET`, `DELETE /api/v1/onboarding/pi/attempt` | start, poll or cancel a Pi device login |

[Conversations](conversations.md) explains the controls and their lifecycle;
[Workspaces](workspaces.md) explains cloning and provider sign-in.

## Reading history

A history request reads Pi's saved session file. With neither `before` nor
`after`, it selects the newest entries. Entries within a page are ordered from
oldest to newest. A `before` request selects older entries and includes the
boundary entry so the browser can join pages by their native keys. `before`
and `after` cannot be combined.

Entry-count and byte limits keep pages bounded. `next_before` identifies where
to continue backwards, and `older_complete` says that the oldest edge has been
reached. If the boundary key no longer exists, `boundary_found: false` tells
the browser to restart from the newest page.

Entries contain ordered block previews. Larger readable blocks are fetched
separately as bounded slices of text or base64 image data, with `next_offset`
when more remains. The page's `native_revision` identifies the file contents.
A block read must match that revision, so a changed file causes the browser to
reload history rather than combine content from different revisions.

## Command outcomes and errors

A command's receipt describes acceptance, not completion of the agent's work.
Conversation status and events describe its subsequent progress. If a reply is
lost, the browser can query the receipt using the same command ID. It does not
automatically resend the message: the first request may already be running.
[Conversations](conversations.md) explains the limits of receipt lookup, and
[Events and recovery](events-and-recovery.md) describes browser recovery.

API errors use the envelope in `contracts/v1/error.schema.json`: a code,
generic message, retryability flag and correlation ID. The status and code
distinguish invalid input, missing authentication, denied access, unavailable
resources, conflicting state and capacity or service failures. The appropriate
response depends on the operation; a conflict does not always call for the
same recovery action.

The gateway returns `daemon_unavailable` when it cannot reach the daemon or
read a complete reply within its limits. This can happen after the daemon
started a write, so an HTTP 503 does not establish that nothing happened.
The receipt or native observation must resolve the outcome. A retryability
flag alone does not make repeating a write safe. Error messages omit native
paths and credentials.

## Contracts and versioning

`contracts/v1/` contains the message schemas, redacted examples and scenario
catalogue. The schemas define message shapes; this page explains the HTTP
operations. Request formats are operation-specific: not every command body
has a version field. Versioned JSON replies and event envelopes identify the
current schema with `schema_version: 1`.

Schema objects reject unknown fields, apart from the error `details` object.
New optional fields can be added within v1, but a validator using an older
closed schema may reject them. Removing or renaming a field, or changing a
type, nullability or ordering guarantee, requires a new version directory
under the contract policy. Requests and replies carry no Unix username. The authenticated user's
snapshot may carry a discovered workspace's absolute path for the conversation
details view; it is never supplied by the browser as authority for a write.
No path is added to an error reply or to a public example.

The generated packages in `internal/contracts/` and `web/src/contracts/` carry
a schema fingerprint. The gate detects schema edits without regeneration;
runtime message validation is separate from that generated-code check.
HTTP handlers live in `internal/gateway` and `internal/daemon`.
