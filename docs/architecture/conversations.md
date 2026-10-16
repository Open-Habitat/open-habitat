# Conversations

A conversation is a Pi session, identified by Pi's session ID and saved in a
JSONL file in the user's home. The daemon starts Pi in a workspace and controls
it through RPC. The browser sends commands through the daemon and follows the
response while Pi writes its own history. Closing the browser leaves Pi
working. When the daemon ends, a browser conversation stays readable and
writable: the next message the person sends starts Pi on its saved history.

```mermaid
flowchart LR
  B["Browser"] -->|"start, send, interrupt, take back"| D["User's daemon"]
  D -->|"RPC"| P["Pi child in workspace"]
  P -->|"writes"| H["Native session history"]
  T["Pi in terminal"] -->|"writes its own sessions"| H
  H -->|"history reads"| D
  D -->|"status, history, live events"| B
```

## Identity and control

Pi stores sessions under `~/.pi/agent/sessions/`. The daemon discovers them
from their file headers and exposes the native session ID as `pi:<session id>`.
The working directory recorded in the header associates a conversation with
its [workspace](workspaces.md). Duplicate session IDs are unavailable because
the daemon cannot choose which file represents the conversation.

A conversation belongs to the Unix user. Multiple browsers signed in as that
person reach the same daemon and Pi process. Control requires a live RPC
connection from the daemon to its child; readable history alone does not
provide it. The browser displays Pi's latest native session name, or a bounded
first-prompt fallback when there is no name. A terminal-origin name is visible
but does not grant browser control.

Terminal conversations are readable and their open views follow changes to
the session files. Pi's RPC interface cannot attach to a running terminal
session, and the host does not take it over. Taskfleet spinoffs are instead observed read-only under their parent, as
described below. Browser-controlled worktree agents remain deferred.

## Starting Pi and keeping one writer

The daemon resolves the selected workspace, opens its directory and starts Pi
there as the user's process, with their home and native configuration. It
assigns a fresh session ID so that starting a conversation creates new history.

A new session can explicitly select a catalog model and supported thinking level
through native Pi startup flags. In an empty conversation, the composer's pill
can retain a different choice in browser memory until the first message. That
message carries the intent to the same child: the daemon reserves control,
checks that no browser command or native content has preceded it, validates the
native catalog and sends correlated `set_model` and `set_thinking_level` RPCs
before the prompt. Pi 1.3 does not persist these setters as global defaults.
An uncertain setter prevents sending the prompt and leaves control uncertain;
neither the intent nor the prompt is automatically replayed. This is not a
model switch for an existing conversation with messages. Neither startup flags
nor the first-message choice changes Pi's global default.

Creation replies as soon as the child exists; Pi's own start can take many
seconds and nobody waits for it. Before delivering the first message, the
controller reads the new child's native `get_state` model and thinking level.
It retains that observation in the existing per-child `startup_choice` field
until native history supplies the settings.
A later global-default change therefore cannot relabel an already-running empty
session. Unknown native state is shown as unknown, not inferred from a browser
catalog. This is transient control state, not a second settings/history store;
daemon restart loses the child and its observation. The browser's shared picker
also changes the default through Pi's own
SettingsManager. It shows recent answered/refused observations from the person's
own native sessions, with older models collapsed, and makes no entitlement claim.
The daemon derives these marks per request from at most 32 recent sessions and
512 KiB of each tail; absent evidence means not tried within that window. It
retains neither an observation cache nor a separate history store. Catalog failure
can show only models observed in that native window, without claiming they can be
started while authentication is unavailable.

The daemon records a browser conversation's workspace and locks its session
while its Pi child runs. The lock survives a daemon crash with the Pi process,
but terminal Pi does not take it. Before resuming Pi or changing saved-history
presentation, the daemon checks processes belonging to the same Unix user
for a native writer. An uncertain observation blocks the write. This is not
an atomic promise: a terminal Pi started after the check, or an unrecognized
launcher without an identifiable session, can still write. The daemon never
reads another user's process details. [The accepted limit](../../issues/native-writer-guarantee/item.md)
does not promise a shared terminal/browser lock.

The daemon bounds its running Pi children and retained handles. Reaching a
limit blocks another start, but native session files remain readable.

## Commands and progress

The daemon supports sending a prompt, steering an active turn, queueing a
follow-up and clearing those queues. Aborting asks Pi to interrupt the current
turn while keeping the process available for another message. Stopping closes
the RPC channel. Closing a freshly started, still-empty browser conversation
also removes its native session file, but only after reaping Pi and verifying
that no user message was saved on any branch. An unknown writer or changed
history prevents removal. The terminal-writer observation has the same race
as resuming on send. [HTTP API](http-api.md) lists the routes.

Message commands have client-generated IDs so the browser can look up their
receipts after a lost reply. A receipt distinguishes held, pending, accepted,
rejected, cancelled and uncertain outcomes. Acceptance means Pi accepted the command;
it does not establish that the turn finished. Receipts live in daemon memory,
so a missing receipt after restart cannot establish rejection. The browser
does not automatically resend an uncertain command, because Pi may already
have acted on it.

After a turn settles, the daemon can ask the person's Pi model for a name and
save it as the native Pi session name. A person can request another name. For
settled history without a controller, a short-lived Pi child can write the
name after another writer check without making that conversation browser-
controllable. A failed model call leaves the existing name or first-prompt
fallback intact. Pi's name setter has no compare-and-set, so a terminal rename
in the final read/write window can still be overwritten. The host has no
separate title store.

Browser-owned Pi processes load the host's recap extension. A person can
request a recap, or the daemon can request one after a completed turn has been
idle. Pi saves the result in native history rather than in a host summary
store. The browser shows it outside the transcript and marks it stale when
new messages have appeared. Existing terminal recaps are readable, but the
daemon cannot request one from a terminal-owned Pi process.

Pi's events carry response text, thinking, tool progress and activity to the
browser. When Pi reports that it has settled, the daemon reads native history
and associates completion with a saved assistant entry. If that entry cannot
be verified, completion remains unknown. This establishes that the turn
settled, not the quality of its result. Authentication failures are reported
with a fixed status code so the browser can offer Pi sign-in without replaying
the message. A completed, natively verified device sign-in clears that failure
from the user's live controllers. Pi's unsupported-model error is classified
separately: signing in again cannot change account entitlement or the model
selected in a running Pi session, so the browser offers an inline model picker and an explicit new conversation
instead. Its optional default checkbox is initially on. Recovery neither replays
messages nor mutates the used session's model.

An empty conversation's top bar names the model without offering a picker;
only the composer chooses its first-message intent. Once there are messages,
the top-bar picker uses the same new-session fallback until safe native
switching for used sessions is established. The authenticated tab preloads
Pi's catalog into identity-scoped memory and refreshes it in the background;
opening a picker retains those rows while refreshing. Logout/identity changes
throw the catalog away, and no model cache is stored on the host. [Events and recovery](events-and-recovery.md) describes how live
updates and saved history reach the browser and recover after a disconnection.

The implementation also displays pending Pi extension questions and provides
answer and cancel controls. Those responses have no correlated Pi receipt,
so even a successful HTTP reply leaves their outcome uncertain. The browser
records the attempt before sending and does not repeat it. These controls go
beyond the agreed display-only scope in
[agent control](../../issues/build-agent-control/item.md); the
[document review](../../issues/rethink-project-docs/item.md) records that
implementation/scope difference for joint follow-up.

## Agent background processes

Daemon-owned Pi children load the optional pi-processes core and the shipped
companion extension. The browser can list their native processes, follow a
bounded output tail, stop a group through its native owner, and clear finished
records and logs. Browser disconnection and an idle agent do not stop them.
Terminal Pi processes remain unreachable; an unavailable inventory is not empty.

Pi's own run start is evidence of work even when a completion notification,
rather than a browser send, woke it. The run stays active until `agent_settled`.
An idle agent with a known exit-waking background process is waiting for that
process, not the user. A pending native extension question still takes priority.
Before closing Pi, the daemon asks the companion to stop managed groups, then
allows bounded graceful shutdown. A crash may still leave unmanaged groups
inside the daemon service until cgroup cleanup; the host does not claim otherwise.

## Archiving presentation

A settled native conversation can be archived, including one begun in a
terminal. Archiving changes only its visibility in user presentation state;
Pi history stays in place. The daemon checks the workspace, history and
writer again before making the change. A working or uncertain writer blocks
archiving, while restoring visibility is possible after a daemon restart.
Archived browser conversations must be restored before sending again; the
send that starts Pi again still checks native ownership. A conversation whose
messages wait for a starting Pi cannot be archived.
Unreadable presentation state or missing native history is shown as unknown,
not silently replaced with an empty archive.

## Sending before Pi runs

A message can be sent while Pi is not running: while a new conversation is
being created, while its Pi starts, after a daemon restart, or after Pi
stopped or crashed. The daemon holds such messages in order under the
browser's command IDs and starts Pi if nothing is starting it. When Pi is
ready, it receives the held texts joined by blank lines as **one** prompt, and
every held command's receipt takes that prompt's outcome. Later messages,
sent while Pi works, are steering or follow-ups as usual. The joined text
shares Pi's prompt limit, so the daemon refuses a message that would exceed
it; a refused message's text goes back to the person.

Held messages are visible in the conversation status, so another tab or a
reload draws the same waiting messages, and the browser resolves its own only
from that list and the receipts (`held`, `pending`, `accepted`, `rejected`,
`cancelled`). A command ID is spent when the daemon first sees it, so a
repeated post is refused rather than held twice. Taking the messages back
before Pi runs (`cancel_held`) returns exactly the texts the daemon still held
and stops a Pi that was started only for them; a new conversation's own start
continues. If Pi fails to start, the messages stay held and the conversation
reports `start_failed`; a retry or the next message starts Pi again. Like
receipts, held messages live only in the daemon's memory. A daemon restart
loses them, and the browser then shows such a message as uncertain and never
resends it.

## Ending and resuming on send

Browser or gateway loss leaves Pi running. A daemon restart loses its handles
and receipts, and systemd cleans up its service processes, including Pi.
An independently detached tool may outlive that cleanup or an interruption;
the host does not claim that all effects of the previous work have stopped.
Native history remains readable. A child that ends during a turn leaves the
conversation `stopped` and `interrupted`: whether that work finished is not
known, and the browser says so until the next prompt.

A browser-started conversation without a running Pi opens as its readable
native history with an enabled composer. The daemon recognises it from the
browser-origin marker its Pi lock file carries, and the snapshot offers it as
resumable. Opening, reading, scrolling or reconnecting never starts Pi, and
the status read takes no lock. The next send starts Pi: the daemon checks that
any previous child has exited, the session lock is available, and the
recorded browser origin identifies a discoverable workspace with the same ID
and working-directory path. This checks the current path association; it does
not preserve a filesystem identity across directory replacement. The daemon
also requires one readable native session with the matching ID and working
directory, and stable content across repeated reads. It holds the lock through
launch, and a new Pi child opens the existing session file. If ownership or
history cannot be established, the start fails and the message stays held.
Terminal history has no browser origin and stays read-only.

Implementation: `internal/daemon` owns discovery, RPC control, writer locks,
held messages and resuming; `web/src/app` owns browser commands and their
displayed outcomes.

Decisions behind this page: ADR 0001, ADR 0003, ADR 0010.

## Observing spinoffs

A browser parent starts Taskfleet work in its ordinary native tools. The daemon
supplies `TASKFLEET_CREATOR_SESSION=pi:<session-id>` on fresh and continued Pi
launches. Taskfleet owns the independent user unit, worktree, settlement and
retained evidence. The daemon never starts, merges or writes to a spinoff for
the browser ([ADR 0017](../decisions/adr-0017-observe-taskfleet-spinoffs.md)).

The open parent reads its direct children from Taskfleet 0.15 or newer, matching
both the recorded creator session and exact source checkout. Nested creator-run
records are not flattened into the browser parent. Native node worktree paths
also exclude direct spinoff checkouts and their unannotated immediate `src`
containers from the workspace snapshot; a directory name alone never hides it. List is inventory; bounded
`run show` reads supply the landing verdict and retained report. Failed reads
remain unknown or partial, and absence of a supported executable is unavailable,
not an empty inventory. The user's `~/.local/bin`, `/usr/local/bin` and `/usr/bin`
are the runtime search locations. No host registry or history copy is written.

The browser places groups beside the native parent turn preceding creation,
refreshing every three seconds while open. Its `spinoff` query parameter selects
a read-only child without making that child's native session a controllable
conversation. The status above the composer links to children; the existing
native process inventory remains the authority for waiting and wake-ups.
`Odottaa spinoffia` has a blinking sidebar dot (static with reduced motion).

Pi transcript reads use Taskfleet's exact node/attempt/session identity. The
original archive is preferred, then the live file. Opens are confined beneath
the mapped home and fixed `.taskfleet` root with no symlinks, and require a
regular file owned by the mapped UID. Native session type/version/ID and the
recorded original/live cwd must agree. Only projected text is returned; native
tool metadata is not serialized. Unsupported harnesses explicitly show that
history is unavailable. There is no continuation or control endpoint for these
sessions. The independent Taskfleet user manager requires deployment-provided
lingering; the daemon does not widen Pi's systemd environment.
