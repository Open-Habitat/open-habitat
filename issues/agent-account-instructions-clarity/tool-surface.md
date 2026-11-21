# Which Microsoft tools the agent is given

Ehdotus, mitään ei ole rakennettu. Jari on päättänyt tästä vain kaksi asiaa
(14.11.2026): ohjeen pitää ohjata oikeaan eikä lisätä kieltoja, ja ehdotus
luetaan ennen kuin mitään toimitetaan. Kaikki muu alla on agentin ehdotusta.
Erottelu on lopussa.

## What happened

On a pilot installation a person asked their agent for a document in a
SharePoint folder. The agent found it, but on the way it called
`delete-mail-folder`. The call failed only because an argument was missing.
Deleting a mail folder deletes the mail in it.

## Why it can happen

The agent does not see a list of tools. It searches tool names with a few
words and gets the eight best matches. At the Full level a Microsoft account
offers 100 tools, 9 of them for files. "List folder" matches the right tool,
`list-folder-files`, and also `list-mail-folders` and `delete-mail-folder`.
This is the likely cause; the pilot's conversation was not read.

The account level does not prevent it. A level is what Microsoft allows, and
the permission that lets an agent write a draft also lets it delete a mail
folder, so three of the four levels allow it.

Two more things came up while counting:

- Six tools manage the sign-in itself (`logout`, `remove-account`). An agent
  that calls one signs the person out until they connect again in Settings.
- Five tools send mail. Three are named like ordinary actions
  (`reply-mail-message`) and send at once, with no draft to read first.

## Proposal

The agent works with what is in the mailbox, not with how the mailbox is
arranged. Messages, drafts, events, contacts and files are handed to an
assistant every day. Folders, calendars, sharing and sorting are set up a few
times a year, by the person, in Outlook.

| Goes | Tools | What a person can no longer ask the agent for |
|---|---|---|
| Arranging the mailbox | 20 | Creating, renaming or deleting a mail folder, a calendar or a contact folder; sharing a calendar; Focused Inbox rules |
| Sign-in management | 6 | Nothing. Accounts are connected and removed in Settings |
| Sending in one step | 4 | Nothing. The agent writes a draft and sends that draft when asked |
| Rare or technical | 15 | Forwarding a meeting invitation, attaching a file to an event, snoozing a reminder, copying a message |

| Tools offered | Full | Everything but sending | Drafts | Read only |
|---|---|---|---|---|
| Today | 100 | 95 | 66 | 48 |
| Proposed | 55 | 54 | 41 | 32 |

The loss most likely to be noticed is "make a folder for these and move them
there": the agent can still move messages into any existing folder, and the
person makes the folder. A removed tool that turns out to be missed comes
back in a release.

Levels work as today, there is no new setting, and nobody signs in again.
The shorter list is not a security boundary: the account's permissions still
allow everything that was removed. It changes what the agent is led to.

## Three questions

1. May the agent stop arranging the mailbox (the first row)?
2. May mail leave only through a draft (the third row)?
3. May the sign-in tools be hidden from the agent (the second row)?

Recommended: yes to all three.

## If accepted

Built as its own issue: Habitat's Microsoft list becomes the 55 names; the
six sign-in tools are hidden through Pi; the server gets the one-line
description in `agent-text.md`; and the test that today demands "the list
equals the server's ready-made sets" demands instead that every tool the
server has is either offered or deliberately not offered, so that a server
upgrade that adds a tool fails until someone decides. The 15 names that are
registered today but offered at no level (mail rules, mailbox settings)
leave the list too.

The exact names are the `KEEP` and `DROP` lists in `tool-surface-check.py`.
It starts the pinned server (0.170.1) at each level without network or
sign-in and fails unless the two lists are exactly the 100 tools offered
today. Every number here comes from it.

Two details for whoever builds it:

- Server 0.184.2, waiting as its own work, makes the sign-in tools obey
  Habitat's list, so hiding them through Pi is needed only until then. It
  also adds a stronger delete tool, which the new test keeps out.
- The server's description of `list-mail-attachments` points to
  `download-bytes`, which is on the `DROP` list. The agent's text then has to
  say that an attachment is saved with `download-bytes-to-file`.

## Erottelu

Lähteet: `item.md` sellaisena kuin se ensin kirjattiin, aiempien
tasopäätösten issuet, koodi ja kiinnitetty palvelin. Issuessa ei ole
päätösmerkintöjä, ja Jari ei ollut tavoitettavissa, joten erottelu on
agentin tekemä.

**Päätettyä**

- Ehdotus luetaan ennen toimitusta; ohje ohjaa oikeaan eikä lisää kieltoja
  (Jari 14.11.2026).
- Taso on Microsoftin valvoma raja ja tasoja on neljä (Jari 28.10. ja
  6.–8.11.2026). Ehdotus ei koske niihin.

**Ehdotusta**

- Raja "sisältö kyllä, järjestely ei" ja 55 työkalun lista. `item.md`
  kirjaa jaon Jarin suuntana, mutta sanamuoto on kapellimestarin; kysymys 1
  ratkaisee asian.
- Lähetys vain luonnoksen kautta ja kirjautumistyökalujen piilotus.
- Ei tilikohtaista kytkintä, eikä taso muuta listaa.
- Toteutus omana issuenaan ja testin muutos.

**Pudotettu**

- Kaaviot, tasokohtainen erittelytaulukko ja vaihtoehtotaulukko. Hylätyistä
  vaihtoehdoista ainoa, jota joku voi kaivata, on tilikohtainen kytkin
  kaikille työkaluille; se kannattaa rakentaa vasta, kun joku kaipaa jotakin
  poistettua.
- Liitetiedoston lisääminen luonnokseen (3 Mt:n raja). Eri asia, joka antaa
  palvelimelle lukuoikeuden hakemistoon ja vaatii oman päätöksensä.
- Työkalujen nimiluettelot. Ne ovat skriptissä, joka myös tarkistaa ne.

**Ristiriita.** `item.md` puhuu noin 110 Outlook-työkalusta ja
postisäännöistä. Mitattuna listalla on 109 nimeä, joista 100 tarjotaan
täydellä tasolla, eikä postisääntöjä tarjota millään tasolla.
