# Tulos: valinta ei enää katoa

## Syy

tmux lähettää hiiritilansa uudelleen (ensin pois, sitten päälle) jokaisessa
koko ruudun uudelleenpiirrossa: liittyessä, jokaisen koon muutoksen jälkeen
ja kun toinen laite muuttaa saman ikkunan kokoa. xterm.js tyhjentää
valintansa aina, kun hiiritila asetetaan, vaikka tila ei muuttuisi. Näin
Shift-vedolla tehty valinta katosi seuraavan piirron mukana. Asian todisti
synteettinen PTY-koetin tmux 3.4:llä.

## Korjaus (f29e0a0e)

`web/src/components/terminalModes.ts` (`TerminalModes`) ottaa hiiritilojen
DECSET/DECRST-sekvenssit haltuunsa. Se kirjaa, mitä ohjelma pyytää, ja antaa
xterm.js:lle vain nettomuutoksen ryöpyn jälkeen. Jos tila ei muutu, xterm.js
ei saa mitään. Pystysuuntainen koon muutos tyhjentää valinnan yhä, koska se
on xterm.js:n oma tarkoituksellinen valinta (xtermjs#5300).

Tavallinen veto ilman Shiftiä on edelleen tmuxin oma valinta. Korostus häviää
napin vapautuessa, mutta tmux kopioi tekstin, ja Kopioi-siru tarjoaa sen.

## Todisteet

- `web/tests/browser-terminal.spec.ts` "a selection survives tmux's
  redraws": Shift-valinta tehdään, sen jälkeen ikkunaa kavennetaan, ja testi
  odottaa tmuxin uudelleenpiirron (`?1000h`-kehys). Korostus ja siru pysyvät.
  Kun suodin poistettiin käytöstä, testi kaatui ("element(s) not found").
- `terminalModes.test.ts`: tmuxin tallennettu piirto ei muuta oikean xterm.js:n
  tilaa kertaakaan.

Elävä tarkistus: ei tehty. Synteettinen host ajaa oikeaa tmuxia ja bashia
omalla UID:lla. Tarkistettavaa elävässä: valitse Shift+vedolla, muuta
ikkunan leveyttä tai avaa sama pääte toiselta laitteelta, ja valinta pysyy.
