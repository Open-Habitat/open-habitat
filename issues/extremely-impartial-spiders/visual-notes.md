# Kierros 4 · kohdat 2–4 · visuaalinen tarkistus

Kaikki kuvat ovat **synteettisestä loopback-laboratoriosta**, eivät live-palvelimelta. Jari ei ole vielä katselmoinut kuvia. Headless Chromium 1440 × 900, keksitty Alice ja fixture-historiat. [Ennen: paluu](round4-before-home.png) → [jälkeen](round4-after-home.png); [ennen: GitHub-vaihe](round4-before-github.png) → [jälkeen](round4-after-github.png); [ennen: Pi-vaihe](round4-before-pi.png) → [jälkeen](round4-after-pi.png).

390 × 844 -tarkistus: [paluu](round4-narrow-home.png), [GitHub](round4-narrow-github.png), [Pi](round4-narrow-pi.png). Painikkeet pysyvät näkyvissä ja järjestys toimii myös kapealla näytöllä.

Paluuosion otsikko ja linkin luku-/jatkomerkintä vastaavat reittiä. Otsikko saa edelleen ohjelmallisen fokuksen, mutta musta/teal kehys ei peitä sitä. Pi:n aloittava painike vetää huomion ennen erillistä, edelleen punaista keskeytystä; GitHub-vaiheessa keskeytys on samalla tavalla kauempana etenemisestä. Näppäimistön ohjainfokus tarkistettiin erikseen selaintestissä (ei pelkästä kuvasta). Historiaa avaava linkki ei aloita agenttia.

Rajat: laboratoriossa ei ole oikeaa OAuthia, Pi:tä eikä UID-eristystä. Kuvat eivät todista ruudunlukijan käyttökokemusta tai Jarin visuaalista hyväksyntää. Jatkettavan selainkeskustelun tekstimerkintä on testattu koodipolulla, ei näillä luku-only-fixturekuvilla.

---

# Tumma teema · synteettisen laboratorion havainnot

**Ei vielä Jarin katselmoima.** Kuvat ovat vain synteettisestä TLS-laboratoriosta (Chromium `colorScheme: dark`, keksitty Alice, ei oikeaa kotihakemistoa tai palvelinta). Aiempi ennen-kuva on [auditin theme-system-dark.avif](screenshots/theme-system-dark.avif): tumma järjestelmäasetus jätti tuotantosovelluksen vaaleaksi.

Korjauksen jälkeen [kirjautuminen](dark-login.png), [repojen valinta](dark-chooser.png), [ChatGPT-kirjautuminen](dark-pi-signin.png), [työtilat](dark-workspaces.png), [tilivalikko](dark-menu.png), [historia](dark-history.png) ja [asetukset](dark-settings.png) käyttävät samaa tummaa tokenistoa. Teksti, rajaukset, painikkeet ja ilmoitus näkyvät taustastaan erottuvina; en havainnut tässä otoksessa uutta kovakoodattua väripoikkeamaa. Tilivalikossa näkyy nykyinen valinta. Otsikoiden fokuskehys ja Pi-kirjautumisen painikkeiden hierarkia korjattiin erillisessä kierroksen 4 työssä (yllä); kuvissa näkyy sen edeltävä versio.

Lisäksi tarkistin laboratoriossa työn etenemisen, keskeytysvahvistuksen ja vanhentuneen näkymän (työkuvat vain ohitetussa `.cache/lab/`-hakemistossa). Storybookin tummissa Markdown-, keskeneräinen työ-, keskeytys-, historia- ja katkostoryissa löytyi oikea kontrastivika: canvas peri vaalean rungon tekstivärin, vaikka kortin tokenitausta oli tumma. [Ennen](dark-storybook-before.png) teksti oli käytännössä lukukelvoton; [korjauksen jälkeen](dark-storybook-after.png) canvas käyttää tausta- ja tekstiväritokeneita. Tarkistin myös Storybookin tumman `data-theme`-alueen lasketut värit (`rgb(20, 23, 26)` / `rgb(230, 233, 236)`). Tuotantobundlen järjestelmä-, oma valinta- ja järjestelmämuutoskäyttäytyminen on tarkistettu Playwrightilla. Kuvat eivät todista kaikkien mahdollisten tilojen kontrastia tai käyttäjän hyväksyntää.
