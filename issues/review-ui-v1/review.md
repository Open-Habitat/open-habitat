# UI v1 review decision

Decision date: 2026-09-22  
Reviewer: Jari Mustonen  
Reviewed preparation revision: `6bcabaa451e4b0927548c408622dee5a0e44fe36`  
Preparation package: [`../prepare-ui-review/review.md`](../prepare-ui-review/review.md)

## Decision

Jari reviewed the eight prepared product choices one by one. The UI v1
implementation target is accepted with one explicit change to recommendation 2.
The previously accepted workspace and agent-navigation direction remains in
scope. The HTML/JSX mocks remain visual references, not backend or production
architecture evidence.

1. **Queue and steering — accepted as recommended.** Use Pi's normal native
   `steer`, `follow_up`, ordered queue and whole-queue `clear_queue` behavior.
   Do not specify per-message cancellation, arbitrary reordering or other queue
   behavior Pi does not provide.
2. **Conversation title — recommendation changed and accepted.** Start with
   “Uusi keskustelu”. Generate the title with an LLM through a verified Pi
   one-off model call outside the agent loop. The title may be regenerated after
   a few messages when the subject has become clearer; it is not permanently
   locked and must not churn after every message. Preserve the latest successful
   title as replaceable presentation data. A failed generation keeps the prior
   title, or uses a shortened beginning of the first user message before the
   first success, and never blocks the conversation. The exact Pi mechanism,
   regeneration trigger, model, storage contract and cost bound remain adapter
   and host-contract decisions that require verification.
3. **Focus and drafts — accepted as recommended.** Move focus only after user
   selection or successful create/resume. Keep server-, identity- and
   agent-specific drafts in `sessionStorage` across reload, not tab closure;
   logout or identity change clears them. Do not add server draft storage in v1.
4. **Reading position — accepted as recommended.** Auto-scroll only while the
   user is already at the bottom; otherwise show an accessible new-content
   control. Preserve reading position and expanded tool groups using stable UI
   keys tied to native events when those events remain available.
5. **Attention — accepted as recommended.** Use an in-app accessible count,
   textual agent-row marker and document-title count. Browser, OS and external
   notifications are outside v1.
6. **Controllability and terminal transfer — accepted as recommended.** A
   managed RPC runtime is controllable; a detected live terminal TUI is
   read-only. Resume or transfer only after current, unambiguous evidence that
   the prior writer has exited and history has settled. Unknown observations
   are shown only when grounded in real evidence, not invented as normal UI
   states. Do not signal a merely observed process without a known owner path.
7. **Uncertain send — accepted as recommended.** Use an idempotent client
   command ID, reconcile against a fresh snapshot and show an uncertain result
   without automatic resend. A deliberate new send is a separate command.
8. **Partial host operations — accepted as recommended.** Show confirmed,
   running, failed, unknown and skipped stages truthfully. Do not claim rollback
   without proof; retry only after fresh native observation, and mark deletion
   complete only after the source listing confirms absence.

## Scope and limits

B1–B10, B12 and B5a–B5f form the accepted conversation reference set. Host
A1–A9 supplies the accepted desktop workspace flow. B11, L1–L13, mobile,
multi-server navigation and post-MVP UI extensions stay outside this target.
GitHub write behavior, browser credential UX, host contracts, the one-off Pi
model-call adapter, production stack and deployment remain subject to their
later evidence and review gates. Acceptance of this UI target does not claim
that those integrations are implemented.

No correction issue is required before technical planning. Later design and
contract work must preserve the decisions above and bring any technically
necessary deviation back to Jari rather than silently narrowing the MVP.
