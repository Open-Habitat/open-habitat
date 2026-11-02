---
created: 2026-11-02
updated: 2026-11-02
type: feature
reporter: jari
status: open
priority: high
lane: org-admission
lane_seq: 2
collision: [internal/gateway/admission.go]
preparation: ready
---

# Admit people through a GitHub organisation team

## Description

Jari 2.11. approved the simple model (`research-org-admission`, its
decision sections; the report's GitHub App and periodic re-check design is
**not** built) with the UI of `proto-org-admission` direction 3, *Syy
riveillä*:

- An administrator adds `organisaatio/tiimi` (for Contoso `Contoso-Power/habitat`)
  in the access page's Salli field, beside individual GitHub logins.
- At sign-in the gateway checks, with the person's own OAuth token
  (`read:org` is already requested), that the person is an **active**
  member of a listed team (team membership API; bind to numeric ids, not
  names). A member is admitted (first sign-in creates the account as today);
  a non-member who is not individually admitted is refused with a generic
  message that does not name the group.
- Individually admitted people stay their own source; someone with both
  reasons keeps access when leaving the team.
- Leaving: the next sign-in is refused; the account and files are kept as
  with *Poista pääsy* today; an open session is not cut (Jari: no new
  maximum lifetime); *Poista pääsy* remains the immediate route. Rows show
  their reasons as chips; a leaver seen at a refused sign-in is raised as a
  notice above the list.
- The organisation must have approved Habitat's OAuth app; when GitHub
  cannot answer the membership question (app not approved, outage) the
  sign-in is refused with an honest message and the access page says why.

Authority stays where it is: admission is broker-owned
(`internal/gateway/admission.go`, the provision broker); the gateway only
asks GitHub at sign-in. No credential is stored for this.

## Acceptance Criteria

- [ ] A team source can be added and removed in the access page; members sign in, non-members are refused, a leaver is refused at the next sign-in, individuals keep access.
- [ ] Tests for admission decisions (member, non-member, pending membership, leaver, both reasons, GitHub unavailable) and the UI states; independent review of the authority path.
- [ ] `docs/operations.md` says what the organisation must approve.
