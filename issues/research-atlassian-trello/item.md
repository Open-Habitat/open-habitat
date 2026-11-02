---
created: 2026-11-02
updated: 2026-11-02
type: task
reporter: jari
status: open
priority: high
lane: atlassian
lane_seq: 1
preparation: ready
---

# Research: Jira, Confluence and Trello integration for Contoso

## Description

Jari 2.11.: Contoso needs a Jira/Confluence integration and a Trello
integration. They probably have an organisation there, which has to approve
the app, and so on. First find out how this is done; then UI prototypes
(a separate issue after this report).

Cover, for Jira, Confluence (Atlassian Cloud) and Trello (also Atlassian):
- What a person's agent needs to do with them (read and update issues and
  pages, comment, search, create cards) and which native tool does it best:
  official CLIs (Atlassian `acli`), community CLIs, Atlassian's remote MCP
  server, plain REST. Habitat's rule is native tools and the person's own
  credentials, no Habitat-built broker (root `AGENTS.md`).
- Authentication per person: OAuth 2.0 (3LO) app vs personal API token,
  scopes, token lifetime and refresh, where the credential lives on the host
  (the person's own home, like the other integrations), and how the browser
  sign-in fits Settings › Integrations (how Google/Microsoft/GitLab/Gitea are
  done today: read their code and the earlier integration research in
  `issues/` and git history).
- The organisation's side: Atlassian organisation admin approval of
  third-party apps, app allowlists, Trello Workspace/Enterprise power-up and
  API restrictions, data residency; who at Contoso has to do what, and
  whether Habitat (or each installation) needs its own registered OAuth app.
- How the agent learns of it (the `personal-data` skill pattern) and what
  stays read-only by default.
Recommend one approach per product with the reasoning, the operator and
organisation steps, and at most five questions for Jari.

## Acceptance Criteria

- [ ] report.md (Finnish): recommended tool and auth per product, organisation approval steps, how it fits Settings › Integrations and the agent, open questions.
