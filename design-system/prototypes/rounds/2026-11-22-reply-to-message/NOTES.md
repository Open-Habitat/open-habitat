# Vastaa agentin viestiin – kierros 1

Issue `reply-to-agent-message`. Rakennettu tuotannon komponenteista
(`AppShell`, `WorkspaceRail`, `NowSections`, `AgentHeader`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `ToolRow`,
`Composer` ja sen `beforeField`-paikka, `ControlButton`, `Icon`).
Kierroksen omia ovat vastausnuolen kuvake, lainauskortti, kieleke,
kohdan korostus ja kohdan valinnan painike. Keskustelu on synteettinen;
mitään ei lähetetä.

## Suunnat

Akseli: kuinka paljon viestistä viittaus kantaa ja kuinka raskaana se
istuu kentässä ja lähetetyssä viestissä. Kulmapainike, hyppy
alkuperäiseen ja ✕ ovat kaikissa samat.

- **A Lainaus**: kentän yllä kortti, jossa viestin alku kahdella rivillä;
  lähetetyn viestin alussa sama lainaus.
- **B Kohta**: valitse tekstiä vastauksesta ja lainaa vain se (*Vastaa
  tähän kohtaan*); kohta pysyy korostettuna alkuperäisessä, kunnes lähetät.
  Kulmapainike lainaa koko viestin kuten A.
- **C Kieleke**: yksi rivi kiinni kentän yläreunassa; lähetetyn viestin
  yllä vain linkkirivi *Vastaus agentin viestiin klo …*.

Oletusnäkymässä vastaus klo 9.20 viestiin on kesken ja historiassa on yksi
jo lähetetty vastaus (klo 9.29 → 9.14), joten kentän ja lähetetyn viestin
ero näkyy heti. Yläpalkin *Näytä, mitä agentti saa* näyttää jokaisen
vastauksen alla tekstin, jonka natiivi istunto saisi.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-22-reply-to-message/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-22-reply-to-message/check.mjs \
  design-system/prototypes/dist/reply-to-message/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi Päivä-, Yö- ja Korkea kontrasti
-teemassa, 1440 ja 390 px: oletusnäkymä, hyppy kentän lainauksesta ja
lähetetyn viestin lainauksesta, ✕, uusi vastaus kulmapainikkeesta, B:ssä
kohdan valinta, lähetys ja agentille menevä teksti (306 tarkistusta,
konsoli puhdas, kuvat kertoimella 2).

Toteutuksessa `AssistantMessage` välittää `actions`-propin `Message`ille,
jolla paikka jo on (Palaa tähän käyttää sitä omissa viesteissä); nyt
painike on aseteltu kortin päälle. `Icon` tarvitsee `reply`-kuvakkeen.
