# Result

Corrected the agent help and host guide without changing runtime behavior.

- Conversation stop now says that Pi's managed process-tool jobs end. It also warns that detaching work does not take it out of the daemon's cgroup, and names independently owned work that survives.
- Attachment create describes raw bytes from a regular file or stdin, not protected JSON. Attachment show describes binary output to a new private file, not JSONL.
- Conversation create describes model/provider as optional overrides, keeping the provider-requires-model constraint. Global model-update help still describes its required provider.
- The host guide names the card's globe button, `Julkinen` / `Public`, and points to offer-command help for limits and inputs.

## Source check and scope

Focused self-review checked the descriptions against `parseResourceRequest`, `parseConversationRequest`, binary output's exclusive 0600 file creation, `piRPC.close`, the process bridge's shutdown handler, `OfferCard.tsx` and `offerCard.ts`.

The brief's cgroup statement needs a distinction: conversation stop closes one Pi and its managed processes; it does not stop the daemon unit. Remaining tool-started children in that unit's cgroup end when the **daemon** stops. The help explicitly separates those events rather than claiming that conversation stop kills the entire cgroup. No process-lifetime behavior was changed and no live conversation was stopped.

## Validation

Under `umask 077`, focused Go tests passed for both packages:

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: 239.949 s.
- `./scripts/test-focused.sh --area go --go-package ./internal/cli`: 0.614 s.

The daemon invocation initially supplied both package flags; the script uses the last one, so CLI was run separately. The first daemon attempt hit the tool's 200-second timeout without a result; the retry with a larger timeout passed. New tests pin the corrected help descriptions, the unaffected model-update requirement and the offer guidance. `git diff --check` passed. No browser, packaging, full gate or live process-survival test was run; the UI itself was not modified.
