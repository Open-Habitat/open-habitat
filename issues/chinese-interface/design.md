# Chinese interface: code-level plan

## Tiivistelmä Jarille

Luettelot avataan lisäkielille muuttamatta yhtään `catalog(fi, en, gb)`
-kutsua. Jokainen lisäkieli on oma hakemistonsa
`web/src/text/locales/<kieli>/<moduuli>.ts`, ja jokainen tiedosto rekisteröi
käännöksensä tuotuun luettelo-olioon (`locale(composerText, {...})`). Tyyppi
vaatii jokaisen avaimen, build kaatuu, jos jokin luettelo puuttuu, ja kieli
ladataan omana palanaan vasta, kun joku valitsee sen, joten suomalaisen sivu ei
kasva. Varakieltä ei ole, kuten päätit.

Prototyyppi löysi korjattavaa jo ennen kiinaa: kielen valinta on kovakoodattu
viiteen paikkaan (selain, daemon, host, kirjautumissivu, sopimus), asetusten
nimet ja muutama aikamuoto valitsevat `language !== "fi"`, ja agentin vuoron
kesto kirjoittaa "min" ja "s" suoraan komponenttiin. Lisäksi lauseen palasiksi
pilkotut tekstit, isojen kirjainten harvennus ja `·`-erotin rikkoutuvat
kiinassa. Fonttiin suositan nimettyä järjestelmäpinoa (prototyypin B): oma
CJK-fontti maksaisi noin 3,7 Mt painoa kohden.

Vaiheet: 0 korjaukset (S–M), 1 luetteloiden avaus ja pseudokieli (M),
2 zh-CN betana (L), 3 zh-TW (M), 4 natiivitarkastus (ulkoinen). Natiivitarkastus
on ainoa osa, jota agentit eivät voi tehdä.

## Where the code is now

Numbers are from the tree at the time of writing.

- 199 `catalog(fi, en, gb)` calls in `web/src/text/` hold 8 206 messages,
  1 256 of them functions; the US English side is about 64 000 words
  (`web/scripts/catalog-review.mjs`). Components read them through `useText`
  (240 call sites), `liveText` (179), `textNow` (46) and, in a few places,
  by indexing the catalog directly (`accountText[language]` in
  `components/Account.tsx`, `signInText[language]` in `LoginCard.tsx` and
  `app/App.tsx`, `conversationActionsText[l]` in
  `app/ConversationActions.tsx`).
- `Catalog<T>` is `Readonly<Record<Language, T>>`. `Language` is a union of
  four tags, and the same list is written by hand in five places:
  `web/src/i18n/index.ts` (type, `languageChoices`, `isLanguageChoice`,
  `browserLanguage`), `contracts/v1/account-preferences.schema.json`
  (enum), `internal/daemon/account_preferences_linux.go`,
  `internal/host/site.go` (`ui.default_language`) and
  `web/public/landing-bootstrap.js`. The language row lists its choices in
  `components/LanguageSettings.tsx`.
- Text that is chosen by language outside the catalogs:
  `app/settingsIndex.ts` keeps the Finnish section and row names and
  `text/settingsIndex.ts` the English ones as a typed object, and
  `shownSettingsSections` returns `language !== "fi" ? english : finnish`;
  `components/conversationTimes.ts:64` and `app/integrations.ts:585,610,619`
  branch on `currentLanguage() === "fi"`; `components/AgentTurn.tsx:204-205`
  writes `min`, `s` and `h` into the duration ("2 个工具 · 4 min 00 s" in
  the prototype).
- `plural(language, n, {one, other})` has 112 call sites; 135 more catalog
  functions choose with `n === 1` inline. Each language writes its own
  functions, so the inline ones are not a problem for a new language.
- Dates and numbers go through `formatDate`/`formatNumber` with
  `localeOf(language)` (129 call sites); six direct `toLocale*`/`Intl.` calls
  remain.
- Tests: `i18n/catalogs.test.ts` compares the key sets of every catalog and
  rejects ä/ö and the other region's spelling in English;
  `i18n/finnishScan.ts` finds Finnish outside catalogs;
  `scripts/catalog-review.mjs` extracts Finnish, US and UK side by side.
- Fonts: `--ah-font: "Instrument Sans", system-ui, sans-serif`; the product
  uses weights 600 (190 rules), 500 (55) and 400. No CJK font is named.
- IME: the composer ignores keys while composing
  (`Composer.tsx:1450`, `isComposing || keyCode === 229`), as do the account
  menu, the switcher, `Primitives`, `ServerAccess` and the terminal and
  dictation shortcuts. Six Enter handlers have no guard: `TerminalPanel`,
  `ExplainMode`, `NameEditor`, `InlineTextSetting`, `NumberStepper`,
  `EditorSplit`.
- Search: the server index is FTS5 with the trigram tokenizer and a LIKE scan
  for two-character terms (`internal/searchindex/query_linux.go`), so a
  two-character Chinese word is found; a one-character term is dropped. The
  settings search folds text and requires a short term to begin a word,
  which Chinese, written without spaces, does not have.

## The catalogs

### Shape

The `catalog(fi, en, gb)` calls stay as they are. Finnish keeps defining the
keys in each module, and US English stays complete beside it, because the
two are the languages the product is written in.

A further language is a directory, one file per module, and each file names
the catalog it translates by importing it:

```ts
// web/src/text/locales/zh-CN/composer.ts
import { locale } from "../../../i18n";
import { composerText } from "../../composer";

export default locale("zh-CN", composerText, {
  idlePlaceholder: "给智能体写消息…",
  send: "发送",
  tooManyFiles: (count: number) => `附件将有 ${count} 个，…`,
  // every key of composerText, with the same function signatures
});
```

`locale<T>(language, catalog: Catalog<T>, messages: Messages<T>)` is typed by
the catalog object itself, so a missing, extra or differently typed message
is a compile error exactly as US English is today. A module with several
catalogs exports one `locale(...)` per catalog. Registration needs neither a
module name nor a rewrite of the call sites: the file holds the object.

At runtime `locale()` stores the messages on the catalog object under the
language's key. The existing readers, including the direct
`accountText[language]` indexing, then keep working unchanged. The
prototype round does exactly this from `zh/*.ts` and shows the production
components in Chinese without touching them.

### Complete, or the build fails

Jari decided on 24.11. that a language arrives whole and that there is no
fallback to English. Three checks enforce it:

- the type check, per catalog (above);
- a Vite plugin at `buildStart` (and the same function in a vitest test)
  that lists the catalogs `text/*.ts` export and the `locale()` calls
  `locales/<lang>/*.ts` make for each language in `languages.ts`, and fails
  on any catalog without a translation;
- `catalogs.test.ts`, widened to every language: no message identical to
  its English one unless allow-listed (product names, key names such as
  `⌘⇧Space`), Han characters present in a zh message that is not an
  identifier, and no simplified-only character in zh-TW and no
  traditional-only one in zh-CN (a short character list, not a converter).

A new string in a feature change is written in every language in the same
change; the type check refuses it otherwise. Agents write it, which is the
reason the rule is affordable.

### Loading

Finnish and English stay in the main bundle. Each further language is one
lazy chunk: `locales/<lang>/index.ts` imports every module of that language
(the build plugin above generates and checks this index), and
`apply()` in `i18n/index.ts` awaits `loadLanguage(lang)` before it changes
`current` and dispatches the change. The invariant "the current language's
catalogs are present" therefore holds without a fallback. The static landing
paints in the remembered language only if it is Finnish or English; for
another it paints in English until the bundle answers, as the server default
does today.

### One language list

`languages.ts` in `web/src/i18n` is the one place that names a language:
tag, autonym, script, `Intl` locale, font stack key and status (`beta` until
a native speaker of that variant has reviewed it). The contract carries the
list as an enum (`contracts/v1/`, so the wire change starts in the schema and
`internal/contracts` and `web/src/contracts` are generated from it); the
daemon and the site configuration validate against the generated list, and
`landing-bootstrap.js` reads a small generated JSON instead of its own array.
The language row draws its choices from `languages.ts`: every language by its
own name, a Beta note in the interface language (the prototype's
`languageSettings.tsx`).

`browserLanguage()` maps the first browser preference: `fi*` → fi,
`en-GB` → en-GB, `zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant*` → zh-TW, other `zh*`
→ zh-CN, everything else → en-US.

### Plurals, ICU

`plural()` widens to the `Intl.PluralRules` categories:
`forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }`.
The 112 existing calls stay valid. Chinese needs only `other`; the widening
is for the languages after it (Polish, Russian, Arabic).

ICU MessageFormat is not adopted. It would need a parser dependency and a
rewrite of all 199 catalogs into strings, and would lose what TypeScript
functions give now: typed parameters, React nodes as arguments and the
compiler's check that a translation takes the same arguments. Agents
translate TypeScript functions without trouble, which removes the usual
reason for ICU (non-programmer translators).

### Text outside the catalogs

- `settingsIndex`: generalise the English pattern. `text/settingsIndex.ts`
  becomes `SettingsIndexNames` with the English object, and
  `locales/<lang>/settingsIndex.ts` supplies the same type;
  `shownSettingsSections(language)` picks by language instead of
  `!== "fi"`. The prototype overlays Chinese names this way.
- `conversationTimes.ts:64`, `integrations.ts:585,610,619`: replace the
  branches with `Intl` options or catalog messages (`GB`/`Gt`, `klo`/`at`
  and the time separator are catalog text).
- `AgentTurn.tsx:204-205`: the duration goes through a catalog function or
  `Intl.DurationFormat` (Chrome 129, Safari 16.4, Firefox 136).
- A scan in the spirit of `finnishScan.ts` for unit literals (`" min"`,
  `" s"`, `" h"`, `" KB"`) in components keeps this from returning.

### Sentences, not fragments

Fragments assembled in components break in Chinese, whose word order and
punctuation differ:

- `gitIdentity.descBefore` + code + `descAfter` works in Chinese only by
  chance;
- `githubRepoChooser.lastUpdated` and `serverVersion.line` are a label the
  component follows with a space and a value; a full-width colon carries its
  own space, so the result reads "最后更新： 2026/11/27".

Rule for `TRANSLATING.md`: a catalog holds whole sentences; a value, a link
or a code element enters as a function argument (`(date: string) =>`,
`(file: ReactNode) =>`), and the component adds no spaces or punctuation.
The extract lists the current fragments as work for stage 0.

## Typography

### Font

Recommendation: the named system stack (prototype direction B), added per
language in `design-system/tokens/typography.css`:

```css
:root:lang(zh-CN) { --ah-font: "Instrument Sans", "PingFang SC",
  "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei",
  "Noto Sans CJK SC", "Source Han Sans SC", system-ui, sans-serif; }
:root:lang(zh-TW) { --ah-font: "Instrument Sans", "PingFang TC",
  "Microsoft JhengHei UI", "Microsoft JhengHei", "Noto Sans CJK TC",
  "Source Han Sans TC", system-ui, sans-serif; }
```

and the same CJK fallback after JetBrains Mono in `--ah-mono`, because a
path or workspace name may be Chinese (`读书笔记` in the prototype).
Instrument Sans stays first, so Latin text, digits and identifiers keep the
product's face.

Every Chinese-language desktop and phone system ships a good CJK face
(PingFang, Microsoft YaHei, Noto Sans CJK); the stack chooses it rather than
whatever the browser falls back to. The cost of naming it is nil. Weights:
PingFang has 400/500/600; Microsoft YaHei has Regular and Bold only, so 500
renders as 400 and 600 as Bold on Windows, which is acceptable. A machine
without any CJK font (a bare Linux, such as the prototype's check machine,
which has only WenQuanYi Zen Hei in one weight) shows synthetic bold.

Self-hosting (direction C) stays the answer if testers report broken bold:
Noto Sans SC (OFL, no Reserved Font Name) in fontsource's unicode-range
slices is about 3.7 MB per weight in ~100 slices; the prototype's screens
used 54 slices, 1.6 MB, over three weights. The product does not fetch fonts
from third parties, so it would ship the slices itself.

### Rules under `:lang(zh)`

From the prototype (B and C share them):

- `--ah-lh-body` 1.75 and `--ah-lh-ui` 1.6: Han text sits taller at the
  same size.
- `--ah-size-label` at least 12 px: 11 px Han is below comfortable reading.
- Tracking: the uppercase eyebrows use `letter-spacing: 0.06–0.09em`
  (`app.css:72`, several in `components.css`), which spreads Han apart
  ("从 浏 览 器 中 移 除" in the sign-out dialog under A). Move the values to
  a `--ah-tracking-caps` token that is 0 under `:lang(zh)` (and later `ja`,
  `ko`).
- No italic: Han has none and a synthetic slant is wrong; `em` becomes
  weight 600.
- `line-break: strict` (closing punctuation never starts a line),
  `text-autospace: normal` (Chrome 140, Safari 18.4: a quarter space between
  Han and Latin, so text needs no typed spaces) and
  `text-spacing-trim: normal`.

### Line breaking and truncation

Han breaks between any two characters, so long titles wrap and truncate
well: the rail's long title ends in an ellipsis inside its row in every
direction (checked). Two cases need care:

- The middle dot `·` (U+00B7) is East Asian ambiguous width; under
  `lang="zh"` Chromium treats it as a break opportunity, and the prototype's
  own picker labels ("A · Nyt") wrapped until they were given `lang="fi"`.
  The product joins short labels with ` · ` ("Selain · ajetaan heti",
  "2 tools · 4 min"): such joined labels get `white-space: nowrap` on their
  parts, or the separator becomes a ` · ` in the catalog.
- `.toLowerCase()` on a catalog label (`Composer.tsx:1827`) is harmless for
  Chinese but wrong for German nouns: the catalog supplies both forms.

## Input methods

Chinese is typed through an IME: Pinyin composes Latin keystrokes into
candidates, and Enter, Space, Escape and the digits belong to the IME while
`isComposing` is true.

- The composer is guarded (`Composer.tsx:1450`). The audit adds the guard to
  the six unguarded Enter handlers listed above and checks every Escape
  handler: Escape during composition cancels the candidate list and must not
  stop the agent ("Esc kentässä" in `stopAgentTip`).
- Safari sends the composition-ending Enter with `keyCode 229` and
  `isComposing` false; the existing `keyCode === 229` check covers it, and a
  shared `isImeKey(event)` helper keeps the two conditions together.
- Shortcuts with letters (`⌘K`, `/` for commands, `@` for files) are typed
  outside composition and keep working; the `/` and `@` lists filter by the
  composed text only after `compositionend`.
- Dictation: the speech key's recognition language follows the interface
  language or, better, the agent answer language; Chinese dictation is
  checked with the server's speech provider.
- A Playwright test drives composition with
  `Input.imeSetComposition` (CDP) in the composer: Enter during composition
  does not send, Enter after it does.

## Server-side text and its language

- **CLI (`open-habitat`)**: English only. It is read by operators and
  agents, follows the AI-first CLI canon, and its output is matched by
  scripts; translating it would break that.
- **Agent guide and agent-facing text**: English. The agent reads it and
  answers in the person's language anyway.
- **Agent answer language**: `app/answerLanguage.ts` offers fi, en and sv
  on the onboarding note. Add 中文 (and the zone/locale guess for
  `Asia/Shanghai`, `Asia/Taipei`, `Asia/Hong_Kong`) so a Chinese-speaking
  person's note asks for Chinese answers.
- **Server messages shown in the UI**: refusals and errors the daemon or
  gateway return as English text appear inside a Chinese page
  (`notSent: (reason) => …`). The inventory the `translation-coverage-check`
  work started is completed as part of stage 2: each such message becomes a
  code with parameters that the browser maps to a catalog message, and the
  raw English remains only as a fallback for an unknown code, shown as
  "server message" so it is not mistaken for a translation gap.
- **Email**: the product sends none today; nothing to translate.
- **Pi's own texts** (its TUI menus, which the browser cannot run) stay
  Pi's.

## Producing and keeping translations

- **Drafting.** An agent drafts a whole language module by module from US
  English, with Finnish beside it for meaning, using
  `catalog-review.mjs`'s extract widened to any language and a per-language
  glossary (`locales/<lang>/GLOSSARY.md`: 工作区, 对话, 智能体, 轮到你,
  运行中, 设置, 退出登录, 代码仓库… for zh-CN). The glossary is translation
  input, so it lives with the catalogs.
- **Staleness.** When an English message changes, the translations may no
  longer say the same. A generated `locales/<lang>/.source.json` records a
  hash of each English message at translation time; `check-generated`
  reports (not fails) messages whose English changed since, and the
  report is the agent's work list. Failing would block every English copy
  edit on languages the author cannot read.
- **Pseudo-locale.** A generated `en-XA` (accented, 40 % longer, bracketed)
  available in development only catches hard-coded strings and layouts that
  cannot take longer text, before any real language arrives.
- **Review.** A native speaker of each variant reviews the extract; the
  language's status in `languages.ts` changes from `beta` to `reviewed`
  then, and only then may an announcement name it.
- **`TRANSLATING.md`** in `web/src/text/` states these rules: whole
  sentences, identifiers untranslated and in monospace, the glossary, beta,
  staleness.

## zh-CN and zh-TW

Two catalogs, not one converted into the other. Character conversion
(OpenCC) gets the script right but not the vocabulary: 设置/設定, 文件/檔案,
账号/帳號, 默认/預設, 服务器/伺服器, 软件/軟體, 信息/訊息, 代码仓库/程式碼儲存庫,
and "agent" (智能体 on the mainland, 代理 or 智慧代理 in Taiwan). zh-TW is
drafted from English with its own glossary, optionally starting from
OpenCC's `s2twp` output of zh-CN, and reviewed by a Taiwanese speaker. Tags
are `zh-CN` and `zh-TW` throughout (BCP 47 region tags, as the product's
`en-US`/`en-GB`); `Intl` gets the same tags, which select 简体 and 繁體
formats.

## Stages

| Stage | Content | Size |
|---|---|---|
| 0 | Fixes that any further language needs: the `!== "fi"`/`=== "fi"` branches and `settingsIndex`, `AgentTurn` durations, sentence fragments, `--ah-tracking-caps`, ` · ` joins, IME guards on six handlers and Escape, settings search for unspaced text | S–M |
| 1 | `languages.ts` and the contract enum; `locale()`, lazy chunk, build plugin and widened tests; `plural()` categories; `browserLanguage`, `localeOf`; the language row from `languages.ts`; extract and staleness report; `en-XA`; `TRANSLATING.md` | M |
| 2 | zh-CN: 199 catalogs and `settingsIndex` (about 8 200 messages) drafted by agents, glossary, `:lang(zh)` typography, answer language 中文, server message codes, IME Playwright test; status beta | L |
| 3 | zh-TW from English and the TW glossary, TC stack | M |
| 4 | Native review of each variant; beta removed | external |

Stages 0 and 1 are worth doing before any Chinese work: they are the same
work Japanese, Korean or Swedish would need, and stage 1 is what lets an
English announcement invite translators honestly.
