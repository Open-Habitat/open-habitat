# Offer persistence path: implemented

`agent file offer --json` now carries `data.result.offer.agent_id` and
`data.result.offer.persistence`, the same fields at the same path as
`agent view offer --json`. The file offer's `offer` object is still the
frozen offer's summary (`offer_id`, `title`, `files`, …) with the two card
fields added. The CLI's persistence warning for a file offer reads
`offer.persistence`.

`data.result.notice` stays on file offer as a deprecated alias of the same two
fields through the 0.2 releases, recorded in CHANGELOG under *Deprecated* and
in the daemon code beside the reply; nothing in the product reads it.

`notice create` was checked: what it creates is the notice itself, so its
documented `data.result.notice.persistence` is unchanged. These replies are
CLI/daemon replies, not part of the browser contract in `contracts/v1/`, and
the web does not read them, so no schema changed.

## Verification

- Daemon tests pin the shape: file offer has `offer.agent_id` and a nonempty
  `offer.persistence`, and the `notice` alias equals them; view offer has a
  nonempty `offer.persistence`.
- `TestOfferPersistenceIsReadFromOffer` drives both CLI commands with daemon
  replies and checks the warning follows `offer.persistence`, not the alias.
- `scripts/test-focused.sh --area go --go-package ./internal/cli` and
  `--go-package ./internal/daemon` passed.
