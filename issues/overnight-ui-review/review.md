# Aamun katselmus — yön 29.–30.9. selainkäyttöliittymä

Yön aikana korjattiin Jarin pilot.12:ssa näkemät ensikäytön ja keskustelun kompastukset sekä seitsemän synteettisen UX-katselmuksen havainnot. GitHubin jälkeen repot voi valita tai ohittaa, Pi:n ChatGPT-kirjautuminen on oma vaiheensa, ja palaaja näkee, avautuuko keskustelu luettavaksi vai voiko sitä jatkaa. Uusi keskustelu alkaa kirjoituskentästä. Keskeneräinen työ näkyy, ja sen aikana voi valita lisäohjeen tai jonoon menevän viestin. Viestin hylkäys säilyttää luonnoksen; eri keskustelujen luonnokset ja lukukohta eivät sekoitu. Työkalutulokset ovat yhdessä avattavassa ryhmässä. Tulevan tuntemattoman kysymysmuodon teksti näkyy nyt ennen avattavaa alkuperäistä JSONia. Pi:n sisäinen valmistumiskehys ei enää näy viestinä. Historia muotoilee Markdownin ja koodin, katkos jättää jo vahvistetun sisällön luettavaksi ja teema seuraa oletuksena järjestelmää.

Kaikki kuvat ovat **synteettisiä**, paikallisen HTTPS-laboratorion tuotantobundlesta: keksitty Alice, valekirjautuminen, keksityt työtilat ja vale-Pi oikean keskusteluohjaimen läpi. Pohjana yön main-tilanne `371518c`, mukana viimeinen tuntemattoman sisällön korjaus `c0f58a9`; kuvat otettu saman korjauksen tuotantobundlesta. Kuvat ovat hetkikuvia, eivät Jarin hyväksyntä. Vertailun tausta: [kierrokset 1–7](../inordinately-zany-kick/audit.md) (aiemmat kuusi linkitetty siellä ja TODO.md:ssä).

## Ensikäyttö ja paluu

![Kirjautuminen](images/signin.avif) ![Vapaaehtoinen repovalinta](images/chooser.avif)

![Pi-kirjautumisen aloitus](images/pi-start.avif) ![Synteettinen laitekoodi](images/pi-code.avif)

![Paluunäkymä](images/landing.avif) ![Paluu kapealla näytöllä](images/narrow-landing.avif)

**Jari:** onko ensikäytön etenemisen ja keskeytyksen painotus sekä etusivun lupaus oikea?

## Lukeminen ja työskentely

![Työtila](images/workspace.avif) ![Natiivihistoria](images/history.avif) ![Kapea historia](images/narrow-history.avif)

![Uusi keskustelu](images/chat-new.avif) ![Pi työskentelee ja ohjausvalinnat](images/chat-working.avif) ![Valmis vastaus](images/chat-answer.avif)

![Ryhmitellyt työkalut](images/tool-group.avif) ![Tuntematon sisältö ja avattava alkuperäinen tieto](images/unknown-content.avif)

![Hylätty viesti, luonnos tallessa](images/chat-rejected.avif) ![Keskustelun oma luonnos palasi](images/draft-restored.avif) ![Katkos: vanhentunut sisältö](images/outage.avif)

**Jari:** erottuvatko kesken oleva työ, valmis vastaus ja luettava historia toisistaan? Tuntemattomaan kysymykseen ei tarjota arvattua vastaustoimintoa.

## Teema ja asetukset

![Tilivalikko](images/menu.avif) ![Tumma aloitus](images/theme-dark.avif) ![Tumma historia](images/system-dark-history.avif) ![Asetukset](images/settings.avif)

**Jari:** toimiiko tumma kontrasti ja löydätkö teeman valikosta?

## Auki ja todistamatta

- [@decide-account-display](../decide-account-display/item.md): vahvistettu tilin näyttönimi ja yhtenäinen keskustelureitti odottavat Jarin päätöstä. Geneerinen *Oma tili* ei yksilöi käyttäjää.
- [Rakenteinen muokkausdiffi](../complete-conversation-ui/result.md): nykyinen historia välittää tekstiä, ei todistettua Pi:n rakenteista edit-patchia. Sopimuspäätös tarvitaan ennen diff-tulkintaa.
- **pilot.13 ei ole asennettu.** Fleetrepo-commit `0eb57677` valmisteli uudelleenrakennetun testipalvelimen vaihto- ja palautusoperaattorin offline; Jarin hyväksyntä vaaditaan ennen live-vaihtoa. Palvelimella on edelleen pilot.12.
- Kuvat eivät osoita oikean GitHubin tai Pi:n toimintaa, eri UID:ien eristystä eivätkä live-palvelimen tilaa. Ne eivät yksin todenna jonon tyhjentymistä, lukukohdan säilymistä pitkässä historiassa, ruudunlukijaa tai koko näppäimistöpolkua. Käyttöliittymän testit ja puhdas CI-portti raportoidaan erikseen, ei kuvien ominaisuutena.
