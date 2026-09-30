# Documentation

`docs/` is the project documentation, starting at `index.md`. It is written for
someone who wants to understand or use the system, and it is also what Glasspad
publishes: the Markdown here is the site, there is no separate source tree. The
pages are mostly in Finnish for Jari, with the ADRs and `evidence.md` in
English; keep a page in the language it already has.

## What good documentation looks like here

Start with what happens: who signs in, what runs, where files live, how the
browser and the terminal reach the same sessions. Ordinary words and a concrete
example carry more than an abstraction:

> Jari signs in through the gateway. It forwards his requests to a daemon running
> as Linux user jari. That daemon lists his ~/src directories and reads his Pi
> histories. He can still use the same agents through SSH and tmux.

Write "read Pi's session file" rather than "reconstruct the authoritative native
projection", and "questions still to answer" rather than "open decision gates".
Process vocabulary, acceptance labels and version ceremonies displace the
explanation the reader came for. Technical terms are fine where they clarify;
explain them on first use.

Keep the reasons. The product builds on mature Unix/Linux components because
each one already manages its own behaviour, data and configuration, and
composing them is the design, not a shortcut for a first version. Features are
added when a real need appears. Tenant separation is one deployment per tenant
with ordinary Linux users inside it; there is no host-level tenant object. A
workspace is a directory whose settings live inside it; there is no workspace
registry. Text that gets shorter but loses these reasons, or the limitations
that go with them, has lost the wrong thing. For the same reason, describe the
design as it stands rather than implying extension points or options nobody has
chosen, and use a component such as Pi to illustrate a general principle
without turning the example into a rule about that component.

The project is pre-release, and much of what the pages describe is agreed but
not yet built. Say in plain language which is which. A mock is not an
integration, an unverified claim is not a refuted one, and a probe that
completed need not have confirmed its hypothesis. When you cite evidence, give
the inspected version, the exact result link and the scope it covers, so the
next reader can tell what was actually shown. Detailed research stays in its
issue and is linked at an exact revision; older research is background, not the
current design.

Pages are for readers, so maintenance notes such as who owns a page or when it
is updated belong in this file, not on the published pages.

## The pages

`glasspad.yaml` lists every page with a one-line description and is the current
map of the site. A few pages carry conventions that are not obvious from their
names:

- `decisions.md` and the `adr-NNNN-<slug>.md` pages record what Jari has agreed
  to. An ADR stays proposed until his review is recorded. A decision that
  changes gets a new ADR that the old one links to, rather than an edit that
  quietly changes what was accepted. The validator requires every ADR to be
  linked from `decisions.md`.
- `status.md` is a dated snapshot for a reader, stamped with the source
  revision it describes, not the commit that edits it. It is not a second
  schedule; `issuectl` owns executable order, and a status page that tries to
  own it drifts from the DAG.
- `interfaces.md` and `design-system.md` explain and point at the machine
  contracts in `contracts/v1/` and the design-system sources. Copied token
  values or component APIs go stale the moment the source changes.
- `logging.md` is a proposal awaiting Jari's decision, not an accepted policy.
- `operations.md` does not exist yet. It is written when the install, update,
  rollback and recovery procedures have been selected and verified, by the
  `prepare-mvp-operations` issue. Host-specific facts stay in Fleetrepo because
  this repository will be public.
- `brand/` holds the identity brief. It is not a page and the validator does
  not look at it.

Update the pages a change actually affects; routine progress does not warrant
rewriting the site. History lives in Git and closed issues.

## Files, validation and publishing

Pages live directly under `docs/`. `.glasspad.yaml` contains only
`space_key: native-agent-host`; the stable key is what lets a re-publish from
any checkout update the hosted space in place instead of minting a new URL. The
reader navigation in `glasspad.yaml` has to name exactly the pages that exist,
and agent instruction files are not pages.

From the repository root, `python3 scripts/validate-project-view.py` checks the
required pages, navigation, local links, ADR registration and the status
metadata, and `git diff --check` catches whitespace. The root `TESTING.md` describes when the full gate is needed.

Publishing is a separate act from landing on `main`, run as
`(cd docs && glasspad publish .)`. The configured target is hosted, so the
result is a shareable link, and the pages link into issue directories that a
reader of the link may not be able to open. Glasspad has ignored top-level
`AGENTS.md` and the `CLAUDE.md` symlink since 0.17.5, so the earlier blocker is
gone; the documentation has still never been published. The dated `status.md`
snapshot still describes the old blocker and needs reconciliation in its review. Keep the instruction files where they
are rather than building a second tree for the viewer, and never describe a
publication that did not happen.
