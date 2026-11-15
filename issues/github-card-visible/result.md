# Tulos

Hyväksytty kierroksen 1 **2 Näkyvissä** on tuotannon GitHub-kortissa ilman kokeellista kytkintä. Tunnus ja tila ovat kortin alussa, työnkulkujen tila omalla lyhyellä rivillään, oikeudet sekä uudelleenkirjautuminen ja katkaisu kortin lopussa. Varoitus työnkulkujen pääsystä repon salaisuuksiin säilyy. Kesken jääneen kirjautumisen voi perua tai yrittää uudelleen.

**Katkaise yhteys…** avaa ikkunan myös vanhalla kirjautumisella. **Vahvista GitHubilla** käyttää tavallista GitHub-kirjautumista ja palauttaa saman käyttäjän samaan ikkunaan. Paluu tekee uuden tilan tarkistuksen, ei katkaisua. Vasta ihmisen **Katkaise yhteys** lähettää daemonin uuden vahvistustunnisteen. Gatewayn viiden minuutin sääntö, CSRF-tarkistus ja daemonin kahden minuutin vahvistustunniste ovat ennallaan. Peru poistaa myös keskeneräisen paluuaikeen; hitaan tarkistuspyynnön voi perua, ja epävarmaa kirjoitusta ei toisteta automaattisesti.

Selitystilan kortit ja `open-habitat-ui`-viitteet on päivitetty. Viitteiden generaattori korjasi samalla kaksi jo ennestään lähteestä jäljessä ollutta EditorFileTree-viitettä; niiden tuotantokoodia ei muutettu.

## Tarkistukset

- `./scripts/test-focused.sh --area web`: 225 testitiedostoa, 1772 testiä sekä lintti, tyypit ja sanastot.
- Kohdennettu selainajo: `github-card.spec.ts`, `github-workflow-scope.spec.ts`, `account-settings.spec.ts`: 22 testiä. Samat kolme tiedostoa myös kolmesti toistettuina: 66/66.
- `lab-github-card.spec.ts`: 6 tapausta, leveydet 1440 ja 390, suomi sekä US- ja UK-englanti; päivä-, yö- ja kontrastiteema. Selitystilan kohdistus ja pysyvien toimintojen esto tarkistettu sekä vanhalla että tuoreella kirjautumisella. Myös kolmesti toistettu ajo: 18/18.
- Oikeudet pois/päällä/puuttuvat/tuntemattomat, kesken jääneen kirjautumisen Peru/Yritä uudelleen, vanhentunut ja puuttuva yhteys sekä vanha → OAuth → tuore → erillinen katkaisupainallus on katettu yksikkö- ja selaintesteillä.
- Synteettiset kuvaparit `card-*.png`/`.html` ja `dialog-*.png`/`.html` näyttävät kortin ja katkaisuikkunan Selitystilassa. Kuvista tarkastettu asettelu ja kieliversiot. HTML:t ovat itsenäisiä, passiivisia näkymiä.
- `python3 scripts/generate-ui-reference.py --check` ja `git diff --check`.

Selainajo käyttää oikeaa gatewayta ja synteettistä GitHub-kirjautumista. Testihostissa ei ole natiivin gh-katkaisun handleria: testi korvaa vain gatewayn läpäisseen downstream-404:n synteettisellä havainnolla/vastauksella. Siksi tämä todistaa käyttöliittymän koko polun, gatewayn vanhan kirjautumisen hylkäyksen, uuden istunnon ja CSRF:n käytön, ei oikean GitHub-tokenin poistumista. Gatewayn ja daemonin koodia tai sopimuksia ei muutettu; Go-testejä, koko selaintestisarjaa tai clean gatea ei ajettu. Oikean OAuth-sovelluksen käyttö jää live-tarkistukseen.

## Katselmointi

Kohdennettu oma katselmointi sekä `claude-fable-5-2` OAuth-paluusta. Löydökset arvioitiin ja korjattiin: peruutuksessa jäljelle jäävä paluumerkintä, hitaan GETin aikana estetty Peru ja StrictModen päällekkäiset havaintopyynnöt. `gpt-6-astra` tarkisti korjaukset sekä sen, ettei paluu tee POSTia tai siirrä edellisen käyttäjän valtuutta. Ei avoimia löydöksiä eikä jatkoissueita.

Selitystilan selaintesti paljasti lisäksi, että sama DOM-painike säilytti edellisen toimintonsa selityksen, kun tarkistus vaihtui vahvistukseksi. Katkaisuikkunan eri toiminnoilla on nyt omat React-avaimensa. Testi todistaa sekä oikean selityksen että kirjoittavien toimintojen eston.

Kehityksen aikana korjattiin myös vanhaan sanamuotoon sidottu selainväite, OAuth-siirtymän aikainen testin reitityskilpa ja puhelintestin navigaatiolaatikon sulkeminen. Pi SDK -testiriippuvuus asennettiin puuttuvan fixture-virheen jälkeen. Lopulliset ajot yllä ovat vihreät.

## Decisions for later review

- **Paluuaie on välilehtikohtainen, kertakäyttöinen ja käyttäjään sidottu sessionStorage-merkintä, voimassa enintään viisi minuuttia.** Vaihtoehto oli uusi paluukyselyparametri; gateway hyväksyy vain tarkat asetussivujen polut. Merkintä ei sisällä valtuuksia tai havaintotunnistetta eikä muuta palvelimen turvarajaa. Jos tallennus ei ole käytettävissä, kirjautuminen toimii ja ihminen avaa ikkunan uudelleen.
- **Tavallinen kirjautuminen, ei reconnect.** Se säilyttää toimivan gh-valtuutuksen sen sijaan, että korvaisi sen juuri ennen poistamispäätöstä.
- **Oikeusrivi kuvaa havaittuja oikeuksia.** Prototyypin vakio-oikeuksien sijaan puuttuvaa oikeutta ei luvata; tuntematon oikeusnimi näytetään sellaisenaan ja lukematon lista epävarmana.
- **GitHubin sovellusasetusten linkki on mukana ikkunassa**, kuten hyväksytyssä prototyypissä. Se avaa uuden välilehden eikä peru lupaa käyttäjän puolesta.
- **Peru toimii tarkistuksen aikana, mutta ei keskeneräisen poistopyynnön aikana.** Vaihtoehto oli estää koko ikkunan sulkeminen myös lukiessa; hidas verkko ei ole syy estää perumista.

**Live check:** Avaa testipalvelimella Asetukset › Koodipalvelut. Tarkista GitHub-kortin lyhyet tekstit ja näkyvät alatoiminnot. Kun GitHub-kirjautumisesta on yli viisi minuuttia, paina Katkaise yhteys… → Vahvista GitHubilla. Kirjautumisen jälkeen saman katkaisuikkunan pitää palata; yhteyttä ei saa poistaa ennen erillistä Katkaise yhteys -painallusta. Peru jättää yhteyden toimimaan. Kokeile poistamista vain tilillä, jonka palvelinvaltuutuksen haluat oikeasti poistaa.
