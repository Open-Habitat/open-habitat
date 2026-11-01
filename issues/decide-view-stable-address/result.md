# Proposal ready for Jari

ADR: [0035](../../docs/decisions/adr-0035-view-stable-address.md).
Independent review and local disposition: [review.md](review.md).
No product code changed; the issue remains open with preparation pending.

The proposal recommends a stable entry URL (public redirects change the address
bar), revival on owner republish, and one address per frozen view ID. New exports
start private and require a new shared address; moving content and rotating links
are removed. Administrative/root revocation and withdrawal permanently delete
reservations, unlike owner unpublishing. The pre-release format transition
invalidates existing links explicitly. These choices await approval.

Four implementation proposals were filed through intake with exact run
provenance, untriaged, unlaned and preparation pending:
`view-address-reservations`, `view-address-publication-lifecycle`,
`view-address-entry-route`, `view-address-end-to-end`.
Their dependency edges and the existing `view-card-public-switch` prerequisites
are recorded. Scheduling awaits the later human lane-or-close decision: the
run policy overrode the original brief's create-and-lane instruction.

Validation: project-view validator passed (16 pages/navigation entries),
`git diff --check` passed; issuectl doctor reported only the existing 455
non-AVIF image observations, no schema/reference errors. No runtime tests are
claimed for a documentation-only proposal. Review used claude-fable-5-1 and
gpt-6-astra, two calls; the model assessment was logged through the corpus helper.

Tool friction: the first intake invocation rejected a trailing newline in its
inline body before creating an item. Retried with a trimmed body successfully;
all four issues and blocker targets now exist. No unauthorized filing or lane
assignment was used.
