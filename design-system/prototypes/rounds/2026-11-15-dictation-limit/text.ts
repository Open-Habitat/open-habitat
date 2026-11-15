// The round's own words in both languages. The field, the listening bar,
// Valmis, Send and Nyt's warning and notice keep production's catalogs
// (web/src/text/dictation.tsx). The dictated passages are synthetic.

export type Lang = "fi" | "en";
export type SceneId = "early" | "minute" | "seconds" | "limit" | "drop";

const fi = {
	title: "Sanelun raja · kierros 1",
	theme: "Teema",
	themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
	language: "Kieli",
	lines: [
		"Nyt: 10 minuutin katto. Minuuttia ennen kentän yllä on harmaa rivi, joka muuttuu punaiseksi 20 sekuntia ennen. Ääntä ei ole, ja sanelu loppuu hiljaa.",
		"1 Kuuluva varoitus: katto pysyy 10 minuutissa. Palkissa näkyy koko ajan ”/ 10:00”, ja viimeisellä minuutilla se laskee alaspäin. Äänimerkki kuuluu minuuttia ja 10 sekuntia ennen sekä lopussa.",
		"2 Tunnin ketju: sanelu jatkuu katkeamatta uusina Soniox-istuntoina 10 minuutin välein, ja raja on tunti. Aikaa ei näytetä ennen viimeistä minuuttia; silloin äänimerkit ja lähtölaskenta ovat samat kuin suunnassa 1.",
		"3 Tauko päättää: sama tunnin ketju, mutta tunnin kohdalla sanelu päättyy vasta seuraavaan taukoon (enintään 30 s). Jäljellä oleva aika näkyy palkin alareunassa hupenevana viivana, ei numeroina.",
	],
	recommend:
		"Suositus: 2 Tunnin ketju. Tavallinen sanelu ei koskaan osu rajaan, ja raja on silti olemassa unohtunutta mikrofonia vastaan. Jos rajaan kuitenkin osutaan, äänimerkki tavoittaa myös sen, joka ei katso ruutua, ja kaikki sanottu on kentässä. Daemoniin ja sopimukseen ei tarvita muutoksia.",
	listen: "Kuuntele merkki",
	replay: "Toista loppu",
	scenes: {
		early: {
			title: "Alussa",
			caption: "Sanelua on takana 2 min 14 s.",
		},
		minute: {
			title: "Minuutti jäljellä",
			caption: "Sanelu lähestyy rajaa; varoitus on juuri tullut.",
		},
		seconds: {
			title: "10 sekuntia jäljellä",
			caption: "Toista loppu soittaa viimeiset sekunnit ja rajan merkkeineen.",
		},
		limit: {
			title: "Raja täynnä, teksti tallessa",
			caption:
				"Sanelu päättyi rajaan, ja kaikki sanottu on kentässä tavallisena tekstinä.",
		},
		drop: {
			title: "Yhteys katkesi",
			caption:
				"Yhteys Sonioxiin katkesi kesken; uusi avain on haussa ja mikrofoni kuuntelee yhä.",
		},
	} as Record<SceneId, { title: string; caption: string }>,
	// The direction's own words in the bar, above and below the field.
	of: (cap: string) => `/ ${cap}`,
	left: (time: string) => `${time} jäljellä`,
	listening: "kuuntelee",
	minuteNote: "Sanelu päättyy minuutin kuluttua.",
	minuteSub: "Kaikki sanottu jää kenttään.",
	secondsNote: "Sanelu päättyy 10 sekunnin kuluttua. Lopeta lause.",
	pauseNote: "Tunti täynnä tauon kohdalla. Sanelu päättyy seuraavaan taukoon.",
	pauseSub: "Lause saa loppua; enintään 30 sekuntia.",
	pauseSeconds: "Sanelu päättyy, kun pidät tauon.",
	pauseState: "päättyy taukoon",
	dropNote: "Yhteys Sonioxiin katkesi. Mikrofoni kuuntelee yhä.",
	dropSub: (time: string) =>
		`Ääntä tallessa ${time}; teksti tulee perään, kun yhteys palaa.`,
	dropState: "yhdistetään…",
	endTitle: {
		1: "Sanelu päättyi 10 minuutin kohdalla",
		2: "Sanelu päättyi tunnin kohdalla",
		3: "Sanelu päättyi tauossa tunnin jälkeen",
	} as Record<number, string>,
	endText: "Kaikki sanottu on kentässä. Mikrofoni on kiinni.",
	resume: "Jatka sanelua",
	dismiss: "Sulje ilmoitus",
	// The one live announcement at each threshold, not the countdown.
	say: {
		minute: "Sanelu päättyy minuutin kuluttua.",
		seconds: "Sanelu päättyy 10 sekunnin kuluttua.",
		pause: "Sanelu päättyy seuraavaan taukoon.",
	},
};

const en: typeof fi = {
	title: "Dictation limit · round 1",
	theme: "Theme",
	themes: { light: "Day", dark: "Night", contrast: "Contrast" },
	language: "Language",
	lines: [
		"Now: a 10-minute ceiling. A grey line appears above the field a minute before and turns red 20 seconds before. There is no sound, and the dictation ends quietly.",
		"1 Audible warning: the ceiling stays at 10 minutes. The bar always shows “/ 10:00” and counts down in the last minute. A tone sounds a minute and 10 seconds before, and at the end.",
		"2 One-hour chain: the dictation continues unbroken as new Soniox sessions every 10 minutes, and the limit is an hour. No time limit shows before the last minute; then the tones and countdown match direction 1.",
		"3 A pause ends it: the same one-hour chain, but at the hour the dictation ends at the next pause (at most 30 s). The time left is a shrinking line along the bar's lower edge, not numbers.",
	],
	recommend:
		"Recommendation: 2 One-hour chain. An ordinary dictation never reaches the limit, yet a limit remains against a forgotten microphone. If it is reached, the tone reaches a person not looking at the screen, and everything said is in the field. The daemon and the contract stay as they are.",
	listen: "Hear the tone",
	replay: "Play the end",
	scenes: {
		early: { title: "Early", caption: "2 min 14 s into the dictation." },
		minute: {
			title: "One minute left",
			caption: "The dictation nears the limit; the warning has just appeared.",
		},
		seconds: {
			title: "10 seconds left",
			caption:
				"Play the end runs the last seconds and the limit with its tones.",
		},
		limit: {
			title: "Limit reached, text kept",
			caption:
				"The dictation ended at the limit, and everything said is in the field as ordinary text.",
		},
		drop: {
			title: "Connection dropped",
			caption:
				"The connection to Soniox broke; a new key is on its way and the microphone still listens.",
		},
	},
	of: (cap) => `/ ${cap}`,
	left: (time) => `${time} left`,
	listening: "listening",
	minuteNote: "Dictation ends in a minute.",
	minuteSub: "Everything you said stays in the field.",
	secondsNote: "Dictation ends in 10 seconds. Finish your sentence.",
	pauseNote: "The hour is up. Dictation ends at your next pause.",
	pauseSub: "Your sentence may finish; at most 30 seconds.",
	pauseSeconds: "Dictation ends when you pause.",
	pauseState: "ends at a pause",
	dropNote: "The connection to Soniox broke. The microphone still listens.",
	dropSub: (time) =>
		`${time} of audio kept; the text follows once the connection is back.`,
	dropState: "reconnecting…",
	endTitle: {
		1: "Dictation stopped at 10 minutes",
		2: "Dictation stopped at one hour",
		3: "Dictation stopped at a pause after one hour",
	},
	endText: "Everything you said is in the field. The microphone is off.",
	resume: "Continue dictating",
	dismiss: "Close notice",
	say: {
		minute: "Dictation ends in a minute.",
		seconds: "Dictation ends in 10 seconds.",
		pause: "Dictation ends at your next pause.",
	},
};

export const TEXT: Record<Lang, typeof fi> = { fi, en };

/** What the person has said so far in each scene, and what Soniox
 * confirms after the stream is ended. Synthetic. */
export const SPOKEN: Record<
	Lang,
	{ said: string; guess: string; more: string[]; last: string }
> = {
	fi: {
		said: "Selitän nyt koko taustan, jotta ymmärrät mistä on kyse. Kirjaston varausjärjestelmä lähettää muistutukset kahteen kertaan, ja asiakkaat ovat valittaneet siitä jo viikon ajan.\n\nEnsimmäinen viesti lähtee heti varauksen jälkeen ja toinen yöajossa, vaikka varaus olisi jo noudettu. Katsoisitko ajon ehdot ja sen, mistä se päättelee noudon",
		guess: " ja korjaisitko",
		more: [
			" sen niin,",
			" että toinen",
			" viesti",
			" lähtee vain",
			" noutamattomista",
			" varauksista.",
			" Lisää myös",
			" testi.",
		],
		last: " Kiitos.",
	},
	en: {
		said: "Let me explain the whole background so you see what is going on. The library's reservation system sends its reminders twice, and patrons have been complaining for a week.\n\nThe first message goes out right after the reservation and the second in the nightly run, even when the item has already been collected. Could you look at the run's conditions and how it decides an item was collected",
		guess: " and fix it",
		more: [
			" so that",
			" the second",
			" message",
			" only goes",
			" to uncollected",
			" reservations.",
			" Add a",
			" test too.",
		],
		last: " Thanks.",
	},
};
