# Placeholder selection

Aloita moves a single nonempty, single-line `[label]` to the end, after the
instructions and any existing draft, with a blank line before it. The whole
marker is selected; typing replaces it. Both buttons keep the guide open and
send nothing. Without a marker, the existing two-newline/end-caret behavior is
unchanged. Ambiguous/malformed brackets stay literal; brackets in an existing
draft are not interpreted.

The shipped `open-habitat-start-page` skill's File format section defines the
marker and shows YAML block-scalar requests with complete instructions first
and the placeholder last, including the DD-source example. Surrounding authored
punctuation is preserved, so older inline requests should be refreshed into
that form. Production Storybook examples and the synthetic guide use it too.

## Validation and self-review

Base `7ddc790c` plus this implementation; all final checks ran after the last
runnable change:

- `npm ci --prefix web` completed.
- `./scripts/test-focused.sh --area web`: format/lint/types and **93 files /
  547 tests** passed. Pure cases include inline/end markers, ambiguity and
  malformed/multiline brackets.
- `./scripts/test-focused.sh --area browser --spec start-here.spec.ts`:
  **4 passed**, 1440/390 × light/dark, through Fleetrepo's Cedar warm runner.
  Both Aloita buttons, existing/empty drafts, selected brackets, actual typing
  replacement, unchanged no-marker end caret, no implicit send and axe audits
  pass. Only one browser suite ran at a time. Synthetic same-UID/fake-Pi
  evidence, not live-provider or user-isolation acceptance.
- `npm run build-storybook --prefix web` passed.
- Project-view validator, issue doctor and `git diff --check` passed; doctor
  retains unrelated pre-existing image-size/format advisories.
- No Go code or wire contracts changed; no Go/contracts/full gate or deployment
  claim. No targeted reviewer was required: no shared state ownership,
  contracts or daemon behavior changed.

[evidence/](evidence/) contains four AVIF/static-HTML pairs from the synthetic
lab. Inspected all four captures: the final marker is visibly selected and the
instructions and earlier draft remain readable in both themes and widths.
Compared with the accepted round-2 read-guide prototype source and earlier
captures: same continuous reading column, section spacing, bounded request
and token-based composer. No layout/CSS/token changes. The extra top action
and retained guide follow the preceding polish; final marker selection is this
brief's intentional interaction change.

## Recovered tool failures

- Initial discovery guessed `components/start-page*` (the component is
  `StartHere.tsx`) and found no installed `web/node_modules`. Located the actual
  files and installed the lockfile before checks; no required check skipped.
- Image-tool probing found no `convert` and the system Pillow lacks AVIF
  support. Used installed `avifenc` successfully for all four captures.
- `issuectl close --status fixed` refused because this is an `improvement`;
  retained its type and closed with the tracker's supported completion status
  **done**. Error receipt: `/var/tmp/placeholder-close-error.json`.

Final logs: `/var/tmp/placeholder-{web,browser,storybook}-final.log`.
Capture transport: `/var/tmp/placeholder-retrieve.py`; original synthetic PNGs
are retained in `/var/tmp/placeholder-shots.tar`. No required step remains
incomplete.
