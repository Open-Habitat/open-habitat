# Host contracts

`v1/` is the canonical machine-readable browser/host boundary. JSON Schemas use
JSON Schema 2020-12. They describe observable messages, not Rust or React
implementation types. Keep the reader-facing meaning in `docs/interfaces.md`.

A breaking semantic or shape change creates a new version directory. Additive
optional fields may remain in v1. Unknown object fields are rejected unless a
schema explicitly provides an `extensions` object; extension keys must be
namespaced. Never add credentials, raw Unix usernames, absolute home paths, or
unredacted user content to examples.

Run `python3 issues/define-host-contracts/validate_contracts.py` from the
repository root after changes. It validates every schema, fixture, cross-file
reference, and scenario catalogue without network access.
