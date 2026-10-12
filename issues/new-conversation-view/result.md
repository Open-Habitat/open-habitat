# Result

The empty controlled conversation no longer renders a recap before native content exists. The controller's idle status displays **Odottaa**, including in the rail; a settled turn retains that open state rather than becoming **Valmis**. The rail uses the daemon controller catalog as evidence of a live process (the native snapshot alone reports process `unknown`), and uses the same observed command status as the conversation. While status is arriving, it leaves genuine uncertainty visible rather than guessing idle.

A missing session file for an empty running controller is not a history error. A failed history read is shown in the rail as **Historiaa ei voitu tarkistaa**, while native-confirmed unreadable history remains distinct. The rail now places secondary history/control warnings beneath the activity instead of floating them beside the title.

## Decisions for review

- A controller with an observed `idle` command is open and waiting, even before it has any turn attention; exit alone is not closure.
- Native snapshot discovery reads only a session header, so a corrupt message body is established by an attempted history read, not inferred from `history: readable`. A failed read says only that history could not be checked, not that its contents are corrupt.
- Keep a genuinely unknown state while a live controller's status has not yet arrived; do not hide it indefinitely or invent a failure.

## Verification

Synthetic lab with real conversation controller and fake Pi: [empty desktop](empty-desktop.png) ([HTML](empty-desktop.html)), [empty phone with navigation open](empty-phone.png) ([HTML](empty-phone.html)), [settled desktop](settled-desktop.png) ([HTML](settled-desktop.html)), and [settled phone with navigation open](settled-phone.png) ([HTML](settled-phone.html)). These are synthetic evidence, not live-host approval. The host-backed `@browser-conversation` test creates and sends through that controller and checks the rail after status returns idle with native history present. `@native-history` tests an actual corrupt synthetic history read and its rail warning. Desktop/phone captures of the corrupt case were not produced in the lab because its seeded workspaces differ from the native-history fixture; the host-backed browser assertion covers behavior, not visual approval of that case.

Final tree: pending clean gate. Live test guest and real Pi were not touched.
