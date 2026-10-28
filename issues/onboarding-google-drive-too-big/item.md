---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: open
priority: normal
lane: onboarding-google
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/onboarding-google-drive-too-big
---

# Onboarding: a Google Drive larger than the quota stops the Google step with unclear states

Ville Kajala (Northwind), käyttöönotto open-habitat.acme.test:lla (pilot.13), 2026-10-28, Jarin välittämä dokumentti 'Kokemuksia open habitat käyttöönotosta'. (1) Valitse kansiot: Google Drive -vaiheessa koko Drive on valittuna oletuksena ja koon kohdalla lukee 'Ei vielä laskettu', jota Ville piti hassuna terminä (img-image2.png). (2) Edellisen ruudun ohje 'sivu ei lataudu, tämä kuuluu asiaan' (Googlen kirjautumisen paluu, localhost-osoite) jäi huomaamatta; se pitää korostaa niin, ettei käyttäjä jää ihmettelemään. (3) Aloita synkronointi -> 'Valitut tiedostot eivät mahdu kotihakemistosi kiintiöön. Mitään ei kopioitu.' (img-image3.png, vapaana 13,1 Gt). (4) Sen jälkeen käyttöönoton Yhdistä Google -näkymä jäi tilaan, jossa Drive näyttää kiintiövirheen ja Gmail, Google-kalenteri ja Google-yhteystiedot 'Tilaa ei saatu selville' (img-image4.png). Odotettu: koko lasketaan tai arvioidaan ennen valintaa ja näytetään ymmärrettävällä sanalla; liian iso Drive johtaa suoraan kansioiden valintaan tai Driven ohittamiseen ilman, että muut palvelut näyttävät tuntematonta tilaa; Gmailin, kalenterin ja yhteystietojen tila selvitetään (miksi 'Tilaa ei saatu selville' kun kirjautuminen onnistui).
