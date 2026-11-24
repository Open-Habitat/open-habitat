# Result

Conversation rows in the rail (Sinun vuorosi, Käynnissä, Hiljaiset, the
adaptive rail and the phone drawer alike) no longer show the workspace's name
when the row carries the workspace icon; the title gets the room. The adaptive
rail's override that named the workspace in every row is removed.

- The workspace stays named for assistive technology and the pointer: the
  icon button's accessible name and tooltip name it, and the row's description
  and tooltip lead with it. New-conversation rows, which had no description,
  now carry the workspace's name as one.
- Rows without icons keep the quiet name in Hiljaiset, where no heading names
  the workspace (stories and listings without icon data).
- Explain mode's conversation-row card says the row shows the icon and that
  pointing at it gives the workspace's name.

## Icon fallback

A workspace without a chosen icon or logo gets two letters from its name and
one of eight hues. The derivation is already collision-avoiding: a letters and
hue pair that another workspace has taken moves to the next free hue. Two
derived tiles can look the same only when nine or more workspaces share the
same two letters, which is unrealistic for one person's list. Two workspaces
can still look alike when their repositories deliberately choose the same
emoji, letters or logo; that is the repositories' choice, and the tooltip and
accessible name tell them apart. No fallback change was needed.

## Evidence

- `./scripts/test-focused.sh --area web` (umask 077): 265 files, 2236 tests
  passed.
- Browser: `rail-icons-quiet.spec.ts` 4 passed, lab `lab-adaptive-rail.spec.ts`
  8 passed.
- UI references regenerated with `scripts/generate-ui-reference.py`; the run
  also picked up earlier drift from main (settings index, web search texts).
