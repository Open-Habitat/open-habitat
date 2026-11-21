# Result

Icon suggestions can select another of the person's own workspace logos or a named image file. Attached images are offered directly beside model choices. Selecting an external image copies it into the target repository, writes the ordinary `icon` setting and includes both files in the existing automatic Git commit where that commit is safe. Nothing is pushed.

The original restriction existed in both `icon-helper.mjs` and the daemon's suggestion validator. The helper previously received only the current workspace facts, wish/history and attachment content, and could return only emoji, letters or that workspace's detected logo. The gateway already authenticated the suggestion call and sandboxed icon responses; those authorities remain unchanged.

## Decisions for later review

- **Workspace catalogue:** send up to 128 discovered workspace names/display names, IDs and detected logo references. Alternatives were guessing sibling paths or giving the helper tools; the catalogue gives enough identity to select a logo without filesystem tools, a new store or home traversal. Workspaces without detected logos are included so a wish can name a file there. Hidden workspaces remain the person's own and are not a separate permission boundary.
- **Named files:** the model returns a workspace ID plus repository-relative image path supplied by the person's wish. No recursive image search or generated/downloaded image. The daemon resolves every selector afresh through discovery and pinned workspace reads, checks ownership of every path component and refuses symlinks, mount traversal, special files, unknown workspaces and escaping paths.
- **Persistence:** copy selected images to content-addressed `.open-habitat-icon-<digest>.<extension>` files in the target workspace and save their relative path in `.open-habitat.yaml`. This includes named files from the current workspace: a copied snapshot guarantees that the selected bytes travel in the commit, rather than depending on an untracked or later-removed source. Preview/selection rereads the source, as the existing logo choice does; a concurrently edited source is not version-locked to the first preview.
- **Bounds:** retain the existing PNG/JPEG/WebP/SVG and 256 KiB icon constraints; do not resize, transcode, accept GIF or fetch URLs. Uploads have no trusted extension, so an SVG attachment must parse as an SVG document rather than merely mention SVG in reference text. An oversized/unsupported image gets deterministic format/size guidance.
- **Model failure:** a validated attached image remains selectable even if the model cannot answer; that round names no model. Text attachments remain model reference material. At most five choices remain visible, matching the existing contract.
- **Git and concurrent writes:** inspect image filter attributes without executing repository filters; filtered images/config remain written but uncommitted for the person's normal Git workflow. Validate the config before publishing any image, stage/sync the complete image and rename without replacement. A later concurrent config failure can leave a complete unused image; do not unlink a published file that another writer may already reference. This is deliberately not a cross-file transaction or a cleanup service.

## Checks

Tested worker changes based on `a58252461b2571ab2b770edd0cdb5e08595c8dff`; the completing commit carries this report. All commands used `umask 077`, bounded timeouts and the scratch lease.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon` — passed. Covers named-file/logo/upload selection, traversal/symlink/FIFO/size/content refusals, no files written by suggestions, copy plus config in HEAD, source removal, config refusal, conflicting destination, filtered-image non-commit, SVG classification, upload rejection feedback and model-timeout fallback.
- `./scripts/test-focused.sh --area go --go-package ./internal/gateway` — passed. Exact candidate query shapes, authentication and inert-image response policy.
- `./scripts/test-focused.sh --area contracts` — passed, including regenerated fingerprints.
- `./scripts/test-focused.sh --area web` — passed: 241 test files, 1953 tests plus static/component/catalog checks.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15700 ./scripts/test-focused.sh --area browser --spec lab-workspace-icon-suggestions.spec.ts --spec lab-workspace-icon-images.spec.ts --spec lab-workspace-icon-setting.spec.ts` — passed (4 cases), including existing axe coverage.
- The same three selected Playwright specs with `--repeat-each 3`, two workers and reply jitter — passed (12 cases). After the visual-only removal of a repeated attachment label, focused specs and web checks passed again; final repeat result is retained with the logs.
- `node --check internal/daemon/icon-helper.mjs`, `git diff --check`, issue doctor and project-view validation — passed.

Development failures were corrected, not omitted: an escaped prompt apostrophe, missing Git initialization in the new unit fixture, the gateway test's expected forwarding count, and a new browser case that reloaded before the save confirmation. The browser now waits for the confirmation before testing persistence.

## Review and evidence

Targeted critical `/llm-review`: finder `claude-fable-5-2`, independent verifier `gpt-6-astra`, followed by `/assess-findings`. Five concrete correctness findings were assessed and fixed: filtered-image commits, non-SVG reference text, missing upload-limit feedback, partial image publication and raw selector labels. No finding remains open; no follow-up issues were filed. The review specifically examined path confinement, ownership checks, sandboxed preview and native write behavior. Performance logging was disabled for this no-push worker.

Retained local evidence (not committed): `/var/tmp/agent-keep/icon-suggestion-other-workspace-logo/` contains focused logs, finder/verifier output and review/assessment artifacts. `visual/other-workspace-logo.{png,html}` and `visual/attachment-candidate.{png,html}` show synthetic browser candidates. The images were inspected; image choices sit beside emoji choices without changing the editor layout. The attachment fixture is a one-pixel PNG, so its tiny preview is expected.

These are synthetic same-UID browser/daemon checks, not a separate-kernel-UID qualification or live provider/deployment test. No live installation was changed and no real model matching result is claimed. The existing icon editor spec is green; no whole browser suite or clean release gate was run.

## Live check

After deployment, open a workspace's icon editor and ask for another own workspace's logo. Verify that the logo appears beside emoji/letter choices; select it and reload. Repeat with a named image file in an own workspace and with a PNG/JPEG/WebP/SVG image attached using Liitä. The chosen image should persist. A GIF or image above 256 KiB should explain the constraint rather than silently disappear. Use disposable test repositories when inspecting the resulting automatic commits.
