# Changelog

All notable changes to this project are documented in this file. Entries are
written for the people who run an Open Habitat server and the people who use
one.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Until 1.0, formats and interfaces may change in any release. Every release is
published on [GitHub Releases](https://github.com/Open-Habitat/open-habitat/releases),
where its notes also say which release it follows and which runtime archives
it carries. To upgrade, deliver the successor release and change only
`site.release`, as [Install and operate](docs/operations.md) describes.

<!-- oss-changelog:unreleased-start -->
## [Unreleased]

### Added

### Changed

### Fixed
<!-- oss-changelog:unreleased-end -->

## [0.1.4] - 2026-11-21

- After its reply the agent can place its conversation in the sidebar's Sinun vuorosi, Käynnissä or Hiljaiset section; the person's own choice, questions, failures and running turns still take precedence.
- Twelve experimental features are now on for everyone: links in the terminal as URL cards, the storage breakdown, the background-work mark, the agent's scheduled wake, explain mode, per-turn changes, the context view with compaction, the agent resources view, Jira and Confluence, Trello, helpers, and the shared-items page, now called Outputs (Tuotokset) and listing private items too.
- Terminal: copy on select was removed; select and copy explicitly.
- Microsoft: each person has one shared Microsoft process with five topic areas instead of one per open conversation. Before deleting, sending or sharing a calendar, the agent asks for permission with a question that takes the composer's place.
- Microsoft relays use much less memory: each open conversation runs a small relay instead of a copy of the host binary.
- A Pi session line torn by an interrupted write is undone instead of being glued to the next entry, so the conversation stays readable.
- A message sent or steered while the conversation's status is being re-read is kept instead of lost.
- Text typed over a message whose delivery was uncertain is no longer cleared when that message turns out to have arrived.
- Upgrades reuse an unchanged runtime payload set from the previous release, which makes them much faster.
- A conversation reopens where you left it, and a Changes card appears under every turn that changed files.
- The editor opens previewable files in preview first and keeps workspace files out of browser caches.
- Sinun vuorosi and Käynnissä can be filtered by workspace; only the workspace list scrolls in the sidebar.
- At a full disk quota, space can be freed without the agent, and a move that cannot be restored says so.
- A reply ends once and stays put; conversations a restart left untitled get their title; silent event streams reopen.
- Google personal accounts are documented in the admin guide and offered in the connect flow.
- On a window or phone too short for the sidebar's regions, the whole sidebar scrolls so every conversation and workspace stays reachable.
- Turning on explain mode on a workspace page no longer crashes the page when the Hiljaiset section folds.
- Workspace icon suggestions offer your other workspaces' logos, image files in the workspace and images attached to the request.
- Experimental: multiplayer conversations: invite another person into a conversation, with participant messages, text-only turns, and a card that lets the owner see which participant turn started a process and stop it or leave it running.
- Experimental: an editor for the agent's instructions, in onboarding and Settings.
- Experimental: attention sounds. Choose a sound for when the agent needs you in Settings › Sounds (Äänet), or per workspace, and mute them from the account menu.
- Operators: releases now include `bin/open-habitat-mcp-relay`; custom installers must keep it beside the real `open-habitat` executable, root-owned and mode 0755, and include it in package verification. `host apply` and `host upgrade` handle this automatically.


## [0.1.3] - 2026-11-16

- ⌘K opens a switcher that searches across all your conversations, backed by a per-person search index on the host.
- ⌥↑ / ⌥↓ move through every visible conversation in the sidebar, across sections.
- Connecting Atlassian (Jira, Confluence) works again: the sign-in follows Atlassian's server-specific return address, and a sign-in that cannot start fails within seconds instead of after five minutes. The dialog title now reads "Connect an account: <name>".
- The editor previews nested front matter and YAML files, and a repository start page as a page, with content checked by the host.
- Dictation can continue for up to an hour as a chain of sessions, with audible signals before the limit.
- The GitHub card's actions are visible, and disconnecting is confirmed in place.
- Deleting a single item from the trash is confirmed with two clicks instead of typing its name.
- The first message of a new conversation no longer flickers or jumps while the conversation is created.
- Restoring an archived conversation with damaged history names the real reason, the notice can be dismissed, and archive notices no longer follow you into other conversations.
- Terminal: selections are visible in every theme, ⌘C copies a selection on macOS, and copy confirmations were removed.
- Storage: stored data is named, worktrees are classified from their run ownership, and cleanup drafts open directly.
- The page reader keeps quote credits and tag lines, and agents can read and change the person's experimental features.
- `/`-commands that the browser supports run as browser actions; worker counts and header facts stay consistent; replies whose text preview ran out are kept in history; read replies stay in their sidebar section during background work.
- The editor (code-server) is updated to 4.145.2.

## [0.1.2] - 2026-11-14

- Taskfleet's Pi workers in workspaces under `~/src` no longer stop at Pi's trust question before they start; the repository's own skills and extensions load for them as they do for browser conversations.
- Connecting a Microsoft account no longer asks which folders to sync. Files are fetched when they are needed, so every site and library the account can reach is available to the agent.
- A new look: three themes (including a high-contrast theme), a new mark, and the mark as the agent's state indicator. Control and state boundaries meet WCAG 1.4.11 contrast.
- The worker view's header shows the worker's Git state, pull request, context use and model.
- The browser terminal keeps selections, scrolls its history smoothly, and can copy text and open addresses.
- The GitHub card can allow agents to change GitHub workflows. It is off until the person turns it on, and only the person can turn it on.
- A repository start page can start a complete authored goal with one press.
- Storage: an experimental breakdown of what uses space, with a request the agent can act on to free what is regenerable (Settings › Experimental features).
- The first turn of a busy conversation no longer stays in its loading state, a message sent while the agent is working shows up at once, and a page part that failed to load says so instead of staying empty.
- A turn cut by a server restart says the restart cut it, not the person.
- Automatic recaps have a reserved background slot and are scheduled even when the acknowledgement arrives after the conversation has settled.
- When Pi exits without being asked, the daemon records which kind of error it printed just before.
- `open-habitat agent` lists conversations with the titles shown in the sidebar.
- The restore-file prompt says that a restore replaces your own edits too.
- Operations: `runtime-release install` installs a runtime generation without a full host apply, test releases can reuse a content-cached runtime, and the host keeps `needrestart` from restarting Open Habitat services.

## [0.1.1] - 2026-11-14

The first release from this repository, following the earlier pilot
pre-releases. Its runtime archives are those of the last pilot pre-release.

- The conversation list no longer flickers. A conversation could jump back and forth between "Your turn" and "Running" while its status was being re-read; it now changes section only when its state really changes, in the sidebar, on the home page and in the return view alike.
- When a person's daemon refuses to start, the system journal now says which startup check refused (for example an unsupported Pi runtime version) beside `server_failed`, without paths or personal data, so an administrator can repair it.
- The agent knows what happens to the background work it starts: a new conversation or a closed browser does not stop it, a daemon restart or upgrade does, and work that must outlive the conversation belongs in a Taskfleet worker or a terminal session.
- Removing a Microsoft account no longer occasionally fails with an error when a sign-in to it had been abandoned just before.
- Stopping the daemon now waits for integration recovery, migration and sign-ins to finish instead of leaving them writing into the home after shutdown.

## [0.1.0] - 2026-11-13

Published without GitHub's release immutability and replaced by 0.1.1 with
the same content. Do not install it.

[0.1.3]: https://github.com/Open-Habitat/open-habitat/releases/tag/v0.1.3
[0.1.2]: https://github.com/Open-Habitat/open-habitat/releases/tag/v0.1.2
[0.1.1]: https://github.com/Open-Habitat/open-habitat/releases/tag/v0.1.1
[0.1.0]: https://github.com/Open-Habitat/open-habitat/releases/tag/v0.1.0
