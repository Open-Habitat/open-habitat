# Result

Cause: the daemon's Git identity write (`POST /api/v1/account/git-identity`)
took `cloneWriter`, the daemon-wide exclusion for `~/src`. A clone job holds it
for its whole transfer, so while the site's 1.1 GiB default cloned every
confirmation got 409 `workspace_busy`. The browser treats a failed write as
possibly completed, re-reads Git without retrying, and so showed the same
unset form again with no message: the button looked like it did nothing until
the clone ended.

Fix: identity writes now exclude only each other (`gitIdentityWriter`, 409
`workspace_identity_running`), which is all onboarding's "never overwrite"
check-then-write needs. Nothing that writes `~/.gitconfig` (forge helper
registration, `gh auth setup-git`) used `cloneWriter`, and a clone does not
write it. The panel now says why a confirmation did not go through, and that
message survives the re-read.

Tests: the daemon test holds the clone writer across the onboarding write; a
unit test covers the visible refusal; `onboarding-default-repos.spec.ts` holds
a default clone, confirms the identity mid-clone, reaches the repository
chooser with the clone still running, then lets it finish. That spec fails on
main and passes here. The spec's old wait for clones before confirming (a
workaround for this bug) is removed.

## Decisions for later review

- Message on a lost or unverifiable write: "Tallennuksen tulosta ei saatu
  varmistettua. Git-asetukset luettiin uudelleen." Alternative: stay silent as
  before. Chosen because silence is exactly what made Ville's click look dead.
