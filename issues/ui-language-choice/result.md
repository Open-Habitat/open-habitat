# Result: UI language choice

## What landed

- The person's choice (System · Suomi · English) is an account preference in
  the daemon (`language` in `account-preferences`; `system` is stored as no
  value). Settings › Appearance › Language writes it; it follows the person
  across devices like the editor choice.
- The server default is set by the administrator in Settings › Server ›
  Default language (`default_language` in `server-administration`) or by the
  installation (`ui.default_language` in `site.json`, published to the gateway
  as `oauth.default_language`). The public, uncached
  `GET /api/v1/site/language` gives it to the sign-in and landing pages.
- Resolution: person → server default → browser (`navigator.languages[0]`
  starting with `fi` → Finnish, anything else → English). `<html lang>`
  follows the result.
- Typed catalogs in `web/src/text/`, one per view or module; Finnish defines
  the keys, English must satisfy `Messages<T>`, and `i18n/catalogs.test.ts`
  checks key parity and that no English text holds ä/ö. Plurals, numbers and
  dates go through `Intl`. The convention is in `web/AGENTS.md`.
- Translated: the shell (rail, connection banner, bell, workspace bar), every
  Settings page including the worktree list and dialogs on Storage, sign-in,
  the onboarding frame and the static landing page.
- Browser spec `web/tests/ui-language.spec.ts` (`@ui-language`): switch,
  reload, a second context sees the choice; System with `sv-SE` gives
  English; the administrator's default changes the sign-in page.
- English evidence at device scale factor 2 in `evidence/` (sign-in, home and
  every Settings page), made with `web/lab/ui-language-shots.mjs`.

## What Fleetrepo must set

Nothing is required: without a value the server default is System. To fix an
installation's default, set in its `site.json`:

```json
"ui": { "default_language": "en" }
```

(`system`, `fi` or `en`). An administrator's choice in Settings › Server
overrides it.

## Left for `ui-english-coverage`

The home view (workspace list and cards), conversations and the composer,
the workers panel, AI offers, operation and mutation messages outside
Settings, and the remaining components. They render in Finnish under an
English choice until moved into catalogs.

## Decisions for later review

- **Shipped server default: System.** An unconfigured server follows each
  browser, so a Finnish browser gets Finnish and anything else English.
  Recommended; a customer installation that wants English for all can set
  `ui.default_language: en`.
- **Only the browser's first preference counts.** `fi-FI, en` gives Finnish,
  `en, fi` English; a second-listed Finnish does not win.
- **English formats as en-GB** (day-month order, 24-hour clock), closer to
  the Finnish conventions than en-US.
- **Route slugs stay Finnish-derived where they were** (`palvelin`,
  `kayttajat` internally); the visible URLs are already English.
- **Administrator's choice overrides the installation config.** The config is
  the default until someone sets one in Settings; after that the Settings
  value (System included) wins, and there is no choice that hands it back to
  the config.
- **The resolved language is cached in localStorage** (`nah:language`) so the
  static landing page and the first paint are in the last language before the
  preferences read; nothing person-specific is stored.
- **The site language endpoint is public**: it reveals only system/fi/en.
- **Demo-only sign-in strings stay inline** in the demo branch, so the demo
  marker check keeps the production bundle free of them.
- **The language row reads no preferences of its own** but subscribes to the
  provider's; its own read on mount re-rendered settings search previews and
  made `settings-search` flaky.
