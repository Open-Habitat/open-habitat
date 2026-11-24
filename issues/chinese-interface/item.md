---
created: 2026-11-24
updated: 2026-11-24
type: feature
reporter: Jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-11-24/chinese-interface
---

# Chinese interface (zh-CN, zh-TW), after opening the text catalogs to more languages

## Description

## What Jari asked (24.11.2026)

A Chinese-language interface, as part of preparing Open Habitat for Chinese
users.

## Two steps

**1. Open the catalogs to more languages.** Today strings live in 197
TypeScript catalogs under `web/src/text/`, Finnish defines the keys,
`web/src/i18n/index.ts` fixes `Language` to Finnish and English variants, and
`catalog(fi, en, gb)` takes exactly those. Adding any language means changing
all 197 call sites, and there is no fallback for a partial language. The
smallest change (private launch-readiness review, 24.11.2026, section 5):

- additional languages as partial overlays on English, one directory per
  language and one file per module (`web/src/text/locales/<lang>/<module>.ts`),
  missing keys falling back to English;
- an English-side extract for translators (`web/scripts/catalog-review.mjs`
  already extracts Finnish, US and UK side by side) and a "what is
  untranslated in <lang>" report;
- `plural()` widened to the `Intl.PluralRules` categories (Chinese needs only
  `other`, but the change is needed for most other languages);
- a language choice in Settings and in `browserLanguage()`, and `localeOf()`
  for dates and numbers;
- a `TRANSLATING.md`.

**2. zh-CN and zh-TW.** Simplified Chinese for the mainland and Traditional
Chinese for Taiwan (Taiwan can use the product as it is today; only the
language is missing). Machine-drafted catalogs marked beta, reviewed by native
speakers of each variant before any Chinese-language announcement names them.
Chinese IME input in the composer and dictation checked. Server-side texts
(Go, Pi extensions) that the catalogs do not cover are listed, as the
`translation-coverage-check` item already noted.

## Why

Chinese forums forbid AI-written posts and readers expect a product they can
use in their own language; the agent already answers in Chinese, the
interface around it does not. The same catalog opening makes Japanese and
Korean possible and lets an English announcement invite translators honestly.
