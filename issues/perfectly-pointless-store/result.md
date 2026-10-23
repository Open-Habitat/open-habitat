# Proc preparation repair and pilot.4 release

Origin: taskfleet `01m5kybnm5b081ptsvbzaby1q9` (spinoff).

## Cause and read-only pilot observations

Pinned root SSH confirmed the supplied report: operation
`c18ecc2ecde0500d7fd1764e208a365f`, running prepare, `session_restarting`, seq 7;
probe EDQUOT and cleanup true, reservation UID 61000, mount ID 48, device 2064;
group open-habitat-proc GID 988 without members; proc service failed exit 32;
logind/polkit active; effective proc still `gid=988,hidepid=invisible`.
Kernel 6.8.0-147-generic reports `proc: Bad value for 'gid'`.
The earlier prepare operation `3d8eb37745e97fbedea6a21965ec7cec` is completed.
No pilot file, service, mount, package or journal was changed by this worker.
SSH initially rejected the default identity; the customer's documented
acme-servers identity with the supplied pinned known_hosts succeeded.

The pilot.2 and pilot.3 proc unit, prepare executor, group and session code have
no source differences (`e1f9ecef...` versus `f3b2e732...`). Both restart the unit.
This is not a new pilot.3 code path: changing the runtime target invalidated the
completed prepare's no-op binding, so preparation restarted an already remounted
proc. Ubuntu util-linux 2.39.3's libmount `context_mount.c:fix_optstr` resolves only
the first named `gid` option (`mnt_optlist_get_named` uses forward traversal);
on a remount its existing numeric option can precede the newly supplied name.
The latter reaches the kernel unchanged. Native reproduction in a disposable
rootless Ubuntu container gives named first=0, named repeat=32, numeric first=0,
numeric repeat=0; see remount-reproduction.txt. LIBMOUNT_DEBUG changes traversal
behavior and was not used for that regression measurement.

## Implementation and evidence limits

The neutral unit is a numeric-GID template rendered from validated NSS at host
prepare/apply/upgrade time. The original strict membership checks stay in place.
A missing group is allowed only as first-prepare preview input, not installation.
Native preparation ensures the group then resolves/render its numeric value.
Stored generation unit policies and all native comparisons use rendered bytes.
Fixture-only raw-template consumers now explicitly render their synthetic GID.

A new prepare preview can approve only a narrowly verified running
session_restarting operation. It preserves the original operation ID/plan and
advances its receipt, skips the quota probe, and never resets broker/journal
state. Receipt/fence agreement, same target, cleaned successful probe, absent
probe directory, original native quota limits on the same mount, exact policies
(other than the known legacy proc unit), and no unresolved journal or unknown policy publications are required.
Other incomplete phases and ambiguity remain fenced. Preparation approvals use
host.prepare.v4; apply continuation retains its original-approval contract.

Operator documentation covers that exception and TLS source-file replacement
followed by fresh ordinary apply, generated-file permissions, gateway restart
(not reload), CA-validating origin/edge verification and external renewal duties.

Tests so far: affected Go host/storagequota/CLI packages, production-rendered
numeric remount twice in rootless Ubuntu, distinct-UID proc/polkit regression,
generated contracts, preparation fixture syntax/negative receipt oracles, Python
fixture compilation, shell syntax, project-view validation and diff whitespace.
No VM qualification, customer mutation, reboot, live HTTPS or browser/provider
acceptance is claimed. The customer's next installer is the pilot acceptance.

## Independent review and assessment

Critical focused `/llm-review`: finder claude-fable-5-1, adversarial verifier
gpt-6-astra; `/assess-findings`: two confirmed FIX, one refuted DROP (Rule 1a),
no spin-offs or unverified residual filings. Both real findings were reproduced
before repair, fixed, and covered by affected Go tests: preserve unsafe/unavailable
journal diagnostics rather than masking them as recovery, and finish only trusted
same-input policy `.next` publication while binding its observation to approval.
Unknown/partial policy stages and all journal splits stay refused. The same-mount
limit remains deliberate; the guide explicitly says to continue before reboot.
Review details are in review.md; machine-local full assessment is under history/.
The initial review call was cancelled/replaced after correcting a diff-attachment
selector mistake, before any result; only the corrected review is evidence.
