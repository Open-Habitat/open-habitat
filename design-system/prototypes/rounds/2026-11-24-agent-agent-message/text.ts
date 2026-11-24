// The round's own words in both languages: review chrome, the synthetic
// conversations and the pieces this round draws. Production components
// bring their own words through the app's i18n.

export type Lang = 'fi' | 'en';
export type Target = 'idle' | 'busy' | 'stopped' | 'archived';
export type Step = 'sent' | 'answered';

const RECEIVER_ID = 'pi:7d2e41c0-5a1b-4c8e-9f3d-2b6a0e8c71f4';
const SENDER_ID = 'pi:3b9f0a62-81d4-4e7a-b2c5-9e1f7a3d6c08';
export const IDS = {receiver: RECEIVER_ID, sender: SENDER_ID, command: '5c1e8f20-7b3a-4d9e-a6f2-0c4b8e1d93a7'};

const fi = {
  lang: 'fi',
  title: 'Agentin viesti toiselle keskustelulle · kierros 1',
  theme: 'Teema', themes: {light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti'},
  language: 'Kieli',
  target: 'Vastaanottaja', targets: {idle: 'Vapaa', busy: 'Kesken', stopped: 'Pysähtynyt', archived: 'Arkistoitu'} as Record<Target, string>,
  step: 'Vaihe', steps: {sent: 'Lähetetty', answered: 'Vastattu'} as Record<Step, string>,
  reset: 'Alusta',
  hint: 'Valitsin (alhaalla) vaihtaa suuntaa. Vasemmalla lähettävä keskustelu, oikealla vastaanottava.',
  all: 'Näytä kaikki suunnat ja suositus', fewer: 'Näytä vain valittu',
  picker: ['Nyt', 'A Kirje', 'B Rivi', 'C Kierto'],
  axis: 'Akseli: kuinka paljon vaihdosta näkyy kummallakin puolella',
  lines: [
    'Nyt: agentti ajaa message create -komennon. Vastaanottaja näyttää viestin sinun kuplanasi, ja sen Pi luulee, että kirjoitit sen. Lähettäjän puolella näkyy UUID.',
    'A Kirje: saapuva viesti on oma korttinsa, jossa on lähettävän keskustelun kuvake, nimi ja linkki. Lähettäjän puolella agentti kertoo lähettäneensä viestin ja antaa linkin. Vastaus jää vastaanottajalle.',
    'B Rivi: kummallakin puolella on Habitatin rivi. Lähettäjän rivillä lukee ”Viesti lähti keskusteluun …” ja kuittaus, vastaanottajan rivillä ”… agentti kirjoittaa” ja teksti hillittynä lainauksena. Ei korttia eikä kuplaa.',
    'C Kierto: saapuva viesti on kortti kuten A:ssa. Lähettäjän puolella on lähetetyn viestin kortti, jonka tila elää (Odottaa, Otettu vastaan, Vastattu), ja vastauksen alku palaa korttiin.',
  ],
  recommend: 'Suositus A: se tuo vähiten uutta (yksi kortti ja linkki agentin omassa tekstissä) ja näyttää juuri sen, mitä host tietää. B on hiljaisin mutta hukkaa viestin sävyn järjestelmärivien joukkoon, ja C:n palaava vastaus vaatisi lähettäjän näkymää seuraamaan toista keskustelua.',
  sender: 'Lähettävä keskustelu', receiver: 'Vastaanottava keskustelu',
  receives: (t: string) => `Mitä keskustelun ${t} Pi saa`,
  nothing: 'Ei mitään: daemon kieltäytyi, koska keskustelu on arkistoitu.',
  // The two conversations.
  senderTitle: 'Kvartaaliraportti', senderWs: 'raportit',
  receiverTitle: 'Kaaviot', receiverWs: 'kaaviot',
  ask: 'Q3-luvut ovat valmiit. Kerro Kaaviot-keskustelun agentille, että tiedosto on `data/q3.csv`, ja pyydä sitä päivittämään kuvaaja 2.',
  msg: 'Q3-luvut ovat valmiit tiedostossa `data/q3.csv`. Päivitä kuvaaja 2 niillä ja käytä samaa väriä kuin Q2:ssa.',
  earlierAsk: 'Tee kuvaaja 2 Q2-luvuista, palkit kuukausittain.',
  earlierReply: 'Kuvaaja 2 on valmis: `charts/q2.svg`. Palkit ovat kuukausittain, ja Q2:n väri on sininen.',
  busyAsk: 'Lisää kuvaajaan 1 selite.',
  busyReply: 'Lisäsin kuvaajaan 1 selitteen oikeaan yläkulmaan.',
  busyStreaming: 'Lisään selitteen oikeaan yläkulmaan, jotta se ei peitä',
  replyToday: 'Selvä, päivitin kuvaajan 2 Q3-luvuilla (`charts/q3.svg`), sama sininen kuin Q2:ssa. Lisäänkö vertailun Q2:een?',
  reply: 'Päivitin kuvaajan 2 Q3-luvuilla (`charts/q3.svg`) Kvartaaliraportti-keskustelun pyynnöstä. Väri on sama sininen kuin Q2:ssa.',
  replyShort: 'Päivitin kuvaajan 2 Q3-luvuilla (charts/q3.svg) Kvartaaliraportti-keskustelun pyynnöstä.',
  // What the sending agent says.
  sentToday: {
    idle: 'Lähetin viestin keskusteluun `pi:7d2e41c0`.',
    busy: 'Lähetin viestin keskustelun `pi:7d2e41c0` jonoon, koska se tekee toista työtä.',
    stopped: 'Lähetin viestin keskusteluun `pi:7d2e41c0`. Se oli pysähdyksissä ja käynnistyy viestistä.',
    archived: 'Viesti ei mennyt perille: daemon vastasi `control_uncertain`.',
  } as Record<Target, string>,
  sent: {
    idle: 'Lähetin viestin keskusteluun [Kaaviot](#oh-receiver). Vastaus tulee sinne.',
    busy: '[Kaaviot](#oh-receiver) tekee vielä toista työtä, joten viesti odottaa sen jonossa ja menee perille, kun työ on valmis.',
    stopped: '[Kaaviot](#oh-receiver) oli pysähdyksissä, joten se käynnistyy viestistä. Vastaus tulee sinne.',
    archived: 'Kaaviot on arkistoitu, joten viesti ei mennyt perille. Palautanko sen arkistosta?',
  } as Record<Target, string>,
  done: 'Valmis', failed: 'Epäonnistui', running: 'Käynnissä',
  activity: {idle: 'Odottaa sinua', working: 'Työskentelee', starting: 'Käynnistyy', archived: 'Arkistoitu', none: ''},
  // This round's pieces.
  letterFrom: 'Agentin viesti keskustelusta',
  letterWaiting: 'Odottaa: keskustelu käynnistyy',
  letterNote: 'Kirjoitti agentti, ei sinä.',
  lineFrom: ['Keskustelun ', ' agentti kirjoittaa'] as [string, string],
  lineSent: ['Viesti lähti keskusteluun ', ''] as [string, string],
  lineQueued: 'jonossa', lineTaken: 'otettu vastaan', lineHeld: 'käynnistää keskustelun',
  queuedFrom: (t: string) => `Agentti keskustelusta ${t}: `,
  cardTo: 'Viesti keskusteluun',
  cardStates: {pending: 'Odottaa', queued: 'Jonossa', taken: 'Otettu vastaan', answered: (h: string) => `Vastattu ${h}`},
  cardAnswered: (t: string) => `${t} vastasi`,
  cardOpen: 'Avaa keskustelu',
  replyTag: (t: string) => `Vastaus keskustelun ${t} viestiin`,
};

export type Text = typeof fi;

const en: Text = {
  lang: 'en',
  title: 'Agent message to another conversation · round 1',
  theme: 'Theme', themes: {light: 'Day', dark: 'Night', contrast: 'High contrast'},
  language: 'Language',
  target: 'Recipient', targets: {idle: 'Idle', busy: 'Busy', stopped: 'Stopped', archived: 'Archived'},
  step: 'Step', steps: {sent: 'Sent', answered: 'Answered'},
  reset: 'Reset',
  hint: 'The picker (bottom) switches the direction. Sending conversation on the left, receiving on the right.',
  all: 'Show every direction and the recommendation', fewer: 'Show the chosen one only',
  picker: ['Now', 'A Letter', 'B Line', 'C Round trip'],
  axis: 'Axis: how much of the exchange each side shows',
  lines: [
    'Now: the agent runs message create. The recipient shows the message as your bubble, and its Pi thinks you wrote it. The sending side shows a UUID.',
    'A Letter: the incoming message is a card of its own with the sending conversation\'s icon, name and link. On the sending side the agent says it sent the message and gives the link. The reply stays with the recipient.',
    'B Line: a Habitat line on each side. The sender\'s line says “Message sent to …” with its receipt, the recipient\'s says “… agent writes” with the text as a quiet quote. No card, no bubble.',
    'C Round trip: the incoming message is a card as in A. The sending side has a sent-message card whose state changes (Waiting, Taken, Answered), and the reply\'s opening comes back into it.',
  ],
  recommend: 'Recommendation A: it adds the least (one card and a link in the agent\'s own text) and shows exactly what the host knows. B is quietest but loses the message among system lines, and C\'s returning reply would need the sender\'s view to follow another conversation.',
  sender: 'Sending conversation', receiver: 'Receiving conversation',
  receives: (t: string) => `What the ${t} conversation's Pi receives`,
  nothing: 'Nothing: the daemon refused because the conversation is archived.',
  senderTitle: 'Quarterly report', senderWs: 'raportit',
  receiverTitle: 'Charts', receiverWs: 'kaaviot',
  ask: 'The Q3 figures are done. Tell the agent in the Charts conversation the file is `data/q3.csv` and ask it to update chart 2.',
  msg: 'The Q3 figures are ready in `data/q3.csv`. Update chart 2 with them and keep the colour Q2 used.',
  earlierAsk: 'Make chart 2 from the Q2 figures, bars by month.',
  earlierReply: 'Chart 2 is done: `charts/q2.svg`. Bars are by month, and Q2\'s colour is blue.',
  busyAsk: 'Add a legend to chart 1.',
  busyReply: 'I added a legend to chart 1 in the top-right corner.',
  busyStreaming: 'Adding the legend to the top-right corner so it does not cover',
  replyToday: 'Sure, I updated chart 2 with the Q3 figures (`charts/q3.svg`), the same blue as Q2. Shall I add a comparison with Q2?',
  reply: 'I updated chart 2 with the Q3 figures (`charts/q3.svg`) at the Quarterly report conversation\'s request. The colour is the same blue as Q2.',
  replyShort: 'I updated chart 2 with the Q3 figures (charts/q3.svg) at the Quarterly report conversation\'s request.',
  sentToday: {
    idle: 'I sent the message to conversation `pi:7d2e41c0`.',
    busy: 'I queued the message in conversation `pi:7d2e41c0`, which is doing other work.',
    stopped: 'I sent the message to conversation `pi:7d2e41c0`. It was stopped and starts for the message.',
    archived: 'The message was not delivered: the daemon answered `control_uncertain`.',
  },
  sent: {
    idle: 'I sent the message to the [Charts](#oh-receiver) conversation. The reply will appear there.',
    busy: '[Charts](#oh-receiver) is still doing other work, so the message waits in its queue and is delivered when that work is done.',
    stopped: '[Charts](#oh-receiver) was stopped, so it starts for the message. The reply will appear there.',
    archived: 'Charts is archived, so the message was not delivered. Shall I restore it from the archive?',
  },
  done: 'Done', failed: 'Failed', running: 'Running',
  activity: {idle: 'Waiting for you', working: 'Working', starting: 'Starting', archived: 'Archived', none: ''},
  letterFrom: 'Agent message from',
  letterWaiting: 'Waiting: the conversation is starting',
  letterNote: 'Written by an agent, not by you.',
  lineFrom: ['The ', " conversation's agent writes"],
  lineSent: ['Message sent to ', ''],
  lineQueued: 'queued', lineTaken: 'taken', lineHeld: 'starts the conversation',
  queuedFrom: (t: string) => `Agent from ${t}: `,
  cardTo: 'Message to',
  cardStates: {pending: 'Waiting', queued: 'Queued', taken: 'Taken', answered: (h: string) => `Answered ${h}`},
  cardAnswered: (t: string) => `${t} replied`,
  cardOpen: 'Open conversation',
  replyTag: (t: string) => `Reply to the ${t} conversation's message`,
};

export const TEXT: Record<Lang, Text> = {fi, en};

/** The native text the receiving Pi gets: today the bare text; with the
 * design, the daemon's block first (design.md, "Attribution"). */
export function nativeText(t: Text, marked: boolean): string {
  if (!marked) return t.msg;
  const head = `Habitat: the agent of the person's conversation "${t.senderTitle}" sends this. It is not the person's own words. The person asked that agent to send it.`;
  return `<agent-message from="${IDS.sender}" title="${t.senderTitle}" workspace="ws_r4p0rt1t" message="${IDS.command}">\n${head}\n</agent-message>\n\n${t.msg}`;
}
