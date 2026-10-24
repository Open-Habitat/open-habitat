# Result — Brave browser-process crash on typing in integration fields

Run `01m5pfjq0ssjxhqjrrkwcbqas8` (spinoff), baseline `ad59d7dd`.

## Cause

This is a Brave/Chromium bug that our forms trigger. The trigger is a text
field that Chromium autofill cannot classify. The IMAP, CalDAV and CardDAV
connect forms consist only of such fields: they have no `autocomplete`, no
`name`, and Finnish labels that the heuristics do not match.
`brave://autofill-internals` reported every field as `UNKNOWN_TYPE` and the
form as "not enough fillable fields". On fields like these, Chromium 154
offers saved addresses on typing (feature
`AutofillAddressSuggestionsOnTyping`) once the typed prefix of at least three
characters matches a saved value. Brave's Email Aliases adds its own *New
Email Alias* entry to the same popup. The browser process then fails a CHECK
on the suggestion types it shows, and the whole browser exits with SIGTRAP.
That fits the reports: Jari's own address matches his saved addresses, the
crash came after "jar", and typing speed made no difference.

Upstream:

- [brave-browser#59220](https://github.com/brave/brave-browser/issues/59220)
  names the CHECK: `BrowserAutofillManager::DidShowSuggestions` allows only
  `{kAddressEntryOnTyping, kDatalistEntry, kSeparator,
  kWebauthnSignInWithAnotherDevice, kManageAddress}` in an on-typing popup.
  Workaround there: `--disable-features=AutofillAddressSuggestionsOnTyping`.
- [brave-browser#60126](https://github.com/brave/brave-browser/issues/60126):
  SIGTRAP after about two characters in an email field; turning off Email
  Aliases stops it.
- [brave-browser#60052](https://github.com/brave/brave-browser/issues/60052):
  the same crash on macOS with Brave 203.0.113.59. Workaround: disable saving
  and filling addresses.
- #60005 and #60019 are further reports of the same crash. #60052 and
  #60126 were open on 2026-10-24.

## Evidence

The Mac crash reports could not be read. No seat was attached
(`tw doctor`: "no attached client"), and maple does not accept SSH
(port 22 timed out over Tailscale). Rowan runs Brave 203.0.113.60 and had no
Brave crash in the last day. The reproduction therefore ran on Alder:

- Official `brave-browser-1.96.60-linux-amd64.zip` (sha256 checked; Chromium
  154.0.8037.93), the same Brave version as rowan. It ran from a
  `mktemp -d` under `/var/tmp` with a fresh profile and a synthetic saved
  address (Alice Example, alice.example@example.test). It was driven over
  CDP against the synthetic lab (`scripts/lab.sh`), headed on an Xvfb
  extracted from the Ubuntu .deb (nothing installed). The script is in
  `evidence/brave-repro.mjs`; the scratch directory has been removed.
- Address suggestions on typing appear on our email field at "ali".
  `evidence/brave-alias-popup-before-crash.png` shows Brave's alias entry on
  the same field at "al".
- On the baseline build with Email Aliases and on-typing both on, the browser
  process exited with SIGTRAP after the third character in the CardDAV email
  field, and likewise in the username and DAV URL fields.
- With only on-typing (no aliases) or only aliases (default features) it
  survived. Brave's Linux defaults do not enable on-typing. On Jari's Mac it
  is presumably enabled by Brave's variations seed (the Mac reports above show
  it is in the field there); this is inferred, not observed.
- Setting `autocomplete` to `email`, `username` or `off` on the field it was
  typed into stopped the crash in every case tried.
- With the fix built: IMAP email and IMAP server, CalDAV full address,
  CardDAV email, username and DAV URL all survived. Control: removing the
  attribute from the email field on the fixed build crashed again at the
  third character.

## Fix

The shared `TextField` and `TextArea` primitives now default to
`autocomplete="off"`, and a caller names the token when the field really is
the person's own data. The integration email field uses `email`, so Brave
can still suggest Jari's own address through the classified path, which does
not crash. The remaining raw inputs that had no token now have one: Git
identity name/email (`name`/`email`, as profile onboarding already had), the
workspace filter, file-tree and repository search, inline settings, storage
limit and the composer textarea (all `off`). They have the same latent
trigger whenever a typed prefix matches a saved address.

Regression test: `Integrations.test.tsx` › "app password form" renders the
IMAP (including the SMTP fields that appear after a server is typed), CalDAV
and CardDAV forms and requires an `autocomplete` token on every text field.
It fails when the primitive default is removed.

## Verification

- `./scripts/test-focused.sh --area web`: passed.
- `./scripts/test-focused.sh --area browser --spec integrations.spec.ts`:
  6 passed.
- Full gate `./scripts/ci-local.sh --clean --json` on 402379a3: **failed**
  in the browser phase only, with no receipt (web checks, 637 unit tests,
  Go/contracts and packaging passed). The two failures,
  `browser-conversation.spec.ts:3118` (title dots; `route.fetch: Test ended`)
  and `lab-browser-editor.spec.ts:9` (ambiguous `main.go` locator), each
  passed when rerun alone on this commit and on main 5ff1f9da. The first is
  filed as `altogether-shocking-babies`; the second was already filed as
  `singularly-habitual-kitten`.
- Brave reproduction before and after the fix, as above. This is
  Linux/Brave 1.96.60 evidence. It has not been tried on Jari's Mac or with
  his profile; `KOKEILTAVAA.md` asks him to.

## Decisions for later review

- **`off` as the primitive default rather than per-field tokens only.** Every
  `TextField` in the app had the same latent trigger. A default protects
  fields added later; a field that wants autofill opts in. Alternative:
  tokens on the three integration forms only, which leaves the filters, Git
  identity and settings fields able to crash Brave.
- **Integration username is `off`, not `username`.** With the
  `new-password` field beside it, `username` would make the password manager
  offer to save the external mail/DAV credential as a login for the Open
  Habitat site. Both stop the crash.
- **Integration email is `email`.** Typing one's own address there is the
  common case. Alternative: `off`, which drops that convenience. Both were
  verified not to crash.
- No browser-specific detection or warning was added; the markup fix is
  browser-neutral.
