# Prototype round 1: worker view header

Round: `design-system/prototypes/rounds/2026-11-13-worker-header/`
(`NOTES.md` there lists the facts the host already gives and what it
would need). Built with that directory's `build.mjs`; its `check.mjs` walks
both directions at 1440 and 390 px, light and dark, in every case.

**Axis:** where the worker's Git, context and model buttons sit. They
are the production buttons in both directions: Git opens production's Git
layer with the worker's files, the ring and the model open the worker's
details (read-only, no picker), and unknown is a "?" with a sentence.

1. **Otsikkorivillä**: on the title row, in the place and order a
   conversation has them. The band keeps worker, parent link,
   harness · profile and Ask. The work sentence line goes away.
2. **Nauhassa**: in the worker band beside the parent link. The title row
   stays as it is. On a phone the band wraps to three lines.

**Recommendation: 1.** The facts are where a conversation has them, so
nothing is learned twice. On a phone it uses the production header's
facts line as it is, and the band stays as the sign that this is a worker.

A third direction (one bar, no band) was tried and dropped: at 1440 px
with the rail open, the header shortening pushed the parent link into ⋯.

Cases: Claude Code worker with no changes and low context; Pi worker with
changes, a PR and context near full; a worker whose facts could not be
read.

## Questions for Jari

- Is the pull request a button beside Git (as here), or only inside the
  Git layer?
- The Claude Code worker's context ring needs the daemon to read Claude's
  usage (new host data). Until then, should the ring show "?" for Claude
  workers?

## Verdict (Jari 13.11.2026)

Direction 1, **Otsikkorivillä**. The open questions were not answered
separately, so the round's own choices stand as the default: the pull
request is a button beside Git, and a Claude Code worker's ring shows "?"
with its sentence until the daemon reads Claude's usage. Implementation:
`worker-header-status`.
