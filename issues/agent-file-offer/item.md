---
created: 2026-11-10
updated: 2026-11-10
type: bug
status: open
priority: normal
---

# agent file offer: relative --source resolves against daemon, not caller cwd

Observed (pilot.24, birch): from the directory containing the file,
`open-habitat agent file offer --current --source 2026-11-04-draft-lisasopimus.pdf --title ... --idempotency-key <uuid> --json`
returned `{"error":{"code":"file_source_not_found",...}}`. The same command with the absolute path succeeded.

Expected: a relative `--source` resolves against the caller's working directory (CLI should absolutize before sending to the daemon), or the error names the resolved path it looked for.
