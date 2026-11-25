# pbcopy ja pbpaste terminaalissa: tulos

Toteutettu Jarin 25.11.2026 päätöksen mukaan: ei kortteja, kenttiä eikä
ilmoituksia, vain komennot Habitatin terminaaliin. design.md:n kortti-,
pyyntö- ja worker-mallia ei rakennettu; se jää historiaan.

## Mitä tuli

- `runtime/core/agent-bin/pbcopy` ja `pbpaste`, ytimen ajonaikaisessa
  ympäristössä `pi`:n rinnalla (`agent-launcher`-komponentti). Daemon laittaa
  `agent-bin`:n viimeiseksi terminaalin PATHiin, joten ne löytyvät joka
  asennuksesta ja oma `pbcopy` aiemmin PATHissa voittaa. Release closure
  (`CoreAgentTools`) vaatii nyt molemmat.
- `pbcopy` lukee stdinin tmuxin nimettyyn puskuriin, tarkistaa koon (enintään
  1 MiB, terminaalin OSC 52 -dekooderin 1,4 Mt base64:n alla) ja lähettää sen
  `tmux load-buffer -w`:llä: teksti on tmuxin uusin puskuri ja menee liitetylle
  terminaalille OSC 52:na. Selaimen terminaali näyttää siitä saman Kopioi-
  toiminnon kuin tmuxin hiirivalinnasta. stderr kertoo tavumäärän ja sen,
  että selaimessa teksti on leikepöydällä vasta, kun Kopioi on painettu.
- `pbpaste` tulostaa tmuxin uusimman automaattisen puskurin (`save-buffer -`).
  `--help` sanoo tarkasti: hiirellä valittu tai pbcopylle annettu teksti,
  yhteinen kaikille saman henkilön terminaaleille, ei selaimen eikä laitteen
  leikepöytää.
- Ilman tmuxia (selaimen Pi-keskustelu, worker, cron) molemmat kertovat sen
  heti ja palauttavat 3. Jos tmuxissa ei ole liitettyä terminaalia, joka
  hyväksyy leikepöytäkirjoitukset (`#{client_termfeatures}` ilman
  `clipboard`), `pbcopy` palauttaa 3, sillä teksti ei päätyisi millekään
  leikepöydälle.

## Todisteet

- `TestClipboardCommands` (internal/daemon): oikea tmux ja PTY:n kautta
  liitetty xterm-256color-asiakas. Testi kattaa ohjeen, käyttövirheet,
  tapauksen ilman tmuxia, irrotetun istunnon, OSC 52 -tavut asiakkaan
  tulosteessa, `pbpaste`:n palauttaman tekstin tavu tavulta, 1 MiB:n rajan
  kummaltakin puolelta, tyhjän syötteen ja sen, ettei mittauspuskuria jää.
  Mutaatio (ilman `-w`) kaataa testin.
- `browser-shell.spec.ts` › pbcopy: oikea tmux ja bash fixture-isännässä.
  `printf … | pbcopy` tuo Kopioi-toiminnon, painallus vie tekstin selaimen
  leikepöydälle ja `pbpaste` lukee sen takaisin. Kaikki 13 browser-shell-
  testiä läpi.
- `TestReleaseClosureCoreAgentTools` kattaa puuttuvan ja väärän omistajan
  komennon. Verifioijan lähdekoodin golden päivitettiin ilman
  sopimusversion nostoa: vaatimuksiin tuli kaksi tiedostoa, mutta logiikka
  pysyi samana, kuten Node 22.23.5 -nostossa.
- Ydinarkisto (linux-arm64) rakennettiin `build-core-runtime.sh`:lla, ja
  `TestReleaseClosureBuiltCore` hyväksyi sen. Arkiston `pbcopy` ja `pbpaste`
  ovat tiloissa 0755 ja tavu tavulta samat kuin lähteessä. amd64-ydintä ei
  rakennettu; julkaisu rakentaa molemmat.

Ei todistettu: oikeaa asennusta, Safaria tai Firefoxia (Kopioi-painike on
olemassa oleva polku), eikä sisäkkäistä omaa tmuxia Habitatin terminaalissa.

## Päätökset myöhempään katselmointiin

- Selaimesta terminaaliin liitetty teksti ei näy `pbpaste`:lle. Liitos menee
  shellille kirjoituksena eikä tmuxin puskuriin, ja sen muuttaminen olisi
  uusi käyttöliittymäpolku. `--help` sanoo tämän suoraan.
- `pbcopy` ei kirjoita selaimen leikepöydälle ilman painallusta. Se käyttää
  terminaalin nykyistä Kopioi-toimintoa, joten teksti on tarjolla eikä vielä
  kopioitu, ja stderr sanoo sen. Muussa tmuxissa, jonka pääte hyväksyy
  OSC 52:n (esim. SSH ja iTerm2), kirjoitus menee suoraan.
- Toimii missä tahansa tmuxissa, ei vain Habitatin omassa: liitetty pääte
  ratkaisee. Irrotetussa worker-tmuxissa `pbcopy` epäonnistuu (exit 3) eikä
  raportoi kopiota, jota kukaan ei saa.
- Ei OSC 52 -kirjoitusta suoraan `/dev/tty`:lle ilman tmuxia: Habitatin
  terminaali on aina tmux, eikä paljaan päätteen vastaanottoa voi tietää.
- Tyhjä syöte on virhe (exit 1), toisin kuin macOS:ssä, jossa se tyhjentää
  leikepöydän. tmux ei luo tyhjää puskuria.
- Exit-koodit: 0 ok, 1 tyhjä, liian suuri tai tmux-virhe, 2 käyttövirhe,
  3 ei terminaalia.
- Ei `xclip`/`xsel`/`wl-copy`-aliaksia eikä agenttiohjeen mainintaa:
  selaimen keskustelussa komennot eivät toimi.
