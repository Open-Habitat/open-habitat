# Selainpolku v2: toteutuksen katselmointi ja seuraavat muutokset

**Mikä tämä on.** Native Agent Host (työnimi Omega Habitat) on suomenkielinen,
ensisijaisesti työpöytäselaimella käytettävä väylä ihmisen omiin
Linux-palvelimen työtiloihin ja natiiviin Pi-agenttiin. Jokaisella ihmisellä
on oma Unix-käyttäjä; Git, Pi:n historia ja tunnukset pysyvät natiiveissa
työkaluissa, ja samat istunnot ovat käytettävissä myös SSH:n ja tmuxin kautta.
Selain on uusi tapa päästä samoihin istuntoihin, ei erillinen agenttialusta.

**Mitä on tapahtunut.** Teit edellisellä kierroksella selainpolku v2:n
(vedokset ja handoff ovat paketissa kohdassa
`design-artifacts/design-system/drafts/v2/`; v1 on viereisessä `v1/`-kansiossa). Olemme
toteuttaneet sen ensimmäisen kerran. Ensimmäinen toteutus noudatti mittoja mutta
rikkoi sommittelun ja ilmeen säännöt (mm. "vain poikkeama näkyy"): tilat
kirjoitettiin auki selitysteksteinä. Keskustelunäkymä on sen jälkeen korjattu
sääntöjen mukaiseksi; sivupalkin, tilivalikon, paluunäkymän ja asetusten
korjaus on vielä tekemättä, ja onboarding on edelleen v1-ajan toteutus. Kuvat
kertovat tämän rehellisesti.

**Mitä pyydämme.** Arviomme toteutuksen eroista on paketissa
(`design-artifacts/issues/compare-v2-pairs/index.md` ja
`design-artifacts/issues/recut-ui-foundation/component-map.md`); se on
katselmoitavaksi, ei sinua sitovaksi. Katso toteutusta omien vedostesi vieressä ja kerro, mitä
kannattaa muuttaa ja miten. `rendered-pages/` sisältää vedos/toteutus-pareja:
`issues/polish-v2-conversation/pairs/` (uusin, korjattu keskustelu) ja
`issues/compare-v2-pairs/` (koko polku ennen korjauskierrosta). Toteutuksen
kuvat ovat synteettisestä labista, jossa on keksitty käyttäjä ja keksityt
työtilat; ne ovat nykytilan näyttö, eivät hyväksytty tavoite.

1. **Keskustelu.** Mitkä erot vedokseen ovat vielä merkittäviä
   (työskentely, jono, työkalurivit, valmis vuoro, hylätty ja epävarma
   lähetys, katkos, vain luku, uusi keskustelu), ja missä vedos itse kannattaa
   tarkentaa nyt, kun näet sen oikealla datalla.
2. **Sivupalkki, tilivalikko, paluunäkymä ja asetukset.** Nämä ovat vielä
   ennen korjausta. Sano, mitä niissä on pielessä sääntöjesi valossa, niin
   korjaamme ne samalla kertaa.
3. **Uudet tilat, joita vedoksissa ei ollut:**
   - **Pi:n dialogi.** Pi:n laajennus voi kesken vuoron kysyä jotain
     (vahvistus, valinta, tekstikenttä) ja odottaa vastausta. Jari päätti, että
     selaimessa dialogiin voi vastata ja sen voi peruuttaa. Vastaus lähtee
     kerran; jos sen perillemenosta ei ole varmuutta, se näytetään epävarmana
     eikä sitä lähetetä uudelleen. Useampi dialogi voi olla jonossa.
   - **Jatka päättynyttä keskustelua.** Päättynyt selainkeskustelu voidaan
     jatkaa vain, kun palvelin vahvistaa sen turvalliseksi. Muuten historia on
     vain luettavissa (terminaalista aloitettu historia aina).
   - **Tilin nimi ja sähköposti** tulevat GitHubista; jos GitHub ei anna niitä,
     onboarding kysyy ne. Suunnittele tämä kysely onboardingiin.
4. **Onboarding** v2:n mukaan, sovituin poikkeuksin: kaikki repot näkyvät
   oletuksena ja aikarajaus on käyttäjän valinta; epävarma hakutulos näkyy
   eikä sitä piiloteta.

**Rajat.** Älä keksi tilatietoa, jota palvelin ei anna (käynnissä-määriä,
aikaleimoja, yhteyden tilaa): suunnittele, miltä näkymä näyttää ilman sitä.
Älä ehdota hiljaista uudelleenlähetystä, yksittäisen jonorivin perumista tai
kirjoitusoikeutta terminaalihistoriaan. Agentin ja hostin teksti on
epäluotettavaa ja näytetään inerttinä. `docs/product.md`, `docs/ui.md` ja
`design-system/production-v1.md` kuvaavat sovitun toiminnan; erottele
nykyinen toteutus, sovittu tavoite ja oma ehdotuksesi.

**Palauta.**
1. Lista muutoksista näkymittäin, kukin nykyisen komponentin nimellä
   (`ui-code/web/src/components/`) ja perusteluineen: mikä kuvassa on väärin,
   mitä se tilalle, ja koskeeko muutos yhteistä komponenttia vai yhtä näkymää.
2. Staattiset HTML/CSS-näkymät uusille tiloille (dialogi, jatkaminen,
   nimen kysely onboardingissa) ja kohdille, joissa vedosta kannattaa muuttaa;
   vaalea ja tumma, 1440 px ja 390 px. Käytä `design-system/tokens/`-tokeneita;
   jos ehdotat token-muutosta, anna arvot molemmille teemoille.
3. Merkitse erikseen asiat, jotka tarvitsevat Jarin tuotepäätöksen.
