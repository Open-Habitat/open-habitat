# Result (23.11.2026): the web search key in the product

The site's search key and the person's own key work like the Soniox key,
laid out as round 3 direction A of `proto-web-search-key` ("Palvelu
kerrallaan"). Only Brave is shown and accepted; Staan stays hidden until its
coverage has been checked.

## What was built

- **Gateway** (`internal/gateway/site_search_key_linux.go`): the site key in
  its own gateway-UID 0600 file `site-search-key.json` beside the AI key's,
  read back as service, suffix and set time. `/api/v1/server/search-key`
  (read, `/set {backend, key}`, `/delete {}`) for a current administrator.
  The set first asks the administrator's own daemon for one trial search
  (`/internal/v1/web-search/key-check`), stores the key, then gives it to
  every joined person's daemon (`/internal/v1/web-search/site-key`) and
  answers the counts. The login that creates an account gives it too.
  Refusal codes are `search_key_rejected` (409), `search_limit_reached`
  (429) and `search_unavailable` (503). The person's own route
  `/api/v1/web-search/key` is forwarded unparsed.
- **Daemon** (`internal/daemon/web_search_key_linux.go`):
  `~/.config/web-search/key.json` (`api_key`, `backend`, `source`), written
  only by the daemon. GET/POST/DELETE on `/api/v1/web-search/key`, where a
  save first makes one trial search with the extension's outcome rules.
  `GiveSiteKey` answers seeded, replaced, already_current or kept. The read
  carries the extension's refusal mark when it names this key's SHA-256 and
  service, and the provider list from the core runtime's
  `node_modules/@open-habitat/pi-web-search/native-search.json`. Writing a
  key removes the mark.
- **Contracts**: `web-search-key.schema.json`, `server-search-key.schema.json`,
  examples, scenario CT-047 and negative checks.
- **Browser**: on Palvelinintegraatiot, a Brave row after the other
  services, with an *Aseta avain…* dialog, an *Avain* menu (*Vaihda avain…*,
  *Poista avain*, with the key and date as its heading), the counts on the
  row, and the removal note. On Tiedot agenteille, a Brave card under
  Yhdistetyt tilit (source, *Lisää oma avain* / *Vaihda avain*, *Poista*, the
  refusal notice, the Verkkohaku service row naming which models use the
  key) or a Brave tile under Lisää tili. Settings search rows `web-search`
  and `server-brave`. fi/en texts in `text/webSearch.tsx`. UI references
  regenerated; this also brought in drift that was already on main
  (`restartNotice`, `upgradeNotice`, `HistoryView`).
- **Rules**: an ADR 0030 amendment (*Site service keys beyond the AI key*)
  and `internal/AGENTS.md` name the search key as the third persistent
  service key and give the person's key file its own rule.
  `internal/daemon/host-context.md` tells agents where the key is set.

## Deviations from the speech key

1. **The service is part of the key** (`backend`), in the files, the
   contracts and the give. The speech key's region is found by the save
   instead. A search key cannot be tried at two services without sending it
   to the one it was not given to (round 2's deviation 1). In direction A the
   service is the row, not a choice in the form.
2. **One service at a time.** A key for the other service replaces the
   stored key, and its site copies as a changed key would. The dialog says
   so (`replacesSite`/`replacesOwn`), and the other service's row says
   *Käytössä on X*. With Staan hidden, this shows only for a Staan key
   written by hand.
3. **The read says which models use the key** (`native_providers`, from
   the extension's list). The browser compares it with the providers the
   person has models for (`pi/models`). Neither side keeps a table.
4. **The read shows a later refusal** (`refused_at`, from the extension's
   mark by key digest). The speech key's refusal is seen during the
   dictation itself.
5. **Place and shape**: a service row and a card or tile among the
   integrations, not a section of its own. The forms open in a dialog, and
   the person's form is not open when there is no key (round 3).
6. **Route prefix `/api/v1/web-search/key`**, not the issue's
   `/api/v1/search/key`, because `/api/v1/search` is already the
   conversation search. The schema is `web-search-key.schema.json` for the
   same reason (`search.schema.json` exists).
7. **No agent command** (the speech key has `agent speech-key`). The host
   context tells agents to send the person to Tiedot agenteille. An agent
   command would need its own CLI canon rows. Nobody asked for one, and the
   key is set once.
8. **Settings index has no `server-staan` row** while Staan is hidden (the
   round planned `server-brave` and `server-staan`).

## Decisions for later review

- **Key shape `^[A-Za-z0-9_-]{16,256}$`**, narrower than the extension's
  "8–512 printable ASCII". Brave's keys fit it, the suffix stays plain, and
  a reference such as `$BRAVE_API_KEY` is refused. If Staan's keys need
  more, both rules widen together.
- **Staan is reserved on the wire.** Read shapes and stored records accept
  `staan`, but set and update accept only `brave`, because a Staan key has
  no trial search. A Staan key written by hand is kept, and shown as such.
- **The site copy's give removes the refusal mark** as the own save does,
  because a newly written key is never the refused one.
- **The refusal mark is advisory.** A mark that is unreadable, not private,
  or names another key or service is simply no refusal. An unreadable key
  file is an error, never absence, as with the speech key.
- **A saved site key that could not be given says so.** The page shows
  "Avain tallennettiin, mutta sitä ei voitu antaa jo liittyneille" when the
  set's reply carries no `given`. The speech key's page has the same gap
  and was not changed here.
- **The first-login give is not ordered against a rotation** (review F1,
  dropped by the triage rules as rare). The setup: an administrator stores
  key B while a new person's first-login give of key A is still in flight.
  If A arrives after B, the person keeps A until the next set. This was
  reproduced with a held fake daemon. A re-give loop fixes it, but adds
  code for a window of milliseconds to seconds. The speech key has the same
  shape.
- **The users line names provider families** (ChatGPT, Claude, OpenAI,
  Anthropic, DeepSeek). The person's providers come from the model list, so
  a provider whose catalog is not readable is missing until the next read.

## Checks

All runs used `umask 077`.

- `./scripts/test-focused.sh --area contracts`: valid (112 schemas, 45
  scenarios).
- `--area go` for `./internal/gateway` and `./internal/daemon` passed in
  full. New tests cover the site copy never replacing the person's own key,
  an unsafe or unknown key file never counting as absence, the trial search
  outcome rules (401/403/422 token, 429/402, 5xx, redirect), the refusal
  mark matched by digest and service, the native list, the internal routes'
  peer check and bounds, the gateway's administrator gate, CSRF, refusal
  codes, the file failing closed, gives to joined people and at first
  login, and delete recalling nothing. `go test ./test/browser-host` passed.
- `--area web`: biome, tsc, 264 vitest files passed, including the new
  `webSearch.test.ts` and the settings-index case.
- Browser: the new `web-search-key.spec.ts` (2 cases, axe on the dialog and
  the card) passed. Touched specs: integrations, server-integrations,
  server-settings-area, settings-search, settings-three-pages,
  integrations-apple, atlassian, trello, google-personal-accounts,
  agent-resources and speech-input. 58 passed and 3 failed; the same 3 also
  fail on main at `ab04fe62c`. The settings-search index case is already
  filed (`settings-search-index-missing-rows`). The two speech-input
  hour-ceiling cases are filed as `speech-input-hour-ceiling-main-failure`.
- Screenshots (not kept): both pages at 1440 light, the person's card at
  1440 dark and at 390. The rows and the card are in proportion with their
  neighbours.
- Independent review (`/llm-review`, critical): gpt-6-astra as finder and
  claude-fable-5-2 as verifier. Both candidates were confirmed. The
  assessment fixed F2 (silent failed distribution, including a concurrent
  delete answered as stored) and dropped F1 (see above).

## Live check

On the test server with this release, as an administrator: Palvelimen
ylläpito › Integraatiot shows a Brave row last, *Ei tarjolla*. Set a real
Brave key. A wrong key keeps the dialog open with the refusal. The right
key makes the row *Tarjolla* with "N sai avaimen". As a person with a
DeepSeek key, Tiedot agenteille shows the Brave card (*Ylläpitäjän avain*).
A new DeepSeek conversation asked about today's news calls `web_search` and
cites links. A ChatGPT or Claude conversation has no such tool. Save an own
key and check that the card says *Oma avain*. Then set a site key again and
check that the person is counted as *käyttää omaa avaintaan*. Finally write
a deliberately wrong key into `~/.config/web-search/key.json` (0600,
`"source": "own"`) and search with DeepSeek. After a reload the card shows
that Brave refused the key, with *Ei vastaa*.
