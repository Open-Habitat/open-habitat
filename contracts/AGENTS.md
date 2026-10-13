# Host contracts

`v1/` is the browser/host boundary as both sides have to see it: a JSON Schema
2020-12 file for each message family, redacted examples under `examples/`, and
`scenarios.json`, the catalogue of situations an implementation must handle.
These files are the authority. The Go and TypeScript packages under
`internal/contracts/` and `web/src/contracts/` are generated from them and
deliberately carry only a fingerprint and opaque types, so nothing is trusted
until it has been validated against the schema at the HTTP/SSE boundary. Write
schemas for what travels over the wire, not for how either side represents it
internally; an implementation type that leaks into a schema makes the boundary
follow the code instead of the other way round.

What the messages mean, who owns which fact, and the HTTP surface with its
versioning policy are written for people in `docs/architecture/http-api.md`.
The schema says what is valid; that page says what it means. Change them
together and do not copy one into the other.

Every response carries `schema_version: 1` and an unknown major version is
rejected, so a v1 client and server are entitled to assume v1 shapes. New
optional fields fit within v1. Removing or renaming a field, or changing a type,
nullability or an ordering guarantee, is a new version directory; the policy is
in `docs/architecture/http-api.md` under versioning. Objects set
`additionalProperties: false` throughout, the one open object being the error
`details` bag in `common.schema.json`, so an unknown field is a rejection, not
a warning. There is no extension escape hatch. The boundary is part of the
architecture decided with Jari, so adding one is a recommendation to him rather
than a schema edit.

The repository will be public and its history is permanent. Examples and
fixtures use placeholder identities (`wid_example-a`, `ws_example123`, fixed
UUIDs) and contain no credentials, Unix usernames, home paths or real user
content; the wire carries no Unix username. The authenticated snapshot may carry the
native workspace path for the details view; examples never carry a real home path.
A real value pasted here once stays in the history for good.

`python3 issues/define-host-contracts/validate_contracts.py` from the
repository root is the offline check: schema well-formedness, each fixture
against its schema, cross-file references, scenario coverage, and a few negative
cases that prove rejections still reject. Two things it will not discover by
itself: a new example file is validated only once it is added to the fixture map
inside the script, and the required scenario coverage labels are a fixed set in
the same script, so a renamed or removed coverage label fails the run until that
list is updated. Any byte change to a schema also changes the fingerprint
embedded in the generated packages; `go generate ./internal/contracts`
regenerates them and `scripts/check-generated.sh` fails on drift.
The root `TESTING.md` explains when to run the full gate.
