# Result: personal addresses belong in Tuotokset

Corrected the Finnish and English account-page Explain card: account settings
no longer claims to contain view addresses. Updated the address catalog's
agent-facing source comment to distinguish the person's Tuotokset / Outputs
page from the administrator's Settings list, then regenerated the shipped UI
skill references from those sources. Three stale Settings comments in the
address client now name Outputs too.

Updated `issues/view-card-public-switch/result.md` to give the current rail →
Tuotokset (`/shares`) flow and explicitly label its older test and screenshot
material as historical, rather than directing someone to the removed settings
row. The existing Outputs Explain cards already describe the current route.

## Decisions for later review

Preserve historical test evidence with an explicit historical label rather than
rewrite those old test results as if they had tested today's navigation. No
control, route, sandbox or authorization behavior changes.

## Verification

- `OH_WEB_WORKERS=2 ./scripts/test-focused.sh --area web`: 255 files /
  2156 tests passed, plus lint and types.
- Generated UI reference check, project-view validation, issuectl doctor and
  diff whitespace check passed. Repository search found no remaining old
  personal-settings claim in the UI source or shipped skill references.
- Inspected the actual M03 card in the synthetic host at 1440 and 390 CSS
  pixels, Finnish and US English. Both texts fit and describe the selected
  account page; UK uses the same unchanged catalog fallback. Paired screenshots
  and HTML, plus the disposable inspection script, live under
  `/var/tmp/agent-keep/views-jhtfx7/account-*`. No captures enter git.
- Independent critical review of the combined work (claude-fable-5-2 finder,
  gpt-6-astra verifier), followed by `/assess-findings`: stale client comments
  corrected; no remaining finding in this wording change.

These edits are ready but not landed: the combined worker preserves the branch
because its navigation-preservation requirement remains unmet. The issue stays
in testing, not done. No installed-server verification is claimed.
