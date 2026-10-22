# Start-page guides implemented

All goal titles open **Opas**: outcome, when, numbered steps and optional full
request. Both **Aloita** buttons return to the catalogue and prepare the editable
draft without sending. Earlier nonblank text remains after the request; the
result ends in exactly two newlines, with focus and caret at its end. Returning
without starting changes no draft text.

`GoalGuide.tsx` / `.css` are reusable production components, with guide,
backless panel-content and long-request Storybook examples. No file-tree changes.

## Decisions for later review

- Required plain-text `what` (≤2048 UTF-8 bytes) and `steps` (1–8 nonblank strings,
  each ≤1024 bytes) join `title`, `when`, `prompt` and optional effective native
  `skill`. Old goals are invalid: no compatibility branch. The bundled skill,
  parser, contract and repository's own `.agents/start-page.md` are updated.
- Guide selection is local to the mounted view, with explicit return/focus
  restoration, not new host routes or durable guide IDs.
- Trailing LF characters are normalized before adding two final newlines.
  Other nonblank text/spaces remain unchanged; blank drafts are discarded as before.
- A mounted `data-reading-intro` marker lets existing scroll owners distinguish
  authored reading from conversation-tail following without duplicating selection
  state. Native following resumes when messages replace the introduction.

## Evidence and validation

Base `bc7101be`; tests cover this implementation. Browser suites ran sequentially
through the installed warm runner on Cedar's Linux guest, never on Alder.
These are synthetic same-UID host-backed checks, not live/UID-isolation evidence.

- Dependencies installed from both web and Pi-fixture lockfiles.
- `./scripts/test-focused.sh --area web`: format/lint/types, **87 files / 491 tests**.
- Focused browser `start-here.spec.ts`: **4 passed**, 1440/390 × light/dark; axe,
  keyboard/return focus, both Aloita buttons, retained/reloaded draft, end caret
  including typing, exactly two newlines, empty draft, skill/no skill, complete
  bounded long request, no send, guide visibility and wide→narrow→wide reflow.
  The former lab-prefixed spec now runs in the normal suite using the same lab fixture.
- Focused `thread-fill.spec.ts`: **1 passed**, including intro→sent conversation;
  `native-history.spec.ts`: **11 passed**, including older-page anchors/narrow history.
- Storybook production-component catalogue built successfully.
- Focused contracts: generated fingerprints clean; **63 schemas, 68 fixture files,
  40 scenarios, 17 negative checks** valid.
- `GOMAXPROCS=2 go test -p 1 -count=1 ./internal/daemon ./test/browser-host`:
  both passed under `umask 077`, with `/var/tmp` scratch.
- Project-view validator, issue doctor and whitespace checks pass (doctor retains
  pre-existing unrelated image-format/size advisories). No full gate/deployment claim.
- One targeted reviewer, `claude-fable-5-1`, found no parser/draft/state defect.
  Its narrow scroll-fix continuation found one remaining EditorSplit width-change
  tail pin. Fixed it; extended its unit test and the browser resize journey.

[evidence/](evidence/) has **12 AVIF + inert static-HTML pairs** from the successful
synthetic journey: catalogue, guide and expanded long request, both widths/themes.
Compared desktop/light and phone/dark guides and phone/light catalogue with the
round-2 prototype: same card grid, continuous sections, tokens and bounded prompt.
Production keeps its actual shell/composer; the additional top Aloita is visible
on phone even when the bottom action requires scrolling. Fixed tail-following
that initially clipped the title/back. Guide copy is round-2 synthetic material;
its skill uses the lab's effective `pytest-debug`. No personal/live data captured.

## Failure inventory

All required steps completed after recovery; nothing remains blocked. The tracker
refused the requested `fixed` status because it is bug-only; this feature is
closed as `done`, without falsifying its type.

- Staged snapshot HTML exposed trailing whitespace in serialized head/CSS.
  Normalized only the HTML head (not captured native text/body), then whitespace
  checks passed.
- Scoped discovery guessed nonexistent component/spec/skill and Fleetrepo paths;
  actual sources were located/read. Root-level Biome refused nested configuration;
  reran from `web/`. First web check caught suppression placement, scrollable-pre
  lint, specificity and template warnings; fixed, then complete checks passed.
- Cancelled the first quiet browser handshake while checking placement, then
  safely restarted the ordinary command. Exploratory runner command/task/config
  queries refused native placement, missing legacy declaration, or missing action.
  Read the installed warm dispatch; all required browser runs completed through it.
  No runner configuration or services changed; no local browser started.
- New viewport assertions initially failed both 390 px cases: history scroll
  owners overrode authored reading. Added the marker guards and regression tests;
  the final journeys pass. The review's additional width-reflow case is fixed too.

Working logs: `/var/tmp/start-guides-{web-width,browser-evidence-final,thread-fill-final,native-history-final,storybook-final,go-final,contracts-final,review,review-scroll}.log`.
