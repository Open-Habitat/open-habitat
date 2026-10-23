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

Review model-performance logging initially hit the known Alder SSH-to-self
refusal; the documented bounded ASSESS_MODELS_SSH_BIN relay through Rowan
successfully delivered the same helper/writer request. Entry:
2026-10-23-llm-review-proc-pilot4. No review or logging step remains incomplete.

Final source `7e04fb4f8395e6ad9dc38d7a078d7a3e217421de` was rebuilt after the
review fixes. Affected Go tests/vet, rendered numeric remount twice, package
verification and all negative package/socket cases passed on that final package.
Contract drift and project-view checks passed. Production web inputs were
unchanged between the clean npm ci/build and final packaging. Pilot.4 source
also authenticated the actual unchanged pilot.3 manifest and selected all twelve
profiles; archive contents and customer apt were not requalified in this run.

## Published and downloaded verification

Published prerelease **v0.1.0-pilot.4** at
https://github.com/Open-Habitat/open-habitat/releases/tag/v0.1.0-pilot.4 .
Annotated tag and downloaded binary resolve to source
`7e04fb4f8395e6ad9dc38d7a078d7a3e217421de`.
Product SHA-256:
`4ab183ed0abb880785c554c820e769d176da3a9a3f556c6e277fbc93f3e52b00`.

The initial gh create timed out while uploading a draft. A resumed upload
refused an already-present checksum asset; inspecting asset states then
uploading only the missing product completed publication without overwriting
published bytes. All four assets were downloaded back: product, single-entry
sidecar, SHA256SUMS and release-gate.json. The downloaded checksum inventory
matched the independent local inventory, all three entries passed SHA-256,
product package verification passed, and the downloaded binary reports the
expected version and full source commit. Release is non-draft, prerelease=true.
The release receipt explicitly records an ungated branch-built test release.
Only the release tag was pushed to this repository; main was not pushed.

**Runtime is reused unchanged from pilot.3.** No runtime archive, manifest,
signature or key was rebuilt or published under pilot.4. Keep the site's
runtime version pilot.3 and manifest pin
`961cb34db858463506108dd12695ab492e8260fde500c6764358b7df9010b9b2`.
`pilot-handoff.md` contains independent pins, download sources and the exact
customer continuation: new product, unchanged site target, verified prepare
preview, its NEW approval plus disruption approval, original operation ID,
then delivery of the still-missing pilot.3 runtime media and ordinary fresh
installation apply. Never reset the journal or reboot first.

No required step remains incomplete. The pilot itself is unchanged; customer
prepare/apply, public HTTPS, reboot and browser/provider acceptance remain the
next installation experiment, not claims of this release.
Final-source distinct-UID proc/polkit regression, fixture syntax/negative receipt
oracles and shell/Python syntax checks were also rerun successfully after the
review fixes. All launched test/review/build/publication processes have settled;
earlier tool interruptions were recovered and disclosed above.
