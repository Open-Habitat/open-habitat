# Optional runtime build inputs

Ubuntu requirements declare direct package names, architectures and qualified
minimum versions. The host apt owns their dependency closure and security updates;
never ship Ubuntu debs or impose exact Ubuntu pins. A solver proposing removals,
downgrades or changes to held packages is a failed installation, not permission
to override the customer. Non-Ubuntu artifact locks remain exact. Profile tests
use disposable Ubuntu containers; nothing installs packages on the build host.
