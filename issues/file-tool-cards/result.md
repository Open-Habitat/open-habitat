# Result

Read/write/edit now show counts in the closed row, file paths when the validated native arguments provide them, an output box for read/write, and a line diff for edit. Paired removed/added lines mark changed words and carry spoken removed/added labels. The command's copy button sits beside the command, independent of output copy.

Pi's native unified diff is used when the result carries `---`, `+++` and hunks; when it does not, the replacement `oldText`/`newText` arguments are diffed. This differs from the draft's always-computed LCS: it keeps Pi's own hunk ordering and context. Without replacement text, the native-diff copy button explicitly says “Kopioi diffi” rather than claiming to copy the complete new file. Native history fetches full readable argument/result blocks, with the existing 64 MiB reading cap. The fixture now exercises read, write and edit in one synthetic turn.

Synthetic lab paired evidence: `lab-desktop.{png,html}`, `lab-phone.{png,html}`, `lab-dark.{png,html}`. The captures show the three expanded file cards in light, dark and phone widths. They use invented fake-Pi content, not a live user or real Pi.

Checks: `./scripts/test-focused.sh --area web` passed; `./scripts/test-focused.sh --area browser --spec file-tool-cards.spec.ts` passed including Axe on the diff. Component tests cover counts, word pairing, native-diff preference and copy. The first browser attempt had the test's base URL omitted and hit the wrong endpoint (200 instead of 204); after fixing the test configuration its rerun passed. No full clean gate result is claimed here.
