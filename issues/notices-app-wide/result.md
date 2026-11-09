# Result

The listed app surfaces now use the shared four-kind warning. Connection loading/retry is progress; uncertainty and unavailable observations are neutral; refused actions are danger; completed archive/undo offers are success. Archive errors cannot expire, and terminal failures/events stay until dismissal or another explicit attempt. Only acknowledgements use terminal toasts. An open terminal dock shows its feedback inside the dock, including when maximized; a closed dock uses the conversation notice stack. Settings field errors, composer state ownership, large-send and attachment handling were not changed.

## Evidence (synthetic lab only)

Each image has an adjacent inert `.html` snapshot. Before captures use the starting committed browser bundle; after captures use this change. Routes and refusals are synthetic, not live-host evidence.

| Surface | Before | After |
|---|---|---|
| Terminal failure (previously toast) | [before](evidence/before-terminal.png) | [after](evidence/after-terminal.png) |
| Connection / new bundle | [before](evidence/before-connection.png) | [after](evidence/after-connection.png) |
| Archive refusal | [before](evidence/before-archive.png) | [after](evidence/after-archive.png) |
| Page observation | [before](evidence/before-page.png) | [after](evidence/after-page.png) |

Explain cards for terminal and archive notices were inspected in Finnish and English at 1440 and 390 pixels: `evidence/explain-{terminal,archive}-{fi-FI,en-US}-{1440,390}.{png,html}`. Cards fit and target the notice rather than its neighbour. Connection/retry/reload cards have fi/en mappings; their new Explain-mode rendering and reload blocking were not separately exercised. Existing reconnect/reload behavior and accessibility were exercised below. No UK-specific wording was added.

Reproduction scripts: `web/lab/notices-app-wide.mjs before|after` and `web/lab/notices-app-wide-explain.mjs`, against an isolated synthetic lab. The before script needs the starting bundle.

## Verification

- `./scripts/test-web-fast.sh`: passed after final code changes.
- Explicit `./scripts/test-focused.sh --area browser` selection: **126 ordinary + 19 lab tests passed**. Specs: browser-shell, browser-conversation, reconnect-recovery, server-version-reload, lab-workspace-page, lab-idle-pi-slots, workspace-count-rail, lab-workspace-trash, reconnect-paths, lab-onboarding, rail-archive, stale-tab-chunk-load, lab-notices-composer, shell-accessibility.
- Timer coverage advances 60 seconds after archive/terminal refusals; notices remain. Terminal tests also cover dismissal, clearing on a successful retry, and a refused clipboard copy remaining visible in a maximized dock. Existing undo/focus/folded-notice and composer stack tests pass.
- UI references regenerated. Full regeneration/check passed; unrelated pre-existing settingsIndex reference drift was then excluded from this commit. All changed notice/Explain references are included.
- Source `git diff --check`: passed. Generated static HTML retains the browser serializer's trailing whitespace (reported when staging the snapshots). No Go changes or full clean gate; no claim about real Pi or Unix isolation.

## Review and assessment

`/llm-review`: claude-fable-5-1 finder, gpt-6-astra verifier, local source checks. `/assess-findings`: three FIX, one DROP. Fixed obsolete browser class selectors (including all additional local matches), terminal errors surviving retries, and lost compact stale-connection text. Dropped a speculative future PageNotice ancestor-stack concern: all current page callers are outside that provider. Final local inspection also found that terminal feedback would be hidden behind a maximized dock and shared the phase notice's test ID. Feedback now has its own ID and renders inside an open dock; the real clipboard-selection browser journey covers this. Final affected browser suite passed after all fixes. No follow-up issues or product decisions needed. Model-performance logging omitted under this run's no-push instruction.
