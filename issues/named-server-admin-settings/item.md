---
created: 2026-10-02
updated: 2026-10-02
type: feature
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-10-02:ui-observations:1-3
---

# Named server and separate administrator settings with user roles

## Description

Reporter observation (2 Oct 2026): The open sidebar shows a truncated server URL ("omega-habitatat.ma...") instead of a server name, followed by "Yhdistetty". Wants a configurable server name shown there; server settings on their own administrator page alongside personal Settings; an administrator CLI able to perform the same actions; ordinary and admin users, with user-role management in the administrator view. The exact meaning of the connection label was not specified. Design question: determine who authorizes administrator actions and how they reach the gateway/daemon/provision broker without granting browser or per-user daemon root authority. Do not treat a UI-only admin flag as authorization.
