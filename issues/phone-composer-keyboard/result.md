# Result

The phone conversation shell now tracks visualViewport height and offsetTop (resize and scroll), removes its desktop minimum height, and bounds the overview card to leave space for the composer. Native pinch zoom remains untouched. Existing reading-position following handles the reduced transcript viewport, including when the asynchronous overview arrives.

## Evidence

- Final `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web --untracked web/tests/phone-composer-keyboard.spec.ts`: **passed** (format, lint, TypeScript, unit and component tests), job `5d95b73cbf2e92016723e03f438b387b58d470aa1eee072ad3e6385a93424846`, snapshot `c65c28f33eb1aab5705b2329f96eb7797a84ddd062e0ec1aacab45419fbaddd3`.

Production implementation: d3b4b42a7510fe816ee467296fa9134bd22541f6, based on main 043f52b3306da8df135a9c5ccb952ed00b91394e. Final test source is `web/tests/phone-composer-keyboard.spec.ts` in this result's commit; runner snapshots identify its exact captured bytes.

- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec phone-composer-keyboard.spec.ts --untracked web/tests/phone-composer-keyboard.spec.ts`: **2 passed**, runner job `2d417089cf595cdaf86ed4dec8cbcb6e51d3ce1ec36cf47055e3d441f81896bf`, snapshot `3474cb436f2ad166abc9b2da8828fc10c854e1ebd17cd28befca68aa006303e7`.
- The two Chromium mobile-emulation cases use iPhone Safari / Android Chrome user agents, touch input and a separately simulated visual viewport. They assert an overview appears on reopen, the transcript follows its tail, and the editor stays above the simulated keyboard while preserving focus and draft through keyboard resize, Safari-style pan and dismissal. This does **not** establish real iOS WebKit or an actual OS keyboard's behavior.
- The existing `browser-conversation.spec.ts` suite, including its accessibility assertions, passed 66 existing cases and failed the existing desktop `validated uncertain send receipt never reposts` case. Final broad implementation run: job `c5e5c9c467b7ee4610b683b0767393402ca351ab432d67520cfb91fd603397ef`. The details popover intercepts the status-check button.
- The identical command on an untouched disposable clone of main 043f52b3 reproduced that same popover interception at the same click: job `ee71928ebb29db39b03d4d03caacf20d0ca34dff66e5677e8ec969f5e009d341`, 64 passed / 3 failed. The two additional baseline-only timeouts were lost-send reload and daemon-restart delivery cases; both passed on the worker. The brief's proven-pre-existing-failure exception applies; the browser suite is not claimed wholly green.

The final broad worker browser run was captured under `/var/tmp/oh-browser-mj_of_on`; it also included the then-unfixed new tests, so its total was 66 passed / 3 failed. The final dedicated phone run above replaces those two new-case failures. No existing browser-conversation test is changed in the final diff.

## Review and limits

Focused self-review was proportionate: this is a small browser layout/listener change, with no Unix-user, gateway/daemon/broker authority, installation, contract or build-input changes. Checked listener cleanup, absent visualViewport fallback, narrow-screen scope, zoom behavior and asynchronous layout following. No independent security review was required.

Before/after lab captures were deferred under Alder's no-local-lab policy. No live host, real user data, deployment, push or Fleetrepo installation change was involved.

## Failure inventory

Initial web lint rejected four non-null assertions in the tests; fixed, then web checks passed. First two browser attempts exposed phone test navigation setup failures (the mobile drawer had not mounted when checked); replaced with desktop setup followed by phone conversation layout. The next attempt exposed an oversized mocked recap rejected correctly by the contract validator; reduced below the contract cap and moved phone cases into their own focused spec. Final phone cases pass. Broad desktop failure and baseline-only timeouts are accounted for above.

Exploratory listing commands found no mobile/recap spec or AppShell.tsx (AppShell lives in Navigation.tsx); continued using scoped source discovery. A parser of the displayed browser log failed because that display was truncated; read the retained raw JSON log instead. Neither affected implementation or evidence. No required review was omitted. Full gate and captures were intentionally not run under the worker/host policy.
