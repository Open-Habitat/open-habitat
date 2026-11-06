# Palaa tähän – kierros 3: vahvistus

Issue `proto-rewind-conversation`. Jari valitsi 6.11. kierroksen 2
(`rounds/2026-11-06-palaa-tahan/`) suunnan **C Valitse mitä**: palatessa
valitaan keskustelu ja tiedostot, vain keskustelu tai vain tiedostot, kuten
raine/better-pi-rewindin `/rewind`-valikossa. Kierroksen 2 vahvistus oli
ison näköinen (työpöydällä noin 500 px korkea kortti: jokaisella valinnalla
selite ja tiedostolista aina auki). Tämä kierros riffaa tiiviin
vahvistuksen kolmella tavalla, ja jokaisessa voi vaihtaa, onko tiedostojen
palautus oletuksena mukana vai pois.

Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`NowSections`, `AgentHeader`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `ToolRow`, `Menu`, `RadioGroup`, `ChoiceMenu`,
`Checkbox`, `Button`, `ConversationFloatingAction`, `Composer`). Kierroksen
omia ovat kolme vahvistusta, tiedostorivi ja -lista sekä tulosrivit
(kierrokselta 2). Keskustelu on sama kuin kierroksilla 1 ja 2. Mitään ei
lähetetä eikä palauteta.

## Ero kierrokseen 2

Sisältö ja kolme valintaa ovat samat; vain vahvistuksen muoto vaihtuu.
Valinnoilta on poistettu selitteet (B:n valikossa ne näkyvät vasta
avattuna), tiedostot ovat yhdellä rivillä ja lista on *Näytä*-painikkeen
takana, ja komennon huomautus on lyhennetty samaan riviin
(*komennon muutokset jäävät*). Yläpalkin valinta *Tiedostot* vaihtaa
oletuksen: *Oletuksena mukana* aloittaa valinnasta Keskustelu ja tiedostot,
*Oletuksena pois* valinnasta Vain keskustelu.

## Riffit

Akseli: missä ja minkä kokoisena vahvistus näkyy.

- **A Ponnahdus**: pieni ikkuna viestin ⋯-painikkeen alla, kolme valintaa allekkain ilman selitteitä; tiedostot yhdellä rivillä, lista Näytä-painikkeen takana.
- **B Ohut palkki**: yksi rivi viestin alla: Palaa tähän, valikko mitä palautetaan ja painikkeet; määrät ja tiedostot pienellä toisella rivillä.
- **C Pieni arkki**: matala paneeli kentän yllä, kaksi valintaa Keskustelu ja Tiedostot rinnakkain; viesti ja sen jälkeinen osa himmenevät keskustelussa.

Korkeus oletusnäkymässä (`check.mjs` mittaa): A 255 px, B 88 px, C 148 px
työpöydällä; puhelimessa 263, 140 ja 209 px. Kierroksen 2 kortti oli 499 px
ja puhelimessa 593 px.

## Mitä kussakin tapahtuu

- **A.** Ikkuna leijuu myöhemmän osan päällä, ei siirrä sitä. Valinta
  vaihtaa painikkeen (*Palaa ja palauta*, *Palaa tähän*, *Palauta
  tiedostot*) ja määrärivin (*Keskustelu jatkuu ennallaan* vain
  tiedostoille).
- **B.** Palkki on keskustelun sisällä viestin alla, ohuiden viivojen välissä.
  Valinta on tuotannon `ChoiceMenu`: suljettuna vain nimi, avattuna nimi ja
  selite. Puhelimessa painikkeet siirtyvät toiselle riville.
- **C.** Arkki on kentän yllä samassa paikassa kuin keskustelun leijuvat
  painikkeet (`ConversationFloatingAction`) ja yhtä leveä kuin kenttä.
  Keskustelu vierii niin, että valittu viesti on ylhäällä. Kaksi valintaa
  ilmaisee kolme vaihtoehtoa: molemmat, vain Keskustelu tai vain Tiedostot;
  kumpikaan ei valittuna estää painikkeen (*Valitse ainakin toinen*).

Kaikissa vahvistuksen jälkeen tulos on kierroksen 2 C:n tulos: viesti
kenttään ja rivi *Aiempi jatko · … · 3 tiedostoa palautettu* (tai
*tiedostot jäivät*), vain tiedostoille rivi *3 tiedostoa palautettu* ja
*Peru palautus*. *Agentti › Työssä* näyttää pysäytyksen (*Pysäytä ja palaa*,
*Pysäytä ja palauta*); A ja C sanovat sen myös rivillä, B määrärivillä.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-palaa-tahan-vahvistus/build.mjs
node design-system/prototypes/rounds/2026-11-06-palaa-tahan-vahvistus/check.mjs \
  design-system/prototypes/dist/palaa-tahan-vahvistus/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen riffin läpi vaaleana ja tummana, 1440 ja 390 px:
oletusnäkymä tiedostot mukana, tiedostolista auki, B:n valikko auki, vain
tiedostot ja sen peruminen, keskustelu ja tiedostot, oletus pois, sisäänkäynti
viestin ⋯-valikosta ja agentti työssä. Se tarkistaa myös, että vahvistus
näkyy kokonaan kentän yläpuolella (344 tarkistuspistettä, konsoli puhdas,
kuvat kertoimella 2). `index.html` on sama ilman upotettuja fontteja
glasspadia varten.
