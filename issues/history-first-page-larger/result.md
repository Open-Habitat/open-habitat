# Result

A tail or older history page now asks for **100 conversational messages**
(`?messages=100`): the person's prompts and the agent's assistant entries with
visible text. Tool calls, tool results, thinking-only steps and markers come
along without counting. The daemon stops at the 100th message, or earlier at
**1000 entries** or **1.875 MiB** of entry JSON (2 MiB minus envelope headroom,
because the browser rejects a history body over 2 MiB).

## Measurement (Birch, 2026-11-02, read only)

Three long open-habitat conductor sessions (1000–1250 native lines each),
through the real handler with `messages=100`:

| session | entries | bytes | daemon time |
|---|---|---|---|
| 2026-10-31T17-51 | 648 | 1 019 268 | 187 ms |
| 2026-10-29T07-28 | 596 | 866 673 | 37 ms |
| 2026-10-31T04-11 | 590 | 997 809 | 37 ms |

So ~6 entries and ~10 KB per message; the old `limit=25` gave about four
messages, matching what Jari saw. 150 messages would have been 940–1090
entries and 1.3–1.5 MB.

Browser (synthetic host, fixture calibrated to the same shape: 600 entries,
1.02 MB for 100 messages): the read took ~140 ms and rendering ~650 ms after it;
app start before the read (~2 s on the test host) does not depend on the page.
`web/tests/history-first-page.spec.ts` asserts 100 messages, < 2 MiB and
read+render < 3 s.

## Decisions for later review

- **100 messages, not 150–200.** 100 is the low end of Jari's range, about
  1 MB and 600 entries on real sessions and well above a viewport. 200 would
  be ~2 MB and ~1300 entries rendered without virtualization, and would hit the
  byte bound on real sessions. Alternative: 150 (≈1.5 MB). Changing it is one
  constant (`historyPageMessages` in `web/src/app/conversationPager.ts`).
- **Messages as a new query parameter.** `messages` (1–200) is accepted on tail
  and `before` pages only; `limit` keeps its entry meaning (max raised
  200 → 1000) for forward `after` pages and as a hard bound. Alternative was to
  redefine `limit`; a separate name keeps forward paging unambiguous.
- **What counts as a message:** user entries and assistant entries whose text
  (untruncated) is non-empty. Notices, recaps, bash entries and extension
  messages do not count.
- **Reconnect reaches back 2 pages instead of 8** (≈200 messages, a few MiB at
  most); a longer gap reloads the tail, as it did before past 8×25 entries.
- **No compression or virtualization** added: 1 MB per open is acceptable on
  the household's links, and render stayed well under a second.
- Removed the unused `readHistoryFetch` from `HistoryView.tsx`.

## Review

Independent `/llm-review` (finder gpt-6-astra, local verification) +
`/assess-findings`: two confirmed findings, both fixed — the daemon budget
equal to the browser's 2 MiB body cap (envelope could overflow it), and long
thinking emptying a reply's text preview so it did not count as a message
(now counted from the untruncated text; regression test added).
