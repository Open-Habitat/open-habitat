# Attention sounds off by default

The attention sound is off until the person turns it on in Settings › Äänet
or from the account menu's Äänet row. The daemon now stores the explicit
choice to hear it (`"sound":{"on":true}`); no sound key means off. Mute and
volume stay per device, unchanged. The wire contract is unchanged
(`enabled` in the reply and the write).

Copy now says so: the Äänet switch reads "Oletuksena pois / Off by default",
the section intro begins "Kun äänet ovat päällä…/When sounds are on…", and
the settings-search row mentions the off default. The unused account-menu
strings `stateOff`/`stateOffWhy` were removed. The UI skill references were
regenerated.

## Decisions for later review

- **Existing accounts get off.** The old stored form could not tell "turned
  sounds on" apart from "never chose" (both were an absent key), so every
  existing account starts with sounds off, including people who had
  explicitly turned them back on. They turn them on once; it then holds on
  every device.
- **Explicit on is stored as `on: true`.** An old file's `off: true` (an
  explicit off from when on was the default) still parses, because the
  decoder refuses unknown fields and dropping the field would make the whole
  preferences file unreadable. It now equals the default, so reading
  discards it and the next save leaves it out. This is the one piece of
  legacy reading kept, and can go once no such files remain.

## Checks

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`
  (umask 077): pass, including the new legacy-off test and the explicit-on
  storage assertion.
- `./scripts/test-focused.sh --area web`: 2223/2223 pass.
- Browser specs `attention-sound.spec.ts`, `account-sound-reasons.spec.ts`,
  `attention-sound-active-device.spec.ts`: 15/15 pass. The first
  attention-sound case now checks a fresh account is off (API, account menu,
  Settings copy) and that turning on from Settings is stored.
- `settings-search.spec.ts` fails on main as well (drawn rows missing from
  the index, unrelated to sounds); filed as
  `settings-search-index-missing-rows`.
- Independent review of the stored-format change (gpt-6-astra via
  consult-llm): no defects.

## Live check

After deployment, sign in with an account that never touched Äänet: no
sound plays when a conversation moves to Sinun vuorosi; the account menu's
Äänet row says off and offers to turn sounds on; Settings › Äänet shows Pois
pressed and "Oletuksena pois". Turn sounds on there, reload on another
device: it is on there too and a reply plays the sound.
