---
created: 2026-11-14
updated: 2026-11-14
type: improvement
status: done
priority: normal
preparation: ready
lane: rewind-text
lane_seq: 1
closed: 2026-11-14
---

# Rewind confirmation says the person's own later edits are replaced too

## Description

The experimental *Palaa tähän* file restore returns tracked files to their
earlier contents, including edits the person made after the agent; the
current contents are captured first, so the restore can be undone. The
confirmation speaks only of the agent's changes.

## Decision (Jari 14.11.2026, from `decisions-review-after-31-10` item 2)

Change the text, not the behaviour: the confirmation says plainly that later
changes by anyone in these files, the person's own included, are replaced,
and that the current contents are saved so the restore can be undone. No new
question, no attempt to tell who wrote which line.

## Acceptance Criteria

- [x] Finnish and English confirmation text in `web/src/text/rewind.ts` (and any other place describing the file restore) says this
- [x] Existing rewind tests updated
