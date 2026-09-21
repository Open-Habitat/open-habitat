# Decisions and open questions

[ADR 0001](adr-0001-unix-native-agent-host) records the agreed approach: one daemon
per Linux user behind a shared authentication gateway, native workspaces and agent
histories, discovery before new storage, and JSON/HTTP with one SSE feed.
[How the system works](architecture) explains these choices with examples.

## Questions for the first implementation

- How does the gateway authenticate users and connect to each user's daemon?
- How do we install and run the daemon?
- How does the daemon discover and resume Pi conversations, including ones started
  through the terminal?
- What process status, output and controls can the Pi extension provide? What can
  we show when it is absent?
- What are the snapshot and command formats? How long do we keep events for
  reconnect, and when must the client fetch a new snapshot?
- Which UI action first needs a workspace metadata file or an agent annotation?

Answer these by building the [first working version](implementation).

## Later questions

Add Claude Code and Codex adapters when a real use case needs them. Work out shared
workspaces or stronger isolation when Unix user separation no longer meets a
specific need. Taskfleet can remain an ordinary Pi tool; it does not need a separate
browser protocol by default.

Northwind needs a pilot that preserves developers' clones, Git workflow and credentials.
Acme needs a decision about how its native and web applications use the host,
including deployment and Moodle integration. Availability, backup and recovery
requirements need to be established from actual use and operational needs.
