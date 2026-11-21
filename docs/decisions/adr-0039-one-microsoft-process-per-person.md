# ADR 0039: one Microsoft process per person, shared through the person's daemon

- Status: Accepted 2026-11-21 (Jari: one Microsoft process per person)
- Date: 2026-11-21
- Decider: Jari Mustonen
- Issue: `agent-account-instructions-clarity`

## Question and constraints

How should all of a person's conversations use one Microsoft MCP process while
keeping file searches separate from mailbox administration?

One Microsoft process **per person**, not per account, conversation or topic,
is an absolute requirement. Five topic areas must not mean five Microsoft
processes. Do not remove useful administration tools. Keep native Microsoft
credentials and account permission levels, and admit no other Unix user to
the service. This record proposes implementation; it does not authorize a
new endpoint or change production code.

## Recommendation

Choose **(b): a small MCP multiplexer in the existing per-user daemon, with
one stdio Microsoft child**. Pi still has five short, described area entries
per account. Their commands run small stdio-to-Unix-socket relays, not
Microsoft servers. The relay belongs in the existing product binary; the
Python relays and separate Node multiplexer used in the experiment are not
the proposed production packaging.

The daemon owns the child independently of conversations. Concurrent requests
for its current account share that child's initialized MCP connection, with
request IDs, cancellation and progress routed to their originating connection.
Closing a conversation closes only its relays. Shutdown, disconnect, permission
changes and upstream failure need explicit lifecycle handling; in particular,
never replay an uncertain write automatically after an upstream crash.

Filter both discovery and execution by the daemon's account/level/area mapping.
Use Pi's default-hidden exposure plus exact allowlists as an additional
presentation filter, not as authentication. Keep the area-first instruction:
`searchTools(query, {namespace: "ms-files"})` excludes administration; a global
search across all five areas does not. Keep sign-in tools unavailable and the
separately agreed human confirmation for destructive operations.

### Several Microsoft accounts still mean one child

The present product gives each account its own cache, application configuration,
scopes and expected username. One shared child must **not** quietly merge those
caches, remove the identity pin, or use the union of account permission levels.
The native server's multi-account feature alone is not a replacement for these
bindings.

Use one daemon-owned upstream slot. Requests for the same binding may run
concurrently. When a different account or configuration needs the slot, drain
in-flight work, stop and reap the child, and start its replacement with that
account's existing native configuration before dispatch. Bound the queue and
make cancellation effective while queued. Never start a replacement before
its predecessor has exited. This is account switching inside one per-person
service, not a process pool or a process spawned for each conversation.

This preserves the one-process maximum and existing credential separation using
the pinned executable, at the cost of startup delays when conversations use
different accounts. The experiment below measures one synthetic account, not
this scheduler or its latency. Account-switch, stale-level and interrupted-write
cases are required implementation tests, not established behavior. A future
native per-request account-context facility could remove the restarts; it is
not a prerequisite for this plan.

### Access boundary and questions for Jari

Put the MCP endpoint under the person's private runtime directory and require
the connecting kernel UID to equal the daemon UID, using the same peer-identity
principle as the existing agent listener. No gateway forwarding, TCP listener,
bearer-secret alternative, or caller-supplied username grants access. A separate
socket avoids giving the gateway-facing listener a new personal-data route.
A privileged host administrator can still impersonate a UID; this proposal is
not a boundary against host root.

**Reachability question:** may anyone other than the person's Unix user call
this service? **No: Jari's follow-up brief explicitly requires an own-UID
endpoint and authorizes choosing (a) or (b) within that boundary.** This proposal
keeps that principal set; it does not silently substitute a loopback port or a
bearer secret. The inherited private pipe becomes an explicitly shared own-UID
endpoint, so other processes of that same person can connect directly rather
than starting their own server with the already-readable native credentials.
That is the reachability consequence Jari should see when accepting the ADR.

There is no additional principal or delegated identity to approve in this
proposal. Allowing another UID, gateway forwarding or a network listener would
be a new security question for Jari and is outside this recommendation. The
ADR remains Proposed for architecture review before implementation; merging
this research does not ship the endpoint.

## Evidence and alternatives

Experiments used Pi **1.5.2**, Microsoft MCP **0.170.1**, dummy app IDs and an
unsigned-in synthetic account. Transport/memory tests ran in a networkless
container. Live model tests blocked every Microsoft tool before dispatch and
also disabled network connection creation in the Microsoft subprocess. No
provider operation was tested or performed. Detailed results and reproducible
lab sources are with the issue in `result-single-server.md` and
`single-server-evidence.md`.

### (a) Five HTTP entries pointing at one native HTTP server

Pi's filtering works: with `exposure: hidden` and exact `toolExposure` entries,
`describeNamespace` returned precisely each allowed area, and file-scoped
`searchTools` excluded mail-folder deletion. The native server handled 15
concurrent listings; it creates a stateless MCP server/transport per HTTP POST,
not one Microsoft process per connection.

It is nevertheless not the simpler fit here:

- Normal HTTP mode uses the request's Microsoft bearer identity, not the
  existing local cache. A made-up bearer can enumerate tools but is not a
  Microsoft credential and is not a per-person access secret.
- `--trust-proxy-auth` uses the local cache and ignores forwarded Authorization.
  Its upstream must be unreachable except through a real authenticated front
  end. A loopback port is not Unix-user isolation.
- The shipped CLI has no Unix-socket listener option. Pi's URL transport has
  no Unix-socket option either. A proxy with a protected front door but an
  independently reachable loopback backend would not close the boundary.
- HTTP omits `download-bytes-to-file`. The combination needed to retain that
  tool and the existing cache, `--http-local-file-tools --trust-proxy-auth`,
  is explicitly refused (observed exit 1).

Making this option safe while retaining today's credentials and tools therefore
requires more adaptation than sharing the existing stdio transport. It would
also introduce token acquisition/refresh responsibilities if bearer mode were
chosen. Reject (a) for the pinned versions, not HTTP in general.

### (b) Shared stdio upstream with filtered namespaces — selected

Four real, model-free Pi SDK conversations, each in its own process, connected
through twenty small relay processes to **one** Microsoft process. Twenty
concurrent extra clients listed their exact area and pinged across the shared
upstream. Closing one Pi conversation did not kill the Microsoft child or
prevent a new files connection. All tool calls in this prototype were refused
before upstream dispatch; write routing and cancellation are not qualified.

The socket directory was 0700, its sockets 0600, owned by synthetic UID 1001.
UID 1002 was refused by the kernel; UID 1001's Pi clients connected. This proves
the experimental filesystem boundary, not production peer-credential checks,
systemd setup, reconnect policy, or root denial.

RSS snapshots in MiB (not PSS, not a leak/load test):

| Open conversations | Microsoft child | Lab multiplexer | All Python relays | MCP-related total | Pi processes, separately |
|---:|---:|---:|---:|---:|---:|
| 1 | 160.1 | 93.4 | 48.8 | 302.4 | 155.6 |
| 2 | 171.5 | 99.8 | 97.7 | 368.9 | 313.6 |
| 3 | 179.9 | 101.0 | 146.5 | 427.4 | 452.0 |
| 4 | 176.6 | 105.4 | 195.4 | 477.4 | 609.0 |

The large Microsoft process is shared, but connections and relays are not free.
Do not call 177 MiB the total cost. Production daemon/Go-relay memory has not
been measured; removing the experimental Node service is not a measured saving.

### (c) One Pi entry with native tool groups

The pinned built-in MCP adapter assigns one namespace to each entry, not each
tool group. Pi extensions can assign namespaces to their own registered tools,
but implementing a replacement adapter is more custom code, and still does not
share a stdio process across independent Pi conversations. Upstream source
inspected at commit `780bf31fcaeb252fa9b68df3964c735eae75bde3` (package version
1.6.0 on main) still builds the namespace from the entry name. This is a source
inspection, not a test of a newer released runtime or every third-party adapter.

### (d) Ask Pi upstream

Request multiple described tool groups over one MCP connection and a native
Unix-socket transport. This could remove the five relays and duplicate catalogs.
It would not by itself make Pi own a cross-conversation child: the per-person
daemon must still own its lifecycle. This is a later improvement, never a
waiting plan or permission to ship five Microsoft processes. No upstream issue
was posted by this run.

### (e) One entry, category words in every search

Tested with the strongest file vocabulary found in the listing, not merely
`files:`. `drive`, `onedrive` and `sharepoint` improve ranking, but the prefix is
ordinary BM25 text, not an area filter. Across the five research queries,
mail-folder deletion remained in the first eight results for **all four folder
queries under every tested prefix**, including the combined vocabulary. Short
server names help ranking but do not remove this contamination.

Six live runs (two tasks, three repetitions) made eleven literal `searchTools`
queries. All eleven included the requested category vocabulary. Five runs used
search; one filtered `ALL_TOOLS` by file-related words instead. The actual Pi
output still included `delete-mail-folder` in one search/run. All six first
Microsoft calls were file-related and blocked; no delete was attempted. The
Microsoft-only ranker replay put deletion in three of the eleven queries;
that is a different corpus, not three observed live exposures.

Reject (e): even perfect compliance does not keep an unrelated destructive
operation out of file discovery. It is simpler and improves first hits, but
fails the specific separation this work is meant to provide. Also, one stdio
entry alone would still start one process per conversation; it cannot satisfy
the absolute process requirement without a shared transport.

## Consequences and validation before implementation lands

We accept a small protocol bridge because neither the native HTTP mode nor a
search instruction meets both constraints. Do not turn it into a credential
broker, tool implementation, conversation registry or second persistent cache.
Native token files stay authoritative. The gateway and provision broker gain
no Microsoft authority.

Implementation must prove one-child ownership under concurrent starts and
reconnects, bounded in-flight state, per-client cancellation and reply routing,
no write replay, level changes and account-switch drain/reap, native identity
pins, same-UID peer checks and foreign-UID denial. Re-run memory measurements
with the actual daemon and relay. The model confirmation hook remains a mistake
guard, not protection from the person's own arbitrary shell commands.
