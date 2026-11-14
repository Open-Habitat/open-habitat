---
created: 2026-11-10
updated: 2026-11-14
type: bug
status: duplicate
priority: normal
closed: 2026-11-14
---

# agent file offer: relative --source resolves against daemon, not caller cwd

Observed (pilot.24, birch): from the directory containing the file,
`open-habitat agent file offer --current --source 2026-11-04-draft-lisasopimus.pdf --title ... --idempotency-key <uuid> --json`
returned `{"error":{"code":"file_source_not_found",...}}`. The same command with the absolute path succeeded.

Expected: a relative `--source` resolves against the caller's working directory (CLI should absolutize before sending to the daemon), or the error names the resolved path it looked for.

## Resolution

### 2026-11-14T07:29:52Z · @issuectl

Fixed by offer-relative-source-cwd (12.11.2026).
