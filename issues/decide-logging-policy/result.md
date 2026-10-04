# Logging preparation: test evidence

Synthetic regression tests were added in `01c7c1a`. The logging policy remains
open; the [source inventory](preparation.md) identifies the implementation gaps
and the [proposal](proposal.md) recommends how to address them.

## What the tests establish

`internal/gateway/logging_policy_test.go` checks that selected credential,
conversation and tool-content markers stay out of callback JSONL on a failed
handoff. It also checks that an immediately failing diagnostic writer preserves
both successful login and malformed-callback rejection, including provider and
handoff call counts. An identity marker is excluded by the current emitter in
that scenario; this is not a policy prohibition on logging user IDs or email.

`internal/provision/logging_policy_linux_test.go` exercises a pre-reservation
guard with a diagnostic callback whose writer immediately returns an error.
The denial and absence of a binding remain intact, and the callback receives
only the fixed stage. This is a writer-callback test, not an end-to-end test of
the production broker's stderr delivery.

Existing gateway and provision tests cover broker failure classifications,
exact gateway record fields, callback reason classifications, selected secret
exclusions and the unmatched-callback burst limit.

## Recorded validation

The full clean gate passed on committed revision `9b1992d`:

```sh
TMPDIR=/var/tmp/n NAH_PORT_BASE=15500 ./scripts/ci-local.sh --clean --json
```

The recorded result was `status:passed`, `clean:true`, covering browser,
Go/contracts, packaging and final checks. The project documentation validator
and `git diff --check` passed, and `issuectl doctor --json` completed. The later
result-text update in `70750af` did not change runnable inputs.

## Limits of the evidence

These runs do not establish behaviour when a diagnostic writer blocks, an
overall record or byte cap, cross-component correlation, or attribution for
future shared-setting changes. They did not inspect live journal permissions,
retention, ingress capture or per-user daemon log access. Those remain part of
implementing and verifying the logging policy.
