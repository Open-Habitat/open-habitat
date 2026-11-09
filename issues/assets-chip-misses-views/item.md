---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: fixed
priority: high
lane: unlaned
preparation: ready
closed: 2026-11-09
---

# Assets chip does not list every view offered in the conversation

## Description

Jari 9.11.2026, pilot.22, conductor conversation
`pi:941e6fe0-7a35-41b5-9c31-243662b0f889`: the assets chip (views and files
beside Workers) did not list *Keskusteluarkisto – prototyyppi, kierros 1*
although it was offered in the conversation, so he had no way to open it;
other views offered the same evening were there (he mentions the large
content prototype). `open-habitat agent view list` shows all five views of
the conversation with this conversation id, all `persisted`:

- `vanxvyzynx3fmzhj2ymtf6wp5ef` Valtava sisältö hallitusti (185 kB, index.html, 18:07Z)
- `vo3wlubizn224xfucuco2c7u2kz`, `v2jj3dmsnwojzfnf2v7n3ri7fcp` Worktree-lista (1.7 MB, offline.html, 18:39Z/18:40Z)
- `v2jp5tijlbaqdmrl77dp7s6w7cp` Keskusteluarkisto (8.1 MB, offline.html, 19:04Z)
- `vm3imo75qguske2vs65icodx5xr` Jaot omaan paikkaan (1.8 MB, offline.html, 19:09Z)

The conversation's Pi was restarted by the Birch upgrade at 20:41Z (pilot.22).
Find which rule drops entries (size, a page or count limit, reading offers
from a history window that no longer reaches them, the restart, the
dedupe of same-titled offers) and fix it so the chip lists every offer of
the conversation, newest first.

Jari 9.11. 06:25, after the conductor re-offered the archive view
(`vptwztuj5uajl6y3ga7peejkqbr`): the chip still reads **2**, the archive now
shows and *Jaot omaan paikkaan* disappeared. So the chip shows only two
views and a newer offer pushes an older one out — a slot/count or dedupe
rule, not size.

## Acceptance Criteria

- [x] Every offer of a conversation appears in the chip, including large ones, older ones beyond the loaded history, and across a daemon restart.
- [x] Test reproducing the missing case; touched specs green.
