# Result, part A: sign-in composer, Pi onboarding, GitHub session, sign-in beside a first pass

Load used for reproduction on Birch: specs with `OH_CPU_THROTTLE=4` or `6`,
`OH_REPLY_DELAY_MS=0` (as in the gate), 4 to 6 Playwright workers, and 4 to 6
`timeout`-bounded `nice 5` shell busy loops; Go with the injected pause
described under item 4. A plain load did not reproduce items 1, 2 or 4
(dozens of passing repeats each), so for those the race was isolated by
holding or delaying exactly the transition it depends on.

## 1. `ai-sign-in-window.spec.ts:61`: the sent message back in the composer (product defect)

**Cause.** This was a real product defect: a person would have seen the message they had
just sent back in the field, with a new *odottaa kentässä* marker, ready to be
sent again. After a refused Claude turn the daemon's status carries
`auth_error: "pi_auth_failed"` for that turn's command until a new send
replaces it. After the sign-in the open conversation resends its waiting
message (`resendNow` → `submit` → `post`), and the field empties. If history
showed the resent user message before any status read made after that send
had arrived, `refusedTurn` found no refused reply (the newest entry was a
user message) and the `ownFailure` fallback in
`web/src/app/BrowserConversation.tsx` took the daemon's classification of the
**earlier** command as current. It used the newest user message, which was the
resent one, as the refused text, restored it into the field and wrote a waiting
marker. The gate's log matches this: *Viestisi lähti* was shown and the field kept
"Kirjaa tunnit. Kiitos!" while `data-working` went true → false.

**Fix.** A direct send records the command the status named when it went
(`supersedes` on the send observation, kept through an uncertain reply). The
fallback ignores a status that still names that command, because such a status was
read before the host took this tab's send. A refusal of any later command
(another tab's send or this tab's held send) still counts. The first version of
the guard compared against "any other command", and the review found that this
hid later commands' refusals (see Review).

**Evidence.** The spec now holds every status reply after the code
confirmation until history shows the resend, which makes the gate's ordering
deterministic: with the product unchanged it failed 3/3 at line 122 with the
gate's exact value, and with the fix it passes. Final runs: the spec file
`--repeat-each 10` (20 cases) under CPU 4× with six busy loops and six workers:
20/20. auth-failed-turn, browser-conversation, queued-send and
ai-sign-in-window together: 104/104. Web static, unit and component checks:
1590/1590.

## 2. `pi-onboarding-slow.spec.ts:7`: `pi-code-copy` never appears

**Cause.** This was a test-design race. The synthetic device-login helper in
`test/browser-host/main.go` printed the code and then exited as `unknown` after
`sleep 2` of wall time. The spec delivers each attempt read 1.9 s late, the
POST answers `pending`, and the page polls every 2 s. When the first poll after
the start fell late in its interval (or a tick was skipped under load), the code
came and went between two reads and the page went straight to *interrupted*.
An instrumented run showed the first read landing 1.64 s after the POST, inside
the 2 s window with 0.36 s to spare.

**Fix.** A new fixture control, `/fixture/pi-device-hold?value=on|off`, keeps
the helper's code until it is released, and the loop also ends when the host exits.
Without the hold the helper keeps its two seconds, so the other onboarding specs
are unchanged. The spec holds the code before pressing start and releases it once
it has seen the code and the focus check; the *interrupted* transition that
follows is still the helper's own.

**Evidence.** The old spec with only the POST reply delayed by 2.1 s (so the
page learns of the attempt after the code's window) failed 3/3 at line 51,
exactly as in the gate. The held spec under the same delay passed 3/3. Final
run: `--repeat-each 10` (20 cases) under CPU 4× with six busy loops: 20/20.
All eleven non-lab specs that drive the Pi device sign-in (account-settings,
first-use-ux, pi-native-route-gate, pi-onboarding-*, round4-polish,
provider-login-layout): 40/40.

## 3. `github-session.spec.ts:6`: timeout "in the finally cleanup"

**Cause.** The location in the gate's report was misleading. Step timing showed both
reproduced failures stalled at the second tab's `logout-confirm` click: no
logout dialog had opened. The test timeout then aborted that click and the
`finally` block's fixture request got blamed. Instrumenting the second tab
showed the actual sequence. The route first renders the repository chooser with
`onboarding-abort`, then switches to the Git identity step, whose confirm
button appears after its own read. `pointerdown` landed on `onboarding-abort`,
`git-identity-confirm` was inserted and pushed the button down, and
`pointerup`/`click` landed outside it, so react-aria cancelled the press.

**Fix.** The second tab now waits for the identity step's action
(confirm or continue) before pressing abort, so it acts on the settled step.

**Evidence.** Under CPU 6× with six busy loops and six workers, the old spec
failed 2/30 and 6/40 (the instrumented copy); under CPU 4× with six busy loops,
the old and fixed specs side by side gave old 2/30 failures with the gate's
exact signature and fixed 30/30. Final: `--repeat-each 10` within the 50/50 run
above.

## 4. `TestSignInWithoutFilesRunsBesideFirstPass`: 503 on "removal beside the pass"

**Cause.** This was a test race against an intended product ordering. The Atlassian
sign-in's worker (`driveLogin`, final block in
`internal/daemon/integrations/relay_linux.go`) publishes `completed` under
`c.write` and then reconciles before releasing it. The test removed the account
as soon as it read `completed`, and `remove` deliberately refuses with
`TryLock` rather than queueing behind the catalog, so under load it met the
reconciliation and answered 503 `native_unavailable`.

**Fix.** The test waits for that sign-in's worker (`attempt.done`) before the
removal.

**Evidence.** Plain load (eight processes × 60 runs with `GOMAXPROCS=1`, plus
150 sequential runs, with busy loops) did not reproduce it. A temporary
100 ms pause inserted before that reconciliation reproduced the gate failure every time
(503 at line 352, 1.71 s, against the gate's 1.72 s). With the fix the test
passed 3/3 under the same injected pause, and 10/10 normally (`-count 10`). The
whole `internal/daemon/integrations` package passed (`test-focused.sh --area go`).

## Review

The product change touches send state in the conversation view, so it went to
an independent `/llm-review` (finder GPT-6 Astra, verifier Claude Fable 5.1,
2 calls) and `/assess-findings`. The one finding was confirmed: the first
guard hid a later command's genuine refusal. It was fixed by `supersedes`, and the
verifier checked that the fix still closes the original race and hides no later
refusal. The verifier also found that an uncertain send reply dropped the field;
that is now carried too. The one remaining case, a reload within one status poll
after a sign-in resend, which rebuilds the observation without `supersedes`, was
dropped as rare (rule 1b) and not filed. The fixture and spec changes had no
findings.

## Decisions for later review

- **Item 4 is fixed in the test, not in the product.** Alternative: publish
  `completed` only after the reconciliation and unlock, or let `remove` wait
  briefly for the lock. I kept the product as it is: its comment says completion
  is published before reconciliation on purpose, the refusal-instead-of-queue
  rule guards against hour-long writes, and a person cannot press remove within
  the milliseconds a reconciliation holds the lock.
- **Item 3: the repository chooser briefly shows before the Git identity
  step** (the identity step is decided only after the catalog read). This is a
  short flash that a person could also click into. I left it as it is, because
  changing the onboarding order is a design question and not part of this flake;
  the spec now acts on the settled step.
