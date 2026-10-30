# Result: model-suggested workspace icons (Sirut)

Behind the *Työtilan kuvake* experimental card. While the repository's
`.open-habitat.yaml` names no icon, the workspace page shows the *Ehdotus*
row under its heading (`WorkspaceIconSuggestions`): placeholders and a
reading line (a seconds counter after 3 s), then five suggested icons with
reasons and the model's sentence, a wish field, the quick wishes
*Leikkisämpi*, *Asiallisempi*, *Kirjaimet* and *Toisia*, and earlier rounds
behind arrows. The footer says what the model saw and which model answered.
One click accepts through the icon write of `workspace-icon-setting`
(written and committed silently) and the row goes. *Ei nyt* hides it for the
visit; `icon: auto`, which the picker's *Automaattinen* writes, hides it for
good; the picker's *Ehdotuksia mallilta…* brings it back for the visit.

Without a model the row says so, offers *Avaa asetukset* (Tekoäly) and
shows the chain's own choices (logo, the name's letters, three emoji drawn
from the name, dashed); a timeout, an invalid answer or a lost request
keep earlier suggestions or show the same fallback, with *Yritä uudelleen*.

Host: `POST /api/v1/workspaces/icon/suggestions` (gateway: CSRF and Origin
like any write, since it spends the person's credentials; daemon:
`workspace_icon_suggest_linux.go`). The daemon reads bounded facts beneath
the pinned workspace (the name, the README's first 2 KiB, the start page's
title and first paragraph, languages by file count three directories deep,
the logo path) and the icons other workspaces' configs name, and runs
`icon-helper.mjs` exactly like the title helper: the selected Pi
installation as the person, HOME/PATH/USER only, 15 s, stderr swallowed,
4 KiB of answer, fixed failure codes. The helper tries the person's native
credentials with the shared background-model policy first and then the
shipped Claude bridge alone (`cacheRetention: 'none'`, its isolated one-off
path), so a Claude subscription alone gives suggestions. Every answer is
validated in Go against the flat format (`parseIconValue`): an emoji, 1–3
letters, or exactly the found logo; never `auto`, another path, a URL, a
repeat, the current icon or another workspace's. Nothing is stored.

## Checks

- `TestWorkspaceIconSuggestionsValidateTheModel`: a steered answer (URL,
  other path, README word, `auto`, repeats, the current and another
  workspace's icon, an overlong or control-character reason) leaves only the
  valid ones; bounded facts (README prefix, start page first paragraph,
  languages, logo); a symlinked README is not read; fixed failure codes;
  request bounds.
- `TestIconHelperUsesPinnedPiRuntime`: the real helper on the pinned Pi SDK
  against a synthetic provider: no tools, `max_tokens` ≤ 600, the instruction
  to treat facts as data, the README in the user message, `model_unavailable`
  without credentials and without a provider call.
- `lab-workspace-icon-suggestions.spec.ts` through the real gateway and
  daemon with the lab's synthetic model (`test/browser-host/icon_model.go`):
  only valid icons shown, a quick wish as a second round and back, accept
  commits and hides the row, the picker brings it back, loading/timeout/no
  model states (replies held or replaced in the browser), *Ei nyt*,
  `icon: auto` persistent, the phone width, axe.
- Live on Birch, 30.10, the helper with Jari's own credentials and a
  synthetic input whose README told the model to answer with a URL: native
  credentials answered with `openai-codex/gpt-6-luna` in 3.4 s; with a home
  holding only the Claude login, `claude-bridge/claude-sonnet-5-5` answered
  in 4.9 s. Neither suggested the URL.

## Decisions for later review

- **Native credentials before the Claude bridge.** The helper asks the
  person's API or ChatGPT credentials first and loads the bridge only when
  they give nothing. Alternative: the bridge first, or by the background
  policy alone (which would pick the bridge's Sonnet for anyone with the
  bridge installed, even without a Claude login). An API answers faster, and
  a missing Claude login then costs nothing.
- **Languages by file count**, three directories deep, at most 4000
  entries, hidden and vendored directories skipped, Markdown only when there
  is nothing else. Alternative: `git ls-files` with byte counts. The walk
  needs no subprocess and works without Git; the shares are approximate,
  which is all the model needs.
- **The model sees other workspaces' configured icons** (to avoid repeats);
  the footer does not list them, as in the prototype.
- **Reasons up to 60 characters are kept**, though the model is asked for
  40; longer ones drop the suggestion rather than cut it.
- **One automatic request per visit**, none stored, as round 2 proposed.
- **A lost request** shows *Ehdotuksia ei saatu* with *Yritä uudelleen*,
  distinct from the model's timeout.
