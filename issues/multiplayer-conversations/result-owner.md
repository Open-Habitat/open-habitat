# Prototype round: the conversation owner's view, 2026-11-21

Round: `design-system/prototypes/rounds/2026-11-21-multiplayer-owner/` (sources and NOTES.md).
Build: `node design-system/prototypes/rounds/2026-11-21-multiplayer-owner/build.mjs` writes `design-system/prototypes/dist/multiplayer-owner/offline.html`.
The participant's view is the parallel round `2026-11-21-multiplayer-guest` (result-guest.md). Both rounds use the same vocabulary.

## Saatesanat

Tämä on Jarin 21.11. mekanismi Ainon eli keskustelun omistajan silmin. Ville kirjoittaa Ainon keskusteluun ja pyytää lisäämään ilmoittautumislinkin ja julkaisemaan sivun. Agentti vastaa hänelle vain tekstillä: se kertoo, mitä tekisi, ja pysähtyy. Aino voi vastata kolmella tavalla. Voit jatkaa lähettää Ainon viestin "Voit jatkaa.", joten tavallinen sääntö pätee: viimeisin viesti on omistajan, ja työkalut ovat käytössä. Hyväksy yksitellen ratkaisee toimet yksi kerrallaan. Kolmas tapa on kirjoittaa itse, jolloin agentilla on taas kaikki työkalut. Osallistujarivi otsikon alla näyttää, ketkä ovat paikalla. Sen paneelista Aino voi merkitä osallistujan luotetuksi, poistaa luottamuksen tai poistaa osallistujan keskustelusta, ja Kutsu tuo mukaan palvelimen muita ihmisiä.

Suunnat näyttävät saman tarinan. Ne eroavat siinä, missä työkalutila näkyy ja mistä Aino sen vapauttaa. **1 Kaista** kertoo tilan kentän yllä ja kenen viesti sen määräsi. **2 Merkki** merkitsee jokaisen agentin vastauksen. **3 Kortti** pysäyttää agentin korttiin, joka luettelee aiotut toimet.

Suosittelen korttia. Aino näkee ennen lupaa täsmälleen, mitä hänen tunnuksillaan tehtäisiin (`bash npm run deploy`), ja voi sallia osan. Päätös jää historiaan siihen kohtaan, jossa agentti pysähtyi. Osallistujan kierros päätyi samaan suuntaan, joten Aino ja Ville katsovat samaa korttia, Aino painikkeiden kanssa ja Ville tiloineen. Kaistan vahvuus on, että se kertoo tilan juuri ennen kuin Aino kirjoittaa. Se on kuitenkin irrallaan vastauksesta, jota se koskee. Tämä näkyi heti, kun Villen vanha pyyntö odotti ja Maija kirjoitti väliin: kaista tarvitsi lisärivin siitä, minkä pyynnön painikkeet ratkaisevat.

Teknisesti tekstivuoro pakotetaan Pi:ssä Habitatin laajennuksella, ei kehotteella. Laajennus asettaa `setActiveTools([])` ja estää kaikki kutsut `tool_call`-koukussa. Tämä estää osallistujaa käynnistämästä uusia toimia, mutta se ei ole Unix-käyttäjien välinen turvaraja. Siksi luotetuksi merkitsemisen ikkuna sanoo suoraan, että Ville voi silloin saada agentin käyttämään Ainon tiedostoja, GitHubia ja sähköpostia kysymättä.

## Directions (axis: where the tool mode shows and where the owner releases it)

1. **1 Kaista / Strip.** A strip in the production composer's `beforeField` slot shows `Vain teksti · viimeisin viesti on osallistujalta (Ville)` or `Työkalut käytössä · viimeisin viesti on sinulta`. Voit jatkaa and Hyväksy yksitellen sit on the strip, and step-by-step approval opens a window, one step at a time. Only the text-only reply carries a mark. This is the only direction that states the current mode at the point of writing. When an older request is still waiting under a newer message, the strip adds "Odottaa lupaasi: Villen pyyntö klo 14.11".
2. **2 Merkki / Badge.** Every agent reply's header carries its mode: Vain teksti, Työkalut käytössä, `· luotettu` or `· yksitellen`. The two buttons sit directly under the text-only reply, and step-by-step approval is the same window as in 1. This direction reads best as history, because the rule "the latest sender defines the mode" can be seen turn by turn. It is the noisiest, and the release does not show what would be done.
3. **3 Kortti / Card** (recommended). After the text-only reply comes a card, *Agentti pysähtyi: Villen pyyntö tarvitsee työkaluja*. Each row is a step (`Muokkaa tiedostoa edit content/events/kevatkokous.md`, `Aja komento bash npm run deploy`) with Salli / Älä salli, and the footer has Voit jatkaa (kaikki). Once decided, the card stays with ✓ Sallittu / ✕ Et sallinut per row and a line saying how it was settled.

Shared by all three directions:
- **Attribution.** Each message shows an avatar with a per-person colour ring, a name ("Sinä" for the owner), a role chip (Omistaja, Osallistuja, Luotettu) and a coloured left edge for other people. Each agent reply says whom it answered ("vastaus: Ville").
- **Who is present.** Under the header, a people row shows stacked avatars with presence dots (here, away, invited), "3 paikalla" and the trusted people's names. It opens the participants panel: role, presence, Merkitse luotetuksi / Poista luottamus, Poista keskustelusta, and a lead sentence saying the agent, model, quota and credentials are the owner's.
- **Invite.** Kutsu (in the people row) lists people on this server with checkboxes. The rule shown is: the agent answers an invited person with text only until you allow it or mark them trusted, and the quota and credentials are yours.
- **Trust.** Marking someone trusted needs a confirmation window that names what is lent. Revoking takes effect at once. Open Habitat records both as lines in the conversation.
- **The owner's own message** settles any waiting request ("Sinä kirjoitit itse; agentilla on taas kaikki työkalut.") and restores tools.

## Recommendation

**3 Kortti.** It is the only direction where the owner's decision is about concrete operations rather than a mode, and it is the same object the participant sees. If Jari wants the current mode visible while writing, take direction 1's mode word into the composer's edge without its buttons, so the buttons stay on the card.

## Host facts the view assumes

- Per agent turn, the daemon reports who started it and its mode (`text_only`, `tools`, `trusted`, `approved_steps`). For a text-only turn it reports the steps the agent proposed (tool, target) and each step's decision. It also reports each message's author and their role. These are daemon facts, and the browser never infers the mode.
- Membership, presence and trust live in the owner's daemon (research.md, option a). Invites list people admitted to the same server.
- Enforcement is described in NOTES.md, "Hostin puoli": an extension sets `setActiveTools([])` and blocks every `tool_call` for the turn. Tools are restored before an owner or trusted message reaches Pi. "Voit jatkaa" is an owner message. Step-by-step approval is a follow-up turn whose `tool_call` admits only the approved calls.

## Decisions for later review

- **"Voit jatkaa" is posted as the owner's message.** The alternative is a silent control that flips the mode. As a message, the single rule "the latest sender defines the mode" covers it, it shows in Pi's native history and the terminal, and the agent hears the permission in its own context.
- **Step-by-step approval continues the guest's request in a follow-up turn limited to the approved calls.** The alternative is pausing live tool calls one at a time. This matches the participant's round and keeps a guest's turn tool-free by default.
- **Older waiting requests stay open when someone writes after them.** The alternative is that a newer message expires them. Expiring would silently drop a request the owner may still want to allow. The owner's own message settles the latest waiting request only.
- **Marking someone trusted applies from their next message.** It does not approve what already waits. This matches the participant's round.
- **Removing a participant is in the panel without a confirmation.** The alternative is to confirm. It takes nothing from the owner and can be undone by inviting again.
- **The invite lists only people on this server.** Link invites to outsiders are research decision 3 and were not built.
- **The people row sits under the header in a band of its own, not inside the header.** The header is already crowded on a phone, and presence needs room for avatars.
- **Per-person colours come from `--ah-source-1..3` as a ring and edge, not a fill.** This keeps text contrast in all three themes. The participant's round used `--ah-glyph-*`, so one family should be chosen at implementation.

## Questions for Jari

1. Card (3) as the shared object of both views: is deciding per step the right granularity, or is "Voit jatkaa" alone enough in practice?
2. Should "Voit jatkaa" appear in the history as your message (as built), or as a Habitat line saying "Aino salli työkalut"?
3. When someone writes after a waiting request, should the old request stay open (as built) or lapse?
4. Should you see per-person spend from native usage in the participants panel now, or later?
5. Is "Luotettu" strong enough for what it hands over, or should the word itself say it ("Täydet oikeudet")?

## Evidence

Screenshots (122 images: 1440 and 390 px, Päivä/Yö/Kontrasti, every flow, English) and the built page are under `/var/tmp/agent-keep/multiplayer-owner/` (`shots/`, `multiplayer-owner.html`). They are not committed. `check.mjs` passes 868 checks with a clean console.
