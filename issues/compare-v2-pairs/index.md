# V2 draft ↔ synthetic lab

The left image in each pair is a **cropped frame from the designer's interactive draft**, not a baseline; the right image and adjacent inert [HTML snapshot] are from the synthetic TLS lab (Alice, invented workspaces/history). Select the theme and width in the table. Desktop states come from [Selainpolku v2.dc.html](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v2/vedokset/Selainpolku%20v2.dc.html); the six designed phone states come from [Puhelin v2.dc.html](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v2/vedokset/Puhelin%20v2.dc.html). The draft's surrounding review prose and the all-state dark-theme collage are not product views; onboarding is excluded until `fit-onboarding-v2` is unblocked. There is no draft of phone settings, a phone rejected-only state, or a desktop phone drawer; existing fitted-slice captures cover those product states without pretending a matching draft frame exists.

Run from the repository root (browser binaries installed, `npm ci --prefix web --offline` or normal `npm ci` first):

```sh
NAH_PORT_BASE=21000 ./scripts/lab.sh start
NAH_PORT_BASE=21000 PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node web/lab/compare-v2.mjs --home  # return pairs only; omit for all pairs
NAH_PORT_BASE=21000 ./scripts/lab.sh stop
```

Use a fresh lab incarnation for the cleanest sidebar histories. `PLAYWRIGHT_BROWSERS_PATH` must point to an installed Playwright Chromium matching the pinned package; on this host the shared repository cache also works. The draft runtime loads pinned React UMD files from unpkg; **font CSS is intercepted and fulfilled from `design-system/fonts/`** (no Google Fonts request or fallback). The lab is verified by `/fixture/lab-marker` in `snapshot()`. The script crops only the 1440×900 draft frame or the matching 390×844 phone tile, makes AVIF images, and captures the lab's inert standalone HTML. The lab HTML includes embedded bundled font data, not a live URL. Draft screenshots contain only the designer's synthetic sample data. No live host, real account, pixel diff, or baseline is involved. `--extras` rebuilds only collapsed rail, account menu and phone disconnect states when diagnosing those states.

## Pairs

| Draft state | Theme · width | Draft | Synthetic lab | Visible differences |
| --- | --- | --- | --- | --- |
| Return/home | light · 1440 | ![Draft](home-light-1440-draft.avif) | ![Lab](home-light-1440-lab.avif) · [HTML](home-light-1440-lab.html) | G1 fitted, I1, I2 |
| Return/home | dark · 1440 | ![Draft](home-dark-1440-draft.avif) | ![Lab](home-dark-1440-lab.avif) · [HTML](home-dark-1440-lab.html) | G1 fitted, I1, I2 |
| Return/home | light · 390 | ![Draft](home-light-390-draft.avif) | ![Lab](home-light-390-lab.avif) · [HTML](home-light-390-lab.html) | G1 fitted, I1, I2 |
| Return/home | dark · 390 | ![Draft](home-dark-390-draft.avif) | ![Lab](home-dark-390-lab.avif) · [HTML](home-dark-390-lab.html) | G1 fitted, I1, I2 |
| Collapsed desktop rail | light · 1440 | ![Draft](collapsed-light-1440-draft.avif) | ![Lab](collapsed-light-1440-lab.avif) · [HTML](collapsed-light-1440-lab.html) | I1, I2 |
| Collapsed desktop rail | dark · 1440 | ![Draft](collapsed-dark-1440-draft.avif) | ![Lab](collapsed-dark-1440-lab.avif) · [HTML](collapsed-dark-1440-lab.html) | I1, I2 |
| Open phone drawer | light · 390 | ![Draft](drawer-light-390-draft.avif) | ![Lab](drawer-light-390-lab.avif) · [HTML](drawer-light-390-lab.html) | G2 fitted, I1 |
| Open phone drawer | dark · 390 | ![Draft](drawer-dark-390-draft.avif) | ![Lab](drawer-dark-390-lab.avif) · [HTML](drawer-dark-390-lab.html) | G2 fitted, I1 |
| Account menu | light · 1440 | ![Draft](account-menu-light-1440-draft.avif) | ![Lab](account-menu-light-1440-lab.avif) · [HTML](account-menu-light-1440-lab.html) | G2 fitted, I2 |
| Account menu | dark · 1440 | ![Draft](account-menu-dark-1440-draft.avif) | ![Lab](account-menu-dark-1440-lab.avif) · [HTML](account-menu-dark-1440-lab.html) | G2 fitted, I2 |
| New conversation | light · 1440 | ![Draft](new-light-1440-draft.avif) | ![Lab](new-light-1440-lab.avif) · [HTML](new-light-1440-lab.html) | G3 fitted, I1 |
| New conversation | dark · 1440 | ![Draft](new-dark-1440-draft.avif) | ![Lab](new-dark-1440-lab.avif) · [HTML](new-dark-1440-lab.html) | G3 fitted, I1 |
| Working/queue | light · 1440 | ![Draft](working-light-1440-draft.avif) | ![Lab](working-light-1440-lab.avif) · [HTML](working-light-1440-lab.html) | G3 fitted, I4, I5 |
| Working/queue | dark · 1440 | ![Draft](working-dark-1440-draft.avif) | ![Lab](working-dark-1440-lab.avif) · [HTML](working-dark-1440-lab.html) | G3 fitted, I4, I5 |
| Working/queue | light · 390 | ![Draft](working-light-390-draft.avif) | ![Lab](working-light-390-lab.avif) · [HTML](working-light-390-lab.html) | G3 fitted, I4, I5 |
| Working/queue | dark · 390 | ![Draft](working-dark-390-draft.avif) | ![Lab](working-dark-390-lab.avif) · [HTML](working-dark-390-lab.html) | G3 fitted, I4, I5 |
| Answer settled | light · 1440 | ![Draft](completed-light-1440-draft.avif) | ![Lab](completed-light-1440-lab.avif) · [HTML](completed-light-1440-lab.html) | G3 fitted, I4, I5 |
| Answer settled | dark · 1440 | ![Draft](completed-dark-1440-draft.avif) | ![Lab](completed-dark-1440-lab.avif) · [HTML](completed-dark-1440-lab.html) | G3 fitted, I4, I5 |
| Answer settled | light · 390 | ![Draft](completed-light-390-draft.avif) | ![Lab](completed-light-390-lab.avif) · [HTML](completed-light-390-lab.html) | G3 fitted, I4, I5 |
| Answer settled | dark · 390 | ![Draft](completed-dark-390-draft.avif) | ![Lab](completed-dark-390-lab.avif) · [HTML](completed-dark-390-lab.html) | G3 fitted, I4, I5 |
| Rejected send | light · 1440 | ![Draft](rejected-light-1440-draft.avif) | ![Lab](rejected-light-1440-lab.avif) · [HTML](rejected-light-1440-lab.html) | G3 fitted, I4 |
| Rejected send | dark · 1440 | ![Draft](rejected-dark-1440-draft.avif) | ![Lab](rejected-dark-1440-lab.avif) · [HTML](rejected-dark-1440-lab.html) | G3 fitted, I4 |
| Outage | light · 1440 | ![Draft](disconnected-light-1440-draft.avif) | ![Lab](disconnected-light-1440-lab.avif) · [HTML](disconnected-light-1440-lab.html) | G3 fitted, I4, I6 |
| Outage | dark · 1440 | ![Draft](disconnected-dark-1440-draft.avif) | ![Lab](disconnected-dark-1440-lab.avif) · [HTML](disconnected-dark-1440-lab.html) | G3 fitted, I4, I6 |
| Outage | light · 390 | ![Draft](disconnected-light-390-draft.avif) | ![Lab](disconnected-light-390-lab.avif) · [HTML](disconnected-light-390-lab.html) | G3 fitted, I4, I6 |
| Outage | dark · 390 | ![Draft](disconnected-dark-390-draft.avif) | ![Lab](disconnected-dark-390-lab.avif) · [HTML](disconnected-dark-390-lab.html) | G3 fitted, I4, I6 |
| Read-only history | light · 1440 | ![Draft](read-only-light-1440-draft.avif) | ![Lab](read-only-light-1440-lab.avif) · [HTML](read-only-light-1440-lab.html) | G3 fitted, I4 |
| Read-only history | dark · 1440 | ![Draft](read-only-dark-1440-draft.avif) | ![Lab](read-only-dark-1440-lab.avif) · [HTML](read-only-dark-1440-lab.html) | G3 fitted, I4 |
| Read-only history | light · 390 | ![Draft](read-only-light-390-draft.avif) | ![Lab](read-only-light-390-lab.avif) · [HTML](read-only-light-390-lab.html) | G3 fitted, I4 |
| Read-only history | dark · 390 | ![Draft](read-only-dark-390-draft.avif) | ![Lab](read-only-dark-390-lab.avif) · [HTML](read-only-dark-390-lab.html) | G3 fitted, I4 |
| Settings | light · 1440 | ![Draft](settings-light-1440-draft.avif) | ![Lab](settings-light-1440-lab.avif) · [HTML](settings-light-1440-lab.html) | G2 fitted, I2, I3 |
| Settings | dark · 1440 | ![Draft](settings-dark-1440-draft.avif) | ![Lab](settings-dark-1440-lab.avif) · [HTML](settings-dark-1440-lab.html) | G2 fitted, I2, I3 |

The conversation pairs were refreshed for the density slice using the synthetic fake Pi, which cannot produce all receipt/question states. See the validated-response synthetic [receipt captures](../show-turn-receipts/result.md) for the remaining I4 states in both themes and desktop/phone widths. The pair captures alone do not establish every receipt outcome.

## What still differs

**Fidelity gaps worth a follow-up:**

- **G1 — return composition (fitted by `fit-return-view-v2`):** desktop and phone now start with “Jatka siitä, mihin jäit” and use compact grouped rows, with no separate “Työtilat” introduction. The fresh synthetic lab has no positively observed live process, so it shows only “Muut keskustelut”; component tests cover “Käynnissä” with observed live processes. “Viimeksi avatut”, timestamps, progress and a one-click new-conversation button are not claimed without host recency or a workspace choice (I1).
- **G2 — density and controls (fitted by `fit-settings-density-v2`):** settings use compact bordered rows and a horizontal segmented theme radiogroup; the account menu groups its theme actions in a compact row. The phone drawer keeps the native search/refresh and the observed agent status text, now compacted into a single short status line per agent. The draft omits those controls and asserts status from mock data; these deliberate source-truth differences remain (I1–I3).
- **G3 — conversation composition (fitted by `fit-conversation-density-v2`):** shared phone spacing tokens and the scrolling transcript keep the editor and actions inside 390 × 844 in the captured states; desktop retains the agreed v2 sizing table. The header remains multi-line to disclose the workspace, activity and control truth (I4); long titles stay accessible. Receipt and queue details scroll with the transcript, while urgent notices remain visible in a bounded panel above the composer. Synthetic browser tests also cover rejected, pending, uncertain, settled and outage states. This is not a claim of pixel equivalence with mock data.

**Intentional deviations already recorded in the fitted slice issues** (do not close these by imitating fake draft data):

- **I1 — source truth and navigation** (`fit-sidebar-v2`, `fit-account-and-history-v2`): no fabricated running count/timestamps/“Jatkettavissa”, no guessed process or GitHub state; the real navigation includes filter and refresh and keeps native links and route semantics. The draft has six mock workspaces while Alice's lab has five. The home “Uusi keskustelu” action needs a real workspace choice, not a dead shortcut.
- **I2 — identity and capability** (`fit-sidebar-v2`, `fit-account-and-history-v2`): no verified first name/email/avatar, so the lab says “Oma tili”; no validated OpenAI connection row or draft-only action; theme remains the existing accessible menu selection.
- **I3 — account session** (`fit-account-and-history-v2`): logout is scoped to the browser session and does not revoke native credentials; the GitHub status is unknown until verified, rather than the draft's always-connected state.
- **I4 — conversation honesty** (`fit-conversation-v2`, `continue-ended-conversation`): explicit status/control labels, long-title disclosure, selected send mode and uncertain command/reading-position behavior remain; the browser now shows a per-send pending/accepted/rejected/uncertain receipt from the command-ID lookup (an absent receipt stays uncertain) and a settled row only when the host's observed timestamp and native key match loaded history. The draft's fixed “13.53” is not asserted from mock data. Read-only history has no assumed create control. Fixture transcript and timestamps are intentionally not identical to the designer's invented examples.
- **I5 — synthetic fake Pi** (`fit-conversation-v2`): the lab captures a real controller with a fake child and submits two real queued messages, rather than reproducing the draft's mock “9/9” tool progress. The script waits for observed working/answered states without claiming a native turn-complete proof.
- **I6 — outage authority** (`fit-conversation-v2`): the app keeps the old view/draft, blocks writes and explains the stale state using its validated session binding and separate connection notice. It does not claim the designer's message-level acceptance, nor reduce a connection loss to a tiny strip.

Requested host/contract changes stay with the slice issues: verified display fields and validated Pi connection status. Turn settlement and send acceptance now have provisional private host fields; the fake-Pi browser fixture does not produce every state, so validated response injection supplies the visual/test coverage instead. No `internal/`, `contracts/`, `scripts/` or other documentation was edited here. These synthetic same-UID screenshots establish visual correspondence only, not UID isolation or real-provider behavior.
