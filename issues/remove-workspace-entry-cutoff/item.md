---
created: 2026-10-05
updated: 2026-10-05
type: bug
status: open
priority: normal
related: ['@rethink-project-docs']
lane: github-first-onboarding
collision: [internal/daemon/, docs/]
preparation: ready
---

# Keep large workspace collections visible beyond 512 entries

Adding one entry to `~/src` can make every workspace disappear. Discovery reads
513 immediate entries and returns `partial/entry_limit` before classifying any
if there are more than 512. Ordinary files and hidden entries count; project
contents do not. Thus 500 project directories plus 13 ordinary files produce an
empty observation. Clone and checkout observation have similar cutoffs in
`internal/daemon`.

Jari approved batched discovery on 2026-10-05 so collections can grow without
losing visible workspaces. The cutoff bounds scan work, but 512 is not a product
limit. Batches should bound the work while allowing the whole collection to be
observed from native directories. A registry would introduce another source of
truth without solving that need.

Success means the browser keeps showing existing workspaces and discovers new
ones above the old threshold, and collection size alone does not disable
onboarding. This reaches through daemon discovery, snapshot construction and
browser consumption: transport limits and partial-result handling can otherwise
recreate the same disappearance. An inaccessible entry is not evidence of its
absence. Clone destination checks need the complete name set, including
case-insensitive matches, because a conflict beyond the first batch still makes
a write unsafe.

Evidence should cover crossing 512 with mixed directories and files,
completeness across batches, inaccessible entries and onboarding with a
conflicting destination beyond the first batch. The architecture description
should explain the resulting behavior. Storage limits are independently owned
by @design-user-storage-quotas.
