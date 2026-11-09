# Result

Implemented Jari's Rengas choice without a flag. Each pending file has a ring, percentage and its own cancel; at 100% it says Saving until the host confirms. Files remain sequential, additions join the queue, and a failed transport pauses it. The shared notice stack names the failed file, transferred bytes and waiting count, with one retry. Cancel removes only that file. Send remains unavailable until all pending files are saved or cancelled; it never sends automatically.

Explain cards V36/V37 cover the ring/percentage and cancellation in Finnish and English. Cancellation waits in Explain mode. Saving animation respects reduced motion. The uploaded response still passes the existing schema/size/type checks; XHR lives beside mutationFetch and names attachment.upload.

## Evidence

- `./scripts/test-web-fast.sh`: static, type, unit and component checks passed.
- Explicit host-backed specs: attachments, attachment-documents, large-send, queued-send, agent-notices — 25 passed.
- Lab notices-composer and attachment-refusal specs — 6 passed.
- New lab-attachment-upload-progress spec — 4 passed: 1440/390, Finnish/English. Simulated slow first-hop progress followed by actual XHR/host upload; active and queued cancellation, append during upload, pause/retry, saved-file retention, no automatic send, reduced motion, Explain mapping and blocked cancellation.
- Generated UI reference and `git diff --check` passed.
- Paired PNG/offline HTML captures in `evidence/`; inspected desktop/phone progress, failure and Explain cards. Synthetic host only, not a live-user/provider or UID-isolation test. Go runtime/contracts unchanged; full clean gate not run.

## Review

Chose `/llm-review` plus `/assess-findings` because upload cancellation and binding lifetime cross asynchronous callbacks. Finder claude-fable-5-1; verifier gpt-6-astra; local code and regression checks. Preserved Send's focusable aria-disabled contract, caught malformed XHR-reply construction, restored explicit mutation classification, removed dead retry branches, and moved binding invalidation to layout cleanup after the verifier reproduced an old-reply commit window. A regression checks abortion before the new binding's parent layout callback and rejects the stale append. No outstanding finding or new issue.
