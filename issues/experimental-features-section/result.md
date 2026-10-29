# Result

Asetukset › Kokeelliset ominaisuudet (`/settings/experimental`), Esittely direction:
a card per feature with a picture (grey while off), *Missä*, *Mitä näkyy*,
*Edellyttää* and a Pois/Päällä switch. Everything starts off. A choice is saved to
the account through the person's daemon and is shown once the daemon confirms it.
The section is the last personal section and uses a new `flask` icon. Its three rows
are in the settings search index.

- **Storage:** the editor preference became one account preferences document,
  `~/.config/open-habitat/preferences.json`. It holds `engine` and `experimental`,
  and only the features that are on are stored.
  - Endpoint: `GET`/`PUT /api/v1/account/preferences`, schema
    `contracts/v1/account-preferences.schema.json`.
  - A `PUT` names one change: `{"engine": …}` or `{"experimental": {"<id>": bool}}`.
    It stays under the gateway's 128-byte cap. The daemon merges the change into
    the file under a lock and returns the whole document.
  - The gateway relay is still `personalSetting`, now
    `internal/gateway/personal_setting_linux.go`.
- **Client API:** `useExperimentalFeature(id)` in `web/src/app/accountPreferences.ts`.
  `AccountPreferencesProvider` (in `App.tsx`) names the session and rereads on window
  focus. The ids are `next-waiting-row`, `worker-row-sentence` and `terminal-watch`
  (`experimentalFeatureIds`).
  - A feature is off until the daemon has confirmed otherwise.
  - An id the browser does not know is ignored.
- **When a feature lands,** its issue does two things in
  `web/src/components/ExperimentalFeatures.tsx`: set `landed: true` on its card and
  check that the card's text still matches. Then gate the UI on
  `useExperimentalFeature(id)`.

Evidence (`evidence/`, device scale factor 2): desktop light with everything off,
the failed save, and phone dark with the terminal mirror on.

Tests:
- daemon `TestAccountPreferences*`: merge, one change per write, removal on off,
  the 32-feature bound, unsafe files;
- gateway relay;
- contract negative checks, including the write shape;
- vitest store tests;
- `web/tests/settings-experimental.spec.ts`: default off, confirmed switch read from
  a second tab, failed save, search landing, axe.

## Decisions for later review

- **Cards are shown now with a working switch and a *Tulossa* line until each
  feature lands.** Alternative: show a card only once its feature exists. Why: the
  section and the switch API can be tested now. A choice made today takes effect
  when the feature arrives, and the line says so plainly.
- **No status message at all.** Jari dropped the "Käytössä nyt kaikilla
  laitteillasi" line, and "Tallennetaan…" went with it because it also changes on
  every click. While a write is in flight the switches are disabled, and the card
  has `aria-busy`. A failed save keeps the old value and shows the Editori-style
  alert with *Lue tallennettu valinta*.
- **No "Näytä keskustelussa" link** on the cards. Alternative: link to some
  conversation. Why: the prototype linked to synthetic conversations. A real
  account has no fixed place to point at, and the features have not landed yet.
- **The picture is drawn in CSS from tokens (`ExperimentalFeatures.css`)**, not a
  screenshot. It is `aria-hidden` decoration, because the facts carry the same in
  text, and the axe check excludes it, because it is faded on purpose while off.
  Esittely's cost stands: each picture must be redrawn when its feature changes.
- **Only enabled features are stored, at most 32.** Alternative: store `false`
  too. Why: a graduated or removed feature leaves at most one stale key, and turning
  a feature off always shrinks the file.
- **The previous `editor.json` is not migrated.** Pre-release with no compatibility
  code. Someone who chose VS Code chooses it once more. KOKEILTAVAA says so.
- **Settings navigation widened from 190 px to 210 px** so "Kokeelliset
  ominaisuudet" fits on one line, as in the prototype.
- **Feature ids are the issue slugs without `-experimental`**, matching the
  prototype's keys. The contract allows any lower-case hyphenated id up to 48
  characters, so a new experiment needs no contract change.

## Review

Independent `/llm-review`: gpt-6-astra as finder, and claude-fable-5-1 as a focused
probe of file confinement, reply/schema agreement and concurrent writes. Then
`/assess-findings`.
- **One confirmed finding, fixed.** The daemon's PUT decoding was laxer than the
  contract. `null` read as off, a null second key was ignored, and key matching
  ignored case. `decodePreferencesWrite` now accepts exactly the contract's
  one-key write, with rejection tests.
- **The probe found no path** outside `preferences.json`, no reply the schema
  rejects, and no lost acknowledged write.

Spec failures that also fail on main were filed as intake items:
- `settings-search.spec.ts:39`: the recap number rows are not found;
- `browser-conversation.spec.ts:963`: the OpenAI credential state stays `unknown`.
