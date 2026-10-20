---
created: 2026-10-19
updated: 2026-10-20
type: improvement
status: open
priority: high
provenance: ai-review
source_ref: taskfleet:01m59z5qhnb264cenh38adtpf2/review-finding:sha1:63a4931f13288d4dd59f1d35702aa21e52778056
review_source: ai-review
originating_run: 01m59z5qhnb264cenh38adtpf2
originating_run_kind: spinoff
labels:
- ai-review-model:gpt-6-astra
- ai-review-model:claude-fable-5-1
assessment_classification: CONFIRMED
assessment_outcome: DISCUSS
review_confidence: high
review_severity: must-fix
review_target: main..wt/nh38adtpf2-implement-workspace-editor (workspace editor)
lane: editor
preparation: ready
lane_seq: 1
collision: [internal/gateway/editor]
---

# Per-person editor hosts: one shared editor origin carries leftover origin code into the next person's session

## Description

# One editor origin for everyone lets code left on it act in the next person's editor session

**Where.** The workspace editor (code-server) is served on one configured editor origin for all
people (`OAuthConfig.EditorOrigin`, `internal/gateway/auth.go`; routing in
`internal/gateway/server.go`). The editor session cookie `__Host-oh-editor` has one name for
everyone, and the gateway relays each editor-origin request to the daemon of whoever the cookie
currently names (`internal/gateway/editor_linux.go`, `editorRelay`).

**Triggering condition.** Two people use the same browser profile (a shared family or office
computer). Person A plants code on the editor origin: code-server serves extension webviews and
its service worker from that same origin, so A's own extension or a page of A's code-server can
register a service worker or keep a tab open. A signs out; B signs in and opens the editor.

**Impact.** Same-origin requests from A's leftover code carry B's new editor cookie, so they reach
B's daemon and code-server: B's files, and code execution as B through code-server's routes. This
crosses the product's one isolation boundary (Unix users).

**What is already in place (implement-workspace-editor, 2026-10-19).** Every editor-session
redemption sends `Clear-Site-Data: "storage", "cache"`, which unregisters service workers and
clears the origin's storage before the new session exists; code-server runs with
`--enable-remote-storage` so the workbench state is kept in the person's data directory. What
remains is a document of A's that is still open in another tab of the same profile: it is not
reached by the header.

**Evidence.** Independent review (finder gpt-6-astra, verifier claude-fable-5-1) confirmed there
was no per-identity origin and no origin clearing; the research for this feature
(`research-shell-editor`, §"The origin problem") had deferred per-person hosts with "would separate
service workers and storage when two people share one browser … not needed for a first slice".

**Proposed direction (a decision for Jari).** Either per-person editor hosts
(`<opaque-id>.code.<host>`, bound to the identity by the gateway), which needs Fleetrepo work:
wildcard DNS, a certificate beyond Cloudflare Universal SSL (Advanced Certificate Manager or a
custom certificate), and a cloudflared ingress rule; or accepting the remaining open-tab case for
shared browser profiles and saying so in the operator guide.
