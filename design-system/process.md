# Design-kierros

Jari suunnittelee käyttöliittymän ulkoasun design-tekoälyn kanssa. Repo antaa
keskustelulle ajantasaisen kuvan tuotteesta ja ottaa palautetun designin
vastaan. Kierroksen tarkoitus on pitää vedokset, [designin kuvaus](design.md)
ja toteutus samoina: designer tietää, mitä sovelluksessa on, ja toteuttaja
pystyy osoittamaan, miten tulos vastaa suunnitelmaa.

## Designin lähteet

`drafts/` sisältää nykyisen ulkoasun: sommittelun, mitat ja esitystilat.
[design.md](design.md) täydentää vedoksia käytöksellä, rehellisyysvaatimuksilla
sekä Jarin kanssa sovituilla poikkeamilla perusteluineen. Tuotantokomponentit,
tokenit ja Storybook toteuttavat tätä designia. Toteutuksen ero vedokseen on
korjattavaa tai Jarin ratkaistava poikkeama; se ei itsessään muuta suunnitelmaa.

Designia päivitetään samoihin tiedostoihin. Aiemmat versiot jäävät
Git-historiaan, jotta seuraavalla kierroksella on yksi suunnittelukohde.
Jos vedos ja sovittu käytös ovat ristiriidassa, handoffin arvio selvittää,
mikä muuttuu ja miksi.

## Mitä designer saa

Designer ei näe sovellusta. Paketin lähtökohta on versioitu tilainventaario:
näkymät ja käyttäjälle näkyvät tilat, myös virheet, epävarmuus ja kontrollien
olennaiset vuorovaikutustilat, puhelimessa ja työpöydällä, molemmissa teemoissa.
Inventaariota ylläpitää paketin kokoaja, ei kehittäjä: paketti kootaan omassa
worktreessä, joka lukee edellisen paketin commitista alkaen tehdyt muutokset
ja täsmäyttää inventaarion koodin nykytilaan (reitit, storyt, labin
fixture-skenaariot). Uusi tila löytyy siis koodista paketin kokoamisen
yhteydessä, eikä kenenkään tarvitse muistaa lisätä sitä. Gatessa tätä ei
tarkisteta. Labista puuttuva tila näkyy kattavuusaukkona, jotta se ei katoa
suunnittelusta.

Inventaarion toistettavat tilat tallennetaan yhdellä komennolla synteettisestä
labista. Designer työstää HTML:ää, joten pääaineisto on itsenäisesti avautuva
HTML-palanen: tilaa esittävä alue tyyleineen, fontteineen ja ulkoasun
säilyttämiseen tarvittavine ympäristöineen. Kierroksen fokusnäkymistä mukana
on koko sivu. Kuvat palvelevat ihmisen katselmointia. Tuotetut tallenteet ovat
uudelleen luotavaa aineistoa; niitä ei commitoida, ja paketti kirjaa lähdecommitin.

Paketti näyttää myös, mikä muuttui edellisen paketin commitista, ja yhdistää
muutokset tiloihin ja tallenteisiin. Paketin `MANIFEST.md` kirjaa commitin,
johon asti se on ajan tasalla; sama commit kirjataan kierroksen issueen ja
[rounds.md](rounds.md)-tiedostoon, josta seuraava kokoaja aloittaa. Kun
riviä ei vielä ole, paketti esittää koko inventaarion uutena ja aukkolistan
muutoslistan sijaan. Git-historia antaa muutokset, inventaario
niiden yhteyden käyttöliittymään. Designeriltä pyydetään kommentti jokaiseen
esitettyyn muutokseen. Aukot näkyvät molempiin suuntiin: toteutettu tila ilman
vedosta ja vedoksen tila ilman toteutusta.

`design-package`-skilli kokoaa zip-paketin inventaariosta, tallenteista,
muutos- ja aukkolistoista, nykyisestä designista, komponenteista, tokeneista ja
viitatuista issueista. Kierroksen issueen jäävä brief kertoo fokuksen ja
ongelmat perusteluineen. Pysyvät odotukset, kuten kontrollien olennaisten
tilojen suunnittelu, kuuluvat skillin ylläpidettyyn ohjeeseen. Jari vie paketin
design-työkaluun ja käy suunnittelukeskustelun siellä.

Designer suunnittelee jokaisen keskustelulohkon esitystilat. Agentti kartoittaa
lohkojen merkitykset ja toimittaa esimerkit suunnitteluaineistoksi, sitten
toteuttaa suunnitelmat yhteisiin komponentteihin ja katalogiin. Vedokset ovat
simuloidulla tiedolla toimivia sommittelumalleja; niiden prototyyppilogiikkaa
ei kopioida sovellukseen.

## Palautuksesta toteutukseksi

Palautuksen saavuttua paikannetaan ensin kierroksen issuen `REQUEST.md`,
`RESULT.md` ja paketin lähdecommit. Palautetut vedokset ja handoff-teksti
arvioidaan tähän pyyntöön nähden ennen toteutuksen suunnittelua. Arvio erottaa
sommittelun, tilojen merkitykset, hostin todettavissa olevat faktat ja
ehdotetun komponentti-API:n toisistaan. Se selittää ristiriidat sovitun
käytöksen tai rajapintojen kanssa sekä puuttuvan lähtötiedon aiheuttamat
väärinkäsitykset. Jarin kanssa sovitaan, mitä toteutetaan, lykätään tai
hylätään ja miksi, ennen kuin palautus korvaa nykyisen designin. Vedosten
esitystä verrataan edelliseen versioon tilakaappauksilla, koska HTML-diffi ei
kerro ulkoasun muutosta. Vain samalla sisällöllä ja tilalla otettuja kuvia
kutsutaan vastaaviksi vertailupareiksi; muuttuneet esimerkkitilat nimetään
erikseen.

Designissa löytyvä uusi toiminto tai ominaisuus kirjataan erikseen ehdokkaaksi
issueiden lajitteluun. Näin hyödyllinen löydös säilyy eikä vedoksen mukana
synny huomaamatta uutta tuotelupausta. Toteutusissuet johdetaan handoff-arviosta,
ja palautus päivittää yhteistä designia.

## Miten vastaavuus osoitetaan

Toteutus rakennetaan yhteisistä komponenteista ja tokeneista. Tilainventaarion
yhteydessä ylläpidetty maamerkkikartta yhdistää vedoksen ja tuotannon vastaavat
elementit. Samassa tilassa, sisällöllä, teemalla ja näyttöleveydellä verrataan
niiden laskettuja tyylejä ja mittoja sekä vuorovaikutteisten elementtien rooleja
ja nimiä. Väärä reunaviiva ja puuttuva painike päätyvät näin eroraporttiin.

Vertailun kohde on tarkoitettu, yhtenäinen design. Design-tekoäly tuottaa
HTML:ää ilman yhteisiä komponentteja, joten saman elementin eri esiintymiin
voi jäädä pieniä tahattomia mitta- ja tyylieroja. Ne sivuutetaan, kun yhteinen
ratkaisu käy ilmi vedoksista ja tokeneista. Tuotannon komponentti toteuttaa
ratkaisun johdonmukaisesti; jokaista vedoksen pikselipoikkeamaa ei kopioida
eikä hyväksytetä erikseen. Eroa arvioidaan sen merkityksen perusteella, sillä
myös tarkoituksellinen tilaero voi olla pieni.

Kierroksen issueen jäävät raportti ja rinnakkaiset kuvat vertailtuine
revisioineen. Sovittu poikkeama tunnistetaan design.md-viitteellä erilleen
korjattavista eroista. Puuttuva vertailutila on aukko, ei onnistunut vertailu.
Mittaus kertoo vertaamistaan ominaisuuksista; kuvat antavat Jarille kokonaisuuden
arvioitavaksi.

Kierros on valmis, kun vedokset ja design.md kuvaavat sovitun lopputuloksen
ja toteutuksen vertailussa ei ole ratkaisemattomia eroja. Keskeneräisessä
kierroksessa erot ja kattavuusaukot jäävät näkyviksi jatkotöiksi. Brief,
handoff-arvio ja vertailun tulos muodostavat seuraavan kierroksen lähtökohdan. Muu työ etenee
[työskentelyohjeen](../AGENTS-WORKFLOW.md) mukaan.

## Työkalujen nykytila

Tilainventaario ja palasten tallennus toteutetaan
[inventory-ui-states](../issues/inventory-ui-states/item.md)-issuessa,
mittausvertailu
[compare-draft-fidelity](../issues/compare-draft-fidelity/item.md)-issuessa.
Nykyinen labikaappaus tallentaa kokonaisen sivun HTML:n ja kuvan; paketin
kokoaja käyttää valittuja Gitissä olevia tallenteita. Siihen asti kierrokset
käyttävät tätä aineistoa ja käsin tehtyä arviota. Työkalutyö muuttaa kokoajan
käyttämään inventaariota ja uudelleen tuotettuja tallenteita.

[design-control-states](../issues/design-control-states/item.md) on ensimmäinen
tälle työtavalle suunniteltu kierros.
