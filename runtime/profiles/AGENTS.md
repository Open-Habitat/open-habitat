# Optional runtime build inputs

Locks include the complete forward package closure even when a dependency is
already present in the tools image. They must also preserve a supported OS's
installed reverse dependencies: GLib's library, bin/data and GIR packages are a
version-coupled cohort, so replacing only its library can make apt remove OS
applications. A solver proposing any removal is a failed qualification, not a
reason to remove the guard.

The libc and systemd/udev suites belong to the customer's supported platform.
Their archived bytes/notices are closure evidence, not tool pins or permission
to install a partial OS suite. Profile tests use a separately pinned current
Ubuntu image; the existing quota/boot diagnostic pin must not be rewritten to
make a profile pass. Exact tool drift, removals or downgrades require a new
qualified target, never a hold, a floating install-time solver or forced repair.
