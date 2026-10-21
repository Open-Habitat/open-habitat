# Result

Fixed by making the synthetic browser host use umask 0077, as production does. The warm runner inherited 0002: Pi created group-writable settings after key save, so the next credential read correctly refused the unsafe native settings file. No credential assertion or production file check was relaxed.

Verified: `cd web && npx playwright test account-settings.spec.ts --trace on` — 13 passed; the same key/provider/removal journey also passed in the final full ordinary run. Combined timings and remaining unrelated cases are in @browser-suite-red.
