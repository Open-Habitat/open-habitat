# Tulos

[index.html](index.html) kokoaa kolme tutkimusta suomeksi. Jokaisessa ovat löydös ja näytön rajaus, päätöksen tuote- ja arkkitehtinäkymä, kustannus ja tekemättä jättämisen seuraus, suositus ja yksi kysymys Jarille. Suositukset eivät muutu hyväksytyiksi päätöksiksi. Alkuperäisiä tutkimuksia tai tuotetta ei muutettu.

Teksti itsearvioitiin kerran kaikkien kolmen report.md:n, kahden result.md:n ja item.md-päätösmerkintöjen perusteella. Erityisesti erotettiin natiivikokeet selainpolkujen päättelystä, yhteinen gatewayn luottamusriski löydetystä hyväksikäytöstä ja resurssikatto Pi:n päivityksessä säilymisestä. Nykykoodista tarkistettiin daemon-unitin Slice-asetuksen puuttuminen, OOMPolicy=continue, transportin GatewayUID-tarkistus sekä provisionin shadow/PAM-viitteiden puuttuminen. Muistimitoitusta tai eston viivettä ei keksitty päätökseksi.

Playwright/Chromium avasi paikallisen sivun 390 ja 1280 pikselin leveyksillä: ei vaakaylivuotoa, kolme osiota, ei rikkoutuneita sisäisiä ankkureita eikä verkkopyyntöjä. CSS on inline, skriptejä ei ole. `git diff --check` läpäisi. Tuotetestejä ei ajettu, koska tuotetta ei muutettu.

Näkymä tarjottiin onnistuneesti keskusteluun `pi:90e52a18-12fa-4f71-bc6a-8c8f1a1ec549`. Tunnus: `vxwobhjtu7mi7ewgiw4igffi5do`. Tarjous tallentui; se ei todista, että Jari avasi sen. Jäädytetty näkymä säilyy worktreen poiston jälkeen.

Testiympäristön havainto: oletettu `/opt/open-habitat/profiles/browser` ei ollut asennettu eikä Python-playwrightia löytynyt. Käytettiin olemassa olevaa päätyöpuun Node-Playwrightia ja sen valmista selainvälimuistia; mitään ei asennettu.
