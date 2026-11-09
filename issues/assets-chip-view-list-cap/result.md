# Result

The chip reads its own conversation's views (`GET /api/v1/views?conversation_id=…`),
following pages to the end. The person-wide list pages by 100 with a
`next_cursor` (`cursor=<created_at>_<view_id>`, the last view's place in the
list order, so a removal between pages does not shift later pages). Each new
view records `source`, the absolute path the agent offered from, and the chip
folds views of the same source and entry as versions of one row; views
without a source fold by title and entry as before. The view-origin export
summary drops `source`; public addresses never read the summary at all.

Evidence: `go test ./internal/daemon ./internal/gateway` (new
`TestViewListPagesByConversation`: 208 views across pages without repeats,
continuation after a removal, malformed queries refused; source recorded and
absent from the export summary; `TestViewListForwardsOnlyItsPageAndConversation`),
contract validator with new negative cases, web unit suite (folding by
source, per-conversation paging, removed view leaves the chip), browser specs
`agent-views` (new: re-offer from the same folder is one row with versions),
`agent-file-offers`, `view-links`, `account-settings`. Synthetic same-UID
evidence. Review: `/llm-review` (gpt-6-astra finder, claude-fable-5-1
boundary verifier) + `/assess-findings`; both findings (a removed view stayed
in the chip; a hidden 50-page browser cap) fixed here.

## Decisions for later review

- **The source path goes to the owner's browser, not an opaque key.** Folding
  needs only equality, so a hash would have done; Jari asked for the offered
  source path in the contract, and the owner's own workspace paths already
  reach the browser in the snapshot. It is never shown in the UI, never in
  the view-origin summary, never on public routes.
- **Source is resolved from the opened workspace root** (`/proc/self/fd`
  readlink of the root descriptor the offer copied from) joined with the
  relative path; an absolute request path is kept as named. Alternative: the
  workspace ID plus relative path, which would not tell a worktree place from
  its main checkout as a path does.
- **Fold key is source + entry,** so two entries of the same folder stay two
  reports; title changes between re-offers do not split a report.
- **Old views are not backfilled** even though their manifests hold
  `workspace_id` + `path`; they fold by title and entry as the brief says.
- **Page size 100** (browser read limit raised to 1 MiB); the chip and the
  tab title lookup follow every page, ending on a repeated cursor.
- **The person-wide first page still decides whether views are offered**
  (204 vs list); the chip no longer uses it for content.
- **Left at 200:** the agent CLI's `GET /agent/v1/views` (newest 200) and a
  conversation's file-offer list (200 per conversation). File offers are not
  folded into versions; the criterion's "file or folder" was read as the
  view's offered source.
