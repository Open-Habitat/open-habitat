---
created: 2026-11-17
updated: 2026-11-21
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-17/attention-sound
lane: attention-sound
lane_seq: 1
preparation: ready
closed: 2026-11-21
commits:
- hash: 3950606e
  summary: 'feat(preferences): the attention sound''s personal choices'
- hash: '23266045'
  summary: 'feat(web): attention sound behind the experimental switch'
- hash: d3a38b63
  summary: 'fix(web): attention sound review findings'
---

# Attention sound: a chime when the agent finishes or wants the person's attention, personal and per repository and conversation

## Description

Request from a pilot user, taken up by Jari 17.11.2026: Habitat could have a 'bling'. When the agent finishes, or reaches a point where it wants the person's attention, the browser plays a short chime (as Claude Code does in a terminal with the classic system sound). Possibly different per repository.

Jari's shape: personal to each person; a set of sounds to choose from; a default sound in the person's settings; a sound configured per repository (workspace); and perhaps per conversation, chosen even from the chat itself. Sounds must be our own or properly licensed (not a copy of a system vendor's sound).

Next action: prototype rounds, one per view: (1) the sound set and when a sound plays; (2) the personal default in Settings; (3) per-repository sound; (4) per-conversation sound (possibly set from the chat). Start with (1) and (2).

## Decisions

### 2026-11-21T07:08:40Z · @jari

Jari 21.11.2026 on rounds 1-2: try to generate considerably more pleasant and more varied sounds (new sound round). Settings: try direction C Laatat, but make the tiles visually more pleasant, with 'sound-like' visuals (riff on it). No sound for the conversation being viewed: ok. Quiet hours: yes — a 'Hiljennä yöllä' choice that follows the same rhythm as the day/night appearance. Sound on by default. Per-device mute may also live in the account menu, but prototype it. The 'conversation in view' rule is personal. (Not answered: separate sound for a question — conductor keeps one sound.)

### 2026-11-21T07:42:12Z · @jari

Jari 21.11.2026 on rounds 2-5: Sounds — Soittimet: Celesta, Kantele, Sähköpiano do not work, others ok. Luonto: Puupala does not work, others ok; Kulho good but its end stops abruptly ('into a wall'), same for Lasit. Tunnelma: none work. Tunnus: only Tunnus puu works. Default for now: Kalimba. One more polishing round: fix the abrupt endings, add depth to the working sounds; in the end all accepted sounds are offered. Volume is right. Per-repository sounds are chosen from these sounds. Settings: direction B Renkaat. Night = the device's dark mode; night hours not editable (come from the system). No navigation sounds on arrow keys now; key/navigation sounds get their own prototype issue later — these sounds are for things becoming ready. Account menu: A Äänet row; the mark on the account picture may stay while muted; Quiet at night wins and Hiljennä yöllä is also in the menu; no timed cross-device quiet (system-level quiet is system-specific).

### 2026-11-21T10:04:59Z · @jari

Jari 21.11.2026 on round 4: Kulho and Lasit end naturally now; character kept and moving the right way, but all sounds can still become more natural and richer. The five new candidates sound 'digital', lacking colour — redo them in the next round; no more new sounds beyond that (max 15 total). The longer sounds a bit shorter, or ideally each sound in a short and a long variant. The final set is chosen after the next round.

### 2026-11-21T12:45:50Z · @jari

Jari 21.11.2026 on round 5: final set is ten sounds — the nine kept ones (Kalimba default, Marimba, Vibrafoni, Tunnus puu, Pisara, Lasit, Tuulikello, Kuplat, Kulho) plus Jääpuikot. Sävelrumpu, Harppu, Kitara and Kivi lampeen are dropped. The person chooses short or long sounds (one setting for all sounds). Next: a prototype round riffing the B Renkaat tile iconography so every one of the ten sounds has its own visual, on a page that also shows the other sound choices.

### 2026-11-21T13:06:56Z · @jari

Jari 21.11.2026 on round 6: emblem direction B Väreilyn muoto is best. Next: riff every one of the ten emblems into three variants, each set of three following a stated idea; all are fairly nice already, Kalimba and Kulho need the most. Lyhyet (short sounds) is the default. Workspace sounds get their own prototype round: in Settings or in the workspace itself — probably both; the picker pop-up could show the emblems too.

### 2026-11-21T13:50:25Z · @jari

Jari 21.11.2026 on the workspace sound picker: Settings rows look very good, but the field width changes with the choice and the field jumps — fix. In the workspace the sound should be clearly visible and changeable, perhaps up top in the workspace head with large controls; the emblem works large, not as a tiny mark beside a word; the button icon is a note glyph. Sidebar: only a note glyph on hover to change it. Press chooses; a separate preview play button on each card. The choice shows also when it is the default. Riff again.

### 2026-11-21T14:25:32Z · @jari

Jari 21.11.2026 on workspace sound round 2: try C Asetusnauha, riffed so all the strip's buttons are the same size; drop the note from the right side of the sidebar row (no hover note). Use round 7's recommended emblems.

### 2026-11-21T14:45:59Z · @jari

Jari 21.11.2026 on workspace strip round 3: B Leveät painikkeet is good; try variable-width buttons sized by what they need — square buttons for Kuvake and Ääni (icon and sound emblem), a flatter wider button for Nimi.

### 2026-11-21T15:33:47Z · @jari

Jari 21.11.2026 on emblems round 7: Tunnus puu current; Lasit: Lasin reuna; Kuplat current; Kulho: Huojunta; Jääpuikot: Helähdys; all others as recommended. Workspace strip round 4: A Yksi rivi; next round Kuvake and Nimi open their real editors.

### 2026-11-21T18:43:07Z · @jari

Jari 21.11.2026 on workspace strip round 5: B Paikallaan (name edited in place). No times/timestamps on the sound choice cards.

## Resolution

### 2026-11-21T19:35:27Z · @issuectl

Implemented as the experimental feature attention-sound; result.md lists what landed, the decisions for later review and the live check.
