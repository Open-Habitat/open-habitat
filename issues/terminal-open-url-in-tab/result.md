# Tulos: päätteen ohjelman avaama osoite tarjotaan Habitatissa (kokeellinen)

## Mekanismi (f29e0a0e)

- Daemon kirjoittaa tmux-socketin viereen (vain ihmisen oma hakemisto)
  sh-apuohjelman `open-url` ja asettaa sen päätteen `BROWSER`-muuttujaksi
  (`new-session -e` ja `set-environment`).
- Apuohjelma toimii näin:
  - hyväksyy vain tulostettavat ASCII-merkit ilman välilyöntejä ja vain
    http(s)-osoitteet, enintään 4096 merkkiä;
  - tulostaa osoitteen päätteeseen;
  - asettaa paneelin `@open-habitat-url`-arvoksi "<nonce> <url>".
- Session otsikko (`set-titles-string oh;#{pane_in_mode};#{@open-habitat-url}`)
  vie arvon selaimelle ilman tmuxin passthroughia.
- Selain toimii näin:
  - jäsentää otsikon (`terminalTitle.ts`);
  - hylkää muut kuin http(s)-osoitteet ja osoitteet, joissa on käyttäjänimi
    tai salasana;
  - ei tarjoa uudelleen liittymisen ensimmäistä otsikkoa, joka on vanha
    pyyntö.
- Kortti näyttää isännän ja koko osoitteen. Vain ihmisen painallus avaa
  `<a target=_blank rel="noopener noreferrer">`-linkin, joten ponnahdusikkunoiden
  esto ei estä sitä. Mitään ei ajeta, ja kortti näkyy vain, kun kokeellinen
  **Päätteen osoitteet selaimeen** (`terminal-open-urls`) on päällä.

## Päätökset myöhempää arviointia varten

- Kanava on tmuxin otsikko eikä OSC-passthrough (`allow-passthrough` pysyy
  pois päältä) tai daemonin oma ilmoitus. Ohjelma, joka voi ajaa `tmux`ia,
  toimii jo ihmisen omin oikeuksin, joten kanava ei laajenna kenenkään
  valtaa. Sama otsikko kertoo myös kopiotilasta.
- Apuohjelma on tiedosto daemonin ajonaikaisessa hakemistossa eikä binäärin
  alikomento, koska `BROWSER` välilyönnillä ei toimi xdg-openissa eikä
  Pythonin webbrowserissa.
- Apuohjelma onnistuu (exit 0) myös silloin, kun ominaisuus on pois päältä.
  Ohjelma ei silloin tulosta omaa varaohjettaan, mutta osoite on näkyvissä
  päätteessä.

## Todisteet

- `browser-terminal.spec.ts` "an address a program opens…": `javascript:`
  hylätään (exit 1, ei korttia). https-osoite näkyy kortissa ja päätteessä.
  Linkin target ja rel tarkistetaan, painallus avaa välilehden oikeaan
  osoitteeseen, ja Ohita sulkee kortin.
- Go `TestTerminalBrowserChannel`: hyväksytty osoite päätyy otsikkoon.
  file:, javascript:, välilyönnillinen ja ESC-merkin sisältävä osoite
  hylätään.
- Riippumaton /llm-review (löytäjä gpt-6-astra, todentaja claude-fable-5-2) ja
  /assess-findings: 2 korjattu, 1 hylätty (itsestään korjautuva).

Elävä tarkistus: ei tehty. Tarkistettavaa: kytke ominaisuus päälle, avaa
uusi pääte ja aja `gh auth refresh`. Kortti näyttää github.com/login/device.
