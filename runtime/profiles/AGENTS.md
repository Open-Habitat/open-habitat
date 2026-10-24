# Optional runtime build inputs

Ubuntu requirements declare direct package names, architectures and qualified
minimum versions. The host apt owns their dependency closure and security updates;
never ship Ubuntu debs or impose exact Ubuntu pins. A solver proposing removals,
downgrades or changes to held packages is a failed installation, not permission
to override the customer. Declarations are architecture-neutral (`native` or `all`); the builder
resolves `native` to the release target, because Ubuntu publishes the same
versions for amd64 and arm64. Non-Ubuntu artifact locks remain exact and pin
one official upstream artifact per release target, at one upstream version:
a list record with `target` applies to that target only, a `targets` object maps
each target to its pin. A profile without an official artifact for a target is
left out of that target's release rather than substituted. Profile tests
use disposable Ubuntu containers; nothing installs packages on the build host.
