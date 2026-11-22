# The account menu: order, icons, general feedback and the phone (prototype round)

## Saatesanat

Kaikissa kolmessa suunnassa järjestys on korjattu samalla tavalla.
*Asetukset* ja *Palvelimen ylläpito* ovat vierekkäin, koska kumpikin
avaa sivun. *Selitä tämä näkymä* ja uusi *Palaute Habitatista…* ovat
niiden alla omana ryhmänään. *Kirjaudu ulos…* on viimeisenä. Jokaisella
toimintorivillä on kuvake edessään, ja Selitän kuvake on sama `?` kuin
yläpalkissa. Suunnat eroavat siinä, mitä tehdään pikavalinnoille (Teema,
Agentin työ ja Äänet).

A pitää pikavalinnat nimettyinä riveinä kuten nyt. Rivit ovat
toimintojen ja uloskirjautumisen välissä, ja niilläkin on kuvake
edessään. B vie Teeman ja Agentin työn Asetuksiin. Valikkoon jää vain
toimintoja sekä yksi valintarivi, *Hiljaa tällä laitteella*, koska
äänet pitää voida hiljentää heti, kun palaveri alkaa. C kokoaa
pikavalinnat kuvakeriviksi nimesi alle: teeman neljä kuvaketta, silmä
agentin työlle ja kaiutin äänille. Rivin alla tila lukee sanoina.

Katselmointipalkin *Tili*-valinnalla näet valikon ilman Palvelimen
ylläpitoa, eli niin kuin tavallinen käyttäjä sen näkee. *Laite*-valinta
näyttää työpöydän ja puhelimen vierekkäin tai erikseen. Puhelimessa
valikko on kaikissa suunnissa alareunasta nouseva arkki, jonka rivit
ovat sormen korkuisia. Kokeile *Palaute Habitatista…*: paneeli kertoo
ennen lähetystä, että palaute lähtee julkisena GitHub-issuena, mitä
siihen tulee automaattisesti ja mitä ei koskaan. *Näytä, mitä lähtee*
näyttää koko issuen.

Suosittelen A:ta. Kun Asetukset ja ylläpito ovat vierekkäin ja Selitä ja
Palaute yhdessä, järjestyksen syy näkyy suoraan. Valikko avautuu
tilinapista ylöspäin, joten valikon alaosa on lähimpänä osoitinta ja
puhelimessa peukaloa. Siksi ainoat usein käytetyt asiat, eli
pikavalinnat, ovat siellä, ja ne näkyvät nimineen. B on siistein ja
paras näppäimistölle, mutta Agentin työ on valinta, jota oikeasti
vaihdetaan päivän mittaan, ja Asetuksissa se on kolmen napsautuksen
päässä. C on lyhyt, mutta silmä- ja kaiutinkuvakkeesta pitää arvata,
mitä ne tekevät, ja kuvakerivi on valikon yläreunassa kauimpana
osoittimesta.

## Built page

`design-system/prototypes/dist/account-menu/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-22-account-menu/build.mjs`.
A copy that outlives the worktree:
`/var/tmp/agent-keep/account-menu-round/offline.html`. The check's
screenshots are in `/var/tmp/agent-keep/account-menu-round/check/`. The
round's `NOTES.md` lists the URL parameters (`?v=1..3`, `?theme=dark`,
`?lang=en`, `?admin=0`, `?device=desktop|phone`, `?night=1`) and the
commands.

`check.mjs` passed 240 checks with a clean console. Its header lists them
all. In brief, for every direction:

- desktop 1440 px in Päivä and Yö: the menu is open on load, with the
  phone frame beside it showing its own open menu. The items come in the
  order Asetukset, Palvelimen ylläpito, Selitä, Palaute, Kirjaudu ulos.
  Every item has its icon in front of the label, and Selitä's icon is the
  top bar's `?`. Only A has the quick rows, between help and sign out.
  Only B has the Hiljaa item and no theme. Only C has the icon row, above
  the actions. The menu fits inside the window;
- an ordinary user: the same menu without Palvelimen ylläpito;
- keyboard: Enter on the account button opens the menu with focus on the
  first item. The arrow keys reach Palaute, and Enter opens the panel
  with the field focused. Esc closes the panel and gives focus back to
  the account button;
- the panel: it says the issue is public and what is included. An empty
  send nudges. The preview has the text and the version but no server
  name and no person. Sending shows the done state;
- the quick choices: the theme choice changes the page's theme, and
  muting puts the speaker badge on the account button;
- phone 390 px with touch, in Päivä and Yö: the menu is a bottom sheet
  with every item at least 44 px high and no sideways scroll. Palaute
  opens the panel as a bottom sheet.

English is checked once, and so is the shared picker.

## Axis and directions

Axis: **the menu's grouping and order, and how much of it is icons**.
What is shared:

- Order: pages (Asetukset, then Palvelimen ylläpito for administrators),
  then help (Selitä tämä näkymä, Palaute Habitatista…), then sign out.
  Jari's objection was that Selitä separated the two items that open a
  page.
- A leading icon on every action row. Asetukset has `gear`, Palvelimen
  ylläpito `server`, Selitä the top bar's `?` mark (`ah-explain-q`),
  Palaute `message` and Kirjaudu ulos `logout`. These are all existing
  production icons.
- Phone: a bottom sheet from the drawer, with touch-height rows and a
  grip.
- The general feedback panel, which is explain-f-reminder round 2's
  "Palaute Habitatista" given its own entry.

What differs:

- **A Groups**: the quick rows keep their names and segmented controls,
  each with a leading icon so the icon column runs through the whole
  menu. The keyboard structure is production's: a menu, then the rows
  reached by Tab, then a one-item menu with Kirjaudu ulos.
- **B Actions only**: Teema and Agentin työ move to Settings' Ulkoasu
  section. Muting stays as a checkable item. One menu, so the arrow keys
  and type-ahead reach everything.
- **C Quick row**: the theme's four icons, an Agentin työ toggle (eye)
  and a mute toggle (speaker) in a row under the person, with the state
  in words beneath. Then A's actions.

## The general feedback panel

The panel says, before anything is sent:

- that the feedback opens in a new tab as a ready GitHub issue and is
  sent only when the person presses Submit there;
- that the issue is public, that anyone can read it, that submitting
  needs a GitHub account, and that it must not contain conversations,
  names or passwords;
- what is included automatically: the text, the Open Habitat version,
  the interface language and the kind of view;
- what is never included: the server's name, the account, workspaces,
  conversations or the page address. Nothing stays on the server.

*Näytä, mitä lähtee* shows the issue exactly. The URL goes to the
product's repository (`FEEDBACK_REPO`) with a new issue form
`feedback.yml`, the same way the explain card's report works
(`web/src/components/explainFeedback.ts`). On the desktop the panel is a
window beside the rail, so the view being written about stays visible
behind the scrim. On a phone it is a bottom sheet, and the drawer closes
under it.

## Accessibility and touch

- Every icon is decorative (`aria-hidden`). The item's text is its name,
  so the icons add no extra speech.
- The action items are React Aria menu items in labelled sections
  (Sivut, Apua), so a screen reader announces the groups. The separators
  are `role="separator"`.
- A and C keep production's split: arrow keys within the actions, Tab to
  the quick controls, Tab to sign out. B is one menu.
- C's toggles are `aria-pressed` buttons whose names say what they
  toggle. Their state is also written out under the row, because the
  icon alone does not carry it.
- On the phone every row is at least 44 px high, and the sheet respects
  the safe-area inset.

## What the view assumes from the host

Only what production already reads: whether the person is an
administrator (today's `onAdministration`), the product version for the
feedback issue (`/api/v1/server`, as the explain report reads it), and
the device's mute and night state. Nothing new crosses the browser/host
contract.

## Decisions for later review

- **Palvelimen ylläpito right after Asetukset.** The alternatives were
  its own group just above sign out, or a link on the Settings page. I
  put it beside Asetukset because both open a full page, and Jari's
  complaint implies they belong together. For an ordinary user the item
  is simply absent.
- **The phone menu is a bottom sheet in every direction.** The
  alternative was production's popover inside the drawer. The full A
  menu is about 560 px tall, which overflows a short phone as a popover.
  A sheet from the bottom is where the thumb already is.
- **Selitä's icon is the top bar's `?`, not the `question` icon.** The
  same mark tells the person that the menu item and the top-bar button
  are the same mode.
- **Palaute ends in "…".** It opens a panel, not an action, in the same
  way as Kirjaudu ulos….
- **B keeps muting in the menu.** Moving every toggle out would be
  cleaner, but muting is the one choice that is time-critical.
- **The panel's feedback issue form `feedback.yml` does not exist yet.**
  Blank issues are disabled, so implementation needs a new form beside
  `explain-feedback.yml`. That is a repository file, not an
  architecture change.
- **The panel opens on top of the view instead of navigating.** The
  person keeps seeing what they write about. The alternative was a
  Help and feedback section in Settings, which costs a page change and
  is not reachable from where the person noticed the problem.

## Questions for Jari

1. A, B or C? If you choose A, would you like the quick rows in the same
   order as now (Teema, Agentin työ, Äänet), or Agentin työ first,
   because you probably change it most often?
2. Is Palvelimen ylläpito in the right place beside Asetukset, or would
   you put it last above Kirjaudu ulos, away from the everyday items?
3. Should the group names (Sivut, Apua) be visible as small headings? In
   the prototype they are only separators, which screen readers announce
   by name.
4. On the phone, does the sheet feel right, or would you rather keep the
   menu as a popover in the drawer like today?
