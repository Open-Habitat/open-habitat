# Tulos

Syy: työpöydällä sovelluksen sivupalkki väistyi kokonaan, kun editori
avautui (`EditorSplit.css`), ja tilivalikon henkilökuvapainike on
sivupalkin alareunassa. Sivupalkin sai takaisin vain keskustelun
otsikkorivin nimettömällä ☰-kuvakkeella, jota ei löytänyt.

Nyt sivupalkki kapenee editorin vierellä kapeaksi kuvakepalkiksi (52 px,
sama kuin itse kavennettu sivupalkki), jonka alareunassa henkilökuva on
tavallisella paikallaan. Palkin › levittää koko sivupalkin editorin
viereen tämän editorikerran ajaksi; kun editori sulkeutuu, sivupalkki
palaa ihmisen omaan valintaan. ☰-painike ja sivupalkki editorin päällä
poistuivat tarpeettomina. Puhelimen asettelu ei muuttunut.

Samalla korjautui kavennetun sivupalkin saavutettavuusvirhe: Etusivu-linkiltä
puuttui nimi, kun teksti oli piilossa (axe havaitsi sen, kun editoritestit
alkoivat nähdä kavennetun palkin).

`web/tests/browser-editor.spec.ts` avaa editorin, avaa Asetukset
tilivalikosta ja palaa keskusteluun.

## Decisions for later review

- **Kapea palkki eikä piilotus.** Vaihtoehdot: tilivalikko editorin
  otsikkoriville, tai näkyvämpi ☰ entisen päällä avautuvan sivupalkin
  tilalle. Kapea palkki, koska tili ja navigaatio pysyvät samassa paikassa
  kuin aina, ja se maksaa editorilta vain 52 px. Editorin päälle avautuva
  sivupalkki poistettiin, koska palkin oma › tekee saman.
- **Levitys koskee vain yhtä editorikertaa.** Seuraava editorin avaus alkaa
  taas kapealla palkilla, jotta editori saa tilan oletuksena.
