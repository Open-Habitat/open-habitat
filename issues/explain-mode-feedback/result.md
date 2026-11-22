# Explain-mode feedback — implementation

Implemented the accepted round 3 direction A on round 2's A Kulkureitti.
The rescued WIP (`4a987405`) supplied the footer, pointer corridor, keyboard
and touch paths, issue form and initial tests. It was adopted against current
main and reviewed rather than merged wholesale without checks.

Each part's card offers **Ilmoita virheestä / Report a mistake**. Writing is
required (whitespace alone is refused), with the accepted 600-character input
limit. Opening the report holds its card; clicking outside a written report
keeps the text. F focuses the footer; Enter opens the field; the first Escape
cancels the report and the next leaves Explain mode. Touch uses the same
footer. No positive feedback is collected.

Explain mode was already ungated on the starting main. The browser tests
explicitly leave its former experiment flag false; no new gate was added.

## Destination and exact URL contents

The new tab opens the product repository's issue form:

```text
https://github.com/Open-Habitat/open-habitat/issues/new
```

Exactly six query parameters are encoded with `URLSearchParams`:

- `template`: `explain-feedback.yml`.
- `title`: `Explanation wrong or incomplete: <English card name> (<card id>)`.
- `fix`: the person's text, trimmed at its ends and capped at 600 UTF-16 code
  units (the textarea's native `maxLength` uses that same unit).
- `card`: `<card id> · <English card name>`.
- `version`: the product version from the existing read-only server information
  endpoint, or `unknown` if it has not arrived or cannot be read.
- `language`: the active interface language (`fi`, `en-US` or `en-GB`).

There is no `body` parameter: `.github/ISSUE_TEMPLATE/explain-feedback.yml`
turns its four text fields into the eventual issue body. This uses GitHub's
issue-form field-ID prefill contract, rather than relying on a blank issue
when the repository disables blank issues. The template must reach the public
repository's default branch before the feature is deployed.

No account, person, workspace, conversation, server name, page address,
commit hash, labels, assignee or tracking parameter is added. The person's
own text is not automatically scrubbed. The UI warns that the issue is
public; the GitHub form also warns against pasting private installation or
conversation details. `noopener,noreferrer` prevents an opener and referrer.
Nothing is posted to Habitat: only a GET for product metadata occurs. Drafts
and the just-opened indication live only in page memory. The final issue is
submitted by the person on GitHub, not by Habitat.

## Harvest corrections and self-review

- Long previews and resized windows cannot strand the controls outside the
  viewport: cards have bounded internal scrolling and a held card is clamped
  when its previous anchor would put it offscreen.
- The preview now rerenders when version metadata arrives. A controlled late
  response verifies the preview and final URL agree.
- The just-opened indication no longer claims that an issue was submitted.
  Copy text remains available after opening, without promising that GitHub
  preserves text through every login flow.
- Reviewed the pointer corridor in both directions, report lifetime, keyboard
  interception, URL allowlist and generated references. The generated
  BrowserConversation reference also catches up to pre-existing source drift;
  no conversation implementation changed here.

Review level: focused self-review plus unit, browser, layout and accessibility
checks. No sessions, contract, daemon state, host operations or authorization
boundary changed, so an independent model review was not required.

## Verification

Final runnable inputs are in the implementation commit referenced by this
issue's `Fixes-Issue` trailer (base `763d97b7`). Commands ran with `umask 077`,
a shared scratch lease, timeouts, and browser concurrency 2.

- `./scripts/test-focused.sh --area web`: passed; 245 files, 2,002 tests,
  typechecking, formatting and catalog checks.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15600 ./scripts/test-focused.sh --area browser --spec lab-explain-mode.spec.ts --spec lab-explain-coverage.spec.ts`:
  30 passed. This includes scripted 24-step pointer paths up and down to the
  footer, a blocked empty submission, outside-click retention, exact query
  contents, late metadata, no API writes, no opener/referrer, keyboard and
  touch journeys, and ungated access.
- From `web/`, `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15600 OH_REPLY_DELAY_MS=60 npx playwright test --config playwright.lab.config.ts tests/lab-explain-mode.spec.ts --repeat-each 3`:
  final repeat run 54/54 passed. The first repeat run had 53 passes and one
  timeout in the existing narrow Finnish “Not now” setup: the account-menu
  trigger was hidden after opening navigation, before Explain mode started.
  No code was changed to hide that failure; the complete identical repeat
  run passed on retry. Its cause and reproduction on main remain unverified.
- Long-preview layout and scoped Axe audits passed at 1440 and 390 px, Finnish
  and US English, in light, dark and contrast themes, including shrinking the
  viewport to 500 px. UK uses the same feedback strings as US English.
- `python3 scripts/generate-ui-reference.py --check`,
  `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and
  `git diff --check`: passed.

Synthetic screenshot/static-HTML pairs are retained outside git under
`/var/tmp/agent-keep/explain-mode-feedback/`, named
`{1440,390}-{fi-FI,en-US}-{light,dark,contrast}.{png,html}`. Inspected the narrow
Finnish light and desktop English dark captures: the actions remain visible,
while the long preview scrolls inside the card. The first repeat failure log
is `repeat-first-failure.log` there. Final command logs are retained there too.

These are synthetic host-backed Chromium checks, not real GitHub submission,
Safari/iOS keyboard, deployed-host, or separate-UID evidence. GitHub was
intercepted in the browser tests; no public issue was submitted. No full
browser suite, clean gate, deployment or push was performed.

## Decisions for later review

- Use a dedicated GitHub issue form rather than a blank-issue `body` URL:
  preserves required writing and works with the repository's disabled blank
  issues. No new host storage or sending service is needed.
- Permit opening with version `unknown` when its read fails or is still in
  flight, rather than blocking a person's report on metadata. A late response
  updates the preview visibly.
- Let long open cards scroll and move only enough to stay onscreen, rather
  than preserving an unreachable offscreen anchor.

## Live check

After the issue form is published and the product is deployed, use synthetic
text only:

1. Open Explain mode without an experiment. Hover the context ring, then move
   straight to the card footer. Repeat upwards from Attach.
2. Open Report a mistake. Empty or whitespace-only text must not open a tab.
   Type a correction; clicking elsewhere must not lose it.
3. Expand the preview, then Open in GitHub. Check the title and four fields
   on the public form; **do not submit a test issue**. Habitat must not claim
   that opening the form submitted it.
4. Repeat with F/Enter/Escape, and by tapping on a phone. Try a long preview
   in a short window and verify Cancel and Open in GitHub remain reachable.
