---
created: 2026-10-28
updated: 2026-10-28
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-28/idle-stop-rest-card
lane: agent-lifecycle
preparation: pending
---

# Idle stop at 10 min interrupts an active person; the rest card says nothing useful

## Description

Jari 2026-10-28 klo 4.57 (Birch, pilot.13), kuva attachments/rest-card.png: kun ikkuna on auki ja kirjoitan tekstikenttään, käytän päätettä ja muuta, 10 minuutin joutoaika on liian lyhyt: Pi pysähtyy kesken viestittelyn, ja keskusteluun tulee kortti 'Agentti lepäsi klo 4.54–4.56 · Pi pysähtyi klo 4.54, kun se oli ollut 10 minuuttia jouten. Mikään työ ei katkennut. ✓ Viestisi herätti agentin klo 4.56. Agentti sai tämän selostuksen.' Jari: kortti on nollainformaatiota sekä hänelle että agentille; pitää miettiä, tarvitaanko sitä lainkaan.

Kaksi kysymystä: (1) joutopysäytyksen pitää ottaa huomioon ihmisen aktiivisuus keskustelussa (kirjoittaminen, pääte, editori, presence-signaali, jota recap-appears-while-typing jo lähettää) ja/tai pidempi raja; (2) lepokorttia ja agentin selostusta ei näytetä, kun mitään ei katkennut eikä valmistunut (wake-stopped-agent:in päätös 'lyhyt selostus aina' kumotaan tältä osin). Päätös Jarille ennen toteutusta.
