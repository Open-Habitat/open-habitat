# Tulos

## Kierros 1 (15.11.2026)

**Yhteenveto.** "Tarkista katkaisu" ei ole esikatselu. Se on yhteyden
katkaisun ensimmäinen askel, ja tavallisesti se ei edes onnistu. Painike
pyytää daemonilta kahden minuutin vahvistustunnisteen ja avaa sitten
ikkunan "Irrotetaanko GitHub-yhteys?". Gateway kuitenkin päästää pyynnön
läpi vain, jos ihminen on kirjautunut GitHubilla alle viisi minuuttia
sitten. Muuten painike näyttää vain tekstin "Kirjaudu ulos ja uudelleen
GitHubilla ennen katkaisua (5 minuutin sisällä)". Toiminto itse tarvitaan,
koska se on ainoa tapa saada palvelin unohtamaan GitHub-token. Siksi
ehdotan sen nimeksi **Katkaise yhteys…** ja ehdotan, että tuoreen
kirjautumisen vaatimus hoidetaan vahvistusikkunassa: **Vahvista GitHubilla**
→ paluu samaan ikkunaan → **Katkaise yhteys**. Kortin muut tekstit
lyhenevät: kortti kertoo tunnuksen ja tilan (Toimii / Ei toimi / Ei
yhdistetty). Oikeudet kerrotaan selkokielellä lisätiedoissa, ja virke
"Selaimesta uloskirjautuminen ei poista palvelimen valtuutusta" siirtyy
lisätietoihin, missä se perustelee katkaisun. Toimivassa tilassa "Yhdistä
GitHub uudelleen" ei ole pääpainike, koska sitä tarvitaan harvoin. Kun
yhteys on rikki, se on ainoa korjaus ja siksi korostettuna.

Suositus on **1 Lisätiedot**. Oletusnäkymä kertoo kuka on yhdistetty ja
toimiiko yhteys. Työnkulkurivi on lyhyempi, mutta varoitus salaisuuksista
säilyy. "Lisätiedot ja yhteyden katkaisu" -avaus sisältää oikeudet,
valtuutuksen säilymisen ja kaksi nimettyä toimintoa: Kirjaudu uudelleen
GitHubilla ja Katkaise yhteys…

Akseli: missä harvinaiset toiminnot (uudelleenkirjautuminen toimivassa
tilassa, katkaisu) ja tekninen tieto (oikeudet, valtuutuksen säilyminen)
ovat.

- **Nyt**: tuotannon kortti sellaisenaan.
- **1 Lisätiedot**: kortti kertoo kuka ja toimiiko; harvinaiset toiminnot ja oikeudet ovat Lisätiedot-avauksen takana.
- **2 Näkyvissä**: samat lyhyet tekstit, ja Kirjaudu uudelleen sekä Katkaise yhteys… ovat aina näkyvissä kortin alalaidassa, oikeudet yhdellä rivillä.
- **3 Valikko**: kortti on yksi rivi; harvinaiset toiminnot ja "Näytä oikeudet" ovat ⋯-valikossa.

Tilanteet: yhdistetty ja työnkulut ei sallittu (oletus), työnkulut
sallittu, lupa puuttuu tokenista, kirjautuminen jäi kesken (Salli painettu,
GitHubista ei palattu), valtuutus vanhentunut tai peruttu, ei yhdistetty
sekä katkaisu (ikkuna sekä vanhalla että tuoreella kirjautumisella).
Leveydet ovat 1440 ja 390, teemat Päivä, Yö ja Kontrasti, kielinä suomi ja
englanti. Nyt-näkymä on tuotannon `CodeHostSettings` sijaisdaemonia vasten,
ja sen Tarkista katkaisu saa 403-vastauksen samoin kuin oikeasti. Suunnat on
koottu tuotannon palasista ja asetussivun luokista. Niiden painikkeet
toimivat sijaistilassa: salli, poista lupa, älä salli, peru, kirjaudu
uudelleen ja koko katkaisupolku.

`NOTES.md` sisältää taulukon, jossa kerrotaan kortin jokaisesta osasta,
mitä se oikeasti tekee ja tarvitaanko sitä tällä kortilla.

**Live check:** Avaa testipalvelimella Asetukset › Koodipalvelut ja paina
GitHub-kortin "Tarkista katkaisu", kun GitHub-kirjautumisesta on yli viisi
minuuttia. Kortti näyttää vain "Kirjaudu ulos ja uudelleen GitHubilla
ennen katkaisua". Tämä on se nykytila, jonka kierros korjaa. Prototyyppi:
`worker-results/01m7g5nz6akvwt07cn7k2c3vag/offline.html`.

Rakentaminen ja tarkistus:

```
node design-system/prototypes/rounds/2026-11-15-github-card/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-15-github-card/check.mjs \
  <out>/offline.html <out>/shots
```

Tarkistus: 857 tarkistusta, konsoli puhdas.

### What the host would need

Nothing new in the daemon, gateway or contract. All three directions keep
every route and guard as is:

- Reconnect, Allow, Remove permission: `/auth/github/start?reconnect=1[&scope=workflow]`, unchanged.
- Disconnect keeps the gateway's five-minute fresh GitHub sign-in rule,
  the daemon's GET observation token (2 min) and the POST with
  `confirmation: "disconnect"`. Only the browser's sequence changes:
  *Disconnect…* runs the GET straight away; a 403
  `reauthentication_required` opens the dialog in its *Confirm with GitHub*
  form, a token opens it in its *Disconnect* form.
- *Confirm with GitHub* is an ordinary GitHub sign-in
  (`/auth/github/start?return_to=<settings>`, without `reconnect=1`). This
  is assumed to issue a session with a fresh `githubAt` (the GitHub callback
  sets `githubAt: now` on the session it creates, `internal/gateway/auth.go`)
  and to keep gh's working token (`Deliver`, not `DeliverReplacing`). A
  browser-side return mark (like `markReconnect`) reopens the dialog on
  return, and the dialog runs the GET again.
- The "GitHub settings" link goes to `https://github.com/settings/applications`,
  where the person can revoke the OAuth grant themselves; nothing is revoked
  for them.

### Decisions for later review

- **Disconnect is not removed, only renamed and merged into one press.**
  Alternative: drop it from Settings, since `gh auth logout` in a terminal
  does the same. Kept because it is the only browser route to make the
  server forget the token, and "signing out of the browser does not remove
  the server's authorization" makes it necessary.
- **The fresh-sign-in step happens inside the dialog** instead of telling
  the person to sign out and in again. The gate is the same; only the way
  to satisfy it changes. Alternative: keep the current instruction text.
- **Confirming uses the ordinary sign-in, not the reconnect.** A reconnect
  would replace gh's token just before deleting it. The ordinary sign-in
  keeps it, and the gateway revokes the new unused token. Needs a check
  with the real OAuth app when implemented.
- **Pending gets a "Try again"** beside Cancel (it re-runs Allow).
  Production has only Cancel, which then needs a second press on Allow.
- **"Allow on GitHub" loses its external-link icon**, because the sign-in
  opens in the same tab.
- **The status mark says "Toimii / Works"** and the identity line names the
  account ("Tunnus maija-example"). "Yhdistetty" would repeat the line.
- **Not drawn:** `unreachable`, `verifying`, `partial`, `unknown`. They
  follow the same pattern (a status word plus one sentence) and keep
  production's current sentences until a round shows otherwise.

### Questions for Jari

1. Which direction: 1 Lisätiedot (recommended), 2 Näkyvissä or 3 Valikko?
2. Should the disconnect dialog link to GitHub's application settings, so
   the person can also revoke the grant there, or leave that out?
