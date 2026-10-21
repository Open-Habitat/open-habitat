---
created: 2026-10-21
updated: 2026-10-21
type: task
reporter: jari
status: done
priority: normal
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# Prototype: skill catalogue — which skills the person has, globally and per repository

## Description

Jari 2026-10-21: prototype a skill catalogue so the person can easily see which agent skills they have, in which repository, and where they are in use. Ground it in the native truth only: Pi's global and project skill locations (and any other harness locations the host actually supports), read where they are; no registry or second store (root CLAUDE.md). Show at least: global skills, per-workspace/repository skills, which one wins when names collide, source/version where natively known, and how to open a skill's file in the editor. Prototype round: 2–3 directions in production context (settings vs workspace view vs conversation-side), desktop and phone, light/dark, synthetic data, published for review. Jari picks; implementation is a later issue.

## Decisions

### 2026-10-21T10:10:09Z · @jari

Jari 2026-10-21 on round 1: the directions focus on maintaining skills; typing / in the chat already lists skills. The goal is adoption: a button where skills are described by use case / purpose, grouped by topic, showing what is new and what colleagues or others have made, so that a new user immediately understands what skills are available, and existing users discover new and old skills as their number grows. Make round 2 around adoption, not maintenance.

### 2026-10-21T10:10:37Z · @jari

Jari 2026-10-21: colleagues' skills means skills visible in the repository — colleagues add them there. Author and recency come from Git history of the skill file.

### 2026-10-21T10:11:16Z · @jari

Jari 2026-10-21: the catalogue may generate or add new metadata on top of a skill's existing metadata where needed.

### 2026-10-21T16:32:42Z · @jari

Jari 2026-10-21 on round 2: choose 'Aloita tästä' (new conversation's starting goals plus 'Tutustu taitoihin'). Its content should be defined in the repository itself. Conductor's reading: the starting goals are repository skills marked in their own frontmatter (metadata), so the team decides them in an ordinary commit; no host-side store. Implementation: implement-start-here.
