# Editor symlinks

## Findings before the change

Source inspection of `editor_files_linux.go`, `BrowserEditor.tsx`, `EditorFileTree.tsx` and `editorTree.ts`:

| Entry | Editor list | Open/browse/save |
| --- | --- | --- |
| Link to an in-workspace file | `unsupported`, ordinary file icon, no target | Refused |
| Link to an in-workspace folder | `unsupported`, no folder expansion | Refused |
| Link outside the workspace | Same unsupported row | Refused |
| Broken link or loop | Same unsupported row | Refused |

The list attempted an O_PATH no-follow open, then rejected the symlink inode's type. Content operations prohibited symlinks in every component. The browser disabled every unsupported row and could not explain the distinction.

`workspace_files_linux.go` is workspace-root admission/settings, not the editor tree: `openWorkspace` requires a real directory entry and rejects symlink roots. Discovery skips non-directory entries using no-follow stat. This remains unchanged. The separate composer listing in `workspace_composer_files_linux.go` uses Git names in checkouts (so link names can appear without link metadata); its plain-directory walk omits symlinks, and its preview still refuses them. These are separate consumers, not the editor's list API.

## Delivered

The editor shows a ↗ link mark, the stored target and, when unavailable, a translated reason. Relative links to allowed files and folders in the workspace can be opened, browsed and saved. Saves replace the resolved target entry, not the link. Folder compaction preserves link rows, including when filtering.

Kernel `openat2` first confines the complete requested path with BENEATH, NO_MAGICLINKS and NO_XDEV. A separate no-follow policy walk checks ownership and excluded components inside link targets; pinned link descriptors prevent readlink substitution. It compares the resulting inode with the kernel observation. Content reopening still forbids symlinks. Saves retain the existing observation checks and held-parent atomic replacement, additionally checking the resolved destination inode. An escaping or broken replacement cannot redirect a save. Bounded retries handle transient EAGAIN only during resolution, never retrying a save.

## Decisions for later review

- **Absolute links stay unavailable**, including an absolute spelling of a target physically in the workspace. BENEATH rejects absolute targets; IN_ROOT would instead reinterpret `/...` under the workspace, changing the link's native meaning. Chose explicit refusal rather than reinterpretation or ambient-host resolution. Relative `..` is allowed inside a link target only when the complete resolution stays beneath the workspace; request paths themselves still prohibit `..`.
- **Preserve existing policy beyond location:** ownership, protected `.git`/`.agent-host` components, mount refusal and unsupported file types remain restricted. An internal alias does not bypass those checks.
- **Keep composer/root listing policy unchanged:** this task changes the editor file list, not workspace identity/admission or composer discovery.
- **No global native-writer CAS promise:** symlink substitutions cannot redirect access, but uncooperative native mutations and directory reparenting retain the previously documented descriptor-relative save limitations.

## Evidence

- Focused full daemon package passed twice, including the final reviewed implementation.
- Added daemon cases: file/directory/chained links, internal `..`, escaping `..`, `/etc/passwd`, missing targets, loops, protected targets, read/stat/list refusal, valid-format bad-link PUT refusal, repeated saves preserving links and version tokens, and mid-save retargeting to another internal file, an external file, a missing target or a loop.
- Focused contracts check passed: generated fingerprints current; 99 schemas, 159 fixtures and 44 scenarios validated.
- Focused web checks passed: static analysis, type checking, 219 test files / 1714 tests, including metadata preservation and non-compaction of directory links.
- Host-backed synthetic browser evidence: all 27 cases in `browser-editor.spec.ts` passed with two workers and isolated ports. New case checks mark/target, disabled explanations, file opening, target-preserving save and folder-link browsing. This is not distinct-UID or installed-server evidence; the container-only UID/mount tests were not run.
- Independent critical `/llm-review`: finder `claude-fable-5-2`, verifier `gpt-6-astra`; `/assess-findings` confirmed three fixes (transient lookup errors, missing-path classification, invalid-base test). All repaired and revalidated. No actionable review residual or new authority requested. Local review/assessment artifacts are under ignored `history/`; model assessment logging succeeded.
- Initial browser test read disk while save was still pending; it now waits for the successful PUT response. Initial marker accessibility lint required an explicit image role; corrected. Final checks pass.

Live check: In a disposable test workspace, create relative links to a text file and a folder, plus a missing target and `/etc/passwd`. Open the editor file list: check ↗ and target text, open/browse the internal links, edit and save through the file link, and confirm the link remains a link. The missing/external links should stay visible and disabled with a reason.
