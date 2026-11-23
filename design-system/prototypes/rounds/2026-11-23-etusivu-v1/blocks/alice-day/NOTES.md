# alice-day

Alice's day: who she is, her places, her ten conversations and their sidebar states, the section's intro and its end. The twelve glimpses are their own blocks.

## v1 changes

- **Intro.** Kicker "One person, ten agents", headline "Alice's Thursday." The blurb now covers only Alice; the six colleagues are introduced once, in `roles-intro`, not twice. The paragraph tells the story the glimpses show (ten asks in her own words, from desk, tram and phone; one ran through lunch with the tabs closed; she never sat and waited). The scroll hint is now its own quiet line.
- **Fixed a false line.** Round 6 said "one is still running tonight". At 17:40 no conversation is in the Running state: the newsletter is waiting for her yes, and the order page is a service, not a running turn. The end now says just that.
- **End.** Three counted pills (10 conversations · 1 sidebar · 1 ordinary server) carry the page's through-line before the roles section, followed by the tomorrow line.
- **Sidebar.** Receipts at 12:44: "25 of 26 filed" became "25 of 26 done". In alice-07's reply 24 receipts are filed, parking is marked *no receipt*, and Bob is asked for the packaging one ("**25 of 26** done"). I checked every other line against its glimpse (counts 23/26, 386, 7 tasks, 17 pages, 3 orders, 3 + 4 notes, times) and they match. No glimpse titles changed.

## Sources and licenses

No third-party files.

## Engine needs

None. `.day-intro p:last-child` styled the blurb; because the intro now ends with the hint line, `block.css` styles the blurb paragraph itself.
