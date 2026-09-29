# Synthetic lab visual check (not yet reviewed by Jari)

`before-desktop.png` and `before-narrow.png` show a saved Pi tool-use message marked **Valmis** while the header says **Pi työskentelee** and the tool is still running. `after-desktop.png` and `after-narrow.png` show the same slow (`hidas`) flow with the message header reduced to **Pi**; the work indicator remains in the conversation header/progress panel. Both runs used the disposable lab, synthetic Alice, the real controller and fake Pi. Screenshots were captured immediately after the intermediate message appeared, before the tool result. No live host or real Pi was used.

The narrow screenshot still has the existing conversation viewport/scroll layout; this change does not alter layout or the neighboring conversation view. Compare the message header and progress indicator rather than treating the screenshot as a layout approval.
