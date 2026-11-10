# Open Habitat: goal and user journeys

Open Habitat is a browser interface to projects and AI agents on a Linux
server. A person opens their own workspace, talks with an agent and follows
its work. Files, Git repositories and conversation history stay in the native
tools' own formats, so the same work remains reachable over SSH and tmux.
Closing the browser leaves the agent working.

Conversations in the browser run Pi on one Linux server. Every person works
under their own Linux account: their files, credentials and agents are
separate from everyone else's. The product does not build a second history or
a workspace registry next to the native tools.

The interface is in Finnish and English (US or UK spelling and number
formats). It works on desktop and phone, in light and dark themes, and follows
the system theme by default.

This page describes what the product is meant to do and why. It does not
track how far the implementation has come; the code is the record of that.

## First use

The server's address decides where a person signs in. Signing in with GitHub
sets up both the browser session and the person's native GitHub use on the
server. The server's administrator decides who gets access, for example
individual GitHub accounts or members of a GitHub organization or team. The
person never picks a Linux account in the browser.

A sign-in lasts through ordinary use and through gateway restarts and
upgrades, so nobody is asked to sign in again every day. The session survives
closing the browser: it ends after 90 days without use, one year after signing
in at the latest, when the person signs out, or when an administrator revokes
it. If the server's private session file is lost or cannot be read, existing
sessions stop working and everyone signs in again. Signing out ends the
browser session, not the native tools' sign-ins. Once signed in, a person can
show a code and open the product on their phone without signing in to GitHub
again.

Getting started follows a short route: GitHub, repositories, any data
connections the administrator has added, and an AI account. The administrator
chooses whether repositories are offered preselected, fetched automatically,
or brought in the background without a repository step. In the repository
step the person chooses which GitHub repositories become workspaces on the
server. All available repositories are listed by default, and the person can
narrow the list by recent activity. Continuing without choosing any
repository is allowed. Cloning runs in the background while the person goes
on, and the route shows each repository's verified result. An existing
matching workspace is not cloned again.

The AI account step connects the agent to a model provider. The administrator
decides what is offered: a ChatGPT or Claude subscription, an OpenAI,
Anthropic or DeepSeek API key, or an AI key the server provides. For a
subscription the browser shows a sign-in link and, depending on the provider,
a code to copy, and the person confirms the sign-in on the provider's page.
Pi stores and renews the credentials in the person's Unix account; no
terminal is needed. Returning from the provider's page does not yet mean
success: workspaces, history and agent control open once Pi's credentials are
found to be usable.

A person can stop part way and sign out. On return the current state of the
native sign-ins and workspaces is checked again. An unclear sign-in or clone
is resolved before a new attempt, so the same work is not started twice. A
returning person whose Pi credentials work goes straight to their workspaces.

## Returning to work and finding your way

The top of the sidebar shows what is going on across all workspaces.
**Your turn** lists conversations where the agent asks something, where it
has replied and the person has not yet answered, which the person has raised
there themselves, or which were just opened and have no message yet. A reply
stays here after being read, until the person answers or chooses **Not now**.
**Running** lists conversations with work under way: those whose agent is
working and those waiting on background work (a process or a worker), with
what they wait for. A conversation whose turn has ended is finished, even if
Pi is still open waiting for a message, and returns to Running only when its
agent works again. Work that crashed or was cut off, for example by an
upgrade, stays in Running until the person continues or archives the
conversation; a turn that ended in an error is marked as failed in the quiet
list. Each row shows the conversation's title, workspace and state. A worker
has its own row instead of sitting under its parent; a mark on the parent's
row says that its worker is working.

**Quiet** lists every other conversation, finished worktree conversations
included, as one list without workspace headings, newest first. The list
survives a pause, Pi resting and a server restart; archived conversations are
not in it. The list can be sorted by newest, workspace or name and narrowed
to one workspace; the sort and the narrowing follow the person from device to
device. Folding the section is a choice of each device: folded, it shows the
open conversation's row and one pill per workspace that opens that
workspace's list directly. The open conversation is marked in every section
and stays visible at the end of the list even when the narrowing would
otherwise hide it.

Below these are the workspaces found in the person's `~/src` directory, in
alphabetical order so that a workspace is always in the same place. An
ordinary directory is a workspace without Git or a configuration file. A
workspace's row hints whether something there waits for the person or work
is running. The row leads to the workspace's page, which lists its
conversations, finished ones included; the sidebar does not list them under
the workspace. The list can be filtered, and archived workspaces sit folded
at the end of the list, where they can be restored; the filter finds them
too. An empty list, loading and a failure to read the directory look
different from each other.

A person with a single workspace has the same view and sidebar as everyone
else. The one-row list, the filter and the workspaces heading are left out;
the workspace's name at the bottom of the sidebar leads to its page, next to
*Add workspaces*. A second workspace brings the list back.

**Home** leads to a return view where the person finds their running and
recently opened conversations. On desktop the sidebar can be narrowed to a
strip that shows the Your turn and Running conversations as workspace letters
and state marks. On a phone the navigation opens over the conversation, and
the menu button shows a count when something waits for the person. The chosen
workspace and conversation are in the browser's address, so they can be
reached again by link, by reloading the page or with the browser's back
button.

Opening a conversation for the first time reads its state and history before
showing the content. History starts from the most recent content, and older
content can be loaded. A recently opened conversation comes back from the
same tab's memory without a new loading state, with its draft and reading
position. When the content is no longer in memory or is no longer known to be
current, what is needed is read again. A conversation that is gone is told
apart from one that cannot be read right now.

Opening history does not start an agent. A new conversation is started
separately. An ended browser conversation can be continued with the same
history once the earlier work is known to have ended. Conversations started
in a terminal are read-only in the browser. Writers started by the browser
share a lock. Before continuing an ended browser conversation, the daemon
checks the same person's Pi processes and refuses to continue if it cannot be
sure about the writer. A Pi started in a terminal after that check does not
honour the browser's lock, so strict exclusion of every writer is not
promised.

## Conversation and steering the work

The person writes a message and sends it to Pi. The message shows whether it
is waiting for acknowledgement or was rejected. An accepted message clears
the draft; a rejected or uncertain one keeps the text. An ordinary success
needs no lasting notice. The person follows the reply and the progress of
tools in the conversation.

While Pi works, a message can go two ways. **Steer** gives Pi an extra
instruction in the middle of the work, at Pi's own pace between tool calls;
it does not interrupt a running tool. **Follow-up** queues the message until
the agent's turn ends. Enter steers while the agent works, as in Pi's own
terminal interface, and Alt+Enter sends once the other way. Shift+Enter adds
a line break. Queued steering and follow-up messages are shown separately in
their original order.

Queued messages can be taken back into the message field, in their original
order, but only those whose removal from Pi's queue is confirmed; steering
that has already been delivered cannot be taken back. **Stop** (Esc in the
message field) asks Pi to stop the current turn. The result is shown as far
as it is known: Pi stopping does not by itself prove that every process it
started has ended.

Pi's questions can be answered or cancelled in the browser. A supported
question asks for text, a choice or a confirmation. An unknown kind of
question is shown as text and can be cancelled. The server receiving an
answer does not confirm that Pi handled it, and an unclear answer is not
resent automatically.

A conversation's title starts as **New conversation**. A title is made from
the content with a separate model call, and it can be refined as the topic
becomes clear or when the person asks for it next to the title; the person
can also rename the conversation. The title does not change with every
message. A failure keeps the previous title or a short start of the first
message, and titling never blocks the conversation. The title is Pi's native
session name, so the same name shows in the terminal's session list. An
existing name is not changed automatically.

The person can ask for a recap of a conversation, and one is also made
automatically after the work has been quiet for a while; the person can tune
or turn off the automatic recap in the settings. The recap is shown near the
message field, and new messages mark an old recap as out of date. It is
stored in Pi's history, not in a separate browser notebook.

## Reading content and agent state

History and the live conversation show the same content with the same
meaning. Text meant for the person, images, thinking, tool calls and their
results, and recaps stay readable in the order and with the links in which Pi
produced them. Thinking and tools can be folded away or shown by default.
Encrypted thinking data and internal technical details are not shown as
conversation messages. Unknown content gets a quiet presentation whose safe
details can be opened when needed.

Markdown and code are readable, and code can be copied. A tool call, its
progress and its result belong together. The structured change that Pi's
`edit` tool delivers is shown as a diff; other tools' results are shown in
the form they provide. A long result can be expanded without losing focus,
text selection or reading position. HTML or program code in the content does
not run in the interface. HTML views that an agent publishes run only in a
sandbox on their own address, never in the application's page.

The agent's state answers separate questions: is the process running, is the
agent doing work, is it waiting for the person, and can it be steered from
the browser? A running process alone does not prove that work is going on,
and a lost connection does not mean that the agent stopped. What is shown
rests on what the host knows. [Design](../design-system/design.md) describes
the shared meanings and how they look in the sidebar, the agents and the
conversation.

Conversations that need attention show in the application's own count, as a
text mark on the agent's row, and in the browser tab's title when the open
conversation finished in the background. Colour alone, or a background tab's
title alone, is never the only sign.

The conversation scrolls with new content only if the person was already at
the bottom. Someone reading older content sees an indicator of a new reply
or ongoing work, and **To the latest** takes them to the end. The reading
position and opened tool groups survive updates of the same conversation
while the matching part of history is still available.

Each conversation has its own draft. It survives a page reload in the same
tab, but not closing the tab, and drafts are not stored on the server.
Choosing a conversation, or successfully creating or continuing one, may move
focus to the message field. A background update, a new title or a change in
list order does not. Closing a dialog returns focus to a sensible place.

## Managing workspaces and conversations

A person can make an ordinary directory or a local Git repository into a
workspace, clone a repository from GitHub, Gitea or GitLab, or turn on Git
later. A GitHub repository can also be created for a local repository. A new
workspace opens, and creating it can include starting the first agent and
moving to the message field. A workspace's display name and its own settings
are stored in the workspace.

Using a Git workspace requires checking that the repository and the agent's
native Git use are ready. A missing permission or a failed preparation is
shown with its cause so that the person can fix it. Being signed in does not
by itself prove that the agent can use that repository.

A worktree agent gets an ordinary `git worktree` of a Git workspace on its own
branch, and ordinary browser conversations happen there. Merging or
discarding the branch is asked of the agent; the top bar shows the Git state.
The workspace page and the storage settings list all worktrees, and they can
be cleaned up or removed by force.

Archiving a workspace removes it from the ordinary list and leaves its files
in place; it can be restored. Deleting moves the workspace to the Trash, from
which it can be restored; permanent deletion happens only from the Trash and
only when asked for separately. A clean clone whose remote holds everything
can be deleted permanently straight away. Before deletion the workspace is
shown with its related processes and worktrees. An unclear effect, a process
that cannot be stopped or a remaining linked worktree blocks deletion, and so
does trying to delete the person's only visible workspace. Taskfleet, the
worker tool shipped with the product, cleans up its own worktrees;
directories outside the workspace are never removed silently. Symlinks and
worktrees found elsewhere may show as observations, but writing actions do
not touch them.

A conversation can be archived out of the active list once nobody writes to
it. Stopping a managed agent and archiving its conversation are separate
actions. The history stays in place, and an ended browser conversation is
continued from the archive with the same native history.

Workers that an agent starts through Taskfleet have their own view: a Pi
worker's conversation is readable, and a worker running another agent, such
as Claude Code, is shown through its read-only terminal. Questions about a
worker's work go through the main agent.

Around the conversation, each workspace has a browser terminal on the same
native tmux sessions and a VS Code editor running as the person, with a
simpler editor on a phone. Agents can publish views and files at addresses
that the person controls. Data connections (for example Google, Microsoft
365, iCloud, Dropbox, IMAP, CalDAV and CardDAV) give agents access to the
person's own mail, calendars, contacts and files, and the person's own
machines can be connected for agents over Tailscale. Dictation in the message
field uses a speech service key.

## Account and settings

The account button shows the first name and the GitHub profile picture, or a
fallback for it. The opened account view shows the email address. The details
come from GitHub; a missing name or email is asked for during getting started.
The displayed details help recognize the account but do not change the
verified identity or whose Unix account is used.

The settings cover the account and Git identity, signed-in devices, the
account's public keys, AI models and the subscriptions or keys behind them,
recaps, dictation, code hosts, data connections for agents, the person's own
machines, appearance and language, the editor, and storage with the Trash.
For each GitHub, AI or other connection the settings show what is known of
its native state. A missing sign-in is told apart from a state that cannot be
verified. The existence of Pi's credentials does not by itself prove that a
request to the provider succeeds. Signing in to an AI provider from the
settings uses the same route through Pi as getting started.

The appearance settings offer a light, dark or system theme. The language can
be Finnish, US English, UK English or the system choice, which follows the
server's default and then the browser's language. Signing out closes the
browser session and clears the person's drafts and read content from the
browser. It leaves the workspaces and the native sign-ins on the server in
place. If signing out cannot be confirmed on the server, the person sees the
failure and can try again. When another person signs in, the views use their
data.

An administrator also sees the server's settings: its name and default
language, who may sign in and who administers the server, the getting-started
route, an AI key and a dictation key the server can provide, and the data
connections the server offers.

## Interruptions and uncertain outcomes

When the connection drops, the last received content stays visible. One
connection notice says that the information is out of date; a background
update does not cover the readable view with a loading screen. The browser
reads again when the network comes back or when the person chooses Refresh.
A new message cannot be sent while the connection to the server is down. A
break in the event stream alone does not mean that the server connection is
down. An ended sign-in requires signing in again.

Pi goes on under the daemon's ownership when the browser is closed. On
return, the person sees the current work and the history written during the
break. A stopping daemon or server can instead cut off active work.

An ordinary message shows as waiting for acknowledgement. If the
acknowledgement is lost, the person sees a sending error. When the connection
returns, the interface checks the message's outcome automatically before a
new message is allowed. The text can be recovered; the message is not resent
automatically, because the same work could otherwise start twice. The draft
and reading position survive the connection coming back.

Creating a workspace, GitHub actions, and creating and cleaning up worktrees
can succeed only in part. The person sees the completed steps, the error and
the effects left behind. A retry starts from a fresh reading of the native
state. Cancelling does not mean that changes already made were undone.

A clone is the person's daemon's job and continues when the browser leaves
the page or the connection drops. An interrupted clone is recognized from the
file system, and it is started over or removed only when the person asks.

## Accessibility and design

The keyboard and a screen reader must reach the same functions. Long
content, zooming and reduced motion must not hide functions or lose the
reading position. States are told with text or another sign that does not
depend on colour; a screen reader is told about meaningful changes rather
than every arriving piece of text.

[Design](../design-system/design.md) and the
[drafts](../design-system/drafts/) describe the layout and visual
presentation of the views.

## Installation and scope

Installation, upgrades and recovery must keep the people's native history,
Git state and workspace settings. SSH and tmux use continue next to the
browser. The [operator guide](operations.md) separates the product package
from a concrete server installation.

Outside the product for now, and decided separately: moving between several
servers in one interface, browser conversations with agent harnesses other
than Pi, browser and operating system notifications, signing in to the
browser with Google, and removing a person's account from the server.
