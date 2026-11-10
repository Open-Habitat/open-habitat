# Result (2026-11-10)

Every agent on an installation now has a `read_page` tool. It opens a URL in
the core runtime's headless Chromium, as the person, and returns the rendered
page's readable text as Markdown, its links and, on request, a screenshot.
Nothing to set up, nothing written to the person's settings, and no hosted
renderer: the page goes only to the site.

- **Extension:** `runtime/core/page-reader.mjs`, shipped as
  `runtime/page-reader/extension.mjs`. The `pi` launcher (Habitat terminals,
  Taskfleet's Pi workers) and the daemon's browser conversations load it like
  the search extension.
- **Rendering:** a fresh logged-out browser context per read. Readability then
  Turndown run inside the rendered page, falling back to the visible text.
- **Bounds:** 30 s by default and 60 s at most; 25 MB of transfers counted at
  the proxy; 20,000 characters by default and 100,000 at most, with `offset`
  to page through; title, link and URL fields clipped; two reads at a time per
  Pi process; the browser exits after a minute idle.
- **Non-pages:** a PDF or other download is reported as not a web page.
  Text, JSON and images are read or shown.

## Community base

No community package fitted as a pin. `pi-web-access` 0.47.0 (MIT) is a broad
multi-provider bundle that changes weekly and turns on keyless third-party
backends. `pi-agent-browser-native` 0.9.18 (MIT) wraps a separate
`agent-browser` binary that downloads its own Chrome. Playwright MCP
(Apache-2.0) is interactive automation with a far larger surface than reading
a page. The extension is ours. Its extraction follows pi-web-access
(Readability, then Turndown), which it credits; no code is copied. It pins
`playwright-core` 1.58.0 (the Playwright version the qualified shell belongs
to), `@mozilla/readability` 0.6.0 and `turndown` 7.2.0. The licences are in
`licenses/DEPENDENCIES.md`.

## Security

- **Sandbox, always.** Chromium never runs without its sandbox. Ubuntu 24.04
  denies unprivileged user namespaces (`apparmor_restrict_unprivileged_userns=1`
  on Birch), so the sandbox needs an AppArmor profile, as Google Chrome's does.
  `apparmor.d/open-habitat-headless-shell` grants `userns` to the shell in
  release generations, which only root can write. Host apply and upgrade
  install and load it (`finishGeneration`), and it also loads at boot.
  Without the profile, the tool answers that the browser cannot start its
  sandbox.
- **Egress proxy per read.** Every connection of a read goes through a forward
  proxy inside the agent's process. The proxy:
  - resolves names itself and connects to the address it checked;
  - refuses this host's own, loopback, private, link-local and CGNAT
    addresses, unless every address of the agent's own URL is local;
  - counts every byte;
  - serves only connections of this Unix user, according to the kernel's
    socket table.

  WebRTC may use only the proxy. Chromium's Local Network Access check alone
  was not enough: it leaves top-level navigation alone.
- **Review.** Independent review: GPT-6 Astra as finder, then Claude Fable 5.1
  as a false-negative probe of the proxy. It found ten defects, all fixed:
  - a redirect or script navigation to loopback returned the local service;
  - worker downloads escaped the byte bound;
  - WebRTC sent UDP to local addresses;
  - Playwright offered the proxy password to any site answering 401;
  - a mixed public/local DNS answer unlocked local access;
  - smaller ones: unbounded metadata, cancellation before start, close
    waiting on an idle connection, the host's own public addresses, and
    oversized extraction.

  The review level was high: agents gain a networked browser, and the host
  operator installs a MAC policy.

## Live verification on Birch

Every run used a disposable `HOME`/`PI_CODING_AGENT_DIR` holding a copy of
Jari's ChatGPT-subscription credential, which had 108 h left, so no refresh
could rotate his login. The copy was deleted afterwards. The runs used the
built arm64 payload's own launcher, with `openai-codex/gpt-5.6-luna`. Logs are
in `evidence/`: `live-js`, `live-bounds`, `live-pdf`, `live-shot` and
`live-nosandbox` from the first build; `live-proxy-build` (the same cases plus
a redirect, after the review fixes); `live-final-build` from commit
cffd70747.

- **JavaScript-rendered page:** `https://quotes.toscrape.com/js/`. All ten
  quotes, which exist only after the page's script ran, and its five links.
- **Slow page:** `https://httpbin.org/delay/10` with `timeout_seconds` 5 gave
  *No response from httpbin.org within 5 s.* in about 5 s.
- **Non-HTML:** `https://www.rfc-editor.org/rfc/rfc9110.pdf` gave *not a web
  page (application/pdf)*. `https://registry.npmjs.org/turndown/7.2.0` (JSON)
  was read as text.
- **Screenshot:** `https://example.com` with `screenshot: true`. The image
  reached the model, which described the layout.
- **Redirect to loopback (proxy and final builds):**
  `https://postman-echo.com/redirect-to?url=http://127.0.0.1:18999/secret`.
  The proxy refused it, the listener on 18999 received nothing, and the result
  names the refused address.
- **No profile:** with the profile unloaded, the tool answered that the browser
  cannot start its sandbox.
- **AppArmor attachment:** the product profile, loaded unchanged, attached to
  the shell placed briefly under a probe generation
  `/opt/open-habitat/generations/zz-web-page-reader-probe-…/payloads/core/runtime/browsers/…`
  (removed afterwards). The sandbox started under `NoNewPrivileges`, as in the
  daemon. The renderer ran with a seccomp filter (mode 2) and in its own user,
  PID and network namespaces. The conversation runs used a copy of the same
  profile with the attachment path changed to the scratch payload.
- **Proxy user check:** `sudo -u nobody curl -x <proxy>` was reset, the own
  user got 200, and a loopback target got 403.
- **Not verified live:** the daemon's browser-conversation path. It loads the
  same file through `piArgs`, but Birch's daemon runs the installed release.

## Size added to every installation

Measured against the previous core runtime (web-search-native's rebuild):

| | amd64 | arm64 |
|---|---|---|
| core download (`core.tar.gz`) | 317.3 → 425.1 MB (+108 MB) | 315.5 → 430.2 MB (+115 MB) |
| core on disk (expanded) | 839.1 → 1122.9 MB (+284 MB) | 829.4 → 1188.4 MB (+359 MB) |
| Chromium's Ubuntu libraries, minimal 24.04 with the previous core packages | 68 packages, 64.3 MB, 262 MB on disk | 66 packages, 64.0 MB, 264 MB on disk |

The arm64 shell is Playwright's unstripped build (288 MB binary). The browser
profile shrinks from about 158 MB to 46 MB, because the shell left it.

## Runtime builds

The final inputs (commit cffd70747) were rebuilt natively, arm64 on Birch
and amd64 on Alder. Three profiles changed inputs: core, browser (its lock
lost the shell) and integrations (the release cut counts any change to the
core npm lock against it). Every archive is on Alder under
`/var/tmp/agent-keep/web-page-reader/{arm64,amd64}/{core,browser,integrations}`
and verifies against its `artifact.json`. The next release cut takes:

```
--rebuilt arm64=/var/tmp/agent-keep/web-page-reader/arm64/core \
--rebuilt arm64=/var/tmp/agent-keep/web-page-reader/arm64/browser \
--rebuilt arm64=/var/tmp/agent-keep/web-page-reader/arm64/integrations \
--rebuilt amd64=/var/tmp/agent-keep/web-page-reader/amd64/core \
--rebuilt amd64=/var/tmp/agent-keep/web-page-reader/amd64/browser \
--rebuilt amd64=/var/tmp/agent-keep/web-page-reader/amd64/integrations
```

| archive | sha256 |
|---|---|
| arm64 core | `927fa539dee41b08e03a62d6087cce75aeacae447235d2a5ef5e5c3d7d041ce8` |
| amd64 core | `449097a4b7748a4bcf2e95302edee55bc90c3f47398943ebb6687014f5289b8d` |
| arm64 browser | `ff876c48b7782f9c39c4c8094260733aa09882fede8c58f8584d944b089cb148` |
| amd64 browser | `4567cfee3a5b9893ca38cad772ee43b4e96c66e0c25615dd2bc10047f88eb803` |
| arm64 integrations | `2bb507dc5cfc5d2e345d16e8039d9ea11ae110e690153e531ab1c73617c9215d` (byte-identical to pilot.26's) |
| amd64 integrations | `3fd41678f62f4a40b8414ed9cf8d8652d03cc4f33b7e5904ff8955e592b852a6` |

They supersede web-search-native's core archives, whose inputs they include.

## Checks

- **Page reader:** `node --test internal/daemon/pi-device-test/page-reader.test.mjs`,
  14 cases, against the browser suite's shell (1243) and against the
  qualified 1208 shell with the sandbox. The cases cover:
  - a JavaScript-rendered page;
  - a slow page and a silent server against the bound;
  - a download versus a text file, and paging;
  - the byte bound, including from a worker;
  - bounded metadata, and cancellation;
  - a public page against a service on the host by subresource, redirect,
    script navigation, worker and WebRTC (with a control run proving the
    WebRTC test);
  - the agent's own local URL;
  - the proxy's user check and close;
  - the host's interface addresses;
  - real Pi offering the tool, with the result reaching a synthetic model.
- **Host:** `go test ./internal/host`, and the root-container apply tests
  (`TestApply*` in disposable Ubuntu), including the profile's publication.
- **Build:** `scripts/test-browser-runtime-build.py`,
  `test-profile-runtime-build.py`, `test-ui-reference.py`, and
  `validate-project-view.py`.
- **Daemon:** `go test ./internal/daemon` passed except
  `TestSnapshotListsWorktreePlaces`. That test needs the Python `referencing`
  module, which Birch's Python lacks; it is unrelated to this change.

## Decisions for later review

- **Proxy in the agent's process rather than relying on Chromium.**
  Alternatives: Chromium's Local Network Access check alone (it misses
  top-level navigation and redirects), or Playwright routes (they miss
  redirect hops and workers). The proxy is the only boundary the review could
  not get around. The cost is about 120 lines, and a read's traffic passes
  through Node.
- **The agent may read a local URL itself.** When every address of the
  agent's own URL is local (a dev server on the host, a tailnet machine), the
  read and its page may reach local addresses, as `curl` could. Alternative:
  refuse all local reading. That would break reading one's own running app.
- **Honest headless user agent.** Chromium announces `HeadlessChrome`, and
  bot challenges block some sites: w3.org answered with a Cloudflare
  challenge page, reported as a 403. Alternative: a normal Chrome user agent,
  which helps somewhat but presents automation as a person.
- **Two reads per Pi process, no limit across processes.** Each Pi process
  (conversation, terminal, Taskfleet worker) has at most one browser, closed a
  minute after its last read. Alternative: a per-person cross-process limit,
  which would need a shared lock in the person's runtime directory.
- **The arm64 shell is not stripped.** Stripping would save about 120 MB on
  disk, but it needs binutils in the builder, and the builder's rule is that
  its own tool versions never reach an archive.
- **AppArmor profile installed by apply and upgrade, not by Fleetrepo.** It
  follows the existing pattern of `finishGeneration` installing system files.
  It is not part of the predecessor `generationMatches` check, so upgrading
  from a generation without it still works. On a host whose AppArmor tools
  were removed, apply goes on and the reader refuses.
- **Readability's byline.** On some pages it takes a quoted author for the
  page's byline and drops it from the text (quotes.toscrape: *By: Albert
  Einstein*). That is accepted as Readability's behaviour.
- **English notes in tool results.** The model reads them. They are not shown
  to the person as such.
