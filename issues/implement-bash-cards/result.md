# Result: Kortit command history

Implements Jari's selected direction without the prototype's repeated context captions. The published prototype's content was read and matches SHA-256 `a788b0beb51a8a14065be1204ce4a3642b6b9227d7de30d2d5d7328e6f1f63fc`. User-message alignment remains the parallel worker's scope.

## Review and scope

Focused self-review is proportionate: this changes command-card rendering, composer notices and their client-side pending observation, not authentication, contracts, host authority, installation or the Unix-user boundary. No independent security review or full gate is claimed.

Reviewed literal rendering of command/output (including Markdown-looking and HTML-looking output), retained native block loading and block indexes, keyboard disclosure, draft retention when another command runs, request-versus-confirmed-stop state, no automatic retry after uncertain interruption, and stale/disconnected status. The interrupt marker is bound to the native command ID; an accepted abort reply does not clear it while the host still reports that command running. Native completion or an unknown outcome ends the spinner. Visibility guidance stays in the typing hint, not each card.

The two existing `!` / `!!` journeys moved from `lab-composer-area.spec.ts` to ordinary `command-cards.spec.ts`; their native controller/fake-Pi command, output, context-exclusion, second-command refusal and cancellation coverage is retained, with pending-stop, keyboard disclosure, accessibility, narrow/dark layout and reload assertions. This makes them runnable under Alder's focused remote policy without duplicating journeys. No test-time saving is claimed.

## Validation

Base revision: `73c3475aba6c4917d061876fb2a8c0066586533c`. Remote jobs capture dirty source and explicitly include both new tests. Run with `umask 077` and disk-backed `TMPDIR=/var/tmp`:

```sh
./scripts/test-focused.sh --area web \
  --untracked web/src/components/composer/CommandRun.test.tsx \
  --untracked web/tests/command-cards.spec.ts
./scripts/test-focused.sh --area browser --spec command-cards.spec.ts \
  --untracked web/src/components/composer/CommandRun.test.tsx \
  --untracked web/tests/command-cards.spec.ts
```

Final-source focused web checks passed: job `2476a1f4b7187ee72fa9d47548c112d048285d0b09cc785522feeb8f3269f4e4`, snapshot `008e6f9710e41bff53df161de3341826124be245f2b9b51b5d1ddd0c07a22b97`, evidence `/var/tmp/oh-browser-wzpkwn_x`. Format, lint, typecheck, unit and component checks all completed successfully. Final-source ordinary browser checks passed: **2 passed (8.5s)**, job `1d1d95871867ccb4a14b4baa2ad8287c06a8801365b2490d741a8e03016753bc`, snapshot `1bc65cb7cfc7e246658d50d68fe976e243bc2c604245bd944db68c5758d899c3`, evidence `/var/tmp/oh-browser-0tk73azj`. This includes affected Axe accessibility assertions, keyboard disclosure, running/refused/pending/confirmed command behavior, and a narrow dark-theme saved-history reload. These are host-backed synthetic results, not real provider or distinct-UID isolation evidence. Runnable inputs have not changed since these final captures.

Earlier focused web feedback passed: job `fb931ae0627744f63c35e76f9f4161c4e5ff43a38d376db6cf0b6e258fc6debd`, snapshot `6876ff50f42843dd9b495d6abd9fe5c532197fef13db3165b1e06ce6af9b3199`, evidence `/var/tmp/oh-browser-yr1epqvz`. Superseded by the final-source checks, not reused as final evidence.

Local lightweight Biome checks, project-view validation and `git diff --check` passed. Issue doctor passed before closing; it is repeated after metadata changes.

### Failure / incomplete-step inventory

- Discovery probes referenced absent `CommandRun.test.tsx`, command-spec globs, `web/src/pages`, and conversation/render globs. Read the actual callers and tests instead; no deliverable step is missing.
- One temporary Python test-migration script had an indentation error and changed no files. Corrected script succeeded.
- First Biome pass found the moved array-index suppression attached to the wrong line and a non-null assertion in the new test. Both were corrected; subsequent targeted checks passed.
- Initial browser feedback: one passed, one failed because saved output still went through the generic Markdown renderer, so the expected literal output `pre` was absent. Job `8eefe5232e6316c1c331d4bce473b0cd6c6ef7f4cd95800557ad09dfe10fcf0e`, snapshot `8d7886baed63be3ce5ec6eea87af94e4be072a279f84ed481b3ec156b57f8cce`, evidence `/var/tmp/oh-browser-2uytw4t2`. Self-review had already corrected the saved command/output to plain text before this job completed; the final browser submission tests that correction. Resolved by the final 2/2 passing browser run above.
- Before/after screenshot + static HTML captures, manual lab and lab-config runs are intentionally deferred: Alder policy does not permit those local runs or remote lab submissions. Ordinary host-backed synthetic browser checks are the permitted evidence, not visual captures or live/native-UID proof.
- No test-server access, push, new issue filing, Fleetrepo edits or global application installation occurred. No Fleetrepo change is required.
