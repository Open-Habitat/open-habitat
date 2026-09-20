# Keskustelunäkymän UI-kit

Tämä hakemisto näyttää, miten design systemin keskustelu- ja agenttikomponentit
voidaan koota yhdeksi staattiseksi näkymäksi. Se on komponenttien käyttöesimerkki,
ei hyväksytty tuotevaatimus eikä tuotannon frontend-toteutus.

`index.html` näyttää yhden agentin keskustelun yhdessä workspacessa yhdellä
palvelimella. Rakenne on:

1. **TopBar** — otsikko, projekti, havaittu tila, yhteys ja malli.
2. **Feed** — viestit ja työkalutapahtumat yhtenä luettavana palstana.
3. **Composer** — syöte, keskeytys ja toimituksessa ehdotetut lähetyskohteet.

Ensimmäisen keskusteludesignin klikattava pääpolku ja tilavedokset ovat tämän
hakemiston ulkopuolella vastaanottoissuen design-aineistossa. Paketoidussa
suunnittelutoimeksiannossa ne ovat `CONVERSATION-DESIGN/`-hakemistossa.

Käytä tyylejä vain hakemiston yläpuolisen design systemin `styles.css`-tiedoston
kautta. Älä siirrä esimerkin jonoa, ohjausta, nimiä tai muuta näkymäkohtaista
toimintaa yleiseksi komponenttisäännöksi ilman UI-katselmoinnin päätöstä.
