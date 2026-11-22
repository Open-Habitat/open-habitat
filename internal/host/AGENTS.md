# Host maintenance

The authority and installation rules in `../AGENTS.md` apply here.

## Runtime verification contract

`RuntimeVerificationContract` identifies the acceptance semantics of
`runtime-release verify`: pinned manifest/target parsing, all-profile selection,
complete inventories, archive integrity and safe-tar policy, file modes and
hashes, licence-file presence, ELF architecture and npm-lock membership. It is
not the manifest schema version, build identity, manifest-writer qualification,
staging/installation readiness, or a credential that makes a binary trusted.

Bump the identifier to a new never-reused value when those semantics change,
including a stricter check, relaxed check, changed bound or a bug fix that changes
accepted inputs. Do not bump for unrelated product work, rebuilds, formatting,
or a semantics-preserving refactor. A toolchain/dependency change needs a bump
only if it changes the covered semantics.

`TestVerificationContractSource` pins the tokens of the verifier entrypoint and
its verification helpers, including shared JSON/regexp/platform rules. A failure
requires reviewing the diff and any new helper dependencies, extending coverage
when a check moves outside those files, and deliberately refreshing its goldens.
Record in the commit why the contract did or did not change. The tripwire is not
a semantic-equivalence proof; whole-file coverage can flag unrelated host work.
Do not automatically regenerate it to make a check green.

The manifest writer records its contract inside the digest-pinned manifest;
verification reports the running code's contract separately from that metadata.
Missing or unfamiliar metadata never skips checks or changes their outcome.
An external operator may use a known contract to classify a previously successful
verification, but must still authenticate each new manifest and trust the running
binary through its existing release-delivery path. The identifier alone grants
nothing. This product adds no receipt cache or verification bypass.
