# Result

Reused the production conversation `Composer` for icon wishes: identical send control, growing multiline textarea, upload/paste/drop attachments, chips and dictation. Commands/skills/shell sources are absent. No shared-composer behavior changed. A successful unchanged wish clears; a refusal or edits made while waiting remain available.

The existing one-shot model helper has no file tools, so the daemon now reads referenced uploads through the existing own-UID attachment-store primitives and sends image blocks or bounded UTF-8 text. Gateway and proxy request budgets match the larger multiline wish/history. No identity, authorization or output-icon permissions changed.

## Decisions for later review

- Start at the composer's normal height rather than a new taller variant. It already grows automatically, and identical controls avoid another composer style.
- Allow 4096 characters including attachment references, replacing 200-character truncation. Alternative: keep 200 or unlimited text. Several paragraphs and references now fit while request/history remain bounded; oversized requests retain the draft instead of silently truncating it.
- Attachments provide reference material, not uploaded icon choices. Accept the conversation upload store's supported raster images and UTF-8 text (64 KiB total text, 20 MiB total attachments, eight distinct references); reject binary documents rather than pretending a tool-less model can open them. Alternatives: add document extraction or start an agent with file tools, both unnecessary expansion here. The Finnish and English hint says what is supported. Real provider limits may reject otherwise valid images; the editable draft remains recoverable.
- Resolve attachments only for the current wish. Earlier rounds retain wish/reference text and suggestions, not copied attachment bytes. Reattach a reference when a later round needs the image again; avoids repeatedly sending large media with every refinement.
- Text remains editable during model requests; uploads and a second send wait. Only an unchanged successful draft clears, avoiding loss of the next wish.

## Verification

Tested working diff based on `8776b2477fff54f0dcb0f7174ae5cff8e9a8d4b0`, with final review fixes included. Commands run on Birch with private `/var/tmp` scratch and umask 077:

- `./scripts/test-focused.sh --area web`: 161 files / 1185 tests passed, lint and TypeScript passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed, including actual pinned Pi-runtime image/text delivery, provider refusal, image-incompatible inventory, absent credentials, and invalid/symlink/missing attachments.
- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`: passed, including exact 98304-byte proxy forwarding and 98305-byte refusal with existing session/CSRF checks.
- `./scripts/test-focused.sh --area contracts`: generation drift and 88 schemas / 134 fixtures / 43 scenarios passed.
- `OH_PORT_BASE=10070 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec lab-workspace-icon-suggestions.spec.ts`: both cases passed after final fixes. Covers multiline growth, image upload/send, full-length Finnish wish through gateway, oversized-wish retention, initial/pending drafting, synthetic Soniox send, icon acceptance/history, axe and phone width.
- Focused self-review plus independent `/llm-review` and `/assess-findings`: claude-fable-5-1 finder, gpt-6-astra verifier, three confirmed findings fixed (gateway plus generic proxy cap; attachment errors misreported as missing credentials; loading disabled drafting). No outstanding findings or follow-up issues.

The first daemon package run lacked Python `referencing`; installed the pinned CI Python dependencies in a disposable uv venv and reran successfully. Initial inspection also tried a nonexistent daemon AGENTS.md and unmatched search globs; root/internal instructions and scoped source reads supplied the needed context. The generated HTML snapshots had trailing CSS whitespace; normalized it before the final diff check.

## Rebase verification

Rebased onto main `a66a1620f49851be51df52759432dcd677441a88`; kept both KOKEILTAVAA additions and regenerated contract fingerprints. Range-diff confirms no other changes to the implementation. The new main UI-reference check required `python3 scripts/generate-ui-reference.py`: refreshed this catalog's reference and four already-stale references from integrated main; no underlying unrelated source changed.

Post-rebase contracts, daemon package, gateway package and both named lab browser cases passed again. Web lint/typecheck passed; the unit suite twice passed 1190 tests but timed out in the unchanged `SpinoffConversation.test.tsx:97`. Independently reproduced the same 5000 ms timeout in main with `npx vitest run src/app/SpinoffConversation.test.tsx`. Filed unlaned intake bug `spinoff-conversation-test-timeout` with this run's provenance; this baseline failure does not block the focused task under the worker brief. Full web success above describes the pre-rebase tree.

A concurrent merge advanced main again to `8d765d2b`; the merge attempt conflicted only in KOKEILTAVAA. Preserved both notes and rebased. Main independently carried the four unrelated generated-reference updates, so they dropped out of this branch's diff. On this final base the named lab cases passed again, and the complete focused web checks passed (161 files / 1193 tests). The earlier timeout intake remains untriaged with this recovery noted, rather than claiming a diagnosed fix.

## Visual evidence and limits

`evidence/composer-attachment-{light,dark}.{png,html}` and `evidence/puhelin-sirut-{light,dark}.{png,html}` are paired synthetic-lab screenshots and offline HTML. Desktop attachment and mobile dark layout inspected. The browser evidence uses real gateway/daemon handlers with synthetic identities, model and speech; it does not prove real provider acceptance, real microphone transcription or distinct-UID isolation. No live service or full gate was run.
