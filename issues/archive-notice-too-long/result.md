# Tulos

Koskematon kuittaus katoaa nyt 8 sekunnissa (ennen 20 s,
`NOTICE_LIFETIME_MS` tiedostossa `web/src/components/ArchiveNotice.tsx`).
Jos osoitin on kuittauksen päällä, fokus on siinä tai toiminto on kesken,
kuittaus pysyy kuten ennenkin. Yksikkötestit ja selaintestit laskevat
ajat vakiosta.

## Decisions for later review

- **Kesto 8 s.** Vaihtoehdot olivat 6 s ja 10 s. Valitsin 8 sekuntia, koska
  rivissä on otsikko ja kumoa-painike: otsikon ehtii lukea ja painikkeen
  painaa, eikä kuittaus jää roikkumaan. Hover ja fokus pitävät kuittauksen
  näkyvissä niin kauan kuin tarvitaan.
