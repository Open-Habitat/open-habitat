# Single-server experiments, 2026-11-21

## Scope and evidence

Baseline product commit: `851325fb`. Installed Pi 1.5.2 and Microsoft MCP
0.170.1; their bundled Node reports 22.21.1. No package or production service
was installed, replaced or restarted. Transport/memory experiments used a
networkless disposable container, synthetic UIDs 1001/1002, dummy application
IDs and empty native caches. No account was signed in. The live-model runs
used `openai-codex/gpt-6-luna`; only the model connection used real provider
authentication. Every non-codemode tool call was blocked by the experiment
extension, and the Microsoft child loaded a network-denial preload. This is
discovery evidence, not successful Graph-operation or real sign-in evidence.

Retained local evidence: `/var/tmp/agent-keep/ms-single-server/`:

- `lab8.json`, `lab8.err`: final passing networkless transport/memory run.
- `full.json`: freshly enumerated real stdio tools, including sign-in tools.
- `rank-final.json`: every ranker result, vocabulary matches and live-query replay.
- `live-1.jsonl` through `live-6.jsonl`, corresponding `.out` files: six actual
  model runs, unabridged tool-result logging. `live-5-search-3-full.txt` and
  `live-6-search-2-full.txt` retain the two full codemode results whose displayed
  text was truncated; both were checked and contain no mail-folder deletion.
  No public transcript was committed.
- Earlier `lab1`–`lab5` failed while developing the harness; `lab6` passed,
  then passing `lab7` added exact per-area tool-set assertions and retained the
  listing. Final `lab8` also asserts the installed package versions.

The tracked `single-server-*` programs are disposable research fixtures, not
production components. They must not be deployed. In particular the mux refuses
**every** `tools/call`; it tests real upstream discovery and ping multiplexing,
not forwarding arbitrary writes, cancellation or progress notifications.

## (e) Category-prefix ranking

The rank script uses Pi's own `Bm25Ranker`, `createToolSearchDocument` and
`createMcpToolName`, with the real tool names, descriptions and input schemas.
It hides the six sign-in tools, keeps all 94 useful tools, and compares both
the old long address-based server name and the short `ms` name. This matches
the research's Microsoft-only corpus, not all built-in tools in a Pi session.

Category presence below is a **case-insensitive substring in name or
description**, not a claim that every word is an exclusive semantic tag:

| Word | Tools in intended area containing it | Matches outside that area |
|---|---:|---:|
| files | 4/10 file tools | 5 |
| drive | 8/10 file tools | 0 |
| onedrive | 2/10 file tools | 0 |
| sharepoint | 6/10 file tools | 0 |
| mail | 24/29 mail tools | 25 |
| calendar | 26/27 calendar tools | 7 |
| contact | 9/9 contact tools | 4 |

`list-folder-files` has files in its name and DriveItems in its description.
`search-query` has none of the four file-category words in its name/description;
its schema does contain file-related concepts. `drive` therefore covers more
file tools than `files` but is not a filter. `onedrive` boosts the search tool;
`sharepoint` boosts site/drive discovery. Mail, calendar and contact words
naturally also match their administration tools.

Replay of the five original queries, with a short server name. Cells show the
**first** result; **† means `delete-mail-folder` is somewhere in the first eight**.
Abbreviations: D = `delete-mail-folder`; F = `list-folder-files`;
O = `search-onedrive-files`; S = `search-sharepoint-sites`;
L = `list-sharepoint-site-drives`.

| Prefix | find file in SharePoint folder | list folder files | sharepoint folder employment contract | list folder | search files |
|---|---|---|---|---|---|
| none | D† | F† | S† | D† | O |
| files: | D† | F† | S† | F† | O |
| drive: | D† | F† | L† | D† | O |
| onedrive: | O† | O† | O† | O† | O |
| sharepoint: | S† | L† | S† | L† | S |
| drive onedrive sharepoint: | O† | O† | O† | O† | O |
| files drive onedrive sharepoint: | O† | O† | O† | O† | O |

With the old long name, **D is first in all four folder queries under every
prefix**. The fifth query returns `search-query` first and does not include D.
The name-hashing issue therefore still needs fixing whichever design is chosen.

Other category examples, short names: `mail: delete folder` puts
`delete-mail-folder` first (appropriate to that explicit task);
`calendar: share` puts `update-my-calendar-permission` first (a write, not a
neutral sharing inquiry); `contact: list folder` puts
`list-contact-folder-contacts` first. With long names the last query puts
`create-contact-child-folder` first. Category text does not encode intent or
an execution permission.

### Six live runs

Same two tasks as the earlier research, three repetitions each:

1. “Etsi työsopimukseni Microsoftin SharePoint-kansiosta HR/Sopimukset ja kerro sen nimi ja linkki.”
2. “List the files in the SharePoint folder 'Shared Documents/HR' of my Microsoft account.”

One entry named `ms`, six sign-in tools hidden, all other account-level tools
available. The paragraph appended to the system prompt was:

> Your Microsoft account is available through the ms MCP server. Always include the category in every tool-search query: for files use "files drive onedrive sharepoint: <what you need>", for mail use "mail: <what you need>", for calendars use "calendar: <what you need>", and for contacts use "contact: <what you need>". Pick the category from the user's task before searching; a SharePoint or OneDrive folder is a files task, not a mail-folder task. Use the tool descriptions to choose the operation.

| Run | Task | Literal searches | Followed prefix | Actual returned deletion | Microsoft-only replay deletion |
|---|---|---:|---:|---:|---:|
| 1 | Finnish contract | 1 | 1 | 1 | 1 |
| 2 | Finnish contract | 0 | n/a | 0 | 0 |
| 3 | Finnish contract | 2 | 2 | 0 | 0 |
| 4 | English folder | 2 | 2 | 0 | 1 |
| 5 | English folder | 3 | 3 | 0 | 0 |
| 6 | English folder | 3 | 3 | 0 | 1 |
| Total | | 11 | 11 | 1 | 3 |

Run 2 filtered `ALL_TOOLS` with `/sharepoint|onedrive|search.*file|file.*search/i`
instead of searching. Thus all searches obeyed the instruction, but only five
of six runs used the prescribed search route. Every first Microsoft call was
`search-sharepoint-sites`; all were blocked, all six runs exited 0, and no delete
was attempted. Six runs are a small sample, not an estimated production error
rate or proof of compliance on other tasks.

All eleven returned lists were checked: eight entries each, using the retained
full-output files for the two truncated displays and the printed names for the
last query. The actual returned deletion in run 1 was present in the logged Pi output.
Do not replace that count with the three from replay: the offline table/replay
ranks only Microsoft tools, whereas live Pi includes other callable tools.
A progress message during the experiment used the replay count before this
cross-check; **one live exposure, three replay exposures** is the final result.
The literal-search extractor was also corrected to preserve the apostrophe in
“the signed-in user's drives”; all eleven emitted queries were checked.

Conclusion: first hits improve and the instruction is usually followed, but
an unrelated delete still appears even with the strongest tested prefix and
correct compliance. This does not meet the requested file/admin separation.
One entry alone also cannot share a stdio child between conversations.

## Native HTTP and Pi filtering

The networkless lab observed:

- Default HTTP `initialize` without Authorization: 401.
- Dummy bearer `initialize` and `tools/list`: 200 for discovery only. No Graph
  call was made. This does not make that bearer a valid credential or local secret.
- Fifteen concurrent HTTP listings: all successful.
- `--trust-proxy-auth` without Authorization: discovery succeeds; source shows
  local-cache identity and deliberately ignored Authorization.
- `download-bytes-to-file` absent in normal HTTP listings.
- `--trust-proxy-auth --http-local-file-tools`: startup refused, exit 1.
- Five real Pi entries on the same HTTP URL, server exposure hidden with exact
  tool allowlists: namespace tool sets equal their area lists, minus the omitted
  download-to-file tool. Counts 28/27/9/9/25. File-scoped search excludes mail
  deletion. No login/logout tool appears in the namespace lists.

Relevant pinned Microsoft modules: `dist/server.js` (`createMcpServer`,
`initialize`, HTTP POST handling, `listen`), `dist/lib/microsoft-auth.js`
(`microsoftBearerTokenAuthMiddleware`) and `dist/cli.js`. HTTP is stateless,
with a server and transport per request. The CLI accepts a host/port, not a
Unix socket. The middleware passes Microsoft bearer identity onward; it is not
a per-person secret verifier. Enabling proxy trust therefore requires genuinely
private backend reachability, not just a protected front proxy.

## Shared stdio and memory

`single-server-mux.mjs` starts one native Microsoft stdio process and uses the
native MCP SDK for upstream request correlation. Five Unix endpoints expose
filtered catalogs. `single-server-relay.py` only copies protocol bytes.
`single-server-pi.mjs` starts a real Pi SDK conversation, registers MCP/codemode,
and executes discovery without calling a model. Four such Pi processes stay
open simultaneously; each has five relays. Exact native `describeNamespace`
tool sets were asserted (29/27/9/10/25), not merely the absence of one bad name.

Twenty concurrent additional connections each initialize, list exactly their
area, ping the shared upstream and attempt a blocked tool call. They all pass.
Closing the first Pi process leaves the same Microsoft PID alive and a fresh
files connection usable. A foreign synthetic kernel UID is denied connection
to the 0600 sockets inside the 0700 directory. No production peer-check or
systemd claim is inferred from that filesystem test.

Memory is sampled from `/proc/PID/status` after discovery and a one-second
settle. The ADR has the complete RSS table. At four conversations the single
Microsoft child is 176.6 MiB, experimental Node mux 105.4 MiB, twenty Python
relays 195.4 MiB: **477.4 MiB MCP-side total**, plus **609.0 MiB for the four Pi
processes**. RSS can count shared pages repeatedly. Neither signed-in work,
long-lived growth, cancellation, provider throttling nor multiple-account
switching was measured. A Go relay is proposed but not measured.

## Reproduction

Set `CORE` and `MS` to the installed, pinned runtime directories containing
`bin/node` and `bin/ms-365-mcp-server`. Do not install new dependencies to make
the experiment look like these pins. The cached builder image supplies Python,
`setpriv` and the matching Linux userspace, not a second Node installation.

```sh
umask 077
SCRATCH=$(mktemp -d /var/tmp/agent-scratch/ms-single.XXXXXX)
EVIDENCE=/var/tmp/agent-keep/ms-single-server-recheck
mkdir -p "$EVIDENCE"
flock --shared /var/tmp/agent-scratch/.lease timeout 240 podman run --rm \
  --network none --pids-limit 180 --memory 2g \
  -v "$PWD/issues/agent-account-instructions-clarity:/lab:ro" \
  -v "$CORE:/runtime/pi:ro" -v "$MS:/runtime/ms:ro" \
  -v "$SCRATCH:/scratch:rw" \
  -e PI_RUNTIME=/runtime/pi -e MS_RUNTIME=/runtime/ms \
  -e LAB_HOME=/scratch/run -e LAB_SOURCE=/source \
  localhost/open-habitat-runtime-builder:latest sh -c \
  'chmod 755 /scratch; cp -r /lab /source; chmod -R a+rX /source;
   umask 077; python3 /source/single-server-lab.py' \
  > "$EVIDENCE/lab.json" 2> "$EVIDENCE/lab.err"
```

The copied source is made readable inside the disposable container for its
synthetic UID. Host source permissions are not changed. The final run used a
fresh directory named `lab8`; earlier failed directories were never reused.
To rank a retained real listing and the six logs:

```sh
PI_RUNTIME="$CORE" timeout 20 "$CORE/bin/node" \
  issues/agent-account-instructions-clarity/single-server-rank.mjs \
  "$EVIDENCE/full.json" "$EVIDENCE" > "$EVIDENCE/rank.json"
```

Copy `full.json` from the lab's synthetic home using the container UID mapping
before that command. For live replication, use isolated Pi agent directories
with one `ms` entry using the same native arguments, dummy app IDs and private
empty token paths. Hide the six sign-in tools; set the Microsoft entry's
`NODE_OPTIONS=--require=<absolute single-server-no-network.cjs>`. Only the Pi
agent directory may refer to model credentials. Run each task three times with
`EXP_LOG=<per-run JSONL> PI_CODING_AGENT_DIR=<synthetic agent dir> timeout 240 pi
-p --no-session --model openai-codex/gpt-6-luna -e <single-server-live-block.mjs>
--append-system-prompt <paragraph file> <task>`, under the scratch lease and a
private `TMPDIR`. No live Microsoft account configuration is reused.

## Pi source and future improvement

Pinned `dist/extensions/mcp/index.js` constructs one namespace per entry.
The installed MCP documentation and `@earendil-works/pi-mcp` configuration
provide exposure rules, not per-tool namespace/group configuration or a native
Unix-socket URL transport. Upstream `earendil-works/pi` main was inspected at
`780bf31fcaeb252fa9b68df3964c735eae75bde3`, package version 1.6.0, specifically
`packages/coding-agent/src/extensions/mcp/index.ts` and its configuration.
It still assigns namespaces by entry. The primary repository source was also
checked through the web; no newer runtime was installed or executed. This does
not assert that every third-party MCP adapter lacks grouping.

A future upstream request should ask for multiple named/described tool groups
on one connection, including tools in more than one group, and native private
Unix transport. The daemon still owns cross-conversation process lifetime.
No upstream publication was made, and waiting for it is not the recommendation.

## Checks and limits

Final networkless lab: passed. Six bounded live runs: passed (all Microsoft
operations blocked). Ranker/table replay: passed. Earlier harness failures were
source mount permissions, an SDK tool allowlist accidentally excluding codemode,
not awaiting asynchronous discovery, discovery before MCP readiness, and output
truncation/parsing. They were corrected before the final passing run; no failed
partial run was used as memory or isolation evidence.

Review is source-grounded self-review: this diff adds a proposed ADR, issue
research and isolated measurement scripts, not product sessions, daemon state,
wire contracts or authorization code. No independent LLM review was required or
claimed. Implementation touching those surfaces will require that review and
distinct-UID production-path tests. Required document/tracker/syntax checks are
recorded in the issue result after execution.
