---
created: 2026-10-01
updated: 2026-10-01
type: bug
reporter: Jari
status: open
priority: high
related: ['@pilot14-session-revalidation-loop', '@browser-state-rewrite']
lane: caution-removal
lane_seq: 65
blocked_by: ['@browser-state-rewrite']
---

# Viestin lähetys välähtää hetkeksi epävarma-virheen

_Source: chat_

## Havainto (Jari, pilot.15, 2026-10-01)

Kun viesti kirjoitettiin ja lähetettiin, näkyviin välähti hetkeksi virhe, jonka teksti oli suunnilleen "Aiemman pyynnön … epävarma …", ja se katosi saman tien.

## Syy, alustava

`web/src/components/Conversation.tsx` ja `AgentInteractionControls.tsx` sisältävät tilat "Aiemman vuoron tulos voi olla epävarma", "Jatkamisen tulos on epävarma" ja "Edellisen lähetyksen tulos on epävarma". Jokin niistä näytetään lähetyksen ja kuittauksen välisessä raossa, vaikka kyse on normaalista odotuksesta, ei epävarmuudesta.

## Odotus

Normaali lähetys ei näytä virhettä missään vaiheessa. Epävarmuus näytetään vain, kun kuittausta ei ole tullut määräajassa tai yhteys on oikeasti katkennut, ja silloin se pysyy näkyvissä, kunnes tila on selvinnyt.
