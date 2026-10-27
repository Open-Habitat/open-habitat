---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: conductor
status: fixed
priority: normal
provenance: other
provenance_detail: pilot.13 clean gate on Birch
source_ref: gate:2026-10-27/gateway-git-fetch-503
lane: gate-health
lane_seq: 4
preparation: ready
closed: 2026-10-27
closed_by: release-pilot-13
commits:
- hash: 0d6865a3
  summary: 'gateway: git fetch test daemon reads the body before replying'
---

# Flaky under gate load: TestWorkspaceGitFetchRequiresSessionAndCSRF gets 503

## Description

pilot.13 clean gate on Birch (a73c43f5, load ~8 on 8 vCPU during the browser+Go phase): internal/gateway TestWorkspaceGitFetchRequiresSessionAndCSRF failed with 'write: 503' at workspace_git_linux_test.go:40. Passes 20/20 alone. The same gate run's only browser failure was attachment-documents.spec.ts:38 (browser-waits-time-out-under-load). Find what returns 503 under load (likely a short daemon-socket or upstream timeout in the test host) and make the test wait on state rather than timing.
