# Connection/state matrix (synthetic host, not visual approval)

The two design sources are `design-system/production-v1.md` and `design-system/component-catalog-v1.md`, not separate deployable packages. The lab exercises the production components with a synthetic same-UID host, invented histories and fake Pi, not real accounts or UID separation.

Legend: **P*** observed page-load heading/text, theme and screenshot at all four combinations (light/dark × 1440/390 px), without asserting route interaction; **P** interaction asserted at all four combinations; **G** previously fixed in `4fb47d7`; **—** not exercised (not a pass). L = workspace list, H = read-only history, C = workspace/conversation route, F = first use, S = settings. All raw observations and full-size screenshots are ignored under `.cache/lab/matrix.json` and `.cache/lab/shots/`. `web/lab/matrix.mjs` generates them. A `P*` in C observes the *workspace landing*, not an active chat.

| Fixture / state | L | H | C | F | S | Observed limit |
| --- | --- | --- | --- | --- | --- | --- |
| ready / populated | P* | P* | P* | — | P* | Native history readable, new-conversation button present; no chat opened in route sweep. |
| empty | P* | P* | P* | — | P* | Known history says not found; known workspace says target gone. |
| missing | P* | G/P* | P* | — | P* | History and workspace do not falsely assert deletion. |
| error | P* | P* | P* | — | P* | Generic cold-load failure rather than empty list. |
| partial | P* | G/P* | P* | — | P* | Discovered workspaces retained, unknown deep link offers retry. |
| malformed / oversize / foreign | P* | P* | P* | — | P* | Generic failure on each route; no untrusted response text shown. |
| delay | P* | P* | P* | — | P* | Eventually loaded in the survey; transient spinner not measured. |
| native-error | P* | P* | P* | — | P* | Catalog load works; native mutation not tested here. |
| pi-blocked | P* | P* | P* | P* | P* | First-use chooser intercepts all four routes. |
| pi-onboarding | P* | P* | P* | P* | P* | First-use chooser intercepts all four routes; device-code flow not exercised in sweep. |
| read-only history | — | P* | — | — | — | History shown without composer; `write_state:read_only` not explicitly forced. |
| active chat / rejection / uncertain send | — | — | P | — | — | Fake Pi `hylkää` retains draft; `kaadu nyt` leaves turn readable, send disabled. |
| stale active chat / reconnect | — | — | P | — | — | Snapshot transport abort; draft retained and send disabled until explicit refresh. Not a physical daemon restart. |
| expired login mid-chat | — | — | P | — | — | Synthetic cookie expiry and focus/refresh clear the old identity; no different-person reauthentication. |

The 192 route loads (12 fixtures × 4 routes × 4 appearances) completed with no missing headings or unexpected login cards. Heading, theme, text excerpt and horizontal-overflow booleans are in the ignored JSON. No 390 px sample had document-level horizontal overflow. The assertions do **not** validate semantic completeness of all content, focus, device-code interaction or whether a fresh chat is writable. Sampled screenshots were reviewed by the worker, not Jari.

A separate `--flows` invocation observed rejection, uncertain send, stale transport/recovery and cookie expiry in an active synthetic chat at each of the four appearances; eight first-use chooser loads cover `pi-blocked` and `pi-onboarding`. The script asserts draft retention, disabled sends and clearing on expiry; `flows.json` has 20 observations. The first-use *steps* and true host process stop/restart were not exercised. The older synthetic `@resilience` and `@lab` Playwright tests cover additional behaviors, but are not substitutes for a full cross-product. A stopped/restarted *host process*, a native read-only write state, all active chat × catalog fixture combinations, the first-use device-code journey across all appearances and visual judgment by Jari remain **—**. Do not check the acceptance box on this evidence alone.
