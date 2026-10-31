# Result

Fixed: a successful empty clone becomes a workspace without inventing a first commit. Gitea/GitLab admission and the common clone UI now allow empty repositories too.

## Cause and reproduction

Created only `maintainer/oh-empty-clone-test`, private, with no README/commits. GitHub reported size 0 (its API still names an intended default branch, `main`). Native Git successfully cloned it; `HEAD^{commit}` could not resolve. The daemon required that commit in verification and therefore returned `verification_failed`, kept the directory, and discovery treated its index-less/ref-less `.git` as an interrupted transfer.

The temporary test preserved in `live-smoke.go.txt` ran the production daemon admission/resolution/clone/verification path against this exact repository, with the caller's own gh authorization and a disposable home. With the original `github_jobs_linux.go` supplied via Go overlay it failed with `verification_failed`, `leftover: kept`; with this fix it passed and discovery returned one workspace. No other person's account/home was inspected. No credentials were copied into evidence.

The repo was deleted. Birch's gh lacked `delete_repo` (403); the exact requested deletion succeeded using the caller's existing gh on Alder. No other repository was deleted.

## Implementation and decisions for later review

- After a successful native clone, accept an unborn symbolic branch only with no refs, no staged entries and a clean worktree. Initialise its ordinary Git empty index. Alternative: a Habitat completion marker or synthetic commit; rejected because native Git already has the needed distinction and the user should own the first commit. No additional registry/store.
- Read-only observation requires a regular native index before accepting an unborn repository. A process inside an interrupted directory can block recovery, but must not establish completion. Existing interrupted clone restart/removal semantics stay unchanged.
- Treat empty Gitea/GitLab repositories the same as GitHub, removing their explicit server refusal and shared UI disable reason. Retain the informational empty badge, expired-token checks and all other write guards.
- Preserve Git's unborn branch choice, without setting a branch or pushing on the person's behalf. Native first commit/push is tested against an empty local remote; real-provider first push and deployed use remain for the KOKEILTAVAA check.

## Evidence

Tested source: base `55838dbd8237b38fabef670102d3d1ab33144170` plus the source diff in this issue's fix commit. Linux Birch, umask 077, disposable `/var/tmp` scratch, Python dependencies in a disposable uv environment. `OH_PORT_BASE=9750`, `OH_BROWSER_WORKERS=2`.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: pass, including genuine empty local Git clones, first commit/push, discovery after forgetting jobs, busy unfinished clone refusal, native HTTPS Gitea and GitLab empty clones. Package tests skip privileged paths according to their existing guards; no isolation claim.
- `./scripts/test-focused.sh --area go --go-package ./internal/nativegh`: pass.
- `go test ./test/browser-host`: pass (focused runner only accepts internal package paths).
- `./scripts/test-focused.sh --area web`: pass, 1188 tests, static and component checks.
- Named browser runs, each separately through `test-focused.sh --area browser --spec`: github-first-onboarding (6), github-stream (2), github-observation (3), gitlab (1), all pass on final source. These are synthetic same-UID host evidence. GitHub empty onboarding advances and remains discoverable after reload; GitLab empty action is enabled and real smart-HTTP clone becomes a workspace.
- `empty-project.png` and `.html`: synthetic lab pair, captured with `OH_VISUAL_CAPTURE=1`; inspected the enabled action and retained empty badge. Ordinary tests never rewrite the pair.
- Independent `/llm-review` and `/assess-findings`: claude-fable-5-1 found two concrete defects during development, gpt-6-astra verified them. Both classified CONFIRMED/FIX and fixed: busy index-less clone misclassification, and the stale forge UI gate. No remaining findings. Review/assessment scratch is in `history/`; no follow-up issues.

No full gate or full browser suite was run. No deployment or real GitLab/Gitea provider acceptance claimed.

## Resolved test/tool failures

Initial compile lacked the strings import; fixed. Daemon schema cases initially lacked Python `referencing`; installed requirements into uv venv and reran successfully. First browser regression asked the synthetic host's fixed workspace list to discover a new clone; onboarding now uses native discovery. Extending GitLab journey created a second workspace, requiring its existing single-workspace locator to filter the native repository name. Biome formatting failures fixed. One unrelated SpinoffConversation unit test timed out at 5 seconds under load; unchanged test passed in the final complete web run. No persistent failure reproduced.

Consult CLI rejected unsupported `--prompt`; corrected to stdin and all four scoped review calls succeeded. Repeated focused-runner spec/package flags selected only the last value; all named packages/specs were rerun individually. Nonexistent optional path probes had no side effects. All required checks are complete.
