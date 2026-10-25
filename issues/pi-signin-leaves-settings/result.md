# Result

## Cause

The OpenAI row in Settings › Yhteydet opened the forced Pi sign-in at
`/settings?pi_sign_in=1`, dropping the section, and the sign-in's completion
handler in `web/src/app/App.tsx` navigated everything except a failed
conversation to `/workspaces`. Settings therefore closed after a successful
sign-in, whether the person chose ChatGPT or Claude in that view (both end in
the same completion handler). The view's only way back, "Takaisin repojen
valintaan", sent a person from settings or a conversation into the onboarding
repository picker.

## Fix

- The settings row keeps its own path (`/settings/connections?pi_sign_in=1`).
- One return target in `App.tsx` serves both completion and going back: a
  known settings section returns to that section with focus on the row's
  sign-in button (settings otherwise focuses its heading on mount); a
  conversation returns to the conversation as before; anything else goes to
  `/workspaces`. The navigation replaces the sign-in entry so browser Back does
  not reopen it.
- The forced sign-in shows "Takaisin" to that target instead of the repository
  picker (`onReturn` through `GitHubOnboarding` to `PiOnboarding`). First-use
  onboarding keeps its repository back button.
- The row's state needs no extra read: settings remounts on return and the
  OpenAI row reads native credentials again (since `openai-row-shows-pi-state`).

Entry points: Settings › Yhteydet (fixed), Claude chosen inside that view
(same handler, fixed), a conversation's model re-sign-in (already returned;
now also its back button returns), first-use onboarding (its start view is the
onboarding itself; unchanged). The model selector only links to Settings ›
Yhteydet, so it is the settings entry.

## Evidence

- `account-settings.spec.ts` case "Pi sign-in from settings returns to the row
  that opened it": back returns to `/settings/connections` with the row's
  button focused; a completed device sign-in returns there, the row reads
  `signed_in` and the button is focused. With the settings branch mutated back
  to `/workspaces` the case fails on the URL.
- `./scripts/test-focused.sh --area web` passed; browser specs
  `account-settings` (15), `browser-conversation` (70) and
  `github-first-onboarding` (5) passed after rebasing onto 81a55455.

## Not tested

- Claude chosen inside the forced view is covered only by sharing the
  completion handler; no browser case drives the Claude code flow there.
- A real OpenAI device sign-in on Birch (synthetic device helper only).

## Decisions for later review

- Focus returns to the row's sign-in button (the control that opened the
  flow), also when Claude was chosen in that view, rather than to the Claude
  row. Alternative: focus the row of the provider actually signed in, which
  needs the sign-in view to report which one it was.
