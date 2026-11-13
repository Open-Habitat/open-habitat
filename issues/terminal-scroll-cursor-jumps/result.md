# Tulos: rullaus etenee riveittäin, kursori ei hyppää, kirjoittaminen palaa kehotteeseen

## Syyt

- xterm.js lähetti yhden rullausraportin jokaista wheel-tapahtumaa kohden,
  ja tmux rullasi viisi riviä raporttia kohden. Kosketuslevyn jokainen pieni
  liike hyppäsi siis viisi riviä.
- tmuxin kopiotila näyttää oman kursorinsa historiassa, ja jokainen piirto
  näyttää sen uudelleen.
- Kopiotilassa näppäimet menevät kopiotilan sidoksille. Pääte tuntui
  jumittuvan, kunnes rullasi alas tai painoi q.

## Korjaus (f29e0a0e)

- Selain lähettää yhden SGR-raportin jokaista riviä kohden, jonka rulla
  liikkui (pikselit / rivin korkeus, murto-osa siirtyy seuraavaan
  tapahtumaan). Daemon sitoo tuotteen tmux-palvelimen copy-mode- ja
  copy-mode-vi-tauluihin yhden rivin rullauksen
  (`internal/daemon/terminal_session_linux.go`).
- Session otsikko on kanava `oh;#{pane_in_mode};…`, jota ei näytetä. Kun
  ihminen on rullannut historiaan rullalla, kursori piilotetaan, ja ensimmäinen
  näppäily lähettää ensin sidotun user-keyn (`\e[29999~`), joka poistuu
  kopiotilasta. Teksti menee sen jälkeen kehotteeseen. Näppäimistöllä avattu
  kopiotila (prefix [) toimii kuten ennenkin.
- Myös kopiotilassa uudelleen liitetty pääte tunnistaa seuraavan rullauksen
  historian lukemiseksi (review-löydös).

## Todisteet

- `browser-terminal.spec.ts`: kymmenen rivin rullaus vie historiaan, ja
  kursori on piilossa. Yhden rivin korkeuden rullaus siirtää ylintä riviä
  tasan yhden, kolmen rivin rullaus kolme ja alaspäin kaksi takaisin. Paneeli
  piilotetaan ja avataan uudelleen, rullataan, ja kirjoitettu komento ajetaan
  ja kursori palaa. Testi kaatuu, kun liittymiskorjaus poistetaan.
- Go `TestTerminalBrowserChannel`: sidokset, otsikko kopiotilassa ja
  user-key, joka poistuu tilasta eikä päädy kuoreen.
- Havainto tmux 3.4:stä: syöte, joka tulee muutaman millisekunnin sisällä
  kopiotilaan siirtävästä piirrosta, katoaa (myös q). Ihmisen näppäily on
  hitaampaa.

Elävä tarkistus: ei tehty. Tarkistettavaa: rullaa kosketuslevyllä tai hiiren
rullalla pitkän tulosteen historiaa ja kirjoita komento kesken lukemisen. Uudet
asetukset tulevat voimaan, kun selain liittyy päätteeseen seuraavan kerran.
