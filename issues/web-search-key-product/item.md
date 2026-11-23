---
created: 2026-11-23
updated: 2026-11-23
type: feature
reporter: jari
status: testing
priority: normal
lane: web-search-key
lane_seq: 2
preparation: ready
blocked_by: ['@web-search-key-extension-backend']
---

# Web search key: site key and own key in the product

## Goal

Implement Jari's chosen design for the web search key (`issues/proto-web-search-key/`,
round 3 direction A "Palvelu kerrallaan", with round 2's speech-key logic and host facts):
the administrator's site search key on the server Integraatiot page and the person's own
key on Asetukset › Tiedot agenteille, both working like the Soniox speech key.

## Done when

- Gateway: the site search key in the gateway's own 0600 file, `/api/v1/server/search-key`
  (read/set/delete), a new contract schema, refusal codes; recorded as an ADR 0030
  amendment (third persistent service key, Jari 23.11.2026 "like Soniox") and in
  `internal/AGENTS.md`'s rule.
- Key check on the administrator's own daemon; copy to each person's daemon at the same
  moments as the speech key (`GiveSiteKey` semantics); a new key replaces earlier copies,
  never a person's own key; delete revokes nothing.
- Person's daemon: `~/.config/web-search/key.json`, `/api/v1/search/key` (read, save with
  a test search, delete), contract schema; reads the extension's native-search list and
  refusal mark (from `web-search-key-extension-backend`).
- Browser: direction A on both pages (Brave row; Staan row hidden until coverage is
  verified, one service at a time), settings-index rows, fi/en texts, open-habitat-ui
  references regenerated.
- Focused Go/web checks, touched and new browser specs; independent review (gateway key
  storage and copies cross an authority boundary).

## Comments

### 2026-11-23T19:44:56Z · @agent

Built as round 3 direction A (Brave only). A live check with a real Brave key on the test server remains; result.md says what to try.
