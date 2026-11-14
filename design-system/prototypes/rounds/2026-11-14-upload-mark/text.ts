// The round's own review words. The chips, the field, the refusal banner and
// the agent's progress line keep production's catalogs. File names and
// sizes are synthetic.

export const TEXT = {
  title: "Liitteen tallennus ja merkki · kierros 1",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  lines: [
    "Nyt: tuotannon tallennusrengas ja prosentti. Merkkiä ei käytetä.",
    "1 Merkki täyttyy: merkin rengas piirtyy ovelta myötäpäivään sitä mukaa kuin tavuja lähtee. Asukas astuu sisään vasta, kun tiedosto on tallessa, ja ovi sulkeutuu.",
    "2 Merkki ja palkki: merkki on lataustilassa (rengas hakee muotoaan), ja edistyminen on ohut palkki sirun alareunassa ja prosentti.",
    "3 Merkki kehyksenä: isompi merkki korvaa tiedoston kuvakkeen, asukas kävelee ovesta keskelle edistymisen mukaan, siru täyttyy taustaltaan ja valmis kuva asettuu renkaan muotoon.",
  ],
  recommend:
    "Suositus: 1 Merkki täyttyy. Merkki itse on edistymispalkki: pysähtynyt siirto näkyy pysähtyneenä renkaana, ja tyhjä koti erottaa tallennuksen agentin työstä, jossa asukas on aina kotona.",
  replay: "Toista",
  scenes: {
    small: {
      title: "Pieni tiedosto",
      caption: "Lähtee alle sekunnissa. Kuva on hetki tallennuksen jälkeen.",
    },
    large: {
      title: "Iso tiedosto hitaasti",
      caption:
        "18,4 Mt hitaalla yhteydellä; siirto pysähtyy välillä. Kuva on kohdassa 37 %.",
    },
    many: {
      title: "Useita kerralla, agentti työskentelee",
      caption:
        "Viisi tiedostoa lähtee yksi kerrallaan, kaksi on jo tallessa. Agentin vuoro on samalla käynnissä, joten agentin merkki näkyy kentän yllä.",
    },
    saving: {
      title: "Lähetetty, tallennetaan",
      caption:
        "Kaikki tavut ovat lähteneet; palvelin kirjoittaa tiedostoa vielä levylle.",
    },
    failed: {
      title: "Katkesi ja uudelleen",
      caption:
        "Yhteys katkesi kohdassa 62 %; seuraava tiedosto odottaa. Yritä uudelleen aloittaa alusta.",
    },
  },
  drafts: {
    small: "Lisäsin muistion, katso kohta 3.",
    large: "Tässä koko alueen kartta.",
    many: "Tässä aineisto kokonaan.",
    saving: "Paketti on tässä.",
    failed: "Esitys ja liitteet.",
  },
};
