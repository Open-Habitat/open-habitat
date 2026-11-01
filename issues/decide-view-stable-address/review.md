# ADR 0035 review

Target: initial draft of docs/decisions/adr-0035-view-stable-address.md, then locally revised.
Finder: claude-fable-5-1 (thread b4192a37-e31f-4cd1-86ce-48383a14284e).
Verifier: gpt-6-astra (thread 01a197b3-e911-7342-a350-23571fcfa5b6).
Two calls; critical rigor because this proposes authorization, bearer secrets and a destructive format transition. Final changes were checked locally, not sent for a third review.

## Confirmed findings, corrected in the proposal

### F2 — should-fix: administrative revocation
Location: ADR choice 2. Merely ending publication lets the owner revive all abusive URLs. Existing revoke.go removes subject links; verifier confirmed. Recommend permanent address deletion for admin/root revocation and withdrawal, distinct from owner unpublish/expiry. This remains a choice for Jari, not a new implemented power.

### F4 — should-fix: intermediate API/client incompatibility
Location: implementation units 1–4. Existing ViewHost.tsx sends view_id/new_address and viewLinks.ts validates content-host URLs. Removing the API before adapting callers breaks Settings. Verifier confirmed. Changed interface units must carry generated types, validators and existing callers together; redesign can follow.

### F5 — should-fix: popup-blocked lazy open
Location: choice 1/3. ViewHost.tsx opens synchronously; awaiting ensure first risks popup blocking. Verifier confirmed. Specify synchronous owner-only launcher followed by CSRF POST and replace; no allocation on GET/render.

### F7 — should-fix: undefined store failure boundary
Location: state and transition. Initial fail-closed wording could unnecessarily stop unrelated app use or permit silent replacement. Verifier confirmed ambiguity, not an established startup bug. Specify disabled address reads/writes, preserved file and unrelated app availability.

### F8 — should-fix: Access-pinned entry routing
Location: what stays as it is. accessIngress wraps the app, so ordinary anonymous entry fails on pinned sites. Verifier confirmed, noting private sessions still need verified Access email. Specify narrow public resolution exemption and upstream policy; retain protected owner continuation.

### F1 — should-fix, narrowed: reachable deletion remedy
Location: state caps. A cap deliberately blocks new addresses, but owner Settings must expose private/expired/missing-export reservations even while sharing is disabled. Verifier confirmed this narrow omission. Added inventory requirement. Rejected automatic eviction: never-published private bookmarks also require stability.

## Dropped candidates (5)

- F3: issues not yet filed was a mid-task observation, resolved by filing the four planned implementation units and card blocker edges before completion.
- F6: new-version rule already explicitly says re-share a new address and identifies lost rolling publication as Jari's trade-off. Moving a reservation is possible, but not a defect in recommending immutable view identity.
- F9: provider/log leakage already prohibited; verifier refuted missing requirement. Added auth-start query/referrer examples for clarity, no separate security claim.
- F10: two independently random secrets reuse the existing content-token model while introducing an entry token. No realistic failure shown; simplifying them is an implementation option, not a must-fix.
- F11: owner uses public budgets intentionally so public opening matches recipients, as the accepted card requires. Owner panel remains available; no defect established.

## Coverage and residual uncertainty

Read the issue, research, accepted card results, ADR 0033, internal authority instructions; locally checked revoke.go, auth return handling, ViewHost and viewLinks callers. Models also inspected nearby gateway and session code. This is a design review, not browser/ingress testing. No product code changed. Entry-vs-address-bar, frozen-version identity, administrative deletion and old-link reset still need Jari's approval. No confirmed defect left unaddressed in the proposed text; implementation must prove the described boundaries.
