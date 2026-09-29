# Result

A session-authenticated GET `/api/v1/onboarding/github/checkout?full_name=owner%2Frepo` now reconstructs an exact validated selection on the broker-mapped socket, checks the daemon's trusted peer and immutable subject, and observes only that UID's `~/src`. The response is `absent`, `confirmed`, `conflict`, or `unavailable`; only a directory with a valid `.git` work tree and exact local canonical HTTPS origin is confirmed. Existing other-owner origins and partial directories are conflicts. A missing `src` is not created. No credentials, paths or UIDs are exposed. This is a narrow pre-Pi read and does not enable Pi-gated routes.

Focused synthetic daemon and gateway tests cover missing/partial/existing/mismatched/case collision/symlink, no-create, forged query and identity, and actual local Git without network access. Clean CI revision and limits are recorded after the gate.
