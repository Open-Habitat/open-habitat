---
created: 2026-10-19
updated: 2026-10-19
type: bug
reporter: jari
status: open
priority: high
lane: gateway-security
lane_seq: 2
collision: [internal/gateway/]
preparation: ready
---

# App sends no frame-ancestors / X-Frame-Options

Found by `research-shell-editor` (report §security "Framing", 2026-10-19), accepted by Jari 2026-10-19: no `frame-ancestors` / `X-Frame-Options` is sent anywhere (checked across `internal/` and `web/`). The `SameSite=Lax` session cookie is sent in same-site frames, and other hosts on the same site (e.g. `glasspad.example.test` publishes arbitrary HTML) could frame the app for clickjacking. Add `Content-Security-Policy: frame-ancestors 'none'` (and `X-Frame-Options: DENY` for old browsers) to every app response from the gateway, with a test.
