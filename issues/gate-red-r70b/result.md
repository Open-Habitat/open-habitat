# Result

Both specs were stale after `conversation-archive-list` (58953e5ae), which
seeds aurinkokello in the lab with thirteen archived conversations. The
snapshot carries archived conversations (with `archive: "archived"`) because
the workspace archive list reads them from it; home and the rail hide them.
Both specs picked conversations by snapshot position, so they now landed on
archived ones:

- `worker-badges.spec.ts` gave workers to the snapshot's first three agents
  and expected their marks on the rail. They were archived, so the rail had
  no marks. The spec now skips archived agents.
- `lab-onboarding.spec.ts:69` gave the long title to `agents[0]` and looked
  for it on the home page at 390 px. That was the archived
  `…00000000000d` ("Salutation en français"). The spec now titles the first
  unarchived conversation.

The product behaviour is the intended one, so no product change.

Bisect: `git bisect run` with the spec by name first named the issues-only
ca1928f81, which then passed 2/2 by hand; checking the commits between by
hand put both failures on 58953e5ae (its parent 42f4ff83a passes both).

## Tests run

`OH_BROWSER_WORKERS=2 OH_PORT_BASE=15700 ./scripts/test-focused.sh --area
browser --spec worker-badges.spec.ts --spec lab-onboarding.spec.ts`: 3/3
runs green (1 + 4 passed each). `./scripts/test-focused.sh --area web`
passed. Review: focused self-review (tests only).

## Decisions for later review

- Stale spec, not product regression: showing archived conversations on the
  rail or home would undo the archive. The alternative of filtering archived
  agents out of the snapshot would break the archive list, which reads them
  from it.
