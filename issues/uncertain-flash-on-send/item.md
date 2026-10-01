---
created: 2026-10-01
updated: 2026-10-01
type: bug
reporter: Jari
status: fixed
priority: high
related: ['@pilot14-session-revalidation-loop', '@browser-state-rewrite']
lane: caution-removal
lane_seq: 65
blocked_by: ['@browser-state-rewrite']
closed: 2026-10-01
closed_by: claude
---

# Viestin lähetys välähtää hetkeksi epävarma-virheen

_Source: chat_

## Havainto (Jari, pilot.15, 2026-10-01)

Kun viesti kirjoitettiin ja lähetettiin, näkyviin välähti hetkeksi virhe, jonka teksti oli suunnilleen "Aiemman pyynnön … epävarma …", ja se katosi saman tien.

## Syy, alustava

`web/src/components/Conversation.tsx` ja `AgentInteractionControls.tsx` sisältävät tilat "Aiemman vuoron tulos voi olla epävarma", "Jatkamisen tulos on epävarma" ja "Edellisen lähetyksen tulos on epävarma". Jokin niistä näytetään lähetyksen ja kuittauksen välisessä raossa, vaikka kyse on normaalista odotuksesta, ei epävarmuudesta.

## Odotus

Normaali lähetys ei näytä virhettä missään vaiheessa. Epävarmuus näytetään vain, kun kuittausta ei ole tullut määräajassa tai yhteys on oikeasti katkennut, ja silloin se pysyy näkyvissä, kunnes tila on selvinnyt.

## Lab resolution (2026-10-01)

Synthetic send tests assert pending during normal request, no transient uncertain notice, and on lost accepted reply a reload reconciles the receipt without a second POST; lab rejects show durable timeline feedback. The final committed implementation `f5f0a6f` passed the clean JSON CI gate (110 Chromium browser cases and 13 lab cases). No test-server deployment or visual verification occurred in this worker; the next release must verify this user-visible defect on the test server.

## Acceptance Criteria

- [x] Normal sends are pending, not uncertain; lost replies remain uncertain until authoritative reconciliation.

## Resolution

### 2026-10-01T23:34:32Z · @claude

Fixed in browser-state-rewrite; synthetic Chromium and clean lab gate passed on f5f0a6f. No test-server verification in this worker; verify visual behavior on the next release.
