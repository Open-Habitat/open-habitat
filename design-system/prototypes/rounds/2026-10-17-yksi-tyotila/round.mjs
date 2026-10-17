// Yhden työtilan tila (proto-single-workspace-mode, 17.10.2026). Jari: kun työtiloja on vain
// yksi, palvelimen nimen paikalla on repon nimi ja koko käyttöliittymä on mietitty yhdelle
// työtilalle; kun käyttäjä lisää toisen, siirrytään nykyiseen monen työtilan tilaan. Tila
// johdetaan natiivien työtilojen määrästä, ei tallennetusta asetuksesta. Sisältö on sama
// kaikissa suunnissa: työtila aurinkokello keskusteluineen, nimi vie etusivulle, palvelin
// siirtyy tilivalikkoon, Lisää työtila kloonaa reitin ja vie monen työtilan tilaan, ja
// reitin siirto roskakoriin palauttaa yhden työtilan tilan. Suunnat eroavat siinä, missä
// yksi työtila itse (nimi, polku, Git, toiminnot) asuu ja kuinka paljon kehystä jää.
export const title = 'Yhden työtilan tila';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Etusivulla', axis: 'sivupalkki on pelkkä keskustelulista repon nimen alla; etusivu ja työtilasivu ovat yksi sivu, jonka otsakkeessa työtilan tiedot ja toiminnot ovat; Lisää työtila on sivupalkin listan lopussa', fn: 'v1' },
  { name: 'Sivupalkissa', axis: 'sivupalkin otsake on työtila: nimi, polku ja Git-nappi, ja nimen vieressä valikko työtilan toiminnoille ja Lisää työtilalle; etusivulla on pelkkä työ', fn: 'v2' },
  { name: 'Yläpalkissa', axis: 'sivupalkkia ei ole: yläpalkissa ovat repon nimi valikkoineen, uusi keskustelu ja tili; etusivu listaa keskustelut ja Git-tiedot; sivupalkki ilmestyy vasta toisen työtilan myötä', fn: 'v3' },
];
