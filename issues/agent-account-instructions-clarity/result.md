# Result: proposal for Jari, nothing shipped

## Yhteenveto (Jarille)

**Ohjeteksti** (`agent-text.md`). Jokaisen tilin kohta alkaa siitä, miten
tavalliset asiat tehdään (etsi ja lue tiedosto, lue posti, valmistele vastaus,
katso kalenteri, siivoa postia), ja nimeää täsmälleen käytettävän työkalun.
Yleinen osa kertoo neljällä lyhyellä kohdalla, mikä on pelissä. Kieltoja ei
tullut lisää. Hostin ohje ei enää väitä, että pilvitiedostot ovat
`~/cloud/`-hakemistossa: tänään yhdistetyllä Microsoft-tilillä ne eivät ole.

**Työkalut** (`tool-surface.md`). Agentti saa Microsoft-tilistä täydellä
tasolla 100 työkalua. Ehdotan 55:tä: kaikki, millä käsitellään viestejä,
luonnoksia, tapahtumia, yhteystietoja ja tiedostoja. Pois jää se, millä
postilaatikkoa järjestellään (kansioiden luonti ja poisto, kalenterien jako,
lajittelusäännöt), eli se, mihin pilotin agentti tarttui. Taso toimii kuten
nyt, uutta asetusta ei tule, eikä kenenkään tarvitse kirjautua uudelleen.

Kaksi löytöä: agentilla on tänään kuusi työkalua, joilla se voi kirjata
käyttäjän tilin ulos (palvelin lisää ne itse; ehdotan piiloon), ja viestin voi
lähettää viidellä työkalulla, joista kolme on nimetty kuin tavallinen vastaus
(ehdotan yhtä: luonnos ensin, lähetys pyynnöstä).

Menetys: agentti ei enää luo tai poista postikansiota tai kalenteria
("tee näille kansio ja siirrä ne sinne": siirto onnistuu, kansion tekee
käyttäjä itse). Sinulta tarvitaan tekstin oikoluku ja kyllä tai ei listalle.

## What was done

- `agent-text.md`: before and after for the host context paragraph, the
  skill's description, opening and "What is at stake", the Microsoft and
  Google account sections, and a new one-line server description for Pi. Says
  which accounts' text stays and why.
- `tool-surface.md`: what each integration hands the agent today, with
  counts, the classification into everyday work and administration, five
  options for how the level maps to it, and one recommendation.
- `tool-surface-check.py`: recounts every Microsoft number from the pinned
  server and fails if the proposed lists do not cover exactly what the full
  level offers.

No product code or shipped text changed.

## How it was checked

Focused self-review against the code. Tool names and counts were produced by
running the pinned server (0.170.1) from an installed integrations runtime
with each level's registration arguments; the script asserts that the "stays"
and "goes" lists are disjoint and together equal the 100 tools of the full
level. gog commands and flags were read from the pinned gog's `--help`
(v0.39.1), Pi's behaviour from the pinned Pi's `docs/mcp.md` and
`docs/codemode.md` (1.5.2). `git diff --check` and
`python3 scripts/validate-project-view.py` pass.

Not checked: the pilot's conversation itself was not read, so the explanation
of how the agent arrived at `delete-mail-folder` (keyword search over similar
names) is the likely mechanism, not an observed one. How Pi shortens a long
tool name was read from its documentation, not seen in a session. Atlassian's
and Trello's tool lists could not be counted without a signed-in connection.

## Live check

Nothing to try yet: this is a proposal. To see the surface as it is today, on
the test server with a Microsoft account connected, ask the agent "what tools
do you have for my Outlook mail folders?" and look for `delete-mail-folder`
and `logout` in its answer.

## Decisions for later review

1. **Where the line between everyday work and administration runs.** Chosen:
   the agent works with messages, drafts, events, contacts and files, and not
   with folders, calendars, sharing or sorting rules. Alternative: keep
   creating mail folders (drop only rename and delete), since "make a folder
   and move these there" is a believable request. Chosen the plain rule
   because it can be said in one sentence to a person and to an agent; the
   alternative is one name back on the list.
2. **One tool that sends.** Chosen: only `send-draft-message`; `send-mail`
   and the reply and forward tools that send at once are not offered.
   Alternative: keep `send-mail` for a new message. Chosen so that every sent
   message existed as a draft first and no tool that sends is named like a
   reply.
3. **No per-account switch for the full tool set** (option C). Alternative:
   build it now so that a person can get the administration tools back
   without a release. Left out because it adds a control, a contract field
   and a second surface to test for a need nobody has shown.
4. **The level does not change the list** (option D rejected). Alternative:
   Full shows everything. Rejected because Full is the broadest level and the
   common one, and the level would start to mean two things.
5. **Sign-in tools hidden through Pi, everything else through the server's
   own list.** Alternative: hide everything through Pi. The server's list is
   an allow list, so an upstream addition stays out until someone adds it;
   Pi's hiding is a deny list. The sign-in tools can only be reached by Pi's
   setting.
6. **Small tools kept or dropped on judgement**: `get-mail-attachment-content`
   and `list-supported-time-zones` stay (the second because the description
   of `create-calendar-event` sends the agent to it); `download-bytes`,
   `get-mail-tips`, `get-mail-message-mime`, `copy-mail-message`,
   `forward-calendar-event`, `add-calendar-event-attachment` and the reminder
   tools go. Each is one name either way.
7. **The Microsoft section became longer** (373 words to 502) while the
   general part became shorter. Chosen because mail, calendar and tidying had
   no path at all before. Alternative: name only the file and reply paths and
   leave the rest to tool search.
8. **Atlassian, Trello, IMAP, CalDAV, CardDAV and Dropbox texts were left
   alone**, for the reasons in `agent-text.md` section 7.
9. **Attaching a file to a draft** was left as a named follow-up
   (`MS365_MCP_UPLOAD_DIRS`), not folded into the recommendation, because it
   gives the server read access to a directory and deserves its own look.
