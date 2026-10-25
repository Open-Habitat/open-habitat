# Agent-to-browser surfaces: research and recommendation

## Jarin yhteenveto

1. Suosittelen Habitatin omaa näyttämistarjousta, en agentin pakottamaa selaimen ohjausta.
2. Agentti käyttää samaa oman Unix-tunnuksen CLI:tä sekä selain-Pi:stä että SSH:sta.
3. HTML avataan keskustelun viereen eristettyyn näkymään, ei sovelluksen tai editorin alkuperään.
4. Jaettava artefakti on valituista tiedostoista tehty jäädytetty julkaisu, ei linkki kotihakemistoon.
5. Nimettyjen vastaanottajien pääsyn tarkistaa gateway; heidän daemoninsa eivät lue tekijän tiedostoja.
6. Kehityspalvelin näkyy vain omistajalle yksityisen Unix-soketin tai eristetyn verkon kautta.
7. Pelkkä localhost-portti ei eristä palvelimella asuvia Unix-käyttäjiä toisistaan.
8. Leikepöydälle kopiointi ja paikallisen tiedoston lataus tarvitsevat ihmisen selainpainalluksen.
9. Julkinen linkki on erillinen, oletuksena suljettu päätös; peruminen ei poista jo ladattuja kopioita.
10. Ensin kannattaa prototypoida näyttämistarjous ja jakamisdialogi; tämä raportti ei hyväksy arkkitehtuuria.

Research date: 2026-10-25. Habitat inspected at `9deeb49e8c2ef742359ebe42a00e0beb9adbd4db`.
For `agent-html-artifacts` and `habitat-seat-commands`; neither issue's status changes.
**Recommendation only: Jari decides before an ADR or implementation.** Review consisted
of my own source-checking; no external model review, deployment or browser experiment.

## 1. What exists, and what does not

| Existing seam | Evidence and consequence |
| --- | --- |
| Separate browser and agent listeners | `internal/daemon/agent_linux.go` has a default-deny agent route table and checks `transport.AgentPeer`. ADR 0027 and `internal/AGENTS.md` reserve it for the daemon's own UID. Use this for all harnesses, not a Pi-only bridge. Agents cannot mint editor or browser grants. |
| Isolated code-server ingress | `internal/gateway/editor_linux.go` derives a 52-character identity label, supports `oh-code-*.example.org` or `<identity>.code.example.org`, validates the Host, and exchanges a one-minute single-use handoff for `__Host-oh-editor`. That cookie is host-only, Secure, HttpOnly, Strict, and bound to the parent app session. The relay strips cookies before reaching the daemon. `docs/operations.md`, “Runtime and native session policy”, describes wildcard ingress/TLS. Reuse the handoff pattern, **not the editor cookie or host**. |
| Own-UID editor backend | `internal/daemon/editor_linux.go` runs code-server on a mode-0600 Unix socket in a private directory. `contracts/v1/editor.schema.json` defines open-at-line; `workspace-editor-files.schema.json` and `internal/daemon/editor_files_linux.go` provide confined text editing. CodeMirror has no HTML execution authority. A file offer can select the person's configured editor without creating another editor. |
| Attachments and document preview | `internal/daemon/attachments_linux.go` stores ordinary files in `~/attachments`, caps each at 20 MiB, and serves non-images as octet-stream downloads with `nosniff`. `AttachmentPreview.tsx`, `DocumentPreview.tsx` and `web/src/app/documentPreview.ts` render PDF/Markdown/Office; DOCX uses `sandbox=""` and a restrictive CSP. The resolved `attachment-preview-documents` issue records that choice. This is inert document rendering, not an interactive HTML host or a share mechanism. Do not loosen it. |
| Browser delivery | `internal/daemon/events_linux.go` supplies a bounded, daemon-lifetime SSE journal with cursors and resnapshot after gaps, proxied through the gateway; `contracts/v1/event.schema.json` enumerates event kinds. Notices already use native conversation entries (`notice.created`), not a notice database. Add typed offer data/events rather than watching terminal output for magic URLs. Events are not durable delivery acknowledgements. |
| Workspace “preview” | Repository search found bounded composer file previews (`contracts/v1/composer.schema.json`), document previews and editor relays, **not a first-class workspace HTTP/dev-port preview contract**. code-server itself has a generic port proxy [S2], but that does not make it a suitably isolated Habitat preview surface. |

The authority rules are in root and `internal/AGENTS.md`. The current ADRs were
read, especially 0027 (own-UID agent operations), 0029 (operator-owned installation)
and 0030 (identity/admission authority). `docs/product.md` requires native truth
and non-executing conversation content. The proposal adds a deliberately separate
execution surface, not executable HTML inside Markdown/history.

## 2. Prior art: what to borrow

- **Glasspad:** the local checkout at `~/Sources/glasspad`, commit
  `e68e2f916c74ec68328cf045f31675028affdb50`, and the installed `glasspad` skill
  distinguish live loopback from hosted snapshots. `glasspad-core/src/artifact_host/headers.rs`
  uses a null-origin sandbox, `connect-src 'none'`, restricted resource loads and
  a trusted outer shell; response CSP also sandboxes direct opens. Hosted links
  are bearer capabilities, not named-person ACLs. Borrow the separation and export
  discipline. Do not treat its loopback service as private between UIDs, or hosted
  publishing as named sharing. A formatter/build export may be useful, but its
  CLI/server is not a drop-in Habitat authority layer. Its policy allows
  user-activated top navigation; I would omit that permission here.
- **`tw browser-open`:** Fleetrepo's `software/tw/src/reverse.rs`, `cmd_browser_open`,
  streams one HTML file over SSH to the attached client and opens a temporary copy.
  That is transport to a trusted personal seat, not multi-user hosting. Habitat
  has no reverse OS channel to the person's laptop. Copy the convenience, not
  remote command execution or the assumption that a local browser can see server files.
- **VS Code Remote SSH / code-server:** VS Code tunnels a remote port to the
  local machine [S1]. code-server supports subpath and subdomain proxies and
  recommends subdomains to avoid base-path breakage [S2]. Root-relative assets,
  redirects and HMR make dedicated origins more robust than `/preview/<id>/`.
- **GitHub Codespaces:** forwarded URLs use `CODESPACENAME-PORT.app.github.dev`;
  visibility is private, organization or public, with organization policy able
  to restrict exposure [S3]. Borrow explicit visibility and private default,
  not “everyone on this server” as a substitute for named recipients.
- **Gitpod Classic (now documented by Ona):** ports get authenticated workspace
  URLs by default; `onOpen` chooses notify, preview, browser or ignore, and
  visibility is private/public [S4]. Borrow **notify before navigation**. Do not
  auto-expose every listening port or trust repository configuration to publish.
- **Coder:** `coder_app` names an app endpoint and can select subdomain routing;
  app sharing has owner/authenticated/public scopes. Port sharing also offers an
  organization level; the two policies are not identical [S5]. Borrow a named
  endpoint, not a URL-proxy textbox. Coder's workspace agent model does not prove
  safe TCP isolation in Habitat's shared host network.
- **JupyterHub 5:** shares grant server-specific access to a named user/group;
  invitation codes and established shares have distinct revocation operations
  [S6]. Its security guide explicitly requires per-user domains to protect
  mutually untrusted users when sharing [S7]. Borrow scoped, revocable access;
  do **not** share an entire execution server merely to show an artifact.
- **Claude artifacts:** the useful model is an artifact beside the conversation,
  rendered separately from trusted chat, with an explicit sharing control.
  Current official help distinguishes invited access from link access, and legacy
  published chat artifacts can be viewed anonymously and unpublished [S8].
  A sandboxed frame on a separate user-content origin is the relevant isolation
  pattern, but **I could not verify Claude.ai's current artifact hostname, iframe
  flags or response CSP**: the app returned a Cloudflare challenge, and the help
  page documents UX, not internals. Do not assert an exact `claudeusercontent.com`
  contract or inherit Claude's network policy. Habitat's proposed boundary below
  rests on browser specifications [S9–S11] and inspected Glasspad code, not that
  unverified implementation detail.

## 3. Three concrete options

| Option | Advantages | Costs / why choose or reject |
| --- | --- | --- |
| A. Reuse code-server's port proxy and existing attachment dialog | Least new routing; already installed for editor users. | A dev page on the editor origin can attack the editor, terminal and its grants. Attachments deliberately do not execute scripts. No named sharing or safe export boundary. **Reject as the product surface.** |
| B. Adopt a separate Glasspad service for everything | Mature offline HTML sandbox and publishing workflow. | Extra server/config/credentials; no Habitat named-person authorization; offline CSP cannot run arbitrary HMR/API apps. Still needs Habitat offers and private transport. **Do not add it as a required service.** Reuse its ideas or qualified export tooling. |
| C. Habitat browser offers plus isolated content origins; frozen exports for sharing, private live previews | One account CLI; existing gateway/daemon/editor seams; small, explicit sharing authority; no public workspace ports. | New content ingress and export reader, a small canonical share ACL store, and a restricted live relay must be implemented and tested. **Recommend C.** |

This is not a general hosting platform or a replacement for native dev servers.
One visible “view” can be either a frozen export or a live owner-only preview;
the UI must say which. **Only frozen exports are shareable initially.** A later
live share would grant application interactions and possibly code execution as
the owner, not just read access, and needs another decision.

## 4. Recommended authority and data flow

### Show, open and copy

1. A process connects to its own `agent.sock`; kernel peer UID, not request fields,
   establishes authority. A new CLI operation submits an offer with an explicit
   workspace/artifact ID and optional known conversation. A browser-Pi child can
   inherit the checked launch context. SSH/Taskfleet callers use explicit targets
   or an account-wide offer: never guess “current” from cwd or newest history.
2. The daemon resolves paths inside its own workspace, builds an export or checks
   a private preview endpoint, and records an offer. Persistent conversation offers
   should be native entries like notices. Unassociated offers can be bounded,
   expiring daemon-memory state, re-listed on reconnect; a restart may expire them.
   No clipboard payload belongs in persistent history by default: retain it briefly
   in memory, suppress stdout/log echo, show a masked copy offer, then expire it.
3. Existing authenticated SSE tells the person's browsers that an offer exists.
   A card says who offered what, workspace, frozen/live, size and visibility.
   **Open / Copy / Dismiss**, not an unsolicited tab, clipboard overwrite or focus
   change. Multiple tabs may show it, but an explicit action consumes the same
   offer ID. Report `offered`, `accepted`, `expired`, `unavailable` or `unknown`,
   never “displayed” merely because SSE was sent. Copy is executed by the trusted
   app in the click handler; permission failure gets a manual-select fallback [S12].
4. On Open, the app obtains a gateway-issued, one-time, view-scoped handoff. The
   agent never obtains an app/editor session or receives browser identity. File
   offers invoke the existing editor path through the browser; content offers
   open the isolated frame or a user-clicked new tab with `noopener`.

These browser gestures are device/UI actions, not a new approval gate for normal
own-UID filesystem operations. ADR 0027's empty browser-confirmation set remains
true for existing personal operations. New share grants are gateway authority;
starting them from the share dialog is a proposed boundary, not a hidden expansion
of the agent listener's privileges.

### Publish to named people

- The **owner daemon** exports an explicit file or selected directory to a private,
  versioned snapshot under the owner's home. Ordinary files plus a small manifest
  are the source of truth, not a workspace registry. Store no pointer back to a
  mutable project as the published content. Reject symlinks, hard-linked source
  files, special files, traversal and mounts; bound files/bytes and account for
  disk use. Show the exact manifest before sharing so `.env`, source maps or
  credentials are not silently swept in. Native tools may construct the export;
  the reader still validates what it serves. Same-UID agents can change their own
  exports: snapshot immutability is a product workflow, not protection from the owner.
- The **gateway** owns one new canonical ACL: owner binding + export revision +
  recipient provider/subject IDs + revocation generation, and later optional
  public-link metadata. This state is justified: no native tool currently owns
  Habitat viewer grants. It must not duplicate content, workspaces or histories.
  The owner browser can select exact existing admitted people through a bounded
  gateway lookup; display names/logins are labels, not grants, and arbitrary
  user enumeration is not added to the agent API. The broker's existing mapping
  remains authoritative; new recipients are not provisioned by sharing.
- A recipient signs in to the **app**, which checks the ACL and issues a scoped
  content session for that export/revision. The gateway then uses the **owner's**
  verified daemon socket and a fixed export-read route. This intentionally adds
  gateway routing on behalf of a recipient; it needs Jari's architecture approval.
  An owner ID in a URL is a lookup key only, never authority.
- The daemon accepts only its existing authenticated gateway peer on this route.
  It receives **no viewer identity claim to believe**: it can return only files
  in an explicitly published export, by opaque export ID/revision and confined
  relative resource path. It cannot list/read arbitrary owner paths. Gateway
  decides *who* may view; owner daemon decides *what bytes* are exported. The
  recipient daemon is not involved; no Unix ACL, group, home permission, root
  helper or filesystem mount is granted to the recipient.
- Keep ACL and content lifecycle separate and fail closed: absent export, ACL,
  valid binding or healthy authorization state means no bytes. Republish creates
  a new revision needing explicit audience selection rather than silently
  changing what recipients trusted. Revocation invalidates handoffs and live
  content sessions, closes streams, and checks the current ACL on each new
  resource request. Private responses are `no-store`; no public CDN caching.
  Daemon offline means unavailable, not a stale gateway content cache.

The **provision broker gains no new operation**. DNS/TLS and optional namespace
prerequisites stay deliberate operator responsibilities. Neither daemon nor
browser chooses another UID or asks root to open files.

### Open a dev server without opening a public port

Use a separate view origin for each preview instance, relayed through gateway →
owner daemon → **owner-private Unix socket**. Validate private ancestor ownership,
socket mode/type and direct server peer UID; pin the endpoint lifetime and fail
on replacement/restart rather than silently attach to another service. Do not
mistake systemd's root peer on an activated socket for an app's UID proof.

A conventional TCP dev server can instead run in the user's existing **rootless
container/private network namespace**, with an own-UID bridge presenting the
private Unix socket to the daemon, and no host-port publication. Reuse the optional
container profile and its native ownership if installed; do not add a privileged
namespace broker. If neither socket nor qualified isolated-network route exists,
say preview unavailable and offer a static build. This is a compatibility cost,
not something to conceal behind “secure localhost forwarding”.

**Do not implement `open http://127.0.0.1:ANY_PORT` on the shared host.** Other
accounts can connect to that listener directly; a daemon can also be tricked into
proxying another account's service. Port-owner probing is not a race-free binding
or connection authorization. Origin isolation does not repair this network-level
problem. The same warning applies to code-server's generic localhost proxy.

Forward only the registered endpoint, including WebSockets for HMR; do not expose
a general destination URL. Preserve root-relative paths on its dedicated host.
Strip Habitat cookies, authorization and identity headers before the upstream.
Reserve gateway handoff paths, validate redirects and Host handling, and never
let an upstream set a parent-domain cookie or replace the gateway's session
cookie. Own preview-app cookies, if needed, require host-only rewriting under a
separate namespace. A full live server is not confined to workspace files merely
because its launch cwd is a workspace. Keep it owner-only and label that risk.

## 5. Origin and browser security

Use a distinct, non-reused **per-view/revision hostname**, such as
`oh-view-<opaque-id>.example.org`, separate from both `app.example.org` and every
`oh-code-<person>.example.org`. This is stronger than one user origin: two exports
from one owner can have different audiences, and stale documents/service workers
must not gain access to a replacement view. Labels must fit DNS's 63-byte limit.

Two execution policies belong to this one view system:

- **Offline artifact (default):** script-capable iframe with **no**
  `allow-same-origin`; response `CSP: sandbox allow-scripts` also protects direct
  navigation. Deny network connections, workers, objects, nested frames, forms,
  top navigation, popups and device/clipboard permissions. Permit inline scripts,
  styles and selected assets only on that exact export host, plus needed data
  images. Do not allow all sibling view hosts. `unsafe-eval` is not needed by
  default. A null origin affects module/CORS/storage semantics: ordinary multi-file
  HTML/CSS/classic JS can work; ESM apps are **not promised** to work in this mode.
- **Web-app compatibility/live preview:** separate origin remains mandatory;
  sandbox may allow scripts, same-origin and forms for modules, storage, app
  fetches and HMR. Do not use this combination on the app's or editor's origin.
  Keep top navigation/popups and powerful browser permissions denied. Restrict
  connections to this exact preview endpoint by default; external APIs require
  an explicit policy choice. A built multi-file ESM app can use this profile as a
  frozen export, with connections restricted to its own export resources. Such
  content must be labelled as executable web content, not an inert document.

Gateway owns the headers; user content cannot replace them. Static content
responses must keep sandbox policy on errors, direct opens and redirects too.
The trusted app grants no authority through arbitrary `postMessage`: verify exact
source window, expected origin (opaque `null` is not unique), view nonce and a
small message schema; an artifact can request resize/close, never copy, fetch a
home path, execute a command or mint a grant [S9–S11].

Habitat's app cookie is `__Host-` scoped (see `internal/gateway/auth.go` and
`session.go`); keep host-only Secure/HttpOnly cookies and different names for
content sessions. An app cookie must not be sent to content hosts; editor cookies
must not authorize previews. **HttpOnly alone is insufficient:** same-origin
script could still make authenticated requests. Same-site sibling hosts are
cross-origin, but SameSite cookies alone are not a CSRF defense against them.
Keep exact Origin/CSRF checks on app writes, no credentialed CORS to content
origins, and no state-changing GETs. Audit ingress/SSO cookies too: a broad-domain
cookie readable by content would undo the isolation [S10].

### Installation implications

- **Birch-style tailnet-only site, DNS-01 TLS:** use names below an operator-owned
  real DNS domain, with split/private wildcard DNS resolving to the tailnet
  gateway. DNS-01 can validate a wildcard without exposing an HTTP listener
  [S13]. Tailnet DNS/routing must actually resolve every generated view host;
  the machine's existing MagicDNS name/certificate is not proof of that wildcard.
  Route all view hosts to the gateway with Host intact and the same tailnet
  access policy. This is an installation plan, not a verified observation of
  Birch's current DNS/certificate configuration.
- **Public pilot:** route `oh-view-*.example.org` to the same ingress, with a
  certificate covering `*.example.org`; preserve Host and verify any TLS origin
  hop. This follows the existing editor's single-label wildcard arrangement.
  An alternative `<id>.views.example.org` needs `*.views.example.org` coverage;
  `*.example.org` does not cover that extra level. Public reachability of the
  gateway does not make private views anonymous.
- Same-site names allow the existing Strict-cookie/frame handoff pattern.
  A **separate registrable domain** is preferable for future anonymous public
  content, reducing same-site cookie/CSRF coupling. That costs another DNS/TLS
  namespace. For authenticated private views on a separate site, do not assume
  third-party iframe cookies work: prototype a top-level handoff/tab fallback
  rather than rely on relaxing SameSite alone. Public frozen exports need no
  authenticated iframe cookie.

## 6. Public links are a separate, opt-in decision

Recommend **disabled in the first release**. The share dialog may prototype the
option as unavailable with its reason. Enabling it later should require operator
policy plus an explicit owner action selecting a specific frozen revision.

A public link is an anonymous bearer capability, not “named sharing without
login”. Use a fresh unpredictable secret, revocable/rotatable at the gateway,
with expiry and a separate public-content namespace. Keep control operations
on the app origin. No public live ports, home browsing, directory listings or
editor access. No analytics or third-party fonts by default; use `no-referrer`,
`noindex`, `nosniff`, bounded requests and no shared cache that bypasses revocation.
`noindex` and unguessable URLs are not confidentiality against a recipient.

Risk: forwarded URLs, screenshots and downloads cannot be recalled; inline data
and source maps may contain secrets; owner-written JS can deceive recipients or
phish even in a sandbox. Public bandwidth/abuse and externally supplied content
increase operational exposure. Revocation stops future authorized retrieval and
streams, not execution of bytes already loaded or copies already taken. State
this in the dialog, including for named sharing.

A tailnet-only server cannot produce an Internet-public link merely by changing
an ACL. Public ingress or an external snapshot-publishing service is a second
operator decision, with data leaving the private server in the latter case.

## 7. Agent interface and the `tw` mapping

Extend the existing binary's `open-habitat agent` namespace; ship version-matched
help and an account-local skill discoverable by Pi and SSH harnesses. Commands
below are **illustrative proposals, not existing commands**. They should follow
the current JSON/strict-validation CLI canon, accept secrets/text through stdin
or a file, and return opaque IDs and truthful offer state. A Pi tool can later be
thin syntax sugar for the same operations, never a separate privilege channel.

| Existing seat function | Habitat mapping |
| --- | --- |
| `tw clipboard copy -` | `agent browser copy --stdin`: offer transient text; person clicks Copy in trusted UI. No clipboard read or secret echo/history. Closed browser means pending until expiry, not copied. |
| `tw browser-open file.html` | `agent browser show --workspace ID --path report.html`: create a frozen view offer. A directory uses an explicit entry file and export manifest. Person opens side panel/tab; no OS browser automation. |
| Open workspace dev page | `agent browser preview --endpoint ID --path /`: offer a registered private endpoint, not an arbitrary URL/port. Static-build fallback when the server lacks private transport. Ordinary HTTPS links are external links with destination shown, never proxied with Habitat credentials. |
| `code <path>` | `agent browser file --workspace ID --path src/main.ts --line 40`: offer navigation to the configured Habitat editor, using existing daemon confinement. No agent editor grant; missing editor is reported plainly. Folder selection can open the workspace editor, not an unrestricted home explorer. |
| `tw fetch <seat-path>` | `agent browser upload-request`: trusted browser file picker / existing attachment upload. Person chooses the file; agent gets the stored attachment ID/path only after completion. No reading Downloads by guessed laptop path. Prefer the existing local-file-request mechanism where applicable, generalized to own-UID callers. |
| `tw client-exec` | **No equivalent.** A browser is not an OS remote shell. Named operations above replace the valid uses; arbitrary client execution would require a separately trusted installed client and another product decision. |
| `notify-jari` | Existing agent notices for in-app attention. Keep `notify-jari` as Jari's optional native external integration; do not assume every account is Jari or add a host Telegram credential store. Closed-browser push/OS notifications remain out of scope. |
| Share/show link | `agent artifact export` can produce a revision and an offer to open its Share dialog. Initial recipient/public grant changes occur in the owner's authenticated browser, not through a daemon pretending to know another person's identity. Revocation lives in that same gateway-owned dialog. |

Account-wide offers are necessary for SSH workers with no browser conversation.
They should be visible in an account tray, with a workspace link, not attached to
an unrelated Pi conversation. UI delivery failure must not stop native work;
offers should have timeouts and be inspectable without a blocking wait.

## 8. Proposed prototype round and later proof

**First, interaction only, with synthetic content and recipients:**

1. A conversation card and account tray show “agent offers to show X”, from both
   an in-conversation agent and an SSH worker. Open/dismiss/expired states,
   offline browser, duplicate tabs, phone layout and focus restoration are visible.
   Compare side-panel viewing with a user-opened tab; do not auto-open either.
2. A static chart, a small multi-file prototype and a clearly labelled live page
   show the same surrounding controls. Show a compatibility failure honestly
   rather than quietly widening the sandbox. Include copy and file-open offers.
3. The Share dialog starts “Only you”, lists exact named recipients and the
   frozen revision/file manifest, and supports removal/revocation. Show a recipient
   opening the view, a denied person, a missing/offline export and a revoked link.
   Public link is explicitly unavailable pending the separate decision.

**No prototype code is delivered by this research.** After Jari chooses the UX
and authority split, record the ADR, then implement a thin owner-only HTML offer
before sharing or generic live preview. A security spike must test real distinct
UIDs and real hostnames: app/editor cookie and storage isolation, cross-view
reads, host confusion, opaque-origin messages, direct-open CSP, traversal/link
races, socket replacement, hostile upstream cookies/redirects/WebSockets, and
revocation on existing sessions. Test modern module assets/HMR, tailnet wildcard
DNS/TLS and browsers with third-party cookies blocked. Unit mocks do not prove
these boundaries.

Out of scope: a publishing marketplace, collaborative editing, live-server
sharing, automatic port discovery, public publishing, arbitrary local-device
commands, desktop agents, artifact-to-agent command bridges, serverless compute,
new root services, content analytics and a second native workspace/history store.

**Decision to take to Jari:** approve or amend option C's split (daemon export +
gateway view/ACL authority), owner-only private live endpoints, and public links
off initially. No additional decision was needed to produce this recommendation.

## Sources and research limits

Public pages were fetched on 2026-10-25. These are documentation claims, not live
qualification of Habitat or those services. Repository paths above identify
inspected implementations at the stated revisions.

- [S1 — VS Code Remote SSH: forwarding a port](https://code.visualstudio.com/docs/remote/ssh#_forwarding-a-port--creating-ssh-tunnel).
- [S2 — code-server guide: forwarded ports and subdomain proxy](https://coder.com/docs/code-server/guide).
- [S3 — Codespaces: forwarding ports and visibility](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).
- [S4 — Gitpod Classic/Ona ports](https://ona.com/docs/classic/user/configure/workspaces/ports) (redirect from Gitpod documentation).
- [S5 — Coder workspace ports, pinned upstream source](https://github.com/coder/coder/blob/7eacfe95b28dd776bafbd7d5f04b9b7188ab1930/docs/user-guides/workspace-access/port-forwarding.md) and [web IDE/app configuration](https://github.com/coder/coder/blob/7eacfe95b28dd776bafbd7d5f04b9b7188ab1930/docs/admin/templates/extending-templates/web-ides.md).
- [S6 — JupyterHub sharing](https://jupyterhub.readthedocs.io/en/stable/reference/sharing.html).
- [S7 — JupyterHub web security and per-user domains](https://jupyterhub.readthedocs.io/en/stable/explanation/websecurity.html).
- [S8 — Claude artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) and [sharing, including legacy anonymous publishing](https://support.claude.com/en/articles/9547008-share-artifacts). Current and legacy behavior differ; do not equate all Claude link sharing with anonymous access.
- [S9 — MDN iframe sandbox and same-origin warnings](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe).
- [S10 — MDN cookie scope, prefixes and SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).
- [S11 — MDN response CSP sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox) and [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy).
- [S12 — MDN Clipboard API security and browser differences](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API).
- [S13 — Let's Encrypt DNS-01 and wildcard validation](https://letsencrypt.org/docs/challenge-types/).

Evidence/failure logs: `/var/tmp/agent-keep/habitat-browser-surfaces/` (public source
extracts, fetch logs and sanitized challenge headers; retained outside git).
Coder's initially guessed applications URL returned 404 and its index returned
403; GitHub's public repository tree and pinned Markdown supplied the required
sources instead. The attempted Claude developer-artifacts URL returned only a
32-character shell, Claude.ai returned 403 (also on retry), and an Anthropic
announcement returned 403. Official support pages supplied artifact/sharing UX;
current Claude sandbox internals remain unverified, explicitly bounded above.
A dependent local extraction first failed because the blocked Coder index file
was absent; corrected extraction and the upstream tree succeeded. An attempted
text inspection of the installed `tw` binary was unhelpful (ELF); its help and
Fleetrepo Rust source supplied the evidence instead. No tool was installed or
updated, and no external account/private browser was accessed. There is no
remaining required implementation, test, review or delegated workflow for this
research-only deliverable; the future qualification tests are not claimed as run.
