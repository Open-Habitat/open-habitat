# Browser conversation: visual review pending

Implementation revision: to be filled at gate revision. Environment: synthetic TLS browser host on loopback, production Vite bundle, Chromium/Playwright desktop 1280×720, two invented same-UID identities; no real Pi credential, child or model. Tested with `PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH TMPDIR=/var/tmp/nah-browser-build PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright npm run test:e2e --prefix web -- --grep '@browser-conversation'`.

- [Reconnect after create and send](screenshots/browser-conversation-reconnect.png): browser-session lease, status resnapshot and no second send; synthetic daemon has **no Pi history**, so this screenshot cannot approve native rendering or real agent login.
- [Ambiguous send after reload](screenshots/browser-conversation-uncertain.png): retained draft and command ID guard prevent automatic retry.

The real mapped-UID daemon/controller, Pi CLI, settled native JSONL and actual streaming conversation have **not** been exercised in this browser test; test host has a small fake conversation handler behind the real gateway. Visual verdict from Jari remains pending. Existing terminal history remains on the old read-only route. This is a partial UI slice, not final acceptance of the issue's full interaction design.
