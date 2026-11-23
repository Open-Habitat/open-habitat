# Result (23.11.2026): the agent guide rewritten with /rethink-instructions

`internal/daemon/host-context.md`, `helpers-context.md` and
`multiplayer-context.md` were rewritten in place. Nothing else changed except
`host_context_linux_test.go`, which gained one test. The facts were carried
over as they stood; none were checked against the code, which is the
fact-check's job.

## How the three files reach the agent

`launchContext` in `internal/daemon/pi_rpc_linux.go` joins them into one prompt
section that a generated Pi extension sets at `before_agent_start`:

- every launch gets `host-context.md`, auxiliary title workers included;
- a conversation launch (create, resume, held) also gets `helpers-context.md`;
- `multiplayer-context.md` is added when the person has the multiplayer
  experiment on.

The files are concatenated as they are, so the two additions still begin with
an empty line and a second-level heading.

## What the original was doing

It was not a procedure manual. Most of its sentences were knowledge the agent
cannot get elsewhere: what the browser can do, which commands exist, how long
processes live, what a quota does when it fills. Its weaknesses were of
another kind:

- Facts and rules were mixed in paragraphs that had grown one sentence at a
  time, so related things sat apart (the view and file offers under "Editor
  and shell", process lifetimes at the end of "Conversations").
- Many rules came without the reason that makes them applicable to a case the
  rule did not name: "never", "do not", "always" and "must" appeared 25 times
  (4 in the rewrite).
- Some operational detail repeated the agent skill.

## What changed

**Rules were turned into the facts behind them.** Examples:

| Original | Now |
|---|---|
| "Check current files and tool help rather than inventing account status" and "Do not infer a connection from this guide" | The guide is the same on every installation and says nothing about this person's account, followed by where the state is read |
| "Never choose [quiet] on your own because nothing seems pending" | A finished answer is something for the person to read, so it stays in Sinun vuorosi |
| "do not block or poll" on `taskfleet run wait` | The wait's completion wakes the agent in a new turn, so there is nothing to block on or poll |
| "Never substitute an ordinary run while claiming it is a resident helper" | An ordinary run ends with its task and cannot take a next message, so it is no substitute |
| "Ask the person first before purchases, cancellations…" | In the server browser the agent acts as the person on their own accounts, so those acts wait for their yes |
| "Never put a token on the command line… Never ask the person to paste a password" | Whatever is written in the conversation stays in its history and goes to the model provider; both rules follow from that |
| "Never delete the person's own files to make room without asking" | Caches and merged worktrees can be regenerated, the person's files cannot, so removing them is their decision |
| "Do not seek other users' homes, credentials, sockets or agents" | Other people use the same server under their own accounts and the separation keeps their work private; kept as a plain limit, with that reason |

**The rail rule keeps the substance of today's fix** (`agent-rail-running-rule`):
`running` is set as the last tool call before the final message when work the
agent will report on is still running and the reply asks nothing, and the
final message ends the turn. It now also says why: the conversation would
otherwise claim the person's attention with nothing for them to do. The bullet
list of the three sections became prose, because `yours` is the default and
needs no instruction. Both places that start a turn-notified
`taskfleet run wait` still say to set `running`, and the new test
`TestHostContextRunningSection` pins the command, "last tool call before" and
both mentions.

**Sections follow what the agent is doing.** "Conversations" has subsections
for the rail, for reminders and notices, and for work that outlives the turn.
View and file offers have their own section, "Showing and handing over your
work". "Attachments" and "Files on the person's computer" are one section. The
headings the route test names are unchanged.

**The helper recipe** reads as a description of a round, not one long
paragraph. All commands and result fields are the same.

**Dropped**, as things the agent skill carries or any agent knows:

- the cache-cleaning commands (`go clean -cache`, `npm cache clean --force`,
  `cargo clean`, `git worktree remove`); the guide still says what is safe to
  free;
- "Stay within the work the person requested" and "This guide grants no extra
  tools or privileges";
- "Do not impersonate a different session" (the guide now says Habitat set the
  creator-session attribution and to leave it);
- the repeated `--title` advice, said once for both kinds of offer.

**Added**, one claim taken from the agent skill: a workspace can be removed
with the agent CLI's checked `workspace delete` as well as in the browser. The
original told the agent to prefer the browser's flow to `rm -rf` and named no
checked route the agent can take itself.

## Size

The rewrite is not much shorter: `host-context.md` went from about 2590 words
to 2470, the helper recipe from 500 to 460, the multiplayer text is the same
size. Because most of the original was knowledge, rewording could not remove
much, and a shorter text would have left the agent knowing less. Real savings
need a decision about what is injected at all; see the first two points below.

## Where Jari's knowledge is needed

1. **Auxiliary launches get the whole guide.** A title worker receives all of
   `host-context.md`, although it never uses workspaces, the rail, offers or
   integrations. If those launches matter for cost, a few lines would do for
   them. This changes `launchContext` and its tests, so it was left alone.
2. **What could move behind a pointer.** Sections that matter only in some
   conversations could shrink to two or three lines that name the capability
   and where to read more: the Gitea 403 diagnosis, the signed-in server
   browser, project trust, attachments limits, files on the person's computer.
   The agent would learn the capability exists and pay for the detail only
   when it needs it. Weaker models are less reliable at following a pointer,
   and whether that risk is acceptable is a product call; nothing was moved.
3. **"Do not promise that deleting history or archiving a conversation frees
   space."** Kept as a rule, because the reason is not in the text. If the
   reason is that Pi's history is small, or that archived conversations keep
   their files, saying so would serve better.
4. **Attachments in repositories.** The original said not to move attachments
   into a repository unless asked. The rewrite says they stay until the person
   removes them and one goes into a repository only when the person asks. If
   the concern was specifically that uploads end up committed, that is worth a
   clause.
5. **Checking for `--resident` before the first helper.** Kept. If Taskfleet's
   refusal of an unknown flag is clear enough, the check costs one call per
   helper and could go.
6. **The notice one-liner.** "One bash call does it, with no help lookup
   first" is kept from the original, which looked like the answer to agents
   spending a call on discovery. `pi_rpc_native_linux_test.go` pins the
   command name and its `--help` in the system prompt.
