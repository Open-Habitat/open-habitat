# Keskustelukäyttöliittymän ensimmäinen suunnittelutoimitus

Tämä hakemisto säilyttää 2026-09-20 vastaanotetun keskusteludesignin vedokset,
klikattavan simulaation ja toimitukseen kuuluneet taustatiedostot. Se on yhden
suunnittelukierroksen aineistoa, ei yhteisen design systemin lähde.

- Yhteiset tokenit ja komponentit ovat [`../../../design-system/`](../../../design-system/).
- Tuotteen arkkitehtuuri on [`../../../docs/site/architecture.md`](../../../docs/site/architecture.md).
- Vastaanottoarvio ja avoimet kysymykset ovat [`../review.md`](../review.md).
- Canonical designer-toimeksiannot ovat arkkitehtuuri-issuen
  `ui-design-*.md`-tiedostoissa. `toimeksianto/` säilyttää toimituksen mukana
  palautuneet kopiot vain toimituksen ymmärtämistä varten.

## Sisältö

- `vedokset/`: pääpolku, tilakatalogit, yhteenveto ja ilmemääritys.
- `toimeksianto/`: toimituksen mukana palautunut toimeksianto ja myöhempien
  ominaisuuksien liite.

Kaikki vedosten tapahtumat ovat simuloituja. Vedos ei todista Pi-adapterin tukea.
Älä nosta jonotusta, kesken vuoron ohjausta, automaattista otsikointia tai muita
toimituskohtaisia ehdotuksia tuotevaatimuksiksi ilman UI-katselmoinnin päätöstä.

## Toimitukseen kirjatut näkymäkohtaiset ehdotukset

Ensimmäinen design ehdottaa muun muassa generoituja keskusteluotsikoita, projektin
nimeen lyhennettyä polkua, käyttäjänimen piilottamista, Pi-nimeä puhujatunnisteena
sekä harnessin ja resume-ID:n siirtämistä lisätietoihin. Nämä säilyvät täällä
katselmointia varten. Ne eivät ole design systemin yleisiä sisältösääntöjä eivätkä
hyväksyttyjä tuotevaatimuksia.

Kun vedos käyttää yhteisiä värejä tai komponentteja, pidä varsinainen määrittely
`design-system/`-hakemistossa. Tätä toimitusta saa päivittää katselmoinnin
korjauskierroksella, mutta sen näkymäkohtaisia sääntöjä ei kopioida design systemin
yleisiksi säännöiksi.
