---
created: 2026-11-24
updated: 2026-11-24
type: feature
reporter: Jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-11-24/oidc-sign-in
---

# Sign-in with generic OpenID Connect beside GitHub, configured by the administrator

## Description

## What Jari asked (24.11.2026)

Sign-in other than GitHub, so that a team's non-programmers do not need a
GitHub account and so that Open Habitat can be used where GitHub is
unreliable (mainland China).

## Why

- **Who has an account.** People sign in only with GitHub OAuth today. The
  product is for the colleagues who never open a terminal; a bookkeeper or a
  designer has to create a GitHub account just to sign in. Outsiders reading
  the install requirements notice this at once (private launch-readiness
  review, 24.11.2026).
- **China.** GitHub is not formally blocked in mainland China but is
  unreliable (GreatFire tests in August 2026 show github.com/login disrupted),
  and non-programmers there live in WeChat, Feishu, DingTalk and WeCom without
  a proxy. A Hong Kong server does not help: every person's browser still has
  to reach github.com to sign in.
- **Companies.** European companies will ask for Entra ID or Google Workspace;
  a Chinese company deployment for its own CAS or IdP (a LobeChat thread on
  V2EX asks exactly this).

## Direction

Generic OpenID Connect sign-in that the administrator configures in the site
file, beside GitHub, rather than one more named provider. One implementation
covers Keycloak, Entra ID, Google Workspace, Authentik, Casdoor, Authing and
Chinese enterprise IdPs that speak OIDC (Feishu, DingTalk and WeCom directly
or through Casdoor/Authing). Gitee OAuth alone was considered and set aside:
it helps only developers reach a code host, not the non-programmers.

Questions the design has to settle (the gateway holds sign-in authority, so
this is an architecture change and starts from a design note, per
CONTRIBUTING):

- the person's stable identity and its mapping to a Linux user (today
  `github:<numeric id>`), and what happens to an existing person who signs
  in through a second provider;
- how the site file's admission list names OIDC people (subject, email,
  group claim);
- what GitHub sign-in still gives that OIDC does not (repository access and
  the GitHub connection are separate from sign-in and stay available as a
  code-host connection);
- multiplayer and sharing, which today name people by provider subject.
