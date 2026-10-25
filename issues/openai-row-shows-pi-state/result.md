# Result

## Cause

Settings › Yhteydet rendered the OpenAI (Pi) row from the settings-only
`GET /api/v1/onboarding/pi/status` read. That is the account-wide gate state:
the native helper reports `usable` if any OpenAI, Anthropic or DeepSeek API key
is stored, or if the Claude bridge reports a completed Claude subscription.
On a Claude-only account the OpenAI row therefore said that credentials were
usable and offered "sign in again".

## Fix

The browser already had OpenAI's own facts. The native
`GET /api/v1/pi/credentials` read, which the key rows on the same page use,
reports `subscription.present` (Pi's `openai-codex` OAuth sign-in) and
`openai.present` (the OpenAI API key) straight from Pi's `auth.json`. No
contract, daemon or store change was needed.

- `PiCredentials` derives `OpenAIState` (`signed_in` / `api_key` /
  `missing` / `checking` / `unknown`) from that single read and reports it
  through `onOpenAI`. The page makes no second native read.
- `AccountSettings` renders the OpenAI row from that state. It offers
  "Kirjaudu ChatGPT:hen" unless the subscription is signed in, and only then
  "…uudelleen". As Jari added on 2026-10-25, the wording now speaks of the
  ChatGPT (Codex) / OpenAI sign-in instead of Pi.
- The settings-only `piStatus` effect and the `settingsPiState` state in
  `App.tsx` had no other consumer and were removed, along with the `piState`
  prop. The first-load Pi gate is unchanged.

## Evidence

- Unit (`Account.test.tsx`): a Claude-only account (Anthropic key plus a
  completed Claude subscription, nothing of OpenAI's) shows `missing` and
  offers sign-in. An OpenAI key alone shows `api_key`, the subscription shows
  `signed_in`, and a failed read shows `unknown`.
- Browser against real native Pi (`account-settings.spec.ts`): after an
  Anthropic key is saved, while the host's Pi gate says `usable`, the OpenAI
  row stays `missing`. Credential reads that are out of contract or fail
  (502) show `unknown`, never success. `browser-conversation.spec.ts` now
  asserts that opening settings does not re-run the Pi gate status.
- `./scripts/test-focused.sh --area web` passed (747 tests). The browser specs
  `account-settings` (14), `browser-conversation` (70), `site-ai-key` (3) and
  `settings-model-picker` (3) all passed.

## Not covered

- `signed_in` means the `openai-codex` OAuth credential is stored. Unlike
  the gate's status helper, the row no longer resolves or refreshes the token,
  so an expired, unrefreshable token still reads as signed in. A conversation
  then fails through the existing auth-failure path.
- The removed settings status read also called `requireLogin()` on a 401. A
  lapsed web session on the settings page is now caught by the other host
  reads; the OpenAI row shows `unknown` meanwhile.
- No real ChatGPT sign-in was performed. The `signed_in` state is covered
  only by the unit test.
