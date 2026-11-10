# Web search and JavaScript pages for agents on Pi: research

Research step for `pi-web-search-capability`, 2026-11-10. Material for the
design discussion with Jari. Nothing is built. Prices and terms were read from
the providers' own pages on this date unless marked otherwise; they changed
several times during 2026, so treat them as a snapshot.

## Summary

Search can come from two places. The first is the model provider the person
already has, which runs the search inside the model request. The second is a
separate search API that a Pi tool calls with its own key.

The first route needs no new credential. On a ChatGPT subscription it works
today with a 15-line Pi extension. I verified it live on Birch with the
release's own Pi 1.3.0. The route has one gap: Claude through
`pi-claude-bridge`. The bridge starts Claude Code with no built-in tools, so
Claude's own WebSearch is switched off on the provider path.

The second route covers that gap and every other provider. It needs a key, and
the question for Jari is whose key: the person's own key in their native Pi
config, or an administrator's key handed out in the same way as the site AI
key.

Reading JavaScript pages is a separate tool. The optional `browser` profile
already ships a qualified headless Chromium for it.

My recommendation (details below):

1. Ship a small provider-native search extension in the core runtime first. It
   gives every Codex-subscription and OpenAI/Anthropic-key user search with no
   setup and no new credential, and it fixes the incident that started this
   issue.
2. Then add one key-based search tool with Brave as the default backend. The key
   lives in the person's own Pi config, and an administrator can give a site
   key using the ADR 0030 copy pattern that the speech key already follows.
   This route serves Claude-bridge users and everyone else.
3. For JavaScript pages, offer an agent tool on top of the existing browser
   profile. Do not use a hosted renderer by default.
4. Do not enable any keyless or zero-config third-party search (Exa's keyless
   MCP, DuckDuckGo scraping) by default.

## What the code shows today

- **Pi 1.3.0** (core runtime, `@earendil-works/pi-coding-agent`) has no web
  search tool. It does have native MCP (`mcp.json`, `pi mcp add`,
  `pi.registerMcpServer`). It also has a `before_provider_request` extension
  event that can rewrite the provider payload just before it is sent
  (`dist/core/sdk.js`, `transformProviderPayload`). That event is how a
  provider's native tool can be passed through without changing Pi.
- Pi's Responses stream parser
  (`pi-ai/dist/api/openai-responses-shared.js`, `createSlot`) builds content only
  from `reasoning`, `message`, `function_call` and `custom_tool_call`. Other
  output items, such as `web_search_call`, are skipped. The Anthropic parser
  likewise skips `server_tool_use` and `web_search_tool_result` blocks. Neither
  parser crashes on them. The cost is that URL annotations and citations are not
  stored as structured data. In the probe below, the model's inline Markdown link
  survived anyway.
- **pi-claude-bridge 0.9.3** starts Claude Code with `tools: []` on the
  provider path (`src/index.ts`) and serves Pi's own tools to Claude over an
  in-process MCP server. So a Pi tool such as `web_search` reaches a
  Claude-bridge model like any other Pi tool, while Claude Code's own
  WebSearch/WebFetch do not. The only built-in path is AskClaude (`read`/`full`
  modes keep WebSearch). It is opt-in, and upstream marks it deprecated: "may be
  removed in a future release" (bridge README).
- **Shipped extensions reach every Habitat entry point.** The daemon starts
  browser conversations with the release's extensions. `runtime/core/agent-bin/pi`,
  the `pi` that Habitat terminals and Taskfleet Pi workers run, adds
  `--extension` for Taskfleet's skills and the bridge in the same way. An extension
  added to the core runtime in both places therefore covers all three. Packages a person
  installs with `pi install` are loaded natively by Pi in all three as well.
- **The browser profile** (`runtime/profiles/browser/artifact-lock.json`)
  ships Python Playwright 1.58.0 and `chromium-headless-shell` 145.0.7632.6.
  The profile is optional, and `docs/operations.md` ("Headless QA browser
  assets") describes it for QA processes. It is not exposed to agents as a
  tool.
- **Credential precedents.** The site AI key (ADR 0030,
  [adr-0030](../../docs/decisions/adr-0030-site-onboarding-authority.md)) is
  written into a person's native Pi `auth.json` by their own daemon, under Pi's
  lock, only where nothing or an earlier site copy is present. The speech key
  follows the same pattern with a `source: site|own` marker
  (`internal/daemon/speech_linux.go`, `GiveSiteKey`). A site search key would
  be a third instance of this pattern, not a new mechanism.

## Live probe: provider-native search through Pi's payload hook

On Birch, in Jari's account, I ran the release's own Pi
(`/opt/open-habitat/core/agent-bin/pi`, Pi 1.3.0) with
`openai-codex/gpt-5.6-luna` on the ChatGPT subscription, no session saved. The
probe loaded a throwaway extension that appends `{ "type": "web_search" }` to
`payload.tools` in `before_provider_request` and logs `web_search` stream
events.

- **Search only.** The model ran 4 `web_search_call` items (`search`,
  `open_page` on npmjs.com and registry.npmjs.org, `search`). It answered
  "pi-web-access 0.47.0, published November 6, 2026" with the npm URL; npm's
  own record says 0.47.0, modified 2026-11-05T01:05Z. Exit 0.
- **Search, then a Pi tool, then search again.** With `bash` enabled, the model
  searched, ran `echo 0.47.0 > v.txt` through Pi's bash tool, searched again
  and answered. The file held `0.47.0`, exit 0. Across this tool round trip Pi
  sent two requests, and the injection happened in both. Leaving the search
  items out of the replayed input did not break the continuation.
- **Observation.** The star count it reported (1.6k) lagged GitHub's API
  (1,782). The probe did not set any live/cached parameter. Codex CLI's
  documented default is `cached`, an OpenAI-maintained index, so the results
  may not be live.

Not verified: the Anthropic API route (no Anthropic key on Birch), OpenAI API
keys, and long multi-turn conversations with compaction.

## Options

### A. Provider-native search (no new credential)

| Provider in Pi | Native tool | How Pi would pass it | Cost to the person | Status |
|---|---|---|---|---|
| `openai-codex` (ChatGPT subscription) | Responses `web_search` on `chatgpt.com/backend-api/codex/responses` | Payload hook adds `{type:"web_search"}` | Counts against the plan's Codex allowance. OpenAI's help page names no separate search price | **Verified live** (above) |
| `openai` (API key) | Responses `web_search` (`gpt-6-astra` recommended) | Same hook | $10 / 1k calls on reasoning models, plus search-content tokens at model rates ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)) | Same API shape as Codex; not probed |
| `anthropic` (API key) | `web_search_20250305` / `_20260209` / `_20260318`, `web_fetch_*` server tools | Hook adds the tool; or a separate tool call | $10 / 1k searches plus tokens; web fetch costs tokens only ([search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool), [fetch](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool)) | Not probed. Anthropic requires result blocks to be sent back *unmodified* when they are sent at all. Pi drops them, which should be allowed but needs a test. Newer versions default to `allowed_callers: ["code_execution_…"]`, so the basic version or `allowed_callers: ["direct"]` is the safe choice |
| `claude-bridge` (Claude subscription) | Claude Code's WebSearch/WebFetch | Not reachable: the provider path runs `tools: []` | — | Needs an upstream bridge option to allow WebSearch/WebFetch on the provider path, or route B |
| `deepseek`, Gemini, xAI | DeepSeek `/v1/tools/search`; Gemini grounding; Grok `web_search` | Separate request with the same credential | Provider's own | Handled by `pi-web-search` (below) |

Two existing Pi packages already do this, both MIT. The difference is
mechanical:

- [`pi-web-search`](https://github.com/ttttmr/pi-web-search) by ttttmr
  (1.7.0, ~85k weekly downloads, 49 stars; npm says MIT, but the GitHub repo
  shows no licence file). It offers a `web_search` tool that makes a *separate*
  request to the current model's provider with the person's Pi credentials
  (Codex, OpenAI, Azure, Copilot, Anthropic, Gemini, xAI, DeepSeek). It does
  not cover claude-bridge.
- [`pi-web-access`](https://github.com/nicobailon/pi-web-access) by
  nicobailon (0.47.0, released 2026-11-05, ~1.3M weekly downloads, 1,782 stars,
  MIT, roughly weekly releases). This is the dominant package. It reuses Codex
  subscription auth for OpenAI search and supports about 40 search backends,
  fetch with Readability plus browser-like TLS, PDF, YouTube and GitHub
  cloning. It also runs as an MCP server for other agents.
  - Its `auto` default falls through to **keyless Exa MCP** when nothing else is
    configured. It also has an opt-in Gemini Web mode that reads browser
    cookies.
  - It reads keys from `~/.pi/agent/web-search.json`, the person's own native
    config.

The in-request hook I verified is simpler than both packages. The model
searches within its own turn, with no second model call and no second
reasoning pass. The trade-off is that it depends on Pi tolerating unknown
output items, which it does today but does not promise.

### B. Search APIs (a key-based Pi tool)

| Service | Price (2026-11) | Free use | Privacy / terms for agents | EU |
|---|---|---|---|---|
| **Brave Search API** | $5 / 1k (Search); Answers $4 / 1k + tokens | $5 credit per month (≈1,000 searches), needs a card and attribution on the project's website | Own independent index. "Architectural Zero Data Retention", SOC 2 Type II ([brave.com/search/api](https://brave.com/search/api/)). Terms forbid storing results beyond transient use | US company; usable from the EU |
| **Exa** | $4 / 1k Lite, $7 / 1k Auto, contents $1 / 1k pages ([pricing](https://exa.ai/docs/admin/pricing)) | $10 credit monthly. Keyless hosted MCP limited to roughly 50–150 calls/day **per IP** (third-party figures; Exa publishes none) | ZDR only on Enterprise ($12k/yr) | US |
| **Tavily** (Nebius since 2026, [SEC 6-K](https://www.sec.gov/Archives/edgar/data/0001513845/000110465926064092/nbis-20260331xex99d2.htm)) | $0.008 / credit pay-as-you-go; Project $30 / 4k ([pricing](https://www.tavily.com/pricing)) | 1,000 credits/month, no card | No retention statement on the pricing page | Owner is Amsterdam-based; Tavily keeps its brand |
| **Kagi Search API** | $12 / 1k search, $4 / 1k extract ([kagi.com/api/pricing](https://kagi.com/api/pricing)) | None; needs any Kagi account | Meta-search proxied through Kagi, so upstreams don't see the asker | US/EU company; usable from the EU |
| **Staan** (Qwant + Ecosia's EUSP) | From €2 / 1k ([docs](https://docs.staan.ai/introduction)) | 1,000 requests/month | EU jurisdiction and data centres, no profiling | **EU**. Young; early-2026 reports said coverage was French-first |
| **SearXNG** (self-hosted, AGPL) | Free software | — | Queries leave via the host's IP to Google/Bing/DDG and others. Upstream engines are banned for a day to weeks on CAPTCHA ([settings docs](https://docs.searxng.org/admin/settings/settings_search.html)) | Wherever it runs |
| Keyless scraping (DuckDuckGo HTML, Bing) | — | — | Already failed in the incident: block page and irrelevant results | — |

What matters for Habitat beyond price:

- **A shared egress IP.** Every person on an installation shares the same
  outbound address. Anything rate-limited per IP is shared by all of them:
  Exa's keyless MCP, DuckDuckGo and SearXNG's upstream engines. It would run
  out for everyone at the same moment and look like a product fault. This is
  also why the incident's curl fallback failed.
- **Consent.** A keyless default sends a person's queries to a company they
  never chose. With a key, they (or their administrator) have chosen it.
- **Brave as the default.** It has its own index rather than a Google/Bing
  resale, a clear ZDR statement, the cheapest per-search price among
  independent indexes, and a free credit that covers a light personal user.
  Staan is the EU-jurisdiction choice to offer next to it once its coverage is
  broad enough for Finnish and English queries. That is worth checking
  directly, since the coverage figures above are third-party.

### C. Reading JavaScript-rendered pages

| Route | What it reads | Where the URL goes | Fit |
|---|---|---|---|
| Plain fetch + Readability (as in `pi-web-access`) | Server-rendered HTML, PDFs | The site only | Cheap first step; fails on SPAs |
| Provider fetch (Anthropic `web_fetch`, Codex `open_page`) | Text and PDF | Provider | Anthropic's fetch **does not render JavaScript** (its docs) |
| Hosted renderers (Jina Reader, Firecrawl, Exa contents) | Rendered pages | A third party (Jina is now Elastic's; its free key is for non-commercial use, per a third-party source) | Fine as a person's opt-in; not a default |
| **Headless Chromium on the host** | Everything a logged-out browser sees | The site only, from the person's own UID | The `browser` profile already ships and licenses `chromium-headless-shell` 145 with Python Playwright 1.58 |

Browser tool options on top of the profile:

- [Playwright MCP](https://github.com/microsoft/playwright-mcp) (Apache-2.0)
  works headless and isolated with an accessibility-tree snapshot. Upstream
  itself recommends its CLI-plus-skills form for coding agents because it uses
  fewer tokens. Both are Node packages: they would need a `playwright-core`
  pinned to the profile's 1.58 and `--executable-path` pointing at the shipped
  shell.
- A small Habitat skill and script that uses the profile's Python Playwright
  to "render this URL to text". This needs no new dependency.

Either way the browser runs as the person in their own session. That fits
"Unix users are the boundary" better than any shared rendering service.

## How credentials would flow

Each route below keeps "no host credential broker": the search call is made
from the person's own UID with a key in the person's own file.

1. **No credential (route A).** The search rides on the provider credential
   already in the person's Pi `auth.json`. Nothing new is stored anywhere.
2. **Person's own key (route B).** Settings › AI gets a "Haku" row. The
   person's daemon writes the key into the search extension's native config,
   for example `~/.pi/agent/web-search.json` if `pi-web-access` is adopted,
   with mode 0600 in their home, the same way the speech key is handled. Pi
   and the person's terminal tools read it natively. The gateway never sees
   it after the write.
3. **Administrator's key (route B).** The gateway stores one site search key,
   and the person's daemon copies it into their native config. The copy happens
   only where there is no key or an earlier site copy, and the record carries
   salted fingerprints only. This is exactly ADR 0030's model and the speech
   key's `source: site`. A copy is the person's own credential: removal is not
   revocation, and only rotating the key at Brave stops it. The cost is a third
   persistent provider credential in the gateway. ADR 0030 called the AI key
   "the single named exception", and the speech key already extended it.
   Adding search is an authority decision for Jari, not mine (open question 1).

Not considered: a search proxy in the gateway with per-person tokens. That is
the credential broker the root `AGENTS.md` forbids, and ADR 0030 rejected it
for the AI key for the same reason.

## What Taskfleet workers and Alder's terminal sessions would get

- **Inside a Habitat installation**, an extension shipped in the core runtime
  reaches browser conversations, `pi` in the Habitat terminal, and Taskfleet's
  Pi workers, all through the same launcher. Route A then works for any
  worker on a Codex subscription (for example the `capable-openai` profile)
  with no setup, and route B works for everyone once a key exists.
- **On Alder** (not a Habitat installation), terminal Pi and Taskfleet Pi
  workers run Jari's own Pi, configured by Fleetrepo. They get nothing from the
  Habitat release. The same extension has to be declared as a Pi package in
  Fleetrepo's `~/.pi/agent/settings.json` `packages`. Route A would immediately
  fix the incident that started this issue (a `capable-openai` research worker
  with no search), with no key. This could be done in Fleetrepo before any
  product work.
- Claude Code workers (e.g. `prototype-opus`) already have WebSearch and
  WebFetch and are unaffected.

## Recommendation

1. **Ship route A first, as a small Habitat-owned extension in the core
   runtime.**
   - It injects the provider's native search for `openai-codex`, `openai` and
     `anthropic` models and does nothing for other providers.
   - Prefer it to adopting a package: it is about 50 lines that we can test
     against the pinned Pi.
   - `pi-web-search`'s separate-request design is the fallback if Pi stops
     tolerating unknown items.
   - Before shipping, it needs an Anthropic probe and a long-conversation
     probe.
   - Reasons: no new credential, no new service, no third party the person did
     not already choose, and it closes the gap for the most common agent setup.
2. **Then route B with a pinned search package and Brave as the default.**
   - Settings › AI gets a search row: own key, or the administrator's site key
     through the ADR 0030 pattern.
   - Keyless fallbacks stay off unless the person turns them on.
   - Whether to pin `pi-web-access` or write a Brave-only tool depends on
     whether its keyless `auto` chain can be disabled by a release default
     without writing the person's config. If it cannot, a small own tool is
     safer.
3. **For JavaScript pages, add an agent browser tool on top of the existing
   `browser` profile.** It runs in the person's UID; hosted renderers are only
   a person's opt-in. This makes the browser profile matter for agents, which
   raises open question 4.
4. **Raise claude-bridge's provider-path WebSearch with the bridge upstream.**
   Until it lands, Claude-subscription users depend on route B.

## Open questions for Jari

1. **Site search key.** May the gateway hold an administrator's search key
   and copy it to people's native config, as with the AI and speech keys? Or
   should search keys always be personal?
2. **Default backend.** Brave (independent index, US) as the default, with
   Staan (EU jurisdiction, coverage still to verify) offered next to it? Or
   should EU jurisdiction decide the default for customer installations?
3. **Codex-subscription search.** It spends the person's plan allowance, and
   the results may come from OpenAI's cached index rather than live pages.
   Acceptable as the zero-setup default?
4. **The browser profile becomes an agent capability.** Should agent page
   reading require the optional `browser` profile, or should the headless
   shell move into the core runtime?
5. **Alder.** Should Fleetrepo add route A to Jari's own Pi now, ahead of the
   product, so that Taskfleet workers there stop falling back to curl?
6. **Adopt or own.** Is it acceptable to own the small native-search extension
   rather than pin a third-party package that changes weekly? (Recommended.)
