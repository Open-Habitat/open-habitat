# Result

Ordinary conversation and workspace copy now says **agentti**, **agentin**,
**agentille** or **agenttia**. This includes composer placeholders and accessible
names, queues, progress, stop controls, native questions, delivery uncertainty,
command output notices, archive/trash descriptions and model defaults. Existing
component/browser expectations were updated, not replaced by label-only tests.
The wording follows the design system's calm, direct Finnish voice.

Pi remains the product name in Account/Claude connection settings, native
credential descriptions, the settings-file explanation
(`~/.pi/agent/settings.json`) and its sign-in guidance. Native identifiers,
paths, commands, protocol values, the native unknown-event parser and technical
comments are unchanged. Historical design prototypes and their tests are not
production UI and retain their original copy.

## Validation

Final source revision tested: `1efa5a465a951f0e6d07398735a40455d6e5e6fd`
(on main `1e5f53a9`). Earlier validation was repeated after rebasing editor and
deletion-blocker work; later integration into main remains the conductor's
combined-tree responsibility.

- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web`: **passed**.
  Job `2c387bcd7fd577e95a2fd4b819f26d97aa0d99c79f4b4069796e16339cb058b3`.
  Formatting, lint, typecheck, 279 unit and 196 component tests passed.
- `umask 077; TMPDIR=/var/tmp python3 scripts/browser-focused.py --task oh-browser-ordinary`
  with repeated `--task-arg=tests/<spec>` for `browser-conversation.spec.ts`,
  `queued-send.spec.ts`, `command-cards.spec.ts`, `settings-model-picker.spec.ts`
  and `design-system.spec.ts`: **88 passed, 3 failed, 2 capture-only skips**.
  Job `1fe69b3874457017956f93f3f951cfab59b4cfc308f8d2834411b2c1357aed02`.
  This is remote ARM64, synthetic host-backed evidence, not live-server/UID
  isolation evidence. The four design-system axe cases passed in this run.
- Two failures reproduce identically on unchanged main `33d63b6f`, checked
  from a closed disposable clone with the same four journey specs:
  job `9a6b7ca9ef3ed6527ab1e3cbb031954ecadab9c5427f4147fa21612501f563f4`.
  The uncertain-send receipt case times out clicking “Tarkista keskustelun tila”
  because the Tiedot popover intercepts pointer events. The Stop-before-start
  case expects zero connection/unknown-state notices but finds one. Baseline
  also had three unrelated timing failures; it was not a passing suite.
- The third final-run failure was the 401-login case timing out opening Tiedot.
  An unchanged-source isolated rerun using the same task, the browser conversation
  spec and `--task-arg=--grep --task-arg='401 from actual status request opens login'`
  **passed**: job `488597d983790fc35778ef46c6db4bbe2421920bb8f256a44f9f2c508d69d87d`.
  Earlier combined validation also passed this case. No test was weakened.

## Review and limits

Focused self-review is proportionate: the diff changes visible strings and
matching expectations only, plus formatter reflow. It changes no Unix-user
boundary, authority, installation, protocol or behavior. The review checked
Finnish inflections and that component identifiers, native payloads and settings
branding were not renamed. No independent LLM review was required.

Before/after captures were deferred: this host's focused remote policy does not
allow manual lab capture. No live host was accessed. No full gate, deployment,
push or Fleetrepo edit was performed.

## Failed and superseded attempts

- First web job `dd71edf9dac68e2c85ab457e6815f34c5e57015401d32b59d3097ae7b559d4fd`
  failed formatting; fixed with the pinned Biome formatter.
- Initial browser job `b514e8d66a6ee7dd0ed91a15d88feac7ff0c2f526de648d990c2ff264f1e0875`
  was explicitly cancelled after capture because its source was superseded.
  Repeating `--spec` selects only the last spec; subsequent multi-spec jobs
  used repeated documented task arguments instead.
- Web jobs `7a302eb84e4c3d05a89b9650e5bd04ab3548f6aa86ee6df605affecebce0ceb7`,
  `669914f6c74c43efc64b18bbc297cdcdc2e7c931006a78d7357473a916c87195` and
  `009946e66eef797f3daaaaa7d0db64ed2cdd482a3eb152b2d68e06aa28ce484e`
  exposed stale text expectations. All were corrected; web job
  `713f4b43bcaddc99e7b120f8844a9ef46296de1e93035da6f6f69aaeed163340`
  then passed, as did the final rebased web job above.
- Browser job `d35182e46c32623f8c4708f5dfddc07adea554ee534f723d8344f3a3498f586e`
  had the baseline uncertain-send failure (81 other cases passed).
  Rebased job `a12fb2cc461cc737ff7c294a11eaf789043458673732bbcdf379f1e1748c68a5`
  had the two baseline failures (89 passed, 2 capture-only skips).
- Earlier design-system job `a9888f0c3350e5b15cbf2b8de64bfd4258857a4f8cea04a1b8e821ecd2281ab4`
  failed the dark unhappy-state button contrast check (about 3.96:1 vs 4.5:1).
  The identical check failed on unchanged main in baseline job
  `8539ed645be7c6f3e2867d32077e036dc3b2341b04ff3eec33e8b1477e3d397a`
  (about 3.98:1, same button/colors); later combined runs passed. This is not
  a claim that contrast was fixed.
- One skill read used an incorrect path; it was immediately read successfully
  from the supplied installed pi-processes path. One attempt to parse the
  process tool's bounded log tail hit truncated JSON; the complete retained
  runner response/artifact was read instead. Neither affected test execution.

The only accepted red checks are the independently reproduced baseline failures;
the 401 timing failure passed on retry. These are disclosed rather than claimed
as a green browser suite, using the task's explicit pre-existing-failure exception.

The isolated 401 case also passed on unchanged main: job
`0568a1c76ddcc8729f541bcd6931085f8305af936fe9ddfd62315aa7699d0d0b`.
`issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
`git diff --check` passed after recording the result and closing the issue.
