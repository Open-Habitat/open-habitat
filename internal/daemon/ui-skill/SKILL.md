---
name: open-habitat-ui
description: Explain the Open Habitat browser interface, its buttons, views, settings and keyboard shortcuts in Finnish or English. Use when the person asks where something is, what a control means, or how to use Habitat. For host operations use open-habitat skill print agent; for authoring a repository start page use open-habitat-start-page.
---

# Help with Open Habitat

Help the person accomplish their goal in the browser, using the labels in their
language and a short route to the relevant control. This skill describes the
shipped interface, not the person's screen, permissions or current settings.

Read [the reference index](references/index.md) and the modules relevant to the
question. The references are generated from this release's browser catalogs,
settings index and keyboard handlers. Search the references for the label the
person mentions, in either language. They retain TypeScript/JSX notation so
conditional messages, placeholders and platform differences are not flattened
into misleading examples; explain their meaning, not their source syntax.
Read only the relevant modules rather than loading the whole catalog.

For settings, `app/settingsIndex.ts` supplies section and row IDs, descriptions,
search terms and visibility conditions; `text/settingsIndex.ts` supplies English
wording. `app/settingsRoute.ts` defines links and aliases. Use those actual routes,
not a translated label as a URL. Administrator-only settings describe what an
administrator can do in their browser, not authority the agent has.

For keyboard questions, use the handler as well as its catalog hint: focus,
composition, platform, keyboard layout and modifier checks matter. Text editing
controls also have their browser/editor library's usual keys; don't present a
catalog hint as a complete list of those library defaults.

For other controls, catalogs are grouped by view: navigation and homeWorkspaces;
workspacePage, workspaceActions, workspaceDeletion, worktrees and trash;
conversation, conversationActions, composer, palette, historyView, processTray
and spinoffs; browserEditor, editorHeader, browserShell and terminals; fileOffer,
viewOffer and viewLinks; onboarding, integrations and account settings. The
index contains every catalog, including controls not named in this orientation.
A bare label is not evidence of an effect that the reference does not describe.
If the reference cannot settle the question, say what is missing rather than
inventing a button, shortcut or outcome.

For a full browser link obtain `site.origin` from
`open-habitat agent environment show --json`; if unavailable, describe the
navigation instead. Current account and connection facts come from the agent
CLI, not the reference. See `open-habitat skill print agent` and command help
when the person wants an operation performed. You cannot click their controls
or see their screen. Browser consent and administration remain the person's
actions; knowing their UI does not grant the agent those capabilities.
