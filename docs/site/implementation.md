# Building the first working version

Start on Alder with one user, one workspace and one Pi agent. Make the complete
path usable before adding more abstractions.

## From login to a running agent

1. Sign in through the gateway and forward requests to the daemon running as the
   mapped Linux user.
2. List directories under `~/src` directly, without a registry or cache.
3. Find a Pi conversation and read its native history and resume ID.
4. Launch or resume Pi using its own configuration and the user's permissions.
5. Return a JSON snapshot, accept a command, and stream updates through one SSE feed.
6. Disconnect and reconnect the browser. Check that the agent keeps running and
   that the client catches up or requests a new snapshot.
7. Use SSH, tmux, Pi, Git and Taskfleet directly alongside the browser. Check that
   work started outside the browser is discoverable.
8. Show clearly what is unavailable when an optional extension or native source
   cannot be read.

## Add a second user and check failures

Let Jari and Kaisa use their own accounts on the same server. Check that the
gateway cannot route one user's requests to the other's daemon. An unknown or
invalid mapping must fail rather than select another account.

Restart a daemon and check how discovery recovers. Try stale process information
and conflicting native observations. Describe extension restrictions honestly:
they do not create a sandbox within the user's UID.

## Add depth when it becomes useful

The next UI needs may be a main-agent marker, a parent link, Taskfleet worktree
information, or subprocess output and stop controls. Read existing information
first and add annotations only for what is missing. Check worktree cleanup and
native-history resume as these features are introduced.

Try the resulting system in a representative Northwind workflow and work out how the
two Acme Creator applications connect to it. Preserve personal clones and native
tools; keep application-specific behavior in the application.

Measure slow paths before adding caches. Split the event feed or evaluate broader
protocols only when actual use requires it.

## What the existing research provides

[Research](evidence) covers the candidate tools, Alder, Northwind and both Creator
implementations. Some behavior could not be observed and still needs checking.
The benchmark fixture is available for later comparisons; its own tests show that
the fixture works, not that a candidate protocol passes the scenarios.

After the first implementation and adoption trials, review the design against
what worked, what failed and the operational requirements. Keep tasks and their
progress in the [architecture epic](https://github.com/maintainer/native-agent-host/blob/e7012c75e759af3a26dcea2ed2fb9d70ef077376/issues/native-agent-host-architecture/item.md)
and issuectl. See [current status](status) for what has been completed.
