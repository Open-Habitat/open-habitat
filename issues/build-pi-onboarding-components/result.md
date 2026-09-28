# Result: first-use Pi sign-in presentation

The production `PiDeviceSignIn` component is exported from `web/src/components/index.ts` and imported directly by Storybook. Ready/pending display only caller-supplied Pi instructions; connected, expired, interrupted, failed and unavailable show no code or provider link. Cancel and retry are callbacks, not network actions. The link is enabled only for the exact verification page accepted by the current native Pi adapter (`https://auth.openai.com/codex/device`); unexpected URIs fail closed. No browser auth token, login request, route or generated contract was added. Stories use the unmistakably synthetic `DEMO-KOODI` and no-op intents; they do not offer a live sign-in.

## Verification

- Verified source revision: `e93eb439b0ac4f969802b5c6ae35cf630dfdb2bc` (clean committed tree at gate entry and exit). The message-only issue trailer stamp changed the code commit ID to `f74345c9eaaff6e277460051ce5920bc374a2815` without changing its verified tree.
- `TMPDIR=/var/tmp/native-agent-host-pi-onboarding PATH=/var/tmp/native-agent-host-pi-onboarding/go/bin:$PATH NPM_CONFIG_FETCH_RETRIES=4 NPM_CONFIG_FETCH_TIMEOUT=120000 ./scripts/ci-local.sh --clean --json` — exit 0, `{"status":"passed","clean":true}`. The Go 1.27.1 toolchain was disposable under `/var/tmp`, not installed into the user environment. Earlier attempts stopped before the gate at missing Go and at an npm registry read timeout; neither was a test failure.
- Focused Vitest component tests: code visibility across transitions, exact provider link/target/rel and unsafe URI rejection, clipboard success/error without console output or code in host URL, Enter/Space keyboard cancel/retry and no local success transition. Biome lint and TypeScript typecheck passed.
- Focused final-diff inspection: new components, CSS module, story, test and index export only; no gateway, daemon, route, generated contract or package changes. Existing Go/native tests in the full gate are regression checks, not evidence of this UI being wired to the host.

## Evidence limits

No screenshots were captured: this component is not yet mounted on an application route. Storybook builds its synthetic states but no human visual acceptance or dedicated screen-reader/zoom audit was performed. The full Playwright gate exercises existing journeys, not an authenticated Pi-device journey. No live provider, real credential, mapped-UID sign-in, token isolation across the browser/host boundary or deployed onboarding was verified. The caller must bind the props to session-bound server state and supply actual callbacks in the later route integration after the gateway/daemon contract lands. This issue is complete only for the standalone component slice; @design-first-use-onboarding remains open.
