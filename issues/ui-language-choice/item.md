---
created: 2026-10-31
updated: 2026-10-31
type: feature
reporter: jari
status: open
priority: high
lane: i18n
lane_seq: 1
preparation: ready
---

# UI language choice: System, Suomi, English with a server default

## Description

Jari 31.10.: a customer needs the system in English soon. Each person chooses
whether Open Habitat is in Finnish or English. The choice has three values:
**System**, **Suomi**, **English**. System follows the browser's language;
a system language other than Finnish or English falls back to English. The
server's settings carry the default language for people who have not chosen.

Today every string is Finnish and hard-coded in `web/src` (about 70 000
lines of components, `index.html` says `lang="fi"`, the landing page and
sign-in are static Finnish). This issue builds the foundation and the choice;
`ui-english-coverage` translates the rest of the interface on top of it.

### Recommended approach (conductor, 31.10.; Jari may change it)

- **No i18n library.** A typed message catalog in TypeScript: the Finnish
  catalog defines the keys and an English catalog of the same type must
  supply each one, so a missing translation is a compile error rather than a
  runtime gap. Plurals and dates through the platform's `Intl`. A library
  (i18next, Lingui) would add a runtime dependency and an extraction step for
  what two compile-checked catalogs already give.
- **Where the choice lives:** the person's choice in the daemon's account
  preferences (`contracts/v1/account-preferences.schema.json`), so it follows
  the person across devices, like the editor choice. The server default in
  server administration, set by the administrator in Settings and by the
  installation's configuration (Fleetrepo sets it per installation).
- **Resolution:** person's choice → if System or unset: server default → if
  the server default is System: browser language (`navigator.languages`),
  `fi*` → Finnish, everything else → English. Before sign-in (landing,
  sign-in page, error pages) only the server default and the browser are
  known.
- `<html lang>` follows the resolved language.

## Acceptance Criteria

- [ ] Settings has the language choice (System · Suomi · English); changing it
      switches the interface without a reload and persists across devices.
- [ ] The administrator sets the server's default language in Settings; the
      installation can also set it in configuration.
- [ ] A browser in a language other than fi/en gets English when the choice
      resolves to System.
- [ ] The catalog mechanism is in place with compile-time completeness, and
      at least the shell, Settings, sign-in and landing page are translated;
      the remaining views are `ui-english-coverage`.
- [ ] Browser spec: switch language, reload, other device sees the choice;
      System with a non-fi/en browser locale gives English.

## Comments
