# Result

Fixed alongside broken-session-resilience in 91f3dd02: the archive test now takes `ConversationController.mu` for every fake session-map mutation and state change, ordering them against the archive-triggered background idle check. The test still covers idle-child archiving, active/unknown writer refusal, stale observations, archive/restore and native byte preservation; it now does so with a quota-cut final record.

Two final runs of `./scripts/test-focused.sh --area go --go-package ./internal/daemon` at runnable revision 911aa02e passed vet and the race detector, jobs `57db15d847e02c04654f26638ec1705d2d85811fa44779d2985efe710bcc79d8` and `6afe3b3fccd80cb66006a1ef17072576c15aea52e21978aadd79f226ae6cfc54`. Unchanged source main 2d81ff0d also passed the same suite. These are synthetic remote ARM checks, not live-server evidence.

The first attempt could not compile an added continuation regression because of a recorder redeclaration; that was corrected before both passing runs. An optional broad health job was externally cancelled, not passed. All required focused checks and failure details for the shared implementation are recorded in `issues/broken-session-resilience/result.md`.

Focused self-review checked that synchronization uses the production mutex without disabling the detector, suppressing the idle goroutine or removing writer coverage. No Unix-user boundary or installation changes were made. No Fleetrepo action is needed.
