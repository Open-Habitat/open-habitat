# Design-kierrokset

Yksi rivi kierrosta kohti: paketin lähdecommit, johon asti paketti oli ajan
tasalla, ja kierroksen issue. Seuraavan paketin muutoslista alkaa viimeisimmän
rivin commitista. [Design-kierros](process.md) kuvaa työtavan.

Ennen ensimmäistä inventaariopakettia toimitetut paketit (viimeisin
`issues/assemble-browser-redesign-handoff/`, 30.9.2026) koottiin käsin
valituista kaappauksista, joten niiden commit ei kelpaa muutoslistan
lähtöpisteeksi. Ensimmäinen inventaariopaketti esitti koko inventaarion
uutena; myöhempi navigaatio- ja asetuspaketti rajattiin tarkennettuun pyyntöön.

| Paketti | Commit | Kierroksen issue |
| --- | --- | --- |
| Ensimmäinen inventaariopaketti: navigaatio, asetukset ja yhteiset tilat | `176d9e643440530cee375a5dc6249b95ab3f95db` | [align-navigation-design](../issues/align-navigation-design/item.md) |
| Rajattu navigaation ja asetusten paketti | `7364709396830ebf8fdb9a4b5fa9fc29c3c402e9` | [align-navigation-design](../issues/align-navigation-design/item.md) |
| Kontrollien ja agenttitilojen suunnittelupaketti | `1efd34d36acb753a207915be8121dc1b2a53fc94` | [design-control-states](../issues/design-control-states/item.md) |
| Pi-tapahtumalohkojen suunnittelupaketti (toimitettu) | `43b3a8b105b307ffb165e0cbb638bab3c60b050c` | [design-pi-event-blocks](../issues/design-pi-event-blocks/item.md) |
