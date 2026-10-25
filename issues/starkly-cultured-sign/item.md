---
created: 2026-10-25
updated: 2026-10-25
type: improvement
status: done
priority: normal
provenance: other
provenance_detail: acceptance observation on a real Gitea
source_ref: taskfleet:01m5r5ajhk37actg18n36pnazy/observation:gitea-connect-scope
originating_run: 01m5r5ajhk37actg18n36pnazy
originating_run_kind: spinoff
lane: unlaned
preparation: ready
collision: [internal/nativegitea/]
closed: 2026-10-25
commits:
- hash: c1f94545
  summary: 'gitea: connect, replace and check need read:user and read:repository'
---

# Gitea connect accepts a PAT without read:repository and reports it working

## Description

## Observation

Against a real Gitea 1.25.4 (the disposable acceptance server on the test
server, release `ea553e4c`), the installed daemon's Gitea `connect` accepted a
PAT scoped only `read:user` and answered `api: ok`, `git: registered`. A later
`check` also answered `api: ok`. Only the repository list showed the problem:
that source came back `state: failed`, `failure: insufficient_scope`, with no
repositories. A PAT scoped only `read:repository` was refused at connect with
`insufficient_scope`, because connect reads `/user` alone
(`nativegitea.Store.Connect` and `Replace` call only `Verifier.User`).

## Effect

A person who creates the Gitea token with the wrong scope (a plausible slip in
Gitea's scope picker) is told the connection works, the PAT is written into
tea's file and the helper is registered, and only the list then reports the
missing scope. Nothing leaks and the failure is named, but the connect
dialog's success is wrong and the person has to notice and replace the token
afterwards.

## Possible direction

Connect, replace and check could also read one page of `/user/repos` (already
one of the fixed reads) and refuse or report `insufficient_scope` before
anything is written. The synthetic Gitea has no scope model yet, so a test needs
one.
