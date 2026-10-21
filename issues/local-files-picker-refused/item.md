---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Folder picker refuses Downloads: 'can't open this folder because it contains system files'

## Description

Jari 2026-10-21, Brave with File System Access enabled, macOS: after 'Salli oman koneen kansio' the browser said 'open-habitat-test.example.test can't open this folder because it contains system files' (Cancel / Choose a different folder). Chromium blocks some directories in showDirectoryPicker (e.g. the home directory and, as far as known, the Downloads directory itself, while allowing their subfolders). Verify Chromium's actual blocklist from source/docs, then make the product's flow honest: what folder the person should choose, what we tell them on refusal (AbortError/SecurityError handling), and whether the screenshot/Downloads use case needs a different approach (e.g. a subfolder, or attachments). Coordinate wording with proto-local-files-notice; do not test UI wording.
