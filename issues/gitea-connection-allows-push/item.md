---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-10-29/gitea-connection-allows-push
lane: gitea
lane_seq: 20
---

# Gitea connection: allow push with the person's own write-scoped token; explain a read-only one

Jari 29.10. (Birch, Fleetrepon agentti Habitatissa): Habitatin Gitea-integraation kautta push ei toimi. Repojen origin on https://alder.example-tailnet.ts.net/…, ja tunnukset tulevat `open-habitat gitea git-credential` -helperistä. Fetch toimii, mutta push (myös --dry-run) palauttaa 403 Forbidden sekä fleetrepo- että habitat-access-test-repossa. Samalla tokenilla Gitean API näyttää tilille push: true, admin: true, joten tilin oikeudet ovat kunnossa; todennäköisin syy on, että integraation token on vain read:repository (yhdistämisohje ja ADR 0031:n read-only first scope). SSH-push samaan repoon toimii.

Jarin päätös 29.10.: "Tääkin pitäisi korjata" — Habitatin Gitea-yhteyden pitää sallia push henkilön omilla oikeuksilla. Tämä laajentaa ADR 0031:n read-only-ensivaihetta; gitea-push-permission osoitti jo, että erillinen write:repository-PAT pushaa samaa natiivia adapteria pitkin.

Toteutettava: Gitea-yhteys pyytää ja hyväksyy tokenin, jolla on write:repository (ja tarvittava read:user), yhdistämisohje ja tilaviesti kertovat sen, ja olemassa oleva read-only-yhteys tunnistetaan ("vain luku: push ei onnistu, vaihda token") eikä push epäonnistu selittämättä 403:lla. Push kulkee nykyistä natiivia git-credential-helperiä pitkin; ei omaa tunnusvälittäjää, ei uutta tallennuspaikkaa, ei selaimen omaa push-painiketta. Gitean suojatut haarat ja tilin oikeudet pysyvät Gitean vastuulla.
