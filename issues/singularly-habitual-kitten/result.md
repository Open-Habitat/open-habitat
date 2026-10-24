# Result

The spec selects the `cmd` directory and `cmd/main.go` file by exact `data-path` intersected with `editor-file-entry`. The root `main.go` cannot match. Production code is unchanged.

## Verification

Tested base revision `80d83b5bc47e6f4436e5822a3eb4336bfd31081b` plus the two locator changes in this issue's fix commit.

Ran five consecutive invocations of:

```sh
TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec lab-browser-editor.spec.ts
```

All five passed all four cases (20/20): 1440px and 390px, each light and dark. Playwright durations: 7.7s, 6.0s, 6.1s, 6.1s, 6.2s. Ordinary npx routing executed these in Cedar's warm Linux runner. Each invocation built fresh production assets and the synthetic host; no prebuilt-assets override or retries were used.

This is host-backed synthetic browser evidence, not native UID isolation or live-provider evidence. No production behavior changed, so no full gate or additional browser journey was needed.
