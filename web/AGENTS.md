# Web client

`web/` owns the browser-only React application. The route is selection authority;
Redux owns synchronized host facts; production components in `src/components/`
are shared with Storybook. The browser never selects a Unix user and never owns
native history or credentials. `VITE_ENABLE_TEST_FIXTURES=true` is test-only and
must not be set for a production build.

From the repository root, use the exact locked commands documented in the root
`AGENTS.md`. `npm ci --prefix web` is the only dependency installation path.
Biome formats and lints; `tsc --noEmit` type-checks. Browser tests use a
repository-local `PLAYWRIGHT_BROWSERS_PATH`.
