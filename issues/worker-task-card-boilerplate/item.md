---
created: 2026-10-29
updated: 2026-10-29
type: improvement
reporter: jari
status: open
priority: normal
lane: worker-presentation
lane_seq: 5
preparation: ready
---

# Worker task card leads with Taskfleet boilerplate; Kysy is clumsy

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Worker-näkymän *Pääagentti · tehtävä* -kortti alkaa Taskfleetin englanninkielisellä vakiotekstillä *Taskfleet run context (read first)*, joten pääagentin varsinainen tehtävä jää *Näytä koko viesti* -painikkeen taakse (Jari 28.10., kuvakaappaus). Kortin pitäisi näyttää ensin tehtävä ja ajon vakioteksti vasta pyydettäessä. Kortin yläpuolelle jää lisäksi suuri tyhjä alue, kun workerilla ei vielä ole muuta sisältöä. *Kysy* on kömpelö (Jari): kaistan oikean reunan siru *Vain luku · kysy pääagentin kautta* avaa ensin dialogin, jossa on vain painike takaisin pääkeskusteluun, vaikka samaan paluuseen on jo oma *‹ pääkeskustelu* -painike. Siru voisi viedä suoraan pääkeskusteluun tai jäädä pelkäksi tiedoksi. Toimivat: worker-kaista (*Worker · ‹ pääkeskustelu · Pi · builtin*), ja *‹ pääkeskustelu* palasi pääkeskusteluun (`worker-view-conversation`).
