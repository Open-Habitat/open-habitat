# Result

This was a test timing race, not a native staging/removal product race.
`files_discovery` is published immediately after token acquisition, before
Graph discovery and staging-directory creation. The test previously treated
that phase as proof that it could write a pending native cache.

The fixture now waits for `import-started`, emitted by the native adapter after
staging has been created. Its existing `hold-mcp` barrier keeps Wait from
returning the identity, preserving the removal-before-identity scenario. The
existing removal completion and no-recreated-account assertions remain intact.

Verified on the worker tree based on e9a50430 (the fixing commit records the
exact test change), Linux, umask 077:

```sh
export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX)
go test -race -count=50 -run '^(TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished|TestMicrosoftRelayHidesApprovedCodeDuringDiscovery|TestDaemonStartResumesInterruptedFirstPass)$' ./internal/daemon/integrations
```

Passed 50 executions of each selected test (56.657s total, private TMPDIR
`/var/tmp/oh-fxh8`). The full integrations package also passed once under
`-race` (30.062s, umask 077, private TMPDIR `/var/tmp/oh-D7OL`). Contract
regeneration check, `git diff --check`, and issue metadata schema validation
passed. No full gate or live provider qualification was run.
