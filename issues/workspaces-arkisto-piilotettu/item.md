---
created: 2026-11-23
updated: 2026-11-23
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-23
---

# Workspaces: "Arkisto" should be "Piilotettu", and the hidden section will not close

## Observed (Jari 23.11.2026, v0.1.6 on a pilot-like installation)

Jari moved several workspaces (repositories) out of sight in the sidebar.

1. **Wrong word.** The workspace section and action say *Arkisto / Arkistoi*. For
   workspaces the right term is **Piilotettu** (hide / hidden): hiding is not deleting or
   archiving, and the agent guide already calls it "hide".
2. **The section cannot be closed.** When he hid a workspace, the hidden section opened at
   once, and clicking its header did not close it. It closed only later, by itself, when he
   clicked some agent or went elsewhere.

## Done when

- Workspace hide wording is *Piilota / Piilotettu / Piilotetut* (en: Hide / Hidden) in
  the sidebar section, the action, its notices and errors, Explain mode, the phone menu and
  the open-habitat-ui skill references. Conversation archiving is a separate concept and
  keeps its own words unless it shares the same section.
- Hiding a workspace does not force the hidden section open (or, if it opens to show where
  the workspace went, a click on its header closes it at once); the header toggles open and
  closed on every click, keyboard included, and the state does not flip by itself on
  navigation. A browser spec covers hide → section state → toggle.
