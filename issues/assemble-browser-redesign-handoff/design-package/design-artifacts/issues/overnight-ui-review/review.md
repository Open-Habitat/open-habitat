# Aamun katselmus — yön 29.–30.9. selainkäyttöliittymä

Yön aikana korjattiin Jarin pilot.12:ssa näkemät ensikäytön ja keskustelun kompastukset sekä seitsemän synteettisen UX-katselmuksen havainnot. GitHubin jälkeen repot voi valita tai ohittaa, Pi:n ChatGPT-kirjautuminen on oma vaiheensa, ja palaaja näkee, avautuuko keskustelu luettavaksi vai voiko sitä jatkaa. Uusi keskustelu alkaa kirjoituskentästä. Keskeneräinen työ näkyy, ja sen aikana voi valita lisäohjeen tai jonoon menevän viestin. Viestin hylkäys säilyttää luonnoksen; eri keskustelujen luonnokset ja lukukohta eivät sekoitu. Työkalutulokset ovat yhdessä avattavassa ryhmässä. Tulevan tuntemattoman kysymysmuodon teksti näkyy nyt ennen avattavaa alkuperäistä JSONia. Pi:n sisäinen valmistumiskehys ei enää näy viestinä. Historia muotoilee Markdownin ja koodin, katkos jättää jo vahvistetun sisällön luettavaksi ja teema seuraa oletuksena järjestelmää.

Kaikki kuvat ovat **synteettisiä**, paikallisen HTTPS-laboratorion tuotantobundlesta: keksitty Alice, valekirjautuminen, keksityt työtilat ja vale-Pi oikean keskusteluohjaimen läpi. Näkymät otettiin commitin `18bd6c7` tuotantobundlesta; alkuperäiset aamun kuvat ovat yhä `images/`-kansiossa. Uudet PNG- ja HTML-parit ovat `pages/`-kansiossa. HTML on passiivinen, offline avattava synteettinen tilannekuva; siinä ei voi navigoida eikä käyttää lomakkeita. Kuvat ja HTML:t ovat hetkikuvia, eivät Jarin hyväksyntä. Vertailun tausta: [kierrokset 1–7](../inordinately-zany-kick/audit.md) (aiemmat kuusi linkitetty siellä ja TODO.md:ssä).

## Ensikäyttö ja paluu

![Kirjautuminen](pages/signin.png) ([HTML](pages/signin.html)) ![Vapaaehtoinen repovalinta](pages/chooser.png) ([HTML](pages/chooser.html))

![Pi-kirjautumisen aloitus](pages/pi-start.png) ([HTML](pages/pi-start.html)) ![Synteettinen laitekoodi](pages/pi-code.png) ([HTML](pages/pi-code.html))

![Paluunäkymä](pages/landing.png) ([HTML](pages/landing.html)) ![Paluu kapealla näytöllä](pages/narrow-landing.png) ([HTML](pages/narrow-landing.html))

**Jari:** onko ensikäytön etenemisen ja keskeytyksen painotus sekä etusivun lupaus oikea?

## Lukeminen ja työskentely

![Työtila](pages/workspace.png) ([HTML](pages/workspace.html)) ![Natiivihistoria](pages/history.png) ([HTML](pages/history.html)) ![Kapea historia](pages/narrow-history.png) ([HTML](pages/narrow-history.html))

![Uusi keskustelu](pages/chat-new.png) ([HTML](pages/chat-new.html)) ![Pi työskentelee ja ohjausvalinnat](pages/chat-working.png) ([HTML](pages/chat-working.html)) ![Valmis vastaus](pages/chat-answer.png) ([HTML](pages/chat-answer.html))

![Ryhmitellyt työkalut](pages/tool-group.png) ([HTML](pages/tool-group.html)) ![Tuntematon sisältö ja avattava alkuperäinen tieto](pages/unknown-content.png) ([HTML](pages/unknown-content.html))

![Hylätty viesti, luonnos tallessa](pages/chat-rejected.png) ([HTML](pages/chat-rejected.html)) ![Keskustelun oma luonnos palasi](pages/draft-restored.png) ([HTML](pages/draft-restored.html)) ![Katkos: vanhentunut sisältö](pages/outage.png) ([HTML](pages/outage.html))

**Jari:** erottuvatko kesken oleva työ, valmis vastaus ja luettava historia toisistaan? Tuntemattomaan kysymykseen ei tarjota arvattua vastaustoimintoa.

## Teema ja asetukset

![Tilivalikko](pages/menu.png) ([HTML](pages/menu.html)) ![Tumma aloitus](pages/theme-dark.png) ([HTML](pages/theme-dark.html)) ![Tumma historia](pages/system-dark-history.png) ([HTML](pages/system-dark-history.html)) ![Asetukset](pages/settings.png) ([HTML](pages/settings.html))

**Jari:** toimiiko tumma kontrasti ja löydätkö teeman valikosta?

Koko sivun HTML-tallenteet sisältyvät kaikkiin 21 näkymään, myös osittaisina esitettyihin keskusteluihin. Tallenteiden yhteiskoko: **4.5 MiB**. Näitä ei ole vielä tarkistanut Jari.

## Auki ja todistamatta

- [@decide-account-display](../decide-account-display/item.md): vahvistettu tilin näyttönimi ja yhtenäinen keskustelureitti odottavat Jarin päätöstä. Geneerinen *Oma tili* ei yksilöi käyttäjää.
- [Rakenteinen muokkausdiffi](../complete-conversation-ui/result.md): nykyinen historia välittää tekstiä, ei todistettua Pi:n rakenteista edit-patchia. Sopimuspäätös tarvitaan ennen diff-tulkintaa.
- **pilot.13 ei ole asennettu.** Fleetrepo-commit `0eb57677` valmisteli uudelleenrakennetun testipalvelimen vaihto- ja palautusoperaattorin offline; Jarin hyväksyntä vaaditaan ennen live-vaihtoa. Palvelimella on edelleen pilot.12.
- Kuvat eivät osoita oikean GitHubin tai Pi:n toimintaa, eri UID:ien eristystä eivätkä live-palvelimen tilaa. Ne eivät yksin todenna jonon tyhjentymistä, lukukohdan säilymistä pitkässä historiassa, ruudunlukijaa tai koko näppäimistöpolkua. Käyttöliittymän testit ja puhdas CI-portti raportoidaan erikseen, ei kuvien ominaisuutena.
