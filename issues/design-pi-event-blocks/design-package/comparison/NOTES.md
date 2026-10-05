# Pi-lohkojen palautus ja nykyinen esitys

Lähde: palautus `Pi-keskustelun lohkovedos.zip` 5.10.2026; lähtöpaketti commitista `43b3a8b`. Hyväksytty ja natiivifaktoihin sovitettu vedos on `design-system/drafts/Pi-keskustelun lohkot.dc.html`. Nämä kaappaukset on tehty tämän vedoksen synteettisen tarinan *asettuneesta* vaiheesta Chromiumissa, vaaleana työpöytäpalstana (828 px, nimetty 1440 × 900 -asettelussa) ja tummana 390 px puhelinpalstana. Kummassakaan ei havaittu sivuvirheitä. Ne ovat vedoksen otoksia, eivät labin tai tuotannon kuvia.

- [Uusi vaalea työpöytäpalsta](pi-block-desktop-light.avif)
- [Uusi tumma puhelinpalsta](pi-block-phone-dark.avif)
- [Vanha synteettinen typed-desktop-light](../../../carry-typed-pi-events/typed-provisional-desktop-light.png)
- [Vanha synteettinen typed-phone-dark](../../../carry-typed-pi-events/typed-provisional-phone-dark.png)

Nämä ovat **saman teemaiset ja suunnilleen saman näyttöluokan esimerkit, mutta eivät saman sisällön/tilan vertailuparit**. Vanha esittää toista kysymystä ja toista Pi-sessiota, täyttä sovelluskehystä, erillistä työkalukutsun riviä ja sen jälkeistä tulosta, toistuvaa PI-otsaketta sekä ”odottaa viestiäsi” -alariviä. Uusi esittää yhtä kuvallista käyttäjän viestiä ja järjestyksessä kulkevaa README-lukua, testikomentoa, virhekatkelmaa ja vastausta yhden PI-otsakkeen alla; työkalun kutsu ja tulos ovat sama rivi. Uuden puhelinpalstan 390 px ei ole kokonainen sovellusikkuna. Muuttunut data ja rajaus estävät mittojen, lukunopeuden ja yksittäisten komponenttien pikselivastaavuuden väittämisen.

**Auki tuotantoon sovitettavaksi:** sisältöä/tilaa/teemaa/viewportia täsmäävät vedos–lab-parit sekä computed-style- ja kontrollivertailu. `@compare-draft-fidelity` rakentaa yleisen vertailupolun ensin; `@apply-pi-block-design` lisää tätä vedosta vastaavat fixturet, blokki- ja live→history-tilat sekä erot. Kattavuuspaketin 120 esitysaukkoa (30 tilaa × 4 yhdistelmää) ja 110 `UNRESOLVED mapping` -muutosmerkintää eivät ratkea näillä kahdella kuvalla. Katkoviivalla tai sanalla ehdollisiksi merkityt tuloksen kokonaisrivimäärä, Pi-katkaisu ja ratkaistut kysymykset eivät ole hostin todistamia faktoja. Tämä arvio ei todenna 200 % zoomia, näppäimistökäyttöä, saavutettavuutta eikä oikeaa sessioreplayta.
