---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# Folder picker refuses Downloads: 'can't open this folder because it contains system files'

## Description

Jari 2026-10-21, Brave with File System Access enabled, macOS: after 'Salli oman koneen kansio' the browser said 'open-habitat-test.example.test can't open this folder because it contains system files' (Cancel / Choose a different folder). Chromium blocks some directories in showDirectoryPicker (e.g. the home directory and, as far as known, the Downloads directory itself, while allowing their subfolders). Verify Chromium's actual blocklist from source/docs, then make the product's flow honest: what folder the person should choose, what we tell them on refusal (AbortError/SecurityError handling), and whether the screenshot/Downloads use case needs a different approach (e.g. a subfolder, or attachments). Coordinate wording with proto-local-files-notice; do not test UI wording.

## Acceptance Criteria

- [x] Verify Chromium's sensitive-directory restrictions from source.
- [x] Explain dedicated subfolders and screenshot/attachment alternatives before selection.
- [x] Handle AbortError, SecurityError and unexpected picker failures without claiming a grant or rendering raw errors; permit retry and preserve a previous grant.
- [x] Preserve placement decisions for the separate local-files-notice prototype.
