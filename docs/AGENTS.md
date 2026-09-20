# Documentation

`docs/site/` contains the Markdown published to Glasspad. Edit those files directly.

## Writing

Explain the system to someone who wants to understand or use it. Start with what
happens: who signs in, what runs, where files live, and how the browser and terminal
work together. Use ordinary words and concrete examples before abstractions.

Preserve the reasons behind a choice. The product builds on mature open-source
Unix/Linux systems: reuse their stable services, compose simple tools, and let
each component manage its own behavior, data and configuration. This is the
reason for using native components, not just a shortcut for the first version.
Add features when a real need appears. Describe tenant separation as one deployment
per tenant, with ordinary Linux users inside it and no host-level tenant object. A shorter text must
not lose those reasons, examples, or important limitations.

For example:

> Jari signs in through the gateway. It forwards his requests to a daemon running
> as Linux user jari. That daemon lists his ~/src directories and reads his Pi
> histories. He can still use the same agents through SSH and tmux.

Write “read Pi's session file” instead of “reconstruct the authoritative native
projection”. Write “questions still to answer” instead of “open decision gates”.
Use technical terms where they clarify something; explain them on first use.
Keep general architecture independent of particular applications. Use component
examples briefly to illustrate a general principle, without elevating the example
to a separate rule. Describe the design as it stands: do not imply optional
features or extension points that have not been chosen. A workspace is always a
directory, its settings live inside it, and there is no workspace registry.

Do not put documentation-management declarations such as Authority, Updates when,
or Not the source for on published pages. Keep maintenance instructions here.
Avoid repeated acceptance labels, version ceremonies, and process vocabulary in
place of an explanation. Distinguish agreed design from implemented behavior in
plain language. Examples illustrate decisions; they do not silently add requirements.

## Pages and updates

- `index.md`: short introduction and links to useful starting points.
- `architecture.md`: how the system works, with examples and design reasons.
- `decisions.md`: links to recorded decisions and questions still to answer.
- `adr-NNNN-<slug>.md`: a decision, why it was made, and its tradeoffs.
- `evidence.md`: links to research at exact revisions, including limitations.
- `implementation.md`: what to build and what to check as it becomes usable.
- `status.md`: what is done, what is next, and known gaps.

Update pages affected by a change; do not rewrite the whole site for routine task
progress. Keep executable tasks in issuectl and research under its parent issue.
Link to detailed research instead of copying it. Historical research is not the
current design. Preserve the meaning of accepted decisions when editing their
language; record a changed decision in a new ADR and link the old one to it.
Use Git and closed issues for history, without separate handoff pages.

## Files and publication

All published pages are directly under `docs/site/`, with lowercase `[a-z0-9-]`
slugs. Assets go in `assets/`. Keep navigation in `glasspad.yaml` in sync with pages.
Do not add instruction files or symlinks inside `docs/site/`; this directory is the
exception to the repository's AGENTS.md/CLAUDE.md convention.

`.glasspad.yaml` contains only `space_key: native-agent-host`. Server, target and
credentials come from the user's environment. Do not change global configuration.

Keep the date and source revision on `status.md` accurate when updating its account
of project progress. The revision identifies the landed state being described,
not the commit containing the status page itself. Pure wording edits do not require
a new project-state revision.

## Validation

Run from the repository root:

```sh
python3 docs/validate-project-view.py
glasspad build --dry-run --json docs/site /tmp/native-agent-host-project-view
git diff --check
```

The validator checks file layout, navigation, links, ADR registration and status
metadata. Glasspad checks that the site can be built.

Publishing is a separate action after changes have landed. Publish the complete
site from the intended branch, never an autonomous worktree. Run from `docs/site/`
so Glasspad loads the correct space key:

```sh
(cd docs/site && glasspad publish .)
```
