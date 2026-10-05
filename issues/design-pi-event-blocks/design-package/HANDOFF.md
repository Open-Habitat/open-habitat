# Pi-keskustelulohkojen palautuksen sovitus · 5.10.2026

Lähtöaineisto: [pyyntö](REQUEST.md), [toimitettu paketti](RESULT.md), [palautettu handoff sellaisenaan](RETURNED-HANDOFF.md) ja [alustava lähdearvio](ASSESSMENT.md). Jari vahvisti palautuksen neljä tuotevalintaa tässä keskustelussa. Hän hyväksyi etenemisen korjaamalla faktarajat; hyväksyntä koskee esityssuuntaa, ei ehdotettuja API-rajapintoja eikä sitä, että synteettiset esimerkit olisivat toteutettuja.

**Nykyinen design:** [Pi-keskustelun lohkot](../../../design-system/drafts/Pi-keskustelun%20lohkot.dc.html), [käytös](../../../design-system/design.md) ja [komponenttikartta](../../../design-system/components.md). Vedos on palautettu prototyyppi sovitettuna natiivifaktoihin; ehdotettuja CSS-tokeneita tai React-proppeja ei siirretty tuotantoon. Kontrollit ja agentin yleistila ovat edelleen [kontrollivedoksen](../../../design-system/drafts/Kontrollitilat%20ja%20agentin%20tila.dc.html) vastuulla.

## Vahvistetut valinnat

- Käyttäjän pitkä viesti supistuu kahdeksaan riviin, mutta sen voi avata kokonaan.
- Peräkkäisten työkalukutsujen ryhmittely lykätään. Toteuta ensin yksi eheä kutsu/eteneminen/tulos `toolCallId`:n mukaan.
- `edit` näyttää nyt sallitut argumentit. Diff-näkymä lykätään erilliseen perusteltuun työhön (ei tähän rakenneta diff-moottoria).
- Bash-esikatselu avautuu oletuksena loppuun, muiden työkalujen alkuun. Käyttäjän Alku/Loppu-valinta muistetaan **työkalukohtaisesti** myöhempiä saman työkalun tuloksia varten; se ei korvaa natiivisisältöä.

## Faktarajat ja tehdyt korjaukset

- Palautus lupasi ratkaistuista kysymyksistä pysyvän `QuestionRecord`-rivin. Natiivi Pi-sessio ei tallenna ratkaisua vahvistettuun historiaan. Avoimen pyynnön saa näyttää tilapäisesti nykyisen dialogin rinnalla; ratkenneet esimerkkirivit on nimetty ehdollisiksi, eikä tuotanto saa tehdä niistä uutta historiavarastoa. Erityisesti tuntematon lopputila ei ole sama kuin peruttu.
- `agent_settled` voi vahvistaa työn asettumisen. `turn_end`, automaattinen retry ja assistentin viestit ovat eri tasoisia; mallia, tokenkäyttöä tai pysähtymissyytä ei summata keksityksi koko työn metatiedoksi. Vedoksen viimeisen viestin malli ja ulostulotokenit on siksi nimetty viimeisen vastauksen tiedoiksi. Poissa olevaa vahvistusta ei esitetä valmistumisena.
- Bash-työkalun tekstissä voi lukea `Command exited with code 1`, mutta se ei ole turvallisesti projisoitu tyypitetty exit-kenttä; status esitetään vain vahvistetun `isError`-tiedon mukaan. Paikallisen käyttäjäkomennon tyypitetty exit on eri asia. Tarkka Pi-katkaisu, tuloksen kokonaisrivimäärä, kysymyksen countdown, laajennuksen lähde ja merkinnän kohde ovat ehdollisia, kunnes niiden turvallinen natiivilähde on osoitettu. Koko sisältö haetaan revisiotarkistetulla rajatulla lohkoluvulla, ei `fullOutputPath`-polusta.
- Prototyypin 11-vaiheinen animaatio, ehdotetut nimet ja tokenit ovat esitysmalleja, eivät hostin tapahtumatestit tai hyväksytyt komponentti-API:t.

[Visuaalinen vertailuhuomio](comparison/NOTES.md) sisältää vaalean työpöydän ja tumman puhelimen nykyvedosotokset sekä vanhojen synteettisten typed-esimerkkien rajat. Sisältö ja rajaus poikkeavat, joten niitä ei väitetä täsmäpareiksi. Vastaavat vedos–lab-parit sekä puuttuvat tilat kuuluvat toteutusissueen `@apply-pi-block-design` yleisen `@compare-draft-fidelity`-polun jälkeen.

Paketin 84 onnistunutta kaappausta mittaavat aikaisemman tuotantoinventaarion esittämistä, eivät valmiin designin toteutusta. 120 esitysaukkoa ja 110 sovittamatonta muutosmerkintää jäävät näkyviin. Samoin saavutettavuus, zoom ja natiivi live→historia-vastaavuus ovat vielä avoimia tuotantotestejä. Tarkennusten vuoksi design-kierroksen voi päättää suunnitteluna, ei valmiina UI:na.
