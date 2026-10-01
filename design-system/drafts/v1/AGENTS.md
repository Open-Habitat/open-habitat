# Keskustelukäyttöliittymän ensimmäinen suunnittelutoimitus

Tämä hakemisto säilyttää UI v0.1 -suunnittelutoimitusten vedokset, klikattavat
simulaatiot ja toimituksiin kuuluneet taustatiedostot. Keskusteludesign
vastaanotettiin 2026-09-20 ja workspace-/navigointidesign 2026-09-21. Aineisto on
suunnittelukierroksen referenssiä, ei yhteisen design systemin lähde eikä
hyväksytty toteutusmäärittely.

- Yhteiset tokenit ja komponentit ovat [`../../`](../../).
- Tuotteen arkkitehtuuri on [`../../../docs/architecture.md`](../../../docs/architecture.md).
- Vastaanottoarvio ja avoimet kysymykset ovat [`../../../issues/receive-designer-v1/review.md`](../../../issues/receive-designer-v1/review.md).
- Canonical designer-toimeksiannot ovat arkkitehtuuri-issuen
  `ui-design-*.md`-tiedostoissa. `toimeksianto/` säilyttää toimituksen mukana
  palautuneet kopiot vain toimituksen ymmärtämistä varten.

## Sisältö

- `vedokset/`: keskustelun pääpolku, tilakatalogit, yhteenveto ja ilmemääritys.
- `toimeksianto/`: keskustelutoimituksen mukana palautunut toimeksianto ja
  myöhempien ominaisuuksien liite.
- `workspaces/`: palvelin-, workspace- ja agenttinavigoinnin `AGENTS.md`-handoff,
  päävedos, A1–A9-yhteenveto ja vedosten paikallinen ajoympäristö.

Kaikki vedosten tapahtumat ovat simuloituja. Vedos ei todista Pi-adapterin,
daemonin, GitHub-kytkennän tai muun taustatoiminnon tukea. Jari hyväksyi
workspace- ja agenttinavigoinnin handoffissa kuvatut toiminnot ensimmäisen
funktionaalisen MVP-version suunnaksi 2026-09-21; tarkat päätökset ja tekniset
rajat ovat [`../../../issues/receive-designer-v1/review.md`](../../../issues/receive-designer-v1/review.md)-tiedostossa. Keskustelun jonotus, kesken
vuoron ohjaus ja muut Pi-rajapinnasta riippuvat ehdotukset odottavat edelleen
adapterikoetta ja yhteistä UI-katselmointia.

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
