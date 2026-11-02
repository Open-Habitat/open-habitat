# Luo aloitussivu tyhjässä keskustelussa – kierros 1

Issue `proto-empty-conversation-start-page`. Yksi näkymä: uusi tyhjä
keskustelu työtilassa, jolla ei ole aloitussivua, puhelimessa (390) ja
työpöydällä. Rakennettu tuotannon komponenteista (`AppShell`,
`WorkspaceRail`, `AgentHeader`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `SkillInvocation`, `Composer` ja sen `GoalChip`,
`ControlButton`, `StartHere.css`, `WorkspaceIntro.css`). Työtilat, aika ja
agentin vastaus ovat synteettisiä; mitään ei lähetetä.

Nyt kohdassa lukee "Luo aloitussivu kirjoittamalla viestikenttään
/open-habitat-start-page." (`nyt.mjs` ottaa siitä kuvan labista).

## Akseli ja suunnat

Akseli: missä kutsu on tyhjässä tilassa ja mitä painallus tekee.

1. **Rivi ja painike**: hiljainen katkoviivarivi kuten työtilan sivulla; painike vie pyynnön kenttään, ja lähetät itse.
2. **Kortti, alkaa heti**: kortti kertoo, mitä sivulle tulee; painike lähettää pyynnön, ja agentti aloittaa heti tässä keskustelussa.
3. **Kentän yllä**: tyhjä tila pysyy tyhjänä; ehdotus on kentän yläpuolella, ja painallus vie pyynnön kenttään.

Suositus: **Rivi ja painike**.

## Sama kaikissa suunnissa

- Ruudulla ei ole komennon eikä tiedoston nimeä. Kenttään menevä pyyntö on
  `/skill:open-habitat-start-page `, jonka kenttä näyttää tavoitesiruna
  *Luo aloitussivu* (sama siru kuin aloitussivun tavoitteilla), ja kursori
  jää sirun perään. Kentän vihje on "Lisää toiveesi tai lähetä
  sellaisenaan…".
- Lähetetty pyyntö näkyy historiassa taitosiruna *Luo aloitussivu* ·
  "Esittely ja tavoitteet tälle työtilalle". Tuotanto näyttäisi tänään
  taidon natiivinimen ja englanninkielisen kuvauksen; kierros ehdottaa
  tavallista kirjainta ja otsikkoa (`round.css`:n lopussa).
- Agentti ehdottaa ensin eikä kirjoita mitään ennen hyväksyntää, kuten
  sulautettu taito jo tekee. Vastaus on sama kaikissa suunnissa.
- *Alusta* palauttaa tyhjän keskustelun.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-02-aloitussivun-painike/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-02-aloitussivun-painike/check.mjs \
  design-system/prototypes/dist/aloitussivun-painike/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi vaaleana ja tummana, 1440 ja 390 px
leveänä, varmistaa ettei oletusnäkymässä ole komennon tai tiedoston nimeä,
painaa *Luo aloitussivu*, tarkistaa sirun, kohdistuksen ja ettei mitään
lähetetty (1 ja 3), lähettää lisätoiveen kanssa ja odottaa ehdotuksen
(40 tarkistuspistettä, konsoli puhdas, kuvat kertoimella 2).
`index.html` on sama ilman upotettuja fontteja glasspadia varten.
