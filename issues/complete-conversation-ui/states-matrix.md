# Connection/state matrix (synthetic host, not visual approval)

Two design sources are `design-system/production-v1.md` (accepted production design) and `design-system/component-catalog-v1.md` (component state contract), *not* two deployable packages. This matrix covers both supported themes. The lab uses the real gateway/daemon handlers, invented accounts and histories, and a fake Pi. No real account, native Pi or UID separation was tested.

Legend: **P** observed expected state; **G** gap fixed here; **—** not exercised, not a pass. Columns L (workspace list), H (read-only history), C (active browser conversation), F (first use), S (settings). `L/D` means light desktop / dark narrow; this is **not** a full width × theme cross-product. `P*` means observation was limited to page load and text, not interaction/focus. Underlying route-by-route raw observations are in the local disposable `.cache/lab/matrix.json` (88 page loads; not committed, because these include fixture paths). Recorded against the worktree before the final commit; rerun the browser gate against the commit.

| Scenario / state | L L/D | H L/D | C L/D | F L/D | S L/D | Observation / limitation |
| --- | --- | --- | --- | --- | --- | --- |
| ready / populated | P* | P* | — | — | P* | Fixture has readable native history and workspace links. |
| empty | P* | P* | — | — | P* | Empty list does not claim loading; known history link reports not found. |
| missing | P* | G | — | — | P* | Deep-linked history previously said it did not exist; now says unverified and offers retry. |
| error | P* | P* | — | — | P* | Cold load has failure and recovery, not an empty list. |
| partial | P* | G | — | — | P* | Same deep-link fix; partial list retains discovered entries. Lab sampling can catch transient `Ladataan` before completion. |
| malformed / oversize / foreign | P* | P* | — | — | P* | All fail closed on cold load; text is generic, not untrusted response body. |
| delay | P* | P* | — | — | P* | Observed loading, not eventual timeout. |
| native-error | P* | P* | — | — | P* | Native error affects detail/actions, not catalog load; no mutation asserted. |
| pi-blocked | P* | P* | — | P* | P* | Onboarding takes over each route; a full first-use flow was not rerun in the manual matrix. |
| transient stale / restored | P¹ | P¹ | P¹ | — | — | Existing `@resilience` host test covers same-session retention and retry. No actual daemon process restart in this run. |
| expired login | P¹ | P¹ | P¹ | — | — | Existing synthetic browser tests expire the cookie; matrix did not repeat for all routes/themes. |
| read-only | — | P* | — | — | — | Native terminal history labelled non-editable; `write_state:read_only` not directly forced by these scenarios. |
| rejected / uncertain send, reconnect | — | — | P¹ | — | — | Existing lab and conversation tests cover fake Pi `hylkää`, `hidas`, `kaadu` individually; no all-route/theme cross product here. |

¹ Prior automated coverage in `web/tests/resilience-states.spec.ts`, `web/tests/lab-conversation.spec.ts`, `web/tests/browser-conversation.spec.ts`; not evidence of a fresh manual all-state check. The regression added here directly verifies missing-history route recovery after a partial discovery and must pass the final browser gate.

**Unfinished:** active chat × both themes for all scenarios, actual host stop/restart, fake Pi command matrix, first-use, settings and global read-only transitions, narrow/light and desktop/dark combinations, and visual judgment from Jari. These are material to the acceptance wording: **do not check the box yet**. The existing tests establish narrower behavior but not the requested systematic complete matrix. Screenshot samples `partial-history-light.png` and `partial-history-dark.png` show the fixed state on a synthetic fixture; appearance has not been reviewed by Jari.
