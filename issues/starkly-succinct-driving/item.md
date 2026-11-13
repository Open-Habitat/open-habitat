---
created: 2026-11-13
updated: 2026-11-13
type: bug
status: open
priority: normal
provenance: other
provenance_detail: pilot.29 clean gate failure (taskfleet run)
source_ref: taskfleet:01m79mf2ybkz1qpjbr18wj5ng3/gate-failure:ms-removal-cancel-race
originating_run: 01m79mf2ybkz1qpjbr18wj5ng3
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# Microsoft removal during an abandoned login fails 503 on its own cleanup race

## Description

`TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished` failed in pilot.29's clean gate
(`microsoft_linux_test.go:1037`: removal answered 503 native_unavailable). Reproduced ~2/400 with
`GOMAXPROCS=2`, 16 CPU hogs, `-race`.

Cause (product): removing a Microsoft account while its login is abandoned before identity is
published. `abandonFor` cancels the attempt and returns; the attempt's `microsoftLogin.Cancel`
then empties and removes `.pending/<address>` at the same time as `microsoft.Remove` empties it.
Whichever loses the race got ENOENT, either unlinking a file the other already removed or
reading a directory the other removed after it was opened. That surfaced as a failed removal
(503) even though the account was gone. A person removing an account mid-login could see it
fail at random.
