# Tulos

Kellon paneelin otsikossa on nyt pelkkä *Ilmoitukset*. *Voimassa nyt*
poistettiin, samoin sen tyylisääntö (`.ah-bell-head span`).

Storyt (`StatusBell.stories.tsx`) piirtävät tuotantokomponentin, eikä
missään storyssa tai specissä ollut alaotsikkoa, joten niitä ei tarvinnut
muuttaa. `web/tests/status-bell.spec.ts` meni läpi (3/3; axe molemmissa
teemoissa), ja sen kuvakaappauksessa otsikko on yksin.

## Decisions for later review

- **Specissä ei ole uutta tarkistusta.** Alaotsikon puuttuminen on
  sanamuotoa, ja TESTING.md kieltää testaamasta UI-tekstiä. Rakenteellinen
  tarkistus, että otsakkeessa on vain otsikko, testaisi yksityistä
  rakennetta eikä käyttäytymistä.
