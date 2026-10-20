# Result: ! commands and composer notices

**Prototype:** https://glasspad.example.test/p/coyjnswccxiytkq6hyxpmeexem/

## Axis and directions

The axis is **how much structure completed commands occupy in the conversation**.
All directions use identical invented output, the production Rivillä field/row
geometry and the same notice placement. This is a presentation copy grounded in
`web/src/components/composer/Composer.tsx`, `CommandRun.tsx` and `composer.css`,
not a production implementation or a change to the shared prototype library.

- **Kortit:** each command is an open card. Best immediate readability for one
  command; repeated commands consume substantial vertical space.
- **Loki:** completed successful commands become compact disclosure rows; a
  running command or failure opens its output. Least conversation displacement,
  but reading successful output takes a click.
- **Nippu:** consecutive commands share one frame and a command count; individual
  outputs open independently. Makes a sequence recognisable without a card per
  command, but adds an extra grouping concept.

**Recommendation: Loki.** Preserve each command's place in the conversation,
show its exact command and exit code even when collapsed, and keep running,
failed and unknown results open. Never silently fold a command the reader has
opened while its output changes. `!!` always carries “Vain sinulle · ei Pi:n
kontekstissa”, including when collapsed: private here means excluded from Pi's
context, not absent from the person's native history.

## Notices and interruption

Put the previous-command refusal **immediately below the field**, associated
with the field via `aria-describedby`, rather than as a transient toast or a
message in the chat. Preserve the draft and add “Näytä komento” linking to the
running entry. The existing Rivillä Stop remains on the right of the field.

Replace the long interrupt acknowledgement with a spinner and **“Keskeytetään…”**
in that same stable notice slot. The command/Pi status also remains pending;
it does not say stopped until a host confirmation. The prototype's explicit
“Vahvista päättyminen” and “Yhteys katkeaa” buttons simulate those two possible
host outcomes, not a timeout-based assertion of completion. Losing the connection
ends in unknown status, not success. “Pi:n keskeytys” exercises the Pi case
separately from the running `!` command.

## Host facts assumed

Exact command, output, exit code when known, running/held/terminal/unknown state,
start time, context-exclusion flag, Pi working state and confirmed interruption
outcome. Grouping in Nippu is only adjacency in the conversation, not a new host
registry. The clock and output in this mock are frozen invented examples; no
command, Pi session or network operation runs. Controls labelled Komennot and
Tiedosto are context only, not simulated completion menus. Actual Pi stop
acknowledgement is **not proof that child tools ended**: implementation must
retain that distinction, and use unknown state if completion cannot be confirmed.
No new contract or architectural authority is decided by this round.

## Build and evidence

From the repository root:

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-20-bash-runs
```

The ignored output is `design-system/prototypes/dist/2026-10-20-bash-runs.html`.
Only synthetic, authored content was published to Glasspad; no live test-server
or personal data. Hosted CSP may fall back from embedded fonts, as in prior rounds.

Final validation (20.10.2026):

- `node --check …/round.js` and the build command above: passed.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web`: passed formatting,
  lint, TypeScript, unit and component checks (final run).
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec
  prototype-bash-runs.spec.ts --writers-paused --untracked
  issues/proto-bash-runs/result.md`: **4 passed (17.1s)** on the Linux ARM64
  remote runner. Job `0cccac519e29b0e3fb3099d6c17a224601724c62372779579a3a0c654b2fb702`,
  immutable source snapshot
  `49fc85b5ec81b2778abb763da7a83c83b7cce589f03f1d29c8db1c15e20230c9`.
  Evidence stays outside source in `/var/tmp/oh-browser-v1a_pny3/`.
  An earlier pre-Pi-scenario run also passed 4 cases; it is superseded by this run.
- SHA-256 of the four runnable round/spec inputs, path + NUL + bytes + NUL,
  in `round.mjs`, `round.js`, `round.css`, spec order: `1329e5afa92d83848c4d37870eb0c42c4a0fc67cc8fc25516db4636a879b02d3`.
  Final rendered HTML SHA-256:
  `ac044cba8da53495ca5ba1eadd04253814be674c48d0fa89bfe9a66ba8dc15a7`.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check`: passed.
- Final Glasspad update: successful, same URL, `--no-open`.

Failure/omission inventory: the first successful publish tried `xdg-open` on
headless Alder; no browser handler existed. Publishing itself succeeded and the
final update used `--no-open`; the shareable URL is the delivery. Exploratory
reads for a prototype package.json and guessed a11y spec paths found no files;
the actual builder, package scripts and dedicated ordinary spec were used.
The policy-deferred lab/check.mjs captures are described below. No required
check remains failing, no review workflow failed, and no test server was touched.

Alder's focused remote pilot prohibits local lab/specialist browser runs.
Consequently before/after production captures and local `check.mjs` captures were
**deferred**, not bypassed. The ordinary remote Playwright spec builds the round
from captured sources and exercises the three directions in light/dark at desktop
and 390px, with console/page-error and overflow assertions, keyboard disclosure,
refusal/draft preservation and confirmed-versus-unknown interruption outcomes.
This is prototype browser evidence, not native execution, UID isolation or
production integration evidence. No production code was changed.

## Review and Jari's choice

Focused self-review is proportionate: this diff changes only a self-contained
presentation experiment, its test and review notes. There is no Unix-user,
authentication, gateway/daemon/broker, installer or contract change. Checked
output escaping, visible context exclusion, draft retention, disclosure keyboard
use and the distinction between requested and confirmed interruption.

Questions for Jari: Is Loki the right default, or does the visible output in Kortit
outweigh its height? Does Nippu clarify a run of commands? Is the field-adjacent
notice visible enough on the phone? The experiment is complete; selection and
production implementation remain separate work.
