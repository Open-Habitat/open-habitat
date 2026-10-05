# ADR 0002: Use a React and TypeScript single-page client

**Status:** Accepted — conversation state ownership was later changed by
[ADR 0009](adr-0009-conversation-state-ownership.md).

**Date:** 2026-09-22

**Accepted:** 2026-09-23 at artifact revision `b87b1aae5d6fefcd914d4f06c0e510b5ca124f60`

## Context

A live conversation keeps changing while the person reads, writes a draft or
moves between workspaces. The browser must reconcile history, streamed updates
and command acknowledgements without losing the draft, reading position or
keyboard focus. It also needs to present long tool output, Markdown and code
safely. Pi remains the source of conversation history.

## Decision

Build a client-rendered React application in strict TypeScript, using Vite to
produce static assets and React Router for navigation. The gateway serves the
application on the same origin as its HTTP and SSE interfaces. The browser
needs no server-side rendering or React Server Components, and deployment needs
no JavaScript server runtime.

React was chosen for its accessible controls, rendering and testing ecosystem,
and its fit with an application that reconciles continuous events. Existing
JSX design references ease implementation, but production components own the
behavior. Stable TypeScript 7, Biome for formatting and linting, and `tsc` for
type checking were explicitly accepted after the combined toolchain passed
without forced peer dependencies, disabled checks or nightly packages.

### State ownership

The original choice put synchronized application data and command
acknowledgements in Redux Toolkit, so snapshots and events could be reconciled
through one testable model. [ADR 0009](adr-0009-conversation-state-ownership.md)
later moved conversation metadata and history windows into a separate in-memory
store to keep streaming updates local to the affected conversation. Redux
retains application and session state.

Routes own the current selection, session storage preserves per-tab drafts,
and components own transient interaction state such as focus and open menus.
The browser reconciles evidence from the host rather than treating a missing
acknowledgement as permission to resend a command.

### Components and rendering

Use React Aria Components for accessible control behavior and focus management,
with native HTML where it already supplies the needed behavior. Product
components wrap that foundation and use the project's design tokens and CSS
Modules for appearance. The application and Storybook import the same
production components; catalog stories supply their states and examples.
This keeps accessibility behavior reusable and the visual design under the
project's control.

Treat native history and tool output as untrusted content. Render ordinary
output as text and Markdown through React Markdown, GFM support and sanitization,
so content cannot become executable HTML. Serve application assets locally
under the gateway's Content Security Policy. Code highlighting and diff views
must preserve this boundary.

Long histories and large output need bounded rendering that preserves the
reading position and access to the content. TanStack React Virtual was selected
for variable-height timeline virtualization. Rich renderers can load separately
to keep the initial application small. Exact renderer recipes and the original
experiments remain in the [selection report](../../issues/choose-frontend-stack/result.md).

## Consequences and alternatives

A static client keeps browser development separate from the Go host while
sharing its authentication origin. React adds more client code than a small
Svelte or HTML application, and live variable-height content still needs careful
focus, scrolling and accessibility work.

Svelte was a credible alternative, but the evaluated React ecosystem gave a
stronger combined fit for accessible controls, rich content and explicit event
reconciliation. Server-rendered HTML with HTMX would still need substantial
custom browser state for drafts, streaming, command uncertainty and history
virtualization. Server rendering would add a second rendering path without a
clear benefit for this authenticated workspace.

The original acceptance also required Jari's approval of each UI slice before
dependent work could proceed. The later [working arrangement](../../AGENTS-WORKFLOW.md#ui-work)
replaced that gate with visual reviews in batches and explicit records of what
remains unreviewed. [TESTING.md](../../TESTING.md) defines current validation;
[the package](../../web/package.json) and its lockfile record dependency versions.
The original pins describe the evaluated toolchain rather than permanent
architecture constraints.

The [selection report](../../issues/choose-frontend-stack/result.md) preserves
the comparison, package versions, trials and their limits. The
[architecture pages](../architecture/index.md) describe the implemented system.
