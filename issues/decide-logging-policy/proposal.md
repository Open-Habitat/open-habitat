# Proposed logging policy

Operators need to connect a reported failure to the component that failed and
to understand who performed a relevant action. The [current inventory](preparation.md)
shows useful gateway diagnostics, sparse broker records and gaps in daemon
coverage. This proposal recommends consistent diagnostics in each component;
protocol and reader-access choices remain to be settled with Jari.
The agreed goals and information policy are in [the task](item.md).

## Record the operation and its outcome

Use structured JSONL on service stderr, building on the existing gateway
logger. Record meaningful transitions and exceptional outcomes: where login
stopped, whether provisioning reached publication or readiness, why a native
operation failed, and who changed privileged state. Normal polling and SSE
traffic add little diagnostic value compared with their volume.

A common record envelope should identify the component, event, outcome and
operation. Classify errors into useful reasons instead of copying provider or
OS error strings, which can contain credentials or work content. Schema
versions, exact field names and event vocabulary are implementation details;
the existing gateway fields are a starting point, not a requirement for every
component to emit an identical record.

Provisioning publication, daemon readiness, credential acknowledgement and
browser session issuance are different outcomes. Records should preserve those
distinctions so an operator can locate the failed boundary. Native state and
the broker ledger remain the authority for what exists; a missing log record
cannot prove that an operation never happened.

## Connect records across components

Recommend carrying the gateway's random login attempt ID to the broker and
mapped daemon over their authenticated internal channels. That would let an
operator distinguish concurrent attempts and follow one failure across services.
The ID is diagnostic data; peer credentials and existing identity checks still
determine authority and routing. This protocol change needs an architecture
decision with Jari. Until then, comparing timestamps remains approximate.

For ordinary requests, use an operation reference that can connect the browser
failure to the corresponding server records. Recommend returning a usable
opaque support reference in place of the current constant placeholder, so a
user can report a failure without copying a URL or credentials. The precise
relationship between request, login-attempt and support references belongs in
the implementation design.

## Identify people where it helps

User IDs, email addresses and other useful user identifiers may be logged.
They can help an operator find a user's failed operation and attribute changes;
routine diagnostics need not be anonymous. Select identifiers for those uses
rather than treating all identity information as forbidden.

For actions requiring attribution, take the actor from the component's verified
identity context and distinguish the actor from the affected user or setting.
The current revocation subject identifies a target, not the operator. A browser
parameter claiming an identity is not evidence of who acted.

Credentials and conversation or tool content remain excluded. Avoid copying
raw headers, request URLs, command output or native session files into records,
because those containers can carry the excluded information. Ingress logging
needs the same care: an OAuth callback URL can expose credentials before the
application has a chance to redact anything.

## Access and retention

Recommend root-authorized access for broker records, a limited operator group
for gateway records, and access for the owning user and authorized operators
to that user's daemon diagnostics. This preserves Unix user separation while
allowing diagnosis. The reader model is an architecture choice to settle with
Jari; Fleetrepo owns the concrete journal and ingress configuration.

Retain records long enough for failures and relevant changes to be investigated,
with automatic expiry and storage limits. Seven days for ordinary diagnostics
and thirty days for privileged changes and broker diagnostics are initial
sizing suggestions, not agreed requirements. Validate their usefulness and
whether the deployment can enforce the chosen separation. Any additional log
copy needs an explicit access and retention policy too.

## Bounded delivery

The task already requires logging failures not to change authorization or block
the underlying operation. Recommend bounded, nonblocking delivery, with record
size limits, aggregation or rate limits for repetitive failures, and dropped
record counts when delivery recovers. Queue sizes and rate budgets can be chosen
from expected traffic and verified under load.

This permits diagnostic loss during an outage or flood. The resulting gaps must
remain visible to operators where possible; delivery cannot be a prerequisite
for the operation to complete. The implementation needs evidence for a writer
that blocks, as well as the promptly failing writer already tested.

## Implementation and verification

Build on the gateway's existing broker classifications and callback diagnostics.
Close the broker and daemon coverage gaps, implement the agreed correlation and
reader model, and replace the unusable support placeholder. Verify representative
failure paths and actor attribution alongside exclusions for secrets and work
content, bounded volume and blocked-sink behaviour. Tests that currently exclude
all identity markers from particular OAuth records are evidence of current
behaviour, not a general policy against user identifiers.

Product behaviour and its architecture description belong in this repository.
Fleetrepo configures and verifies deployed journal access, retention and ingress
capture. The existing synthetic results do not establish those deployment facts.
