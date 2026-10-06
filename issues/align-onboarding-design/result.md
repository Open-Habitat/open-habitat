# First-use onboarding alignment

The signed-out landing, optional account details, repository chooser and Pi device-code screen now share a product/server/three-step frame. The repository list starts unfiltered, and an explicit activity filter keeps selected repositories and those without a known update date visible. Rows are selectable across their full width; checkout progress, partial and uncertain outcomes still use the existing host observations and explicit read-only recheck. The Pi screen places the native code before the approved OpenAI link and preserves attempt polling and session binding. Leaving either authenticated step now requires confirmation using the same shared logout dialog as the account menu.

## Visual comparison

[Draft/lab pair index](pairs/report.md) contains sixteen synthetic draft/lab pairs: landing, repository chooser, Pi start and Pi code in both themes at desktop and phone width. These are *layout* comparisons, not like-for-like content: the draft uses invented `alice-m` repositories and lab uses fixture repositories. The report preserves measured deviations and missing draft states, not an assertion of pixel-perfect fidelity. Paired screenshot + offline inert HTML of the production desktop views are also available for both themes:

| State | Light | Dark |
| --- | --- | --- |
| Landing | [image](sign-in-light-synthetic.avif) · [HTML](sign-in-light-synthetic.html) | [image](sign-in-dark-synthetic.avif) · [HTML](sign-in-dark-synthetic.html) |
| Repositories | [image](repos-light-synthetic.avif) · [HTML](repos-light-synthetic.html) | [image](repos-dark-synthetic.avif) · [HTML](repos-dark-synthetic.html) |
| Device code | [image](pi-code-light-synthetic.avif) · [HTML](pi-code-light-synthetic.html) | [image](pi-code-dark-synthetic.avif) · [HTML](pi-code-dark-synthetic.html) |
| Partial checkout | [image](partial-light-synthetic.avif) · [HTML](partial-light-synthetic.html) | [image](partial-dark-synthetic.avif) · [HTML](partial-dark-synthetic.html) |
| Uncertain checkout | [image](uncertain-light-synthetic.avif) · [HTML](uncertain-light-synthetic.html) | [image](uncertain-dark-synthetic.avif) · [HTML](uncertain-dark-synthetic.html) |

All screenshots and HTML are from the synthetic TLS lab; no live identity or actual provider account was captured. Drafts have no like-for-like partial/uncertain state. Jari's visual verdict is pending deployment, not a prerequisite to merging the testable implementation.

## Decisions for review

- The host label is `window.location.host`, not a configured or guessed service hostname. It shows the server the browser actually reached. The signed-out copy describes the available journey without claiming a production server admits all GitHub identities; the *test installation* is open by deployment policy, not by a browser permission check.
- The profile question stays a skippable display-only session edit inside GitHub's frame; it is not a fourth authentication step and cannot affect Unix identity.
- The draft suggests every clone result can be reduced to success/error after a server read. The host can fail to confirm a write, including after a partial result. Those states remain visible, with recheck as a separate read and no blind retry; matching the draft's certainty would misrepresent native facts.
- The draft's recent-only default conflicts with the agreed all-repositories default. The explicit filter uses the catalog's `pushed_at` as the available activity fact, preserves chosen repositories and unknown dates, and applies only in the browser. The draft uses a more compact switch/listbox control; native switch and select keep keyboard and screen-reader behavior without inventing a second catalog.
- Pi's initial status check, canceled attempt, expired code and failed read remain distinct despite the draft's narrower examples. Only the exact native-verified `https://auth.openai.com/codex/device` link renders; a missing or unexpected link/code shows a safety notice, not a fallback provider URL. A browser logout does not erase already cloned workspaces or native Pi credentials.
- The shared logout dialog names what is removed from the browser and retained on the server. It intentionally replaces the prototype's inline warning with the product's existing accessible modal.

## Validation and limits

Pending final clean gate on the committed product tree. Earlier focused web static/unit/component checks passed (100 unit, 85 component tests). Host-backed browser checks of the changed first-use paths passed after adapting assertions to the new screen labels and confirmation flow. The first clean gate failed 23 browser cases because old tests expected the previous labels, selector counts, layout width, and immediate logout; those are not a pass. A focused run initially failed three session-flow cases for the same confirmation interaction; all subsequently passed in isolation or in a five-case focused run. The first fidelity measurement missed eight Pi pairs because its selector still used the old heading; the inventory/selector was corrected and all sixteen pairs captured. The first `npm run test:browser` invocation from within `web/` incorrectly used `--prefix web`; rerunning from the repository root succeeded. These tool attempts did not establish product regressions, but the required clean gate still needs a final successful run. Synthetic browser tests do not prove live GitHub, OpenAI, separate UID isolation or Jari's visual verdict.

## Review

Focused self-review of the final UI diff and host-backed journeys is pending. No gateway, daemon, contract, authorization or native write semantics were changed.
