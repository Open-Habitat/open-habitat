# Tulos

Tekstin ja esikatselun vaihto on nyt **⌥⌘P** Macilla ja **Ctrl+Alt+P**
muualla. VS Coden **⌘⇧V / Ctrl+Shift+V** toimii edelleen, ja Esc palaa
tekstiin kuten ennenkin. Esikatselupainikkeen vihje ja `aria-keyshortcuts`
kertovat uuden yhdistelmän. Cmd/Ctrl+E ei enää vaihda näkymää, vaan se jää
selaimelle ja editorille.

## Decisions for later review

- **Ctrl/⌘+Alt+P, ja Cmd+E pois.** Selaimet käsittelevät Ctrl/⌘+E:n
  ennen sivua: Macilla esimerkiksi oman sivupalkin tai valinnan
  hakukenttään, Windowsissa ja Linuxissa osoiterivin haun. Siksi sivu ei
  voi luottaa siihen. Ctrl/⌘+Alt on sama perhe, jota sovellus jo käyttää
  editorin ja keskustelun väliseen vaihtoon (Ctrl+Alt+K / ⌥⌘K). Selaimet
  eivät tietääkseni varaa siitä P:tä. Vaihtoehtoja olivat:
  - Cmd+E rinnakkaisena: se olisi toiminut vain joissain selaimissa, ja
    vihje olisi luvannut näppäimen, joka ei aina toimi;
  - pelkkä ⌘⇧V: se on VS Coden käyttäjälle tuttu mutta muille vaikea
    löytää.

  Safarin, Arcin ja Edgen omia ⌥⌘P-pikanäppäimiä ei voitu tarkistaa
  tältä koneelta, joten Jarin selain kannattaa kokeilla.
- **AltGr jätetään rauhaan.** Windowsissa AltGr näkyy Ctrl+Alt:na. Siksi
  näppäintä ei käsitellä, kun selain ilmoittaa AltGr-tilan
  (`getModifierState("AltGraph")`), eikä merkin kirjoittaminen vaihda
  näkymää.
