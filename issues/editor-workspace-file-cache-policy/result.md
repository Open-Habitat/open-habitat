# Result

Enabled code-server's `--disable-file-cache` for newly started workspace editors. Workspace resources no longer enter its HTTP/webview caches; extension assets keep upstream's normal caching policy. Existing editor processes are not restarted or disrupted to apply this launch option.

## Policy and upstream verification

The tagged code-server v4.145.2 source, `patches/disable-file-cache.diff`, was inspected on 2026-11-21. It selects NO_CACHING for non-extension remote resources and omits workspace-resource ETags from the webview loader, whose service worker caches only responses with an ETag. Its extension-location checks remain unchanged.

Source: `https://github.com/coder/code-server/blob/v4.145.2/patches/disable-file-cache.diff`.

This reduces browser persistence and prevents those resource caches from supplying old workspace bytes. It is **not** a guarantee that an already-open text buffer instantly follows every external write, nor an offline-mode implementation or a new isolation boundary.

## Verification

- The real pinned code-server 4.145.2 ran behind the production gateway/daemon editor relays with synthetic accounts and workspaces.
- New opt-in `@native-editor-cache` browser case: Markdown preview successfully loads a workspace SVG; its remote-resource reply is `no-store`; an external writer's changed bytes are read immediately and after reload; the SVG is absent from editor-origin Cache Storage; logout denies the editor URL.
- Both native editor cases passed three times with one worker (the existing Explorer case also verifies external create/rename/delete).
- The complete stand-in `workspace-editor.spec.ts` passed three times with two workers: nine passes per run, including existing a11y/session-isolation cases; the two native-only cases correctly skipped there and were covered separately above.
- Focused daemon Go tests passed with the launch-argument assertion extended. Fast web checks passed (234 files, 1921 tests).
- Initial native-test attempts exposed fixture issues: Chromium service workers require the certificate-ignore launch argument for this ephemeral TLS fixture, the editor must have focus before invoking preview, and an app reload requires reopening its editor panel. These were fixed in the test before the three final passes.

Commands used the focused runner, `BROWSER_HOST_CODE_SERVER` pointing to the pinned launcher, a private port base, `umask 077`, the scratch lease and timeouts. Logs: `/var/tmp/agent-keep/five-hygiene/{native-cache,browser-final,editor-browser,go-final,web-final}.log`.

These checks exercise a real workbench on synthetic data, not an installed host upgrade, live user data or distinct-UID isolation. The combined run is not merged: the unrelated existing scroll-spacing failure also reproduced on unchanged main (tracked by `practically-ancient-swing`).

## Review

Source-level self-review, tagged upstream inspection and native integration verification. The only product behavior change is the editor launch policy; no session grant, daemon state format, contract or authorization boundary changes. No independent architecture review was required.

## Decisions for later review

Prefer fresh host-backed workspace resources over persistent browser caching/offline reuse. Do not restart existing editors merely to change cache policy: preserving the person's running work takes precedence; the flag applies on the next editor process start.

## Live check

After deployment and the next editor process start, open a Markdown preview with a workspace image, change the image through an agent, reopen the preview and reload the app. Confirm the changed image remains visible, then sign out and confirm the editor can no longer fetch it. This installation check has not been run by this worker.
