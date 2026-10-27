# Result

The view offer without a conversation is gone, as Jari decided; the
conversation's card stays. Removed: the account target of the daemon's offer
route (an offer without `--current`/`--conversation` is now refused before
anything is copied), the `view.offered` event and its example, the corner tray
of account cards with its dismiss button and Storybook story, the conversation
store's `onViewOffered` subscription and the browser host's `account` fixture.
`open-habitat agent view offer` requires exactly one of `--current` or
`--conversation pi:UUID`; the offer reply's `offer` carries `agent_id` and
`persistence`, no `target`.

`GET /api/v1/views` stays: the browser still reads it to learn whether the
installation has a view origin at all. Exports made earlier by account offers
stay listable and removable with `agent view list`/`remove`.

Evidence: contracts focused check (generation clean, fixtures valid); Go
`./internal/daemon`, `./internal/cli`, `./test/browser-host`; web focused
checks; `agent-views.spec.ts` 2 passed (the own-tab case now starts from a
conversation offer). The daemon view tests now all offer into a running
conversation through a fake Pi notice writer, and assert that an offer with
no conversation query, or with a query naming none, is refused.

## Decisions for later review

- The daemon answers an offer without a conversation with the generic
  `400 invalid_arguments` rather than a dedicated code: the CLI refuses it
  first with an explanatory usage error, so only a hand-made request reaches
  the daemon's refusal.
