# Web client

`web/` owns the browser-only React application. The route is selection authority;
Redux owns synchronized host facts; production components in `src/components/`
are shared with Storybook. The browser never selects a Unix user and never owns
native history or credentials. `VITE_ENABLE_TEST_FIXTURES=true` is test-only and
must not be set for a production build.

`src/app/snapshot.ts` validates a bounded response against the canonical v1
JSON schemas before Redux receives it. The browser never keeps an invalid or
previous identity snapshot across a failed fetch. `test/browser-host/` is a
standalone Go test-only TLS host, not part of `cmd/native-agent-host` or the web
bundle. It mounts the real gateway and daemon snapshot handler with synthetic
same-UID UDS and OAuth seams; the separate two-UID systemd VM proves actual
UID/socket isolation. Playwright starts this host against a fresh production
`web/dist` build with fixture flags unset. Test scenarios are controlled only
under the host's `/fixture/` prefix, never in the production binary.

From the repository root, use the exact locked commands documented in the root
`AGENTS.md`. `npm ci --prefix web` is the only dependency installation path.
Biome formats and lints; `tsc --noEmit` type-checks. Browser tests use a
repository-local `PLAYWRIGHT_BROWSERS_PATH`.
