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

## Purpose

The sidebar currently shows a truncated server URL instead of a recognizable
server name. Show a configurable name and provide a separate administrator page
for shared server settings and user-role management, alongside personal Settings.
The administrator CLI supports the same administration actions.

## Agreed scope

Users have an ordinary or administrator role. A browser administrator manages
shared server settings and user roles. That role does not grant access to other
users' conversations, files or credentials. Operating-system maintenance authority
is separate from the browser role.

A server can run normally without any administrator user. The privileged
admin/maintenance CLI remains available independently of browser roles and can
assign an administrator later, if one is needed. Bringing up a disposable test
installation should be lightweight; creating or appointing a browser administrator
is not a prerequisite for installation or normal use.

## Architecture to resolve

The product behavior above is agreed; the authorization mechanism remains to be
designed. The current gateway, per-user daemon and root provisioning broker have
separate authorities, described in [the architecture](../../docs/architecture.md)
and [the runtime instructions](../../internal/AGENTS.md). Recommend where server
settings and roles belong and how browser and CLI administration use them while
preserving user isolation. Record that architecture decision before implementation.

## Original observation

Reported by Jari on 2 October 2026: the expanded sidebar showed the truncated URL
"omega-habitatat.ma...", followed by "Yhdistetty". He requested a configurable
server name, separate administrator settings, an equivalent administrator CLI,
and ordinary/admin roles managed through the administrator view.

## Decisions

### 2026-10-02T09:38:01Z · @codex

Jari hyväksyi selainylläpitäjän rajauksen: yhteiset palvelinasetukset ja käyttäjäroolit, ei pääsyä muiden keskusteluihin, tiedostoihin tai tunnuksiin. Hän tarkensi, että järjestelmä saa toimia ilman ylläpitäjäkäyttäjää. Erillinen etuoikeutettu admin/maintenance-CLI toimii selainrooleista riippumatta ja voi lisätä ylläpitäjän myöhemmin. Testijärjestelmän pitää käynnistyä kevyesti ilman pakollista ylläpitäjän käyttöönottoa. Valtuutuksen teknistä toteutusta ei vielä päätetty.

Jarin täsmennys sanasta sanaan:

> toi suositus ylläpitäjän rajauksista ja roolista on just se mitä ajattelin. Sellainen tässä on, että meillä voi olla, ainakin tässä kohtaa, sellainen tilanne, että järjestelmällä ei ole ylläpitäjää. Meillä on erillinen admin/maintenence cli joka joka tapauksessa voi tehdä mitä tahansa niin se voi sitten lisätä ylläpitäjäkäytätjän jos/kun sellainen tarvitaan. Pointtina mulla on tässä se, että testijärjestlemä pitää saada keveästi tulille aina.
