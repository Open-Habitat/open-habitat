---
name: issue
description: Manage issues and epics in issues/ with the issuectl CLI. Use when creating, searching, updating, closing, or triaging issues and epics, or when an agent needs to read or write issue data.
---

# Issue Management

This repository tracks its work as markdown issues under `issues/`. Each issue
is a directory holding `item.md`: YAML frontmatter plus a markdown body. The
`issuectl` CLI is the interface to that tree. It knows the schema in
`issues/.schema.yaml`, holds the repo-wide write lock, validates every write,
and emits a version token you can use for optimistic concurrency. Hand edits
to frontmatter get none of that, so frontmatter goes through the CLI. Body
markdown is yours to edit when the CLI has no verb for what you need; the
CLI writes the frontmatter and a few structured body blocks, nothing more.

Argument: $ARGUMENTS
