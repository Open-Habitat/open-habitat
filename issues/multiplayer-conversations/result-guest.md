# Prototype round: the participant's (guest's) view, 2026-11-21

Round: `design-system/prototypes/rounds/2026-11-21-multiplayer-guest/` (sources and NOTES.md).
Build: `node design-system/prototypes/rounds/2026-11-21-multiplayer-guest/build.mjs`, which writes `design-system/prototypes/dist/multiplayer-guest/offline.html`.
The owner's view is the parallel round `2026-11-21-multiplayer-owner`.

## Saatesanat

Tämä on Jarin 21.11. mekanismi Villen silmin. Ville on samalla palvelimella ja kirjoittaa Ainon keskusteluun. Agentti vastaa hänelle, mutta vain tekstillä: se kertoo, mitä tekisi, ja jää odottamaan Ainoa. Kun Aino sanoo "Voit jatkaa" tai hyväksyy toimet yksitellen, toimet tehdään Ainon vuorolla. Kun Aino merkitsee Villen luotetuksi, Villen seuraava viesti saa agentin käyttämään työkaluja suoraan.

Kaikki kolme suuntaa näyttävät saman tarinan. Ne eroavat siinä, mistä Ville näkee, saako agentti toimia. **1 Kaista** kertoo sen kentän yllä ennen lähettämistä. **2 Merkki** merkitsee jokaisen agentin vastauksen. **3 Kortti** näyttää pysähdyksen siinä kohdassa, missä agentti pysähtyi, ja jokaisella toimella on oma tilansa.

Suosittelen korttia. Ville näkee sen, mitä hän odottaa ("Muokkaa `src/data/tapahtumat.json` · Odottaa Ainoa"), siellä missä keskustelu on, ja tila muuttuu samassa paikassa, kun Aino vastaa. Lisäksi omistajan kierros päätyi samaan suuntaan, joten Aino ja Ville katsovat samaa korttia, Aino painikkeiden kanssa ja Ville ilman. Ennen lähettämistä tieto tulee kentän tekstistä "Kirjoita Ainon agentille. Se vastaa sinulle tekstillä.", joten kaistaa ei tarvita sitä varten.

Teknisesti tekstivuoro on pakotettava Pi:ssä eikä kehotteessa. Sen tekevät Habitatin Pi-laajennuksen `tool_call`-koukku, joka estää jokaisen kutsun, ja `setActiveTools([])`. Pelkkä työkalujen piilottaminen ei riitä, koska Pi:n codemode- ja deferred-työkaluja voi kutsua silti. Luotettu-merkintä on edelleen päätös antaa toiselle omistajan Unix-käyttäjän valta. Prototyypin sanat kertovat sen kutsussa ja luotetuksi merkitsemisen rivillä.

## Directions (axis: where the guest sees the tool mode)

1. **1 Kaista / Strip.** A strip above the composer (production `Composer`'s `beforeField` slot) says *Vain teksti: the agent answers you with text; actions wait for Aino*. While actions wait it lists them with their states. Once trusted it says *Työkalut käytössä*. This is the only direction that tells the guest before sending, but it is detached from the reply it explains.
2. **2 Merkki / Badge.** Every agent reply header carries a badge: `Vain teksti · Ville` or `Työkalut · Aino` / `· Sanna` / `· Ville`. Under the text-only reply a line reads "2 tointa odottaa Ainon vahvistusta". It explains the rule "whoever sent the latest message defines the mode" best when the conversation is read as history. It is the noisiest, and it does not list what waits.
3. **3 Kortti / Card** (recommended). After the text-only reply sits a card, *Agentti pysähtyi tähän*, with one row per intended action and its state: Odottaa Ainoa → Tehty, or Aino hylkäsi. The owner's round puts the approval buttons on the same card.

Shared by all three directions:
- **Attribution.** Every person's message has an avatar (production account avatar with a per-person glyph colour), a name, a role chip (Omistaja, Luotettu) and a coloured left edge. Your own message reads "Ville (Sinä)". A participants row under the header lists everyone with their role.
- **What the guest sees.** The guest sees the messages and the tool rows (name, target, state). A tool row's output reads "Tuloste näkyy vain omistajalle." Once trusted, the output shows. The header's workspace is not a link, and a line says files, editor and terminal are Aino's.
- **Habitat's lines.** Open Habitat notes the join ("Liityit keskusteluun."), the per-action decision ("Aino hyväksyi muokkauksen ja hylkäsi julkaisun.") and the trust change.
- **The invite.** The invite appears under *Jaettu kanssasi* in the rail. It says whose agent this is (Aino's model, quota and connections), that the agent answers the guest with text only until Aino confirms, and what the guest can and cannot see. It names the model and offers Liity / Ei nyt. Nothing of the conversation shows before joining.

## Recommendation

**3 Kortti**, keeping the composer placeholder as the before-sending cue. If Jari finds that the guest learns the rule too late, add direction 1's mode word (without the action list) to the field's edge, not a second list.

## Host facts the view assumes

- The daemon reports, per agent turn, who started it and whether it had tools (`text_only` / `tools`). It reports the actions the agent proposed in a text-only turn with their states (`waiting`, `approved`, `declined`, `done`), and each message's author with their role. These are daemon facts. The browser never infers the mode.
- Per-guest filtering: for a non-trusted participant, tool output and thinking are not sent at all. Hiding them in the browser would not be enough.
- Enforcement and its limits are in NOTES.md, "Hostin puoli": an extension `tool_call` block plus `setActiveTools([])` for the turn, mode restored before an owner or trusted message reaches Pi, a participant's message held while a tools turn runs, and per-action approval as a follow-up turn whose `tool_call` admits only the approved calls.

## Decisions for later review

- **Guests do not see tool output or thinking; trusted participants do.** Alternatives: text only (no tool rows), everything. Tool rows without output tell the guest what was done to the shared work without exposing Aino's files or mail (research decision 4). A trusted person can read the files anyway.
- **Nothing of the conversation shows before joining.** Alternative: a preview. A pending invite is not yet consent from the guest, and the owner may withdraw it.
- **"Ei nyt" keeps the invite** until the owner withdraws it. Alternative: decline removes it. A guest's "not now" is rarely final.
- **Per-action approval is modelled as proposed actions recorded in the text-only turn, run in a follow-up turn limited to the approved calls.** Alternative: gate live tool calls one by one with the turn paused. Gating live calls would give a guest's turn the tools again, which contradicts "text only by default".
- **Marking trusted does not approve what already waits.** Alternative: approve everything pending. Trust applies from the next message. Earlier waiting actions still need Aino's answer, or Ville can ask again.
- **A participant's message sent during a tools turn waits until the turn ends** (NOTES.md, point 4). Alternative: steer it in as text only. Switching tools off mid-turn would cut off work the owner started.
- **Synthetic names Aino (owner) and Ville (guest)** match the owner's round. Sanna (trusted) is this round's own.

## Questions for Jari

1. Card (3) as the shared object of both views: does it read right from the guest's side, or does Ville need the mode stated before sending (1)?
2. Tool output for a non-trusted guest: hidden (as built), or should even the tool names be hidden?
3. Should the guest be able to stop a turn their own message started? Not built. The default assumed here is yes for one's own turn and no for others'.
4. Does "Luotettu" say clearly enough, in Aino's invite and trust dialogs, that it hands over her Unix account's reach? Or should the word be stronger ("Täydet oikeudet")?

## Evidence

Screenshots (82, 1440 and 390 px, Päivä/Yö/Kontrasti, flows, English) and the built page are under `/var/tmp/agent-keep/multiplayer-guest/` (`shots/`, `multiplayer-guest.html`). They are not committed. `check.mjs` passes 809 checks with a clean console.
