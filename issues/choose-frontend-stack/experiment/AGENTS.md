# Disposable frontend decision experiment

This directory is evidence for `choose-frontend-stack`, not a product scaffold. It may be deleted after the decision without removing product behavior.

The fixture in `src/App.tsx` transcribes representative records from `issues/probe-pi-control/events.redacted.jsonl` at repository revision `4187da0ec40079ec09d98539c03f840102cde616` (SHA-256 `d7981abf9aff8896dd5dc950e13ceaf926b406c5001416ddbe1ddc620520702a`). That source is a real Pi 0.85.1 RPC/history probe with synthetic, redacted content; this experiment does not inspect personal histories.

The experiment exercises:

- replacement snapshot plus cursor/event deduplication and uncertain command acknowledgement in one Redux store;
- URL-owned agent selection and `sessionStorage`-owned per-tab drafts;
- a 2,500-event virtualized history, streaming tool update, grouped tool details and focus retention;
- Markdown and parsed unified diff content escaping;
- per-event tool disclosures (grouping is not implemented in this trial);
- keyboard access and automated Chromium axe checks;
- a Storybook catalog built from the same components.

Run with a disposable npm cache:

```sh
npm ci --cache /tmp/native-agent-host-frontend-npm-cache --no-audit --no-fund
PLAYWRIGHT_BROWSERS_PATH=/tmp/native-agent-host-playwright npx playwright install chromium
npm run typecheck
npm run lint
npm test
npm run build
PLAYWRIGHT_BROWSERS_PATH=/tmp/native-agent-host-playwright npm run test:e2e
npm run build-storybook
```

`node_modules/`, `dist/`, test output and `storybook-static/` are generated and must not be committed. Preserve `package-lock.json`, source, tests and the parent issue's `result.md`.
