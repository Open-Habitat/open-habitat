# Result

Messages accept 30 attachments totaling 100 MiB; 101 MiB is refused. Per-file 20 MiB and directory 1 GiB remain unchanged. Contract description and generated fingerprints updated. The browser had no aggregate admission cap to raise: attachments.ts still correctly bounds each upload/preview at 20 MiB. Finnish and English refusal catalogs now state 100 MiB.

The browser journey exposed an existing defect: HTTP 400 invalid_attachments was treated as an uncertain write, and the normal refusal formatter hid attachment-specific reasons. It now recognizes that exact typed refusal, preserves the draft and all chips, and names the limit in both running and held-message notices. Other unknown 400s remain uncertain.

## Decisions for later review

- Allow up to two minutes for image frames over 20 MiB encoded, instead of 15 seconds. Alternative: retain the timeout or change native Pi's parser/resizing strategy. The pinned Pi JSONL reader took 28.5 seconds to read a 139,817,639-byte frame carrying 100 MiB raw images; keeping 15 seconds would make the newly allowed size unusable. No automatic retry. Native commands serialize, so Stop may wait behind this write.
- Raise native inbound frame capacity from 32 MiB to base64(100 MiB) + 4 MiB, retaining the existing 1 MiB notification reduction and aggregate-event draining. Pi echoes user images in message_start/end; dropping those events would lose queue-matching text. This costs several hundred MiB of transient Go allocation in addition to Pi's parser. The isolated input-parser probe measured **2,093,220 KiB peak RSS**, not a full Pi/provider or concurrent-send memory qualification. This is a material resource cost; no dependency patch or image-reencoding pipeline was introduced.
- Keep aggregate refusal at send, as before, rather than add a browser attachment-size registry. Uploaded files survive refusal; the person can remove chips and retry. File upload/preview caps stay independent.

## Validation

Working change based on `6db68460bd6bd5f08e49edded72386872d7febaa`:

- `./scripts/test-focused.sh --area contracts`: clean generated bindings; 97 schemas, 154 fixtures, 43 scenarios pass.
- `./scripts/test-focused.sh --area web`: 190 files / 1430 tests pass plus static checks (rerun after final frontend fix).
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=28700 ./scripts/test-focused.sh --area browser --spec attachments.spec.ts`: all three pass. The extended existing count journey sends 30 files totaling exactly 100 MiB, refuses 31 files, then refuses 30 totaling 101 MiB while retaining draft/chips. Existing attachment journey includes axe. These are synthetic host-backed tests, not a provider.
- `go test -v ./internal/daemon -run 'Test(PromptAttachment|Attachments|PiRPCSynthetic)' -count=1`: pass. New full-size test exercises production request writing, pinned Pi JSONL input parsing, two full-size synthetic user echoes through production frame reduction, preserved queue-matching text and the following acknowledgement. It took 33 seconds. It also checks 101 MiB refusal in both image modes.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: only the existing `TestAgentCommandPathIsPerHomeAndInherited` fails (installed core agent-bin missing from expected PATH). Reproduced in a clean archive of the base commit; already tracked by `agent-path-test-misses-core-tools`, so no duplicate issue filed. Final `go test -count=1 ./internal/daemon -skip '^TestAgentCommandPathIsPerHomeAndInherited$'`: pass (177 seconds).
- Independent `/llm-review` finder claude-fable-5-1 and verifier gpt-6-astra, then `/assess-findings`: two confirmed FIX findings, both resolved (timeout validator and image echo frame cap). Review/assessment are in local history scratch. Later frontend refusal fix was self-reviewed against the failing browser trace and passing regression.

After rebasing onto concurrent landings (only KOKEILTAVAA conflicted; retained both entries), reran contracts, web (1430 tests), all three attachment browser cases and the attachment/native RPC tests on `69d53199c8b461575d8b05de2c567983a204138b`: pass. Native regression took 71 seconds with concurrent checks, within the two-minute budget. None of the touched production files had changed on main.

Initial web formatting check failed and was corrected. First browser boundary run exposed uncertain-refusal handling; second confirmed draft restoration but exposed generic running-message notice; third passes after attachment-specific wording. No full gate, whole browser suite, live provider, real image conversion, distinct UID or simultaneous maximum-size submission evidence claimed. Synthetic PNG headers in the payload probe are framing data, not valid photos; provider limits can still differ. KOKEILTAVAA has a phone-photo tryout under Työn alla.
