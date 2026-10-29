# Result: prototype round 1

The prototype is `prototypes/kokeelliset/index.html`, one offline file with three
directions behind the picker. [NOTES.md](prototypes/kokeelliset/NOTES.md) is Jari's
guide in Finnish. `prototypes/kokeelliset/evidence/` holds 66 AVIF screenshots at device
scale factor 2:

- desktop at 1440 and phone at 390, light and dark;
- settings off and on, Iltakierros and the terminal mirror;
- in Merkki also the popover, turning a feature off and landing on its setting;
- the failed save and the phone section list.

The page is hand-written (`round.js`, `round.css`). `build.mjs` inlines the tokens,
fonts and picker. It contains no production components. To rebuild and check it:

```
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-experimental-features/prototypes/kokeelliset/check.mjs [--evidence]
python3 scripts/screenshots-to-avif.py issues/proto-experimental-features/prototypes/kokeelliset/evidence
```

The check passes 12 variant × width × theme cases. It verifies:

- every feature starts off;
- each switch takes effect at once in the place it belongs:
  - the next-conversation row;
  - the sentence on all three worker rows and on the rail's worktree row;
  - Katso päätteessä and its read-only dock;
- off again restores today's footer text;
- a failed save leaves the feature off and shows the editor-style reload alert;
- Merkki's tags are present only in Merkki, and its popover:
  - stays on screen on a phone;
  - closes with Esc and returns focus to the tag;
  - turns the feature off with an undo;
  - lands on the right settings row;
- Esittely's link opens the place;
- the account menu opens Settings, and the phone list/detail works;
- nothing overflows sideways, the picker follows its contract, and there are no console
  errors or network requests.

## The axis: where an experimental feature explains itself

Production context is the settings page as `web/src/components/Account.tsx`
(`AccountSettings`) and `Settings.css` draw it: section list, `s-card` / `s-row`, and a
`Segmented` choice like Editori and Agentin työ. The app is around it: rail, Iltakierros
with the Workers panel and composer, and the terminal-started Status-skripti.

| # | Direction | Settings | Where the feature appears | Right when | Cost |
| --- | --- | --- | --- | --- | --- |
| 1 | **Rivit** | One card, one row per feature: name, one sentence, Pois/Päällä. An intro says they may change or disappear and that the choice covers all devices. | Unmarked; it looks like any other part of the product. | Few people, all of whom turned the feature on themselves and remember it. | Someone who forgot (or another person on the same account) cannot tell where the new row came from or how to remove it. |
| 2 | **Merkki** | Same as Rivit. | A small **Kokeellinen** tag (flask icon; icon only on a phone) on the next row, the Workers panel header and the terminal footer. The tag opens a popover with the feature's name, "may change", **Poista käytöstä** (with Kumoa) and **Asetukset**, which lands on the row. | Experimental features show up in the main working view, so the explanation and the off switch belong where the surprise happens. | One more element on each feature. The panel header tag marks the panel, not the sentence, until it is opened. |
| 3 | **Esittely** | A card per feature: a small picture of what it adds (grey when off), *Missä*, *Mitä näkyy*, *Edellyttää* (tmux, gh login), and a link to the place. | Unmarked. | Discovery: the person decides whether to try something before seeing it. | The pictures are a second depiction of each feature that must be redrawn whenever the feature changes. The page is three times as long. |

The same in all three:

- **Off by default.**
- **Saved per account** (all devices), not per browser.
- **Takes effect when the daemon confirms the write**, with no reload. While saving, the
  choice is disabled and says "Tallennetaan…". Afterwards the row says "Käytössä nyt
  kaikilla laitteillasi."
- **A failed save** keeps the old value and shows the Editori alert with *Lue tallennettu
  valinta*.
- **The section is the last personal section**, after Tallennustila and before Palvelimen
  ylläpito. Its icon is a new `flask`.

## Host facts

| Fact | Exists? | Where | Needed by |
| --- | --- | --- | --- |
| An account-backed personal preference, read and written by the person's daemon | **Yes** (editor only) | Daemon: `internal/daemon/editor_preference_linux.go`. It keeps `~/.config/open-habitat/editor.json` through `personalDir` (no symlinks, owner and mode checked, atomic rename), with `GET`/`PUT /api/v1/account/editor-preference`. Gateway relay: `personalSetting` (`internal/gateway/editor_preference_linux.go:15`), shared with the first-route mark. Contract: `contracts/v1/editor-preference.schema.json`. Web: `web/src/app/editorPreference.ts` validates the reply's `web_identity_id`, keeps nothing in browser storage and reads again on window focus. | All three directions. |
| Experimental switches | **No** | Nothing stores them. Theme and Agentin työ are per browser in localStorage (`web/src/theme.ts`, `web/src/workPreference.ts`), the per-browser alternative. | All three. |
| Write size | Constraint | The gateway rejects a `PUT` body over 128 bytes (`internal/gateway/editor_preference_linux.go:21`). A write that names one feature (`{"feature":"terminal-watch","enabled":true}`) fits; a write carrying the whole set would not. | Design of the write. |
| Next-conversation row | Partly | Its own host facts are in `research-workmux-sidebar/result.md`: last-change time is missing, so the order falls back to the rail. | `next-waiting-row-experimental` |
| Worker work sentence | **No** | A spinoff run's `git_summary` against `source_branch` and the gh PR read; see `proto-worker-row-work-facts/result.md`. | `worker-row-sentence-experimental` |
| Terminal mirror | **No** | Writer PID and environ from the census, the tmux socket across the daemon's PrivateTmp, and a new watch target kind; see `proto-open-in-terminal/result.md`. | `terminal-watch-experimental` |

None of this moves authority. The switch is the person's own setting, written by
their daemon into their home through the existing personal-setting relay. Turning a
feature on only shows the person data their daemon already reads as them. The
terminal mirror's cross-PrivateTmp read was accepted by Jari in its own issue and is
not widened by a switch.

## Recommendation

**2 Merkki**, with Rivit's settings rows.

- These features land in the main working view: the composer, the Workers panel and
  the terminal footer. Someone who forgot turning one on, or who meets it on another
  device after the account-wide save, needs the explanation and the off switch at that
  spot, not in a settings section they would first have to know about.
- The settings stay as small as Editori's. One sentence per feature is enough when the
  place itself explains.
- Esittely's pictures would be a second copy of each feature to keep in step with the
  code, which the repository avoids. Its *Edellyttää* line is still worth taking into
  Merkki's row text where a feature needs something (tmux, gh). The prototype's rows
  already say "Selain ei kirjoita siihen" for the mirror.

Implementation (the head of `next-waiting-row-experimental` and its siblings, or a
small issue of its own before them):

1. Generalize the editor preference into one account preferences document,
   `~/.config/open-habitat/preferences.json`, with `engine` and `experimental:
   {<id>: bool}`. The endpoint becomes `/api/v1/account/preferences`. A `PUT` names one
   change and the daemon merges it under the file. The contract changes, and the web
   store replaces `editorPreference.ts`. Pre-release, so no compatibility path.
2. The settings section with the three rows, and a `flask` icon.
3. A `Kokeellinen` tag component with its popover. Each feature issue places it.

## Decisions for later review

- **Per account, not per browser.** Alternative: localStorage like theme and Agentin
  työ. Why: the issue asks for an existing account-backed preference. These features
  are about the person's work, not about one screen. The Merkki tag answers "why is
  this here on my phone".
- **One preferences document instead of a second file beside `editor.json`.**
  Alternatives: `experimental.json` with its own endpoint through the same relay, or new
  fields in `editor.json` under the old name. Why: one place for the person's small
  settings, one relay entry and one contract. A sibling file would add a second copy of
  the same read/write code for every new setting. Writes stay under the gateway's
  128-byte limit by naming one change at a time.
- **Off by default, and a feature id unknown to the browser is ignored.**
  Alternative: on for administrators. Why: experiments are opt-in, and an id left
  behind after a feature graduates or is removed must not break the page.
- **Takes effect on the daemon's confirmation, not optimistically.** Alternative:
  switch at once and roll back on error. Why: it matches Editori, and a row that
  appears and then vanishes would be worse than a 0.5 s wait.
- **Other devices pick the change up on their next read** (window focus, as
  `useEditorChoice` does). Alternative: push through the event stream. Why: no new
  channel for a setting that changes rarely.
- **Section placement and name:** last personal section, "Kokeelliset ominaisuudet",
  with a new flask icon. Alternative: a group under Ulkoasu. Why: the features are not
  appearance, and the section grows as experiments come and go.
- **Popover's *Poista käytöstä* acts at once with a Kumoa toast,** instead of asking
  for confirmation. Why: turning off is harmless and reversible.
- **The mirror's footer sentence** is now one sentence: "Pi kirjoittaa tätä tmuxissa
  (work:2), joten selaimessa se on vain luettavana." The dock note is one more: "Peili
  tmux-ikkunastasi work:2. Selain ei lähetä siihen näppäimiä." This is Jari's request
  in `terminal-watch-experimental`. The final wording belongs to that issue.
- **No count of enabled experiments in the section list.** One was tried and dropped:
  it wrapped the label and added noise to a list that rarely changes.

## Questions for Jari

1. Rivit, Merkki or Esittely? The recommendation is Merkki with Rivit's settings.
2. Per account (recommended) or per browser?
