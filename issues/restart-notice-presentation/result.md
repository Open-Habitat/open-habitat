# Result

The catch-up Habitat prepends to the first run after Pi restarts is no longer
shown as a raw English "Laajennuksen viesti". The daemon recognises the
`oh-resume-catch-up` message (both native forms) and projects only its details
into a new optional history-entry field `restart` (`contracts/v1/history.schema.json`,
`event.schema.json`): cut-off background processes by name, Taskfleet runs with
their state and title, and runs still going whose wait was cut. The browser
draws it as a quiet marker, "Agentti käynnistettiin uudelleen", with one short
Finnish line per item. The agent's text is unchanged in substance and never
reaches the browser; block reads of the entry are refused like process
notifications. The extension's details now carry process names, run titles and
rearm objects; an older entry with bare rearm ids still renders.

## The wrong "stalled"

The state was already Taskfleet's own: `taskfleet run show` returned
`stalled: true, supervisor.state: dead` for run 01m5w60pxynq08hyrxde3s1dyn while
its supervisor (pid 1643413) was alive. Taskfleet v0.17.1 matches a supervisor
by its recorded start second with 1 s tolerance, computed from `/proc` btime,
and Birch's clock had stepped about 23 s (recorded 1793020944, computed now
1793020921). Taskfleet main already fixes this (`7026d09f fix(supervise):
decide PID reuse from the kernel start identity`), unreleased at the time; the
fix arrives with the next Taskfleet release through Fleetrepo. Habitat no longer
restates a stall as fact: the agent text says "is reported stalled by Taskfleet
(check `taskfleet run show` before relying on that)" and the marker says
"Taskfleetin mukaan pysähtynyt".

## Verification

Under `umask 077` with TMPDIR in `/var/tmp`: `./scripts/test-focused.sh` for
contracts, web and `./internal/daemon` passed; `node --test catch-up.test.mjs`
passed; the whole `npm run test:browser --prefix web` passed (398 passed, 3 skipped).
Independent review: `/llm-review` (gpt-6-astra) raised one candidate, confirmed
and fixed (block-read exposure); `/assess-findings` recorded it as FIX.

## Decisions for later review

- A new optional contract field `restart` on the history entry (like `notice`
  and `recap`) rather than a Finnish text built by the daemon: the browser owns
  the wording, as with process completions.
- The marker is always shown with its items, not collapsed; the list is short
  and is what the person needs after a restart.
- A stalled run is still listed (attributed to Taskfleet) rather than hidden,
  since a real stall is news; once Taskfleet's identity fix ships the false
  positive disappears at its source.
