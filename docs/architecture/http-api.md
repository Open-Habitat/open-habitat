# HTTP API

The browser talks to the gateway over same-origin HTTPS. Reads are JSON `GET`
requests and one Server-Sent Events stream; writes are JSON `POST` or `DELETE`
requests that carry the session cookie, the configured `Origin` and the
session's CSRF header. The gateway authenticates each request and forwards it
unchanged in meaning to the user's daemon, which produces the reply. The
machine-readable contract is `contracts/v1/`: a JSON Schema per message
family, redacted examples and the scenario catalogue. This page says what the
routes mean; the schemas say what is valid.

## Routes

Authentication, served by the gateway itself:

| Route | Meaning |
|---|---|
| `GET /auth/github/start` | begin the GitHub login flow |
| `GET /auth/github/callback` | complete it and issue a session |
| `GET /auth/session` | the session's provider and CSRF secret |
| `POST /auth/logout` | end the web session; native `gh` authorization stays |
| `GET /healthz`, `GET /readyz` | liveness probes with a fixed body |

Native state and control, forwarded to the user's daemon:

| Route | Meaning |
|---|---|
| `GET /api/v1/snapshot` | workspaces, conversations, journal cursors, native `gh` state |
| `GET /api/v1/events?after=<cursor>` | the user's event stream; `Last-Event-ID` overrides `after` |
| `GET /api/v1/agents/pi:<id>/history?limit&before` | a page of native history, newest first; `before=<entry key>` pages back |
| `GET /api/v1/agents/pi:<id>/entries/<key>/blocks/<index>?revision&offset&limit_bytes` | a bounded slice of one selected block (UTF-8 text or base64 image); revision must match the selected native history |
| `GET /api/v1/conversations` | the conversations this daemon controls |
| `POST /api/v1/conversations` | start Pi in a workspace |
| `GET /api/v1/conversations/pi:<id>/status[?continuation=true]` | observe one conversation; with the flag, run the continuation proof |
| `GET /api/v1/conversations/pi:<id>/receipt?command_id` | the receipt of one earlier write |
| `POST .../send`, `.../steer`, `.../follow_up` | message writes with a client `command_id` |
| `POST .../clear_queue`, `.../abort`, `.../stop`, `.../continue`, `.../question` | the remaining controls described in [Conversations](conversations.md) |
| `GET /api/v1/onboarding/github/repos?page&limit` | the user's GitHub repositories through their own `gh` |
| `POST /api/v1/onboarding/github/clone/stream` | clone one repository; the reply is an SSE stage stream |
| `POST /api/v1/onboarding/github/clone` | the same without streaming, for small repositories |
| `GET /api/v1/onboarding/github/checkout?full_name` | what the local checkout shows |
| `GET /api/v1/onboarding/pi/status` | whether Pi's credential is usable |
| `POST`, `GET`, `DELETE /api/v1/onboarding/pi/attempt` | start, poll and cancel a Pi device login |

Query strings are exact: a route accepts only the parameters listed, once
each, and anything else is `400 invalid_request`. Bodies are small JSON objects
with no unknown fields; the gateway forwards at most 64 KiB of request body.

## History paging

A history page is read from Pi's file at request time. Without `before` it
returns the newest entries, up to `limit` (default and maximum 200; the browser
asks for 25). With `before=<key>` it returns the entries older than that key and
reports `older_complete` when the oldest edge was reached, or
`boundary_found: false` when the key no longer exists, in which case the browser
starts again from the newest page. Entries contain bounded ordered block previews; readable blocks have a separate
read route selected by native entry key and block index. Each response is at
most 64 KiB of text or base64 (aligned to UTF-8/codepoint or base64 quartet),
with `next_offset` when more is available. The page's `native_revision` is a
hash of the native file; the daemon rejects a block read when that revision
changes, so the browser reloads the page rather than combining old and new
content. Redacted thinking and unknown native fields cannot be selected.

## Writes and receipts

A command's acceptance and its effect are separate. The daemon answers a write
with a receipt state, and the state of the work lives in the conversation's
status and events. A lost reply leaves the outcome uncertain, and the browser
reports it that way rather than retrying, because an unacknowledged message may
already be running. A deliberate retry is a new command with a new ID.

## Errors

Every error body is the shape in `contracts/v1/error.schema.json`: a fixed
code, a generic message, a `retryable` flag and a correlation ID. The HTTP
status says which boundary refused.

| Status | Codes | Meaning |
|---:|---|---|
| 400 | `invalid_request` | the request shape was not accepted; nothing started |
| 401 | `authentication_required` | no valid session; the browser opens login |
| 403 | `origin_denied`, `csrf_denied`, `identity_mapping_denied`, `cross_user_denied` | a trust boundary refused the request |
| 404 | `resource_not_found`, `attempt_not_found`, `content_revision_gone` | the target does not exist for this user; nothing is said about other users |
| 409 | `cursor_expired`, `cursor_instance_mismatch`, `writer_conflict`, `read_only_history`, `control_uncertain`, `github_auth_unavailable`, `checkout_exists`, `checkout_unavailable`, `attempt_active` | the current state blocks safe progress; take a new snapshot or wait |
| 429 | `capacity_exceeded` | the daemon's Pi child or handle limit is reached |
| 503 | `daemon_unavailable`, `native_source_unavailable`, `checkout_uncertain`, `native_adapter_error` | the daemon or a native source could not be reached or read; already shown content may stay readable, writes do not proceed |

The gateway produces `daemon_unavailable` when it cannot dial the socket or
the reply exceeds its cap; every other daemon status and body passes through
untouched. Free text in errors never contains home paths, usernames or URL
credentials.

## Versioning

Every message carries `schema_version: 1`. Objects are closed: an unknown field
is a rejection, and there is no extension bag apart from the error `details`
object. New optional fields fit within v1. Removing or renaming a field, or
changing a type, nullability or an ordering guarantee, is a new version
directory. `internal/contracts/` and `web/src/contracts/` are generated from
the schemas and carry a fingerprint, so a schema edit without regeneration
fails the gate. Requests and replies carry no Unix username and no absolute
home path.
