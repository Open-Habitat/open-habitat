---
created: 2026-11-23
updated: 2026-11-23
type: feature
reporter: jari
status: open
priority: normal
lane: web-search-key
lane_seq: 1
preparation: ready
---

# Web search key: key-based backend in the search extension

## Goal

The search extension (`Open-Habitat/pi-web-search`, checked out at `~/src/pi-web-search`,
pinned in `runtime/core/package.json`) gains a key-based search backend for models without
provider-native search, as designed in `issues/proto-web-search-key/result.md` (rounds 2–3,
"Host-tiedot") and decided by Jari (search key works like the Soniox speech key; Brave
first, Staan hidden until coverage is checked; keyless fallbacks stay off; provider-native
search wins when the model has it).

## Done when

- The extension reads `~/.config/web-search/key.json` (0600; `api_key`, `backend`
  brave|staan, `source` own|site) natively and offers a `web_search` tool backed by Brave
  (Staan behind the same interface, not offered until enabled) only for models without
  native search; never both tools in one conversation.
- A 401/403 from the backend writes a refusal mark (e.g. `last_refused_at`) in the
  extension's own state file, which a new save clears; the daemon can read it.
- The extension publishes which providers search natively (the list the person's row
  shows), in a form the daemon can read from the installed package.
- Tests in the extension repo; a release of the extension (version, changelog, release
  asset as the existing v0.1.0); the product's pin raised to it with the runtime lock
  regenerated as the product requires.
