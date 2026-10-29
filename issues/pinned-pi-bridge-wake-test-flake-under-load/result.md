# Result

Test-timing defect, not a product bug. Pi writes `agent_start` to stdout
before it calls the provider, but the daemon's `drain` goroutine reads that
frame asynchronously. Under load, the provider's third call (the wake turn)
could arrive before `drain` set `runActive`/`state=accepted`, and the test
checked the state only once. The provider holds that call until `wakeRelease`,
so the run cannot settle before it is observed. The test now polls the
observed state with its existing 15 s `wait` helper instead of checking once.

Evidence (Birch, 8 vCPU):
- old test, 12 `yes` hogs, `-count=20`: 1 FAIL at line 121, the reported message;
- fixed test, 8 hogs, `-count=20`: 20/20 pass; 12 hogs: 20/20 pass; alone: 20/20 pass;
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: ok.

Review: focused self-review (test-only change).

## Decisions for later review

None.
