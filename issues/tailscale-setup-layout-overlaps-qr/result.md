# Result

Implemented in `16731c33b559a46e22d4a7377a8b9252d482adee`.

The login view reserved 148 px for a shared QR that renders at 184 px. The
neighboring column could therefore paint inside the QR. The wizard also lacked
spacing between its body and footer, and the login column had no vertical gaps.

The wrapper now takes the shared QR's actual width rather than duplicating its
dimension. Shared spacing tokens separate wizard sections, login text, link and
waiting status. The modal owns its width, the login columns wrap, and footer and
duration controls can wrap on narrow screens. Existing shared dialog, controls
and QR components remain in use; there is no experimental switch.

## Decisions for later review

- Preserve the shared QR size instead of shrinking its image to the old wrapper.
  This removes conflicting dimensions and keeps the existing scannable size.
- Retain the existing phone behavior (login link without a QR). Also support a
  desktop window resized to phone width with the QR still mounted: it wraps above
  the text instead of relying on the initial viewport classification for safety.

## Verification and review

Tested source revision: the commit above. Final web checks passed all static and
catalog checks plus 2,157 tests in 256 files. Final named Playwright specs passed
three repetitions with two workers each: `own-machines.spec.ts` (15 passes) and
`lab-own-machines-layout.spec.ts` (9 passes), with reply jitter 0–60 ms. Commands,
initial failed attempts and scope limits are recorded in the companion result
at `../tailscale-misses-existing-connection/result.md`.

The new lab spec uses the production dialog and synthetic host at 1280, 1024 and
390 px, DPR 2. It checks document/dialog overflow, QR versus neighboring content
and footer, body-to-footer separation, action-button overlap and text-to-link
separation. It also narrows a mounted desktop QR to 390 px. All three widths pass
WCAG A/AA axe checks. These are layout assertions, not screenshot comparisons.

Focused manual review checked CSS intrinsic sizing, token spacing, wrapping and
all four captured images. No host reads or authorization behavior changed, so
an independent LLM review and Go test run were not required. No live installation
was captured or modified, and no whole browser suite or clean gate was run.

## Evidence

Synthetic screenshots and adjacent offline HTML are outside the repository under
`/var/tmp/agent-keep/tailscale-setup/`:

- `login-1280.png` / `.html`
- `login-1024.png` / `.html`
- `login-390.png` / `.html`
- `login-resized-390.png` / `.html`

Capture switch: `OH_TAILSCALE_CAPTURE=/var/tmp/agent-keep/tailscale-setup`.
The normal spec writes no screenshots. Final run logs are `web-final.log`,
`browser-repeat.log` and `lab-repeat.log` in the same evidence directory.

## Live check

After deployment, open Settings › Own machines › Add machine and reach the
Tailscale login step in a test account that still needs authorization. At 1280,
1024 and 390 px, verify that text and buttons neither cover the QR nor touch the
footer. On a phone, use the login link. Narrow an already-open desktop dialog too.
Live acceptance remains pending deployment; the evidence above is synthetic.
