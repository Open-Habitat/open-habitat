# Return view v2 fit — synthetic evidence

The return view starts with “Jatka siitä, mihin jäit” instead of a separate “Työtilat” introduction. Conversations are compact rows: positively observed live processes under “Käynnissä”, all others under “Muut keskustelut”. Existing read-only and browser-session routes remain. The host does not supply last-opened ordering or timestamps, so neither the section nor a date is invented. The draft's single new-conversation button is omitted because the user must choose a workspace first; `item.md` records these I1 deviations.

Four refreshed [comparison pairs](../compare-v2-pairs/index.md) contain synthetic TLS-lab screenshots and adjacent offline HTML, light/dark at 1440 × 900 and 390 × 844. Captured using `NAH_PORT_BASE=21000 ./scripts/lab.sh start`, `NAH_PORT_BASE=21000 PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node web/lab/compare-v2.mjs --home`, and lab stop. The lab's invented histories do not show a positively observed live process, so “Käynnissä” is tested with component fixtures, not claimed as screenshot evidence. No live host, real profile, provider or distinct-UID isolation was tested.

Development checks: `TMPDIR=/var/tmp/nah-fit-return NAH_PORT_BASE=21000 ./scripts/test-web-fast.sh` passed 14 unit and 64 component cases after formatting. `TMPDIR=/var/tmp/nah-fit-return NAH_PORT_BASE=21000 PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" npm run test:browser --prefix web -- --grep '@workspace-slice|@lab shell|@a11y keyboard|@github-first'` passed 21 synthetic host-backed browser cases. Earlier fast run stopped at formatting on the unformatted edit; formatting and rerun passed.

Final committed-candidate gate, review and metadata receipts follow.
