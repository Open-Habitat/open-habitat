# ADR 0028: Selectable workspace editors share a confined daemon file API

**Status:** Accepted under Jari's delegation of 2026-10-21 to decide and proceed
per the recommendations. The three choices, CodeMirror 6 default, phone rule,
common opening behaviour and narrow daemon file API are Jari's decisions in
[decide-editor-choice](../../issues/decide-editor-choice/item.md#decisions).

## Context

VS Code through code-server already has a daemon-owned process and a separate,
identity-specific editor origin. `internal/gateway/editor_linux.go` grants and
relays an editor session; `internal/daemon/editor_linux.go` starts code-server
only on an explicit start and opens message file links through the extension.
`web/src/app/WorkspaceEditor.tsx` owns the shared split and header, but currently
makes editor availability depend on code-server. A phone needs a smaller editor
and should not need a server-side IDE process to read or change text.

The [prior research](../../issues/research-shell-editor/report.md) measured
code-server's cost and recommended a daemon file API plus CodeMirror. Its
shared editor-host proposal for code-server was superseded by the current
per-identity origins; that isolation remains unchanged. Browser editors are
text-editing libraries, not VS Code replacements with terminals or extensions.

## Decision

### A. One product surface, three implementations

Settings has an **Editori** page with **CodeMirror 6**, **Monaco**, and **VS Code**.
CodeMirror 6 is the default. Store only the enum `codemirror6|monaco|vscode` in
app-origin localStorage under a versioned key containing the current validated
`web_identity_id`. This is a device/browser preference, not a workspace property.
Absent, invalid or inaccessible storage means CodeMirror 6, with an in-memory
choice for the current session. A change in another tab applies only after the
current dirty document is saved or explicitly discarded. No contents, paths,
version tokens or drafts go into persistent browser storage.

Reset all live editor state on identity/CSRF binding change, abort outstanding
reads and reject stale responses as the rest of the app does. Never adopt the
previous identity's preference while the new identity is unresolved. Logout
clears live documents, not the non-sensitive identity-scoped enum.

Phones offer only CodeMirror 6. Use the application's compact layout breakpoint
(390 px is a required test case) to conservatively treat compact viewports as
phones; do not guess from User-Agent or touch capability. On compact layouts,
the other two options are visible but unavailable with a reason. A stored
desktop choice remains stored but the effective choice is CodeMirror 6. If
resizing requires changing engines, a dirty buffer blocks the transition until
saved or explicitly discarded; no silent loss. Growing the viewport does not
switch engines mid-document: a later clean open uses the stored choice.

Keep `WorkspaceEditor` as the shell for adapters (open file/range, focus,
dirty state, dispose). Reuse `EditorHeader`, `EditorSplit`, opener,
full-window/return, close, conversation strip and Ctrl+Alt+K from the landed
`implement-editor-header` work. Browser engines add a shared file sidebar,
active file name, dirty/saving/conflict state and explicit Save control; phones
use a dismissible file picker and reachable Save instead of desktop key chords.
Initially keep one open document; opening another file, closing, changing
workspace or engine requires saving or explicit discard if dirty. Navigation
and page unload get the same unsaved-work protection where the browser permits
it. No autosave, automatic retry, force-save or persistent browser draft store.
VS Code retains its own workbench's unsaved-document handling.

Conversation `FileRef` paths and 1-based line ranges remain the common entry
point. They are untrusted candidates, never proof a file exists. CodeMirror and
Monaco read through the new API, then clamp the selection to the actual line
count; VS Code keeps its separate-origin extension route. Errors leave the
conversation and existing dirty document intact. File links work without a
code-server installation, including on phones. Binary or unsupported files
show a fixed explanation, never raw HTML, SVG, Markdown preview or a data URL.

### B. The daemon alone resolves and changes files

The app-origin API is browser → authenticated gateway → mapped daemon socket.
The gateway enforces session, exact Origin and CSRF for PUT, bounds bodies and
forwards bytes without interpreting file contents or resolving paths. It can
necessarily see relayed plaintext in memory; this is not end-to-end encryption.
It acquires no home access, file cache, preference store or file-serving role.
No file data, paths or native error text go into diagnostics. Replies use
`Cache-Control: no-store`; service workers must not cache them.

Every operation freshly resolves `workspace_id`, including worktree-place IDs,
through the existing `workspaceFD` admission, holds its descriptor, and creates
an `os.Root` from that held descriptor (the `start_page_linux.go` pattern).
Never reopen the discovered absolute workspace pathname for I/O. `os.OpenRoot`
confines resolution but by itself does not prohibit mounts or symlinks. Apply
Linux `openat2` beneath/no-magiclinks/**no-symlinks/no-xdev** discipline to each
opened directory and file, for reads as well as writes. All content opens use
those descriptor-relative primitives, not an unchecked `Root.OpenFile` after a
separate validation; os.Root is not an alternative resolver with weaker flags.
Use nonblocking opens followed by fstat so a FIFO cannot hang a request. Refuse all symlinks, even ones pointing inside the
workspace, for a consistent read/write target. Retain parent descriptors for
writes, and revalidate their ancestry and the workspace's named identity before
commit. No string-prefix containment check or check-then-open absolute path.

Extend the workspace deletion admission discipline to hold a file-operation
lease: managed deletion cannot move the workspace during an admitted operation,
and a held deletion fence refuses new operations. Register an in-memory active
operation count atomically with `admits` under the controller's fence mutex,
including worktree places; release it on every operation exit. Deletion must
check those counts under that same mutex before taking its fence, including
operations admitted through an enclosing workspace that contains the place
being removed. Use the held operation root and deletion target ancestry to
check overlap in either direction, not only equal root inodes. Report an active
file operation as busy, not as a Pi process. The initial `workspaceFD` check
alone is not such a lease. Revalidate before returning reads and before
write commit; substituted, fenced, missing or ambiguous places are unavailable.
A same-UID native process may still rename a held directory after a check;
descriptor-based operations remain inside that held tree, not at a substituted
path. This is not a sandbox against the person or their own agents, who already
have their UID's authority. It must never become another UID's authority.

Paths are UTF-8 workspace-relative names, at most 1024 UTF-8 bytes, at most 64
components, each at most 255 bytes. Reject absolute paths, empty components,
`.`/`..`, backslashes, NUL and control characters; do not clean an invalid path
into a valid one or URL-decode a parameter twice. Empty path means root only
for directory list/stat. Dotfiles are otherwise available, but deny any `.git`
or `.agent-host` component: Git internals and product workspace identity are
not editor documents. Apply the same rules to direct calls and sidebar results.
Only daemon-UID-owned directories and regular files on the workspace filesystem
are usable; sockets, devices, pipes and symlinks are never opened as content.
Foreign-owned entries are unavailable, not a way to exercise inherited access.

### C. A small, specified contract

Implementation adds `contracts/v1/workspace-editor-files.schema.json` and its
route/error scenarios, and generates Go and TypeScript; this ADR changes no
schema or code. Existing composer `workspaces/files` and `file_preview` stay
picker/preview APIs, not a second editor backend. The new routes are:

| Operation | Request | Success payload (all include `schema_version: 1`, `workspace_id`, `path`) |
|---|---|---|
| Read | GET `/api/v1/workspaces/editor/file?workspace_id=…&path=…` | `content`, `version`, `encoding: "utf-8"`, `bom`, `newline: "lf"|"crlf"|"none"`, `size_bytes`, `mode` |
| Save existing file | PUT same path, no query; JSON `{workspace_id,path,base_version,content,bom,newline}` | `version`, `size_bytes`, `mode` for the committed bytes |
| List one directory | GET `/api/v1/workspaces/editor/list?workspace_id=…&path=…` | `entries: [{name,kind:"file"|"directory"|"unsupported"}]`, `truncated` |
| Stat | GET `/api/v1/workspaces/editor/stat?workspace_id=…&path=…` | `kind`, `size_bytes`, `mode`, `editable`, optional `reason` |

Objects reject unknown properties, duplicate query parameters, extra JSON and
invalid types. Query values are URL-encoded once; PUT names its target only in
the JSON body. Modes are integer permission bits, not browser-settable. Stat's
`reason` is a fixed enum (`too_large`, `binary`, `encoding`, `mixed_newlines`,
`metadata_unsupported`, `type_unsupported`, `protected_path`); stat is bounded
like read when determining editability and supplies no save token. Stat root
uses kind `directory`; sizes for directories are not meaningful. Listing does
not follow or reveal symlink targets; denied entries may be marked unsupported
but never expose foreign ownership or absolute paths. No recursive tree,
watcher, search index or host cache: expand directories on demand. Sort a
bounded scan (at most 2000 directory entries inspected, at most 500 returned),
return `truncated: true` whenever incomplete, and say so in the picker. No
pagination promise: very large directories need native tools/VS Code initially.
Cap list response at 1 MiB; stop before that cap, marking truncation. Listing
and stat do not start any editor process.

Read and save accept at most **1 MiB of on-disk text**, checked both by fstat
and a cap+1 read, with a fresh post-read stat to reject a changing file. Read
only valid UTF-8 without NUL; binary and other encodings are unsupported, not
lossily decoded. A leading UTF-8 BOM is removed from `content` and recorded in
`bom`. Uniform CRLF is represented as LF in `content` and `newline: "crlf"`;
uniform LF as `lf`; no line endings as `none`. Mixed CRLF/LF or bare CR is
read-only unsupported in this slice. Save content must be valid Unicode text
with LF only (no CR/NUL or unpaired surrogates); daemon reconstructs BOM/EOL
exactly as requested, validates newline consistency, and caps reconstructed
bytes. Validate raw JSON UTF-8 and escaped surrogate pairing **before** ordinary
Go JSON decoding: `encoding/json` replaces invalid sequences with U+FFFD, so
checking the decoded string cannot enforce this contract. Browser adapters also
refuse lone surrogates rather than displaying a successful lossy save.
Adapters preserve the read BOM/newline choice; for a no-newline document
that gains lines choose LF. Opening and saving without edits must preserve bytes.
Use plain text fallback for unknown extensions; do not infer executable content
from MIME or filename. UTF-16/legacy transcoding, images and large-file views
are out of scope, not errors silently worked around by an engine.

Bound JSON requests and read replies to **8 MiB** (worst-case JSON escaping of
1 MiB text plus metadata), enforce cap while streaming even without a truthful
Content-Length. Add a route-specific 8 MiB PUT allowance in the gateway proxy
(the current general limit is 66,000 bytes), retaining its rejection of unknown
length/chunked bodies and a streaming cap at both gateway and daemon. Limit
concurrent file operations to four per daemon.
One operation has a five-second budget, including waiting for admission; a
commit already begun must finish durability handling rather than pretend a
cancel undid it. Browser schema validation and bounded response reads happen
before editor state sees content. Read/list/stat are side-effect free except
for ordinary filesystem access metadata; no persistent observation records.

Errors use existing fixed-code envelopes: 400 `invalid_request`, 403
`cross_user_denied`, 404 `workspace_unavailable`/`file_unavailable`, 409
`file_changed` (stale version or race detected before commit), 413
`file_too_large`, 415 `file_unsupported`, 503 `file_busy`/`file_io_failed`.
Session/CSRF failures retain gateway semantics. A typed 4xx writes nothing;
a 5xx, disconnect or lost reply on save is **uncertain**, never an instruction
to retry. No native errors or file contents in error payloads. Quota, disk-full
or fsync failure does not acknowledge success. On an uncertain save keep the
dirty buffer and offer an explicit read/compare before the person tries again.

### D. Conflict detection and atomic replacement

`version` is an opaque `sha256:v1:<64 lowercase hex>` digest over a domain-tagged,
length-delimited record of workspace device/inode, relative path, file
device/inode, size, mode, nanosecond mtime/ctime and SHA-256 of **raw file bytes**.
It is an observation token, not an access credential or timestamp comparison.
A replacement with equal text still changes version. No persistent token table.

Only existing regular files can be saved, and only when the owner's write bit
is set and effective filesystem permissions allow writing; a writable parent
alone must not make a read-only file editable. No create, mkdir, rename, delete,
chmod, upload or arbitrary command route. Refuse files with multiple hard links,
set-ID/sticky bits or extended attributes (including ACLs/capabilities), unless
a later change explicitly supports preserving their semantics; replacement must
not silently break links or drop security metadata. Ordinary rwx mode,
including executable bits, is preserved; new inode remains owned by the daemon
UID and retains the original group, or the save is refused before replacement.
This conservative rule also makes labelled files on SELinux hosts unsupported
for saving initially; do not silently exempt labels without proving that the
replacement preserves their policy semantics.

Serialize all daemon saves with one daemon-wide in-memory mutex, not a file
store. Per-workspace locking is insufficient: a linked-worktree place may also
be reachable beneath another workspace ID, aliasing the same target.
Under admission, reread the target safely and compare the complete version to
`base_version`. Stage a random `.oh-save-<nonce>.tmp` O_EXCL, O_NOFOLLOW temporary file at mode 0600
in the held target parent, write the reconstructed bytes, apply preserved
group and rwx mode, and fsync it. Immediately before replacement, re-open and
rehash the named target and revalidate admission/parent ancestry. On mismatch,
remove staging and return 409 without replacing anything. Rename relative to
the same held parent atomically, then fsync the directory. After rename and directory fsync, fstat the still-held staged-file descriptor
and compute the returned version from that committed observation and the known
bytes, not a pre-rename stat (rename can change ctime) or a new unconstrained
pathname read. Clean up this request's staging on ordinary failure paths. A
crash/power loss can leave a recognizable temporary file in the source tree;
it is not a saved document or a recovery guarantee. Do not automatically delete
pattern-matching files whose ownership by the current request is unproven.
No rollback copies or automatic retries.

Conflict UI keeps the local buffer, offers reload/discard or explicit comparison
with a fresh remote read, and requires a fresh base before saving a manually
reconciled result. No unconditional overwrite endpoint. All saves go through
`mutations.ts` as confirmed writes and reuse `writeOutcome`/`hostChanged`,
without a snapshot round trip or retry.

This detects edits since read, and serializes two browser saves; it is **not a
filesystem-wide compare-and-swap**. Native Pi, git and editors do not honour our
lock. An external write between the final check and rename can still be lost,
or can replace our save afterwards. Linux rename has no conditional-on-version
primitive, and advisory flock would not fix uncooperative native writers. Do
not claim guaranteed exclusion of native writers. No autosave reduces exposure;
show that agents may edit concurrently. Strict exclusion would require changing
native writer behaviour, which this decision rejects. Descriptor confinement
still holds during a symlink substitution; no write follows the substitute.

### E. Load only the chosen engine

CodeMirror 6 and Monaco run on the app origin as trusted bundled libraries;
repository text is data, never evaluated, imported, rendered as HTML or run in a
preview. No plugin marketplace, project-provided plugins, LSP process or package
execution is added. VS Code alone retains its existing separate origin and
editor-scoped grants; browser engines never mint these grants or use its relay.

Both browser engines are dynamic imports on effective selection and opening,
not imports in the initial shell/settings bundle. CodeMirror uses modular
packages, not an everything-included preset. Monaco uses its ESM build with
explicit same-origin worker entry points and only selected language features;
no CDN, remote loader or broad CSP relaxation. Release packaging includes all
chunks and workers. Dispose models, views and workers when no longer needed.
Record compressed initial and per-engine asset sizes in implementation evidence;
test that a CodeMirror open fetches no Monaco chunks/workers. Exact budgets
follow measured build output, not unsourced library-size claims.

Initial syntax scope for both: plain text, Markdown, JavaScript/TypeScript
(including JSX/TSX), JSON, HTML, CSS, Go, Python, shell and YAML. Lazy-load grammar
support; Monaco's missing built-in grammars use a small bundled tokenizer, not
an LSP or a whole VS Code extension. Other files remain editable plain text.
Monaco's built-in local language workers are permitted; no promise of project
compilation, cross-file IDE intelligence or VS Code extension compatibility.
Theme extensions derive editor background, text, selection, caret and syntax
colours from existing design tokens in light/dark mode, not engine defaults.
Check contrast, keyboard focus, screen reader operation and Finnish shortcuts.

Selecting an option only records a preference. Opening VS Code explicitly is
the only path here that can start code-server; settings, status, conversation
links to browser engines, and browser-engine reads start nothing. Switching away
unmounts its frame after unsaved-work handling but does **not** stop the shared
per-user process: another tab may use it, and its terminal/extension work must
not be killed. Existing code-server idle timeout frees it when unused. No daemon
startup, login or browser-engine path eagerly starts it.

## Consequences and rejected alternatives

- **Home-stored choice.** Would follow the person across browsers but adds a
  host settings authority for a UI preference that can differ by device; there
  is no native editor-choice file to reuse. Browser-local per identity wins.
- **One global localStorage choice.** Leaks one person's preference into another
  in a shared profile. Identity-scoped keys and live-state reset avoid that.
- **Code-server only / Monaco default / Monaco on phones.** Contradicts Jari's
  trial and phone decisions; Monaco explicitly does not support mobile browsers.
- **Separate file APIs or code-server as the file backend.** Duplicates the
  security boundary or forces a heavyweight process for lightweight editing.
- **Gateway filesystem access or new file service.** Moves authority out of the
  UID daemon without need. Serving raw files/HTML on the app origin also exposes
  active content instead of treating it as text.
- **Following safe-looking internal symlinks.** Can be confined with os.Root,
  but complicates a consistent replacement target and race reasoning. Refusing
  all symlinks trades convenience for a clear first-slice contract.
- **mtime-only or content-hash-only conflict checks.** Can miss rapid writes or
  inode/metadata replacement respectively; the combined observation is cheap
  at the 1 MiB bound. Lockfiles/flock cannot exclude uncooperative native tools.
- **In-place truncate/write.** Can expose partial text and destroy a file on
  quota failure. Same-parent atomic replacement preserves an old complete inode
  until commit, at the cost of refusing metadata we cannot preserve.
- **Recursive whole-tree snapshots/watchers and eager engine bundles.** Add
  memory, invalidation and download cost before a person needs them. Bounded
  directory expansion and lazy engines suffice; truncation is explicit.
- **Autosave, force overwrite, automatic retries or persistent drafts.** Increase
  data-loss or cross-identity leakage risks; explicit saves and reconciliation
  keep the first slice understandable.
- **Full VS Code parity in browser libraries.** Requires language servers,
  extensions and execution authority that these libraries do not supply. People
  needing that can select the existing VS Code implementation.

## Implementation phases

1. **File API, Editori settings and CodeMirror 6 default.** Complete the shared
   contract, descriptor/admission/write tests, identity-local preference,
   phone behaviour, shared browser-editor shell/picker and file links. Ship
   CodeMirror and existing VS Code end to end. Show Monaco as not yet available,
   never silently reinterpret a stored choice. This is useful and independently
   landable without Monaco. Distinct-UID VM tests must prove routing isolation;
   daemon tests cover traversal, symlink/mount swaps, special files, deletion
   fencing, hardlinks/metadata refusal, modes, Unicode/size limits, concurrent
   saves, native-change conflicts and full-disk/fsync uncertainty. Host-backed
   browser tests cover identity changes, dirty buffers, links/ranges, phone
   layout, keyboard/header behaviour and zero code-server starts for CodeMirror.
2. **Monaco adapter.** Depends on phase 1, adds only the lazy engine, grammars,
   workers and themed adapter; makes its settings option selectable on desktop.
   Reuse the same contract and interaction tests, with chunk/worker isolation
   and no-mobile-loading checks. No new server authority or file operations.

Retain this ADR until both phases land; then move only lasting authority rules
to the nearest AGENTS.md and remove the implemented decision per repository
policy. The implementation issues hold scheduling, not this record.

## Evidence

Repository paths above were read at the decision base, together with
`workspace_files_linux.go`, `workspace_fence_linux.go`,
`workspace_composer_files_linux.go`, `start_page_linux.go`,
`web/src/components/fileRefs.ts`, and `contracts/v1/editor.schema.json`.
The existing composer picker does not provide editing or save conflict control.
The current `editorFile` permits confined internal symlinks; the new API's
no-symlink rule is deliberately stricter and does not claim that helper proves it.

Primary sources checked 2026-10-21:

- [Monaco README](https://github.com/microsoft/monaco-editor/blob/main/README.md):
  mobile browsers unsupported, workers for language services, not a VS Code
  extension host.
- [Monaco ESM integration](https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md):
  explicit bundler/worker integration and selectable language features.
- [CodeMirror system guide](https://codemirror.net/docs/guide/): modular state,
  view, language and theme extensions; editor document is data.
- [CodeMirror bundling example](https://codemirror.net/examples/bundle/): explicit
  module bundling rather than a runtime remote editor service.

These establish capabilities, not measured Open Habitat bundle sizes or mobile
usability. Those require implementation evidence. No code or live-server test
is claimed by this decision-only change.

**Proposer:** Taskfleet technical-decision run `01m5fs673v3g8t13brvtj4erzt`.
**Decider:** Jari Mustonen (delegation), 2026-10-21.
