# Synthetic workspace demo — visual acceptance pending

**Tested implementation revision:** `41e12de4553ad5dc20bacd07da2743cea30967b3` plus reviewed follow-up revision `ff09f3ddfecc0f4651e3aac0a41e766c05b2972b` (server/build isolation; no visual changes). Jari has **not** visually accepted this issue; status remains `testing`.

## Start / open / stop (repository root)

```sh
npm ci --prefix web
npm run demo --prefix web
```

Open **http://127.0.0.1:4184/workspaces?scenario=ready** in a browser on the machine running the command. Stop with **Ctrl-C** in the same terminal. No installation outside `web/node_modules`, no host service, no HTTPS warning. This is bound to `127.0.0.1:4184` only; it is not a remote-seat URL or deployment. To change state, replace `ready` with `empty`, `partial`, `missing`, `unavailable`, or `login` and reload the `/workspaces?scenario=…` URL. A route selection retains the scenario in a local, synthetic-only cookie. The `login` button is disabled and explains why; choose `?scenario=ready` to return. The banner says **SYNTEETTINEN DEMO** in every state.

## Screenshot evidence

Chromium 153.0.8010.12 headless, Linux x86_64, 1280×720, light theme; captured with Playwright and converted from full-page PNG using `avifenc -q 75 --speed 6`. The revision above is the UI revision captured; follow-up server/build-guard fixes do not change these visuals. Jari should review these, or launch the HTTP demo and decide explicitly.

| State | Capture | Deterministic assertion |
|---|---|---|
| Ready, searchable workspace list / selection | ![Ready](assets/ready.avif) | Three visible synthetic workspaces; select `git-project`, filter to empty, clear; skip link focuses main |
| Confirmed empty | ![Empty](assets/empty.avif) | `Workspaceja ei ole` |
| Partial source | ![Partial](assets/partial.avif) | `uncertain` listed, count qualified |
| Missing source | ![Missing](assets/missing.avif) | `Lähdettä ei löydy` distinct from empty |
| Unavailable snapshot | ![Unavailable](assets/unavailable.avif) | `Yhteyttä ei saatu` |
| Login-looking but simulated | ![Login](assets/login.avif) | Login button disabled with visible reason; no OAuth endpoint |

## Commands and limits

From repository root:

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm exec --prefix web playwright install chromium
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:demo --prefix web
```

`test:demo` builds the production bundle and asserts no demo markers remain, then checks all six scenarios, basic keyboard focus, serious/critical Axe violations, foreign Host denial, absent auth/provider/editor endpoints and cross-site request rejection. Result: **7 passed** on the implementation revision and after the isolation fixes. `npm run test:unit`, `npm run test:component`, `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run build` passed. The clean committed-tree CI gate passed on `ff09f3d`; existing browser suite results and limits are in `result.md`.

Only display state is simulated: fake identity, filesystem/source facts, unavailable response, and disabled login. No real login, OAuth credentials, user-home access, GitHub account, native history, agents, Pi control, cross-UID proof, deployed server or HTTPS endpoint is exercised. Existing product-host browser tests are separate. This is not readiness for a first-login pilot. Screenshots support visual review; automated assertions do not constitute Jari's visual acceptance. No mobile or screen-reader acceptance is claimed.
