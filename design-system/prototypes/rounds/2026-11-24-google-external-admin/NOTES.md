# Google ja henkilökohtaiset tilit, ylläpitäjä – kierros 1

Issue `google-personal-accounts`. Suunnat, aukot, suositus ja kysymykset ovat
issuen `round-external-admin.md`:ssä.

Valitsimessa Nyt on tuotannon nykyiset Google-näkymät kuvina synteettisestä
labista (ylläpitäjä ja henkilö, fi, 1440 ja 390, vaalea). Kuvat eivät ole
puussa: `build.mjs` upottaa ne rakennettuun sivuun kaappaushakemistosta.
Suunnat A, B ja C käyttävät tuotannon `ServerIntegrations`-sivua
muuttamattomana. Ne lisäävät Google-rivin nimisoluun yhden rivin
(portaalilla) ja omat ikkunansa tuotannon palasista: `Modalish`, `Progress`,
`Path`, `Copy`, `Segmented`, `Badge`, `GoogleShot`, `workspaceStep`,
`GoogleAudienceDialog` ja `GoogleNote`. Henkilön puoli on luonnos tuotannon
`GoogleNote`n rinnalla. Kaikki nimet, osoitteet ja client ID ovat
synteettisiä. Kierros on vain suomeksi.

Yläpalkissa valitaan tilanne. `?s=` valitsee alkutilan
(`rivi`, `julkaisu`, `org-internal`, `testing`, `uusi-henkilo`, `henkilo`),
ja `?theme=dark` tumman teeman.

## Kaappaus, rakentaminen ja tarkistus

`capture.spec.ts` ajetaan kopioimalla se hetkeksi `web/tests/`-hakemistoon.
Kuvat menevät repositorion ulkopuolelle:

```
cp design-system/prototypes/rounds/2026-11-24-google-external-admin/capture.spec.ts web/tests/google-external-capture.spec.ts
OH_GOOGLE_CAPTURE_DIR=/var/tmp/agent-keep/google-external-admin/today \
  ./scripts/test-focused.sh --area browser --spec google-external-capture.spec.ts
rm web/tests/google-external-capture.spec.ts
node design-system/prototypes/rounds/2026-11-24-google-external-admin/build.mjs \
  [out-dir] [/var/tmp/agent-keep/google-external-admin/today]
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-24-google-external-admin/check.mjs \
  design-system/prototypes/dist/google-external-admin/offline.html <kuvahakemisto>
```

`offline.html` on yksi itsenäinen tiedosto fontteineen ja kuvineen.
`index.html` on sama ilman upotettuja fontteja. `build.mjs` muuntaa kuvat
WebP:ksi ImageMagickillä, jos se on asennettu, ja upottaa muuten PNG:t.
Tarkistus: 317 tarkistusta, konsoli puhdas. `--quick` ajaa vain 1440 vaalean.
