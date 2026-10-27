# Result

The editor offer is gone end to end: `open-habitat agent editor offer` and its
help entry, the daemon route `/agent/v1/editor/offers` with its idempotency
memo and fixture, the `editor.offered` event, the notice `editor` field and the
`editor.schema.json#/$defs/offer` contract with its example and negative checks,
the in-conversation card, the account tray cards and the EditorLinks registry
that only they used, the CONFORMANCE section, and the skill and host-context
text. Host context now tells the agent that a `path:line` reference in its
reply is the answer to "open this in my editor".

Checks: contracts (generation clean, validator), `go test ./internal/daemon
./internal/cli`, web fast suite, browser specs `agent-views` and
`agent-notices`. Independent review (gpt-6-astra) found nothing.

## Decisions for later review

- An old Pi session's notice that carried an editor offer now decodes without
  the field and shows as a plain notice whose text is `path:line`; no
  compatibility code.
- `createNotice` takes the optional view directly instead of the one-field
  offer struct.
- The removed `--path`/`--line` help descriptions were used only by this
  command.
