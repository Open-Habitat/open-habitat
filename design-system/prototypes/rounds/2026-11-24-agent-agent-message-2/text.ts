// The round's own words in both languages: review chrome, the synthetic
// story in two conversations and the pieces this round draws. Production
// components bring their own words through the app's i18n.

export type Lang = 'fi' | 'en';
/** The story's steps, cumulative: each adds to the one before. */
export const STEPS = ['sent', 'back', 'midturn', 'several', 'quote'] as const;
export type Step = (typeof STEPS)[number];
export type MsgId = 'm1' | 'm2' | 'm3' | 'm4' | 'm5';
export type Side = 'sender' | 'receiver';

export const IDS = {
  receiver: 'pi:7d2e41c0-5a1b-4c8e-9f3d-2b6a0e8c71f4',
  sender: 'pi:3b9f0a62-81d4-4e7a-b2c5-9e1f7a3d6c08',
  /** Each message's id is the sending command's idempotency key, which
   * both conversations' histories already carry. */
  msg: {
    m1: '5c1e8f20-7b3a-4d9e-a6f2-0c4b8e1d93a7',
    m2: 'a07d3b91-2c64-4f1e-8b5a-d3e9f2c10a46',
    m3: 'e41f9c07-6d2b-4a83-9e15-7b0c3a8d2f61',
    m4: '0b8e2d5c-91f3-4c7a-a6e2-4f1d9b3c8e07',
    m5: '7f3a1c9e-4b0d-42e8-b571-c6d8e2a9f034',
  } as Record<MsgId, string>,
};

type Msg = {from: Side; time: string; text: string; quote?: MsgId; queued?: boolean};

const fi = {
  lang: 'fi',
  title: 'Agentin viesti toiselle keskustelulle · kierros 2',
  theme: 'Teema', themes: {light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti'},
  language: 'Kieli',
  step: 'Vaihe',
  steps: {
    sent: '1 Viesti lähtee',
    back: '2 Yksi takaisin',
    midturn: '3 Tulee kesken vuoron',
    several: '4 Useita takaisin',
    quote: '5 Lainaus',
  } as Record<Step, string>,
  prev: 'Edellinen', next: 'Seuraava',
  reset: 'Alusta',
  hint: 'Vasemmalla lähettävä keskustelu, oikealla vastaanottava. Nimi viestissä vie toiseen keskusteluun samaan viestiin, lainaus alkuperäiseen.',
  all: 'Näytä kaikki suunnat ja suositus', fewer: 'Näytä vain valittu',
  picker: ['Nyt', 'A Kirjeet', 'B Säie', 'C Nauha'],
  axis: 'Akseli: miltä edestakainen vaihto näyttää ajan mittaan kummallakin puolella',
  lines: [
    'Nyt: viesti on bash-rivi ja UUID. Vastaanottaja näyttää sen sinun kuplanasi, ja viesti takaisin näkyy lähettäjälläkin sinun kuplanasi.',
    'A Kirjeet: jokainen viesti on oma kuplansa siinä kohdassa, jossa se lähti tai tuli. Tuleva näyttää sinun viestiltäsi, mutta lähettäjä on toinen agentti; lähtevä on agentin puolella. Lainaus on viestin yläreunassa.',
    'B Säie: vaihto yhden keskustelun kanssa kootaan yhdeksi säikeeksi siihen kohtaan, josta se alkoi. Uusi viesti jättää aikajanan loppuun rivin, joka vie säikeeseen.',
    'C Nauha: jokainen viesti on tiivis rivi, jonka saa auki. Vaihto kulkee aikajanassa työn seassa ja vie vähiten tilaa.',
  ],
  recommend: 'Suositus A: viesti on viesti molempiin suuntiin, eikä mitään tarvitse yhdistää pyyntöön. Agentin reaktio on heti viestin alla, missä se luetaan. B kokoaa vaihdon mutta irrottaa viestin siitä työstä, jonka se käynnisti; C säästää tilaa mutta piilottaa sen, mihin agentti juuri tarttui.',
  sender: 'Lähettävä keskustelu', receiver: 'Vastaanottava keskustelu',
  receives: 'Viimeisin agentin viesti, jonka tämän keskustelun Pi sai',
  nothingYet: 'Ei vielä yhtään.',
  // The two conversations.
  senderTitle: 'Kvartaaliraportti', senderWs: 'raportit',
  receiverTitle: 'Kaaviot', receiverWs: 'kaaviot',
  msgs: {
    m1: {from: 'sender', time: '9.39', text: 'Q3-luvut ovat valmiit tiedostossa `data/q3.csv`. Päivitä kuvaaja 2 niillä samalla värillä kuin Q2:ssa ja kerro minulle, kun se on valmis.'},
    m2: {from: 'receiver', time: '9.43', text: 'Kuvaaja 2 on päivitetty Q3-luvuilla: `charts/q3.svg`. Väri on sama sininen kuin Q2:ssa.'},
    m3: {from: 'receiver', time: '9.46', text: 'Huomasin vielä, että `data/q3.csv`:stä puuttuu syyskuu. Kuvaajassa on nyt vain heinä- ja elokuu.', queued: true},
    m4: {from: 'sender', time: '9.51', text: 'Lisäsin syyskuun rivin tiedostoon `data/q3.csv`. Päivitä kuvaaja 2 vielä kerran.', quote: 'm3'},
    m5: {from: 'receiver', time: '9.54', text: 'Kuvaaja 2 kattaa nyt heinä–syyskuun: `charts/q3.svg`.', quote: 'm4'},
  } as Record<MsgId, Msg>,
  s: {
    ask: 'Q3-luvut ovat valmiit. Kerro Kaaviot-keskustelun agentille, että tiedosto on `data/q3.csv`, ja pyydä sitä päivittämään kuvaaja 2. Tee sillä välin taulukot.',
    sent: 'Lähetin viestin keskusteluun [Kaaviot](#oh-receiver-m1). Teen sillä välin taulukot.',
    sentToday: 'Lähetin viestin keskusteluun `pi:7d2e41c0`. Teen sillä välin taulukot.',
    tables: 'Taulukot 1–3 ovat raportissa. Kuvaaja 2 tulee lukuun 3, kun se on valmis.',
    placed: 'Lisäsin päivitetyn kuvaajan 2 raportin lukuun 3.',
    placedToday: 'Lisäsin kuvaajan 2 lukuun 3, kuten pyysit.',
    intro: 'Kirjoita raportille lyhyt johdanto.',
    introStreaming: 'Johdanto kertoo ensin neljänneksen päätulokset, sitten',
    introDone: 'Johdanto on raportin alussa: neljänneksen päätulokset ja mitä seuraavaksi.',
    missing: 'Kaaviot huomasi, että syyskuu puuttuu tiedostosta `data/q3.csv`. Syyskuun luvut ovat tiedostossa `data/syyskuu.csv`. Yhdistänkö ne ja kerron Kaavioille?',
    missingToday: 'Syyskuu puuttuu tiedostosta `data/q3.csv`, kuten kirjoitit. Luvut ovat tiedostossa `data/syyskuu.csv`. Yhdistänkö ne?',
    yes: 'Kyllä, yhdistä ja kerro sille.',
    told: 'Yhdistin syyskuun tiedostoon `data/q3.csv` ja kerroin [Kaavioille](#oh-receiver-m4).',
    toldToday: 'Yhdistin syyskuun ja lähetin viestin keskusteluun `pi:7d2e41c0`.',
    final: 'Raportin kuvaaja 2 kattaa nyt koko neljänneksen.',
    finalToday: 'Selvä, kuvaaja 2 on nyt ajan tasalla raportissa.',
  },
  r: {
    earlierAsk: 'Tee kuvaaja 2 Q2-luvuista, palkit kuukausittain.',
    earlierReply: 'Kuvaaja 2 on valmis: `charts/q2.svg`. Palkit ovat kuukausittain, ja Q2:n väri on sininen.',
    told: 'Päivitin kuvaajan 2 ja kerroin [Kvartaaliraportille](#oh-sender-m2). Syyskuu puuttuu datasta, joten [kerroin siitäkin](#oh-sender-m3).',
    toldToday: 'Päivitin kuvaajan 2 ja kerroin keskusteluun `pi:3b9f0a62`. Syyskuu puuttuu datasta, joten kerroin siitäkin.',
    again: 'Päivitin kuvaajan heinä–syyskuulle ja kerroin [Kvartaaliraportille](#oh-sender-m5).',
    againToday: 'Päivitin kuvaajan ja kerroin keskusteluun `pi:3b9f0a62`.',
  },
  done: 'Valmis', running: 'Käynnissä',
  activity: {idle: 'Odottaa sinua', working: 'Työskentelee'},
  // This round's pieces.
  agentOf: (t: string) => `${t}`,
  agentWord: 'agentti',
  inLabel: (t: string) => `Agentin viesti keskustelusta ${t}`,
  outTo: 'Lähetetty keskusteluun',
  outQueued: (t: string) => `Jonossa: ${t} oli kesken`,
  quoteOf: (who: string, time: string) => `${who} · ${time}`,
  quoteJump: (time: string) => `Siirry lainattuun viestiin (klo ${time})`,
  quoteLabel: 'Viittaa viestiin',
  you: 'Sinä',
  thisAgent: 'Tämän keskustelun agentti',
  queuedFrom: (t: string) => `Agentti keskustelusta ${t}: `,
  thread: (t: string, n: number) => `Viestit keskustelun ${t} kanssa · ${n}`,
  pointerIn: (t: string) => `${t} kirjoitti`,
  pointerOut: (t: string) => `Lähetetty keskusteluun ${t}`,
  inThread: 'säikeessä',
  expand: 'Näytä koko viesti', collapse: 'Pienennä',
};

export type Text = typeof fi;

const en: Text = {
  lang: 'en',
  title: 'Agent message to another conversation · round 2',
  theme: 'Theme', themes: {light: 'Day', dark: 'Night', contrast: 'High contrast'},
  language: 'Language',
  step: 'Step',
  steps: {
    sent: '1 The message goes',
    back: '2 One back',
    midturn: '3 Arrives mid-turn',
    several: '4 Several back',
    quote: '5 Quote',
  },
  prev: 'Previous', next: 'Next',
  reset: 'Reset',
  hint: 'Sending conversation on the left, receiving on the right. The name on a message opens the other conversation at the same message; a quote opens its original.',
  all: 'Show every direction and the recommendation', fewer: 'Show the chosen one only',
  picker: ['Now', 'A Letters', 'B Thread', 'C Strip'],
  axis: 'Axis: how a back-and-forth looks over time on both sides',
  lines: [
    'Now: the message is a bash row and a UUID. The recipient shows it as your bubble, and a message back shows as your bubble on the sender\'s side too.',
    'A Letters: every message is its own bubble where it was sent or arrived. An incoming one looks like your message but the sender is another agent; an outgoing one is on the agent\'s side. A quote sits at the top of the message.',
    'B Thread: the exchange with one conversation gathers into one thread where it began. A new message leaves a line at the end of the timeline that leads to the thread.',
    'C Strip: every message is a compact row that opens. The exchange runs in the timeline among the work and takes the least room.',
  ],
  recommend: 'Recommendation A: a message is a message in both directions, and nothing has to be matched to a request. The agent\'s reaction is right below the message, where it is read. B gathers the exchange but separates a message from the work it started; C saves room but hides what the agent just acted on.',
  sender: 'Sending conversation', receiver: 'Receiving conversation',
  receives: 'The latest agent message this conversation\'s Pi received',
  nothingYet: 'None yet.',
  senderTitle: 'Quarterly report', senderWs: 'raportit',
  receiverTitle: 'Charts', receiverWs: 'kaaviot',
  msgs: {
    m1: {from: 'sender', time: '9.39', text: 'The Q3 figures are ready in `data/q3.csv`. Update chart 2 with them in the same colour as Q2 and tell me when it is done.'},
    m2: {from: 'receiver', time: '9.43', text: 'Chart 2 is updated with the Q3 figures: `charts/q3.svg`. The colour is the same blue as Q2.'},
    m3: {from: 'receiver', time: '9.46', text: 'I also noticed that September is missing from `data/q3.csv`. The chart now shows only July and August.', queued: true},
    m4: {from: 'sender', time: '9.51', text: 'I added the September row to `data/q3.csv`. Update chart 2 once more.', quote: 'm3'},
    m5: {from: 'receiver', time: '9.54', text: 'Chart 2 now covers July to September: `charts/q3.svg`.', quote: 'm4'},
  },
  s: {
    ask: 'The Q3 figures are done. Tell the agent in the Charts conversation the file is `data/q3.csv` and ask it to update chart 2. Do the tables meanwhile.',
    sent: 'I sent the message to the [Charts](#oh-receiver-m1) conversation. I will do the tables meanwhile.',
    sentToday: 'I sent the message to conversation `pi:7d2e41c0`. I will do the tables meanwhile.',
    tables: 'Tables 1–3 are in the report. Chart 2 goes into chapter 3 when it is ready.',
    placed: 'I added the updated chart 2 to chapter 3 of the report.',
    placedToday: 'I added chart 2 to chapter 3, as you asked.',
    intro: 'Write a short introduction for the report.',
    introStreaming: 'The introduction first gives the quarter\'s main results, then',
    introDone: 'The introduction opens the report: the quarter\'s main results and what comes next.',
    missing: 'Charts noticed that September is missing from `data/q3.csv`. The September figures are in `data/september.csv`. Shall I merge them and tell Charts?',
    missingToday: 'September is missing from `data/q3.csv`, as you wrote. The figures are in `data/september.csv`. Shall I merge them?',
    yes: 'Yes, merge them and tell it.',
    told: 'I merged September into `data/q3.csv` and told [Charts](#oh-receiver-m4).',
    toldToday: 'I merged September and sent a message to conversation `pi:7d2e41c0`.',
    final: 'Chart 2 in the report now covers the whole quarter.',
    finalToday: 'Right, chart 2 in the report is now up to date.',
  },
  r: {
    earlierAsk: 'Make chart 2 from the Q2 figures, bars by month.',
    earlierReply: 'Chart 2 is done: `charts/q2.svg`. Bars are by month, and Q2\'s colour is blue.',
    told: 'I updated chart 2 and told [Quarterly report](#oh-sender-m2). September is missing from the data, so [I told it that too](#oh-sender-m3).',
    toldToday: 'I updated chart 2 and told conversation `pi:3b9f0a62`. September is missing from the data, so I told it that too.',
    again: 'I updated the chart for July to September and told [Quarterly report](#oh-sender-m5).',
    againToday: 'I updated the chart and told conversation `pi:3b9f0a62`.',
  },
  done: 'Done', running: 'Running',
  activity: {idle: 'Waiting for you', working: 'Working'},
  agentOf: (t: string) => `${t}`,
  agentWord: 'agent',
  inLabel: (t: string) => `Agent message from ${t}`,
  outTo: 'Sent to',
  outQueued: (t: string) => `Queued: ${t} was busy`,
  quoteOf: (who: string, time: string) => `${who} · ${time}`,
  quoteJump: (time: string) => `Go to the quoted message (${time})`,
  quoteLabel: 'Refers to',
  you: 'You',
  thisAgent: 'This conversation\'s agent',
  queuedFrom: (t: string) => `Agent from ${t}: `,
  thread: (t: string, n: number) => `Messages with ${t} · ${n}`,
  pointerIn: (t: string) => `${t} wrote`,
  pointerOut: (t: string) => `Sent to ${t}`,
  inThread: 'in the thread',
  expand: 'Show the whole message', collapse: 'Collapse',
};

export const TEXT: Record<Lang, Text> = {fi, en};

/** A quote's excerpt: the first sentence, at most 160 characters, as the
 * reply-to-message quote takes it. */
export function excerpt(text: string): string {
  const first = text.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? text;
  return first.length > 160 ? `${first.slice(0, 159)}…` : first;
}

/** The native text the receiving Pi gets: the daemon's block first, with the
 * quoted message's id and excerpt when there is one (design.md). In this
 * story the sender writes from the person's turns (hop 1) and Charts from
 * the turns those messages started (hop 2). */
export function nativeText(t: Text, id: MsgId): string {
  const m = t.msgs[id];
  const fromSender = m.from === 'sender';
  const title = fromSender ? t.senderTitle : t.receiverTitle;
  const from = fromSender ? IDS.sender : IDS.receiver;
  const head = `Habitat: the agent of the person's conversation "${title}" sends this. It is not the person's own words.`;
  const q = m.quote ? `\n<quote message="${IDS.msg[m.quote]}" from="${t.msgs[m.quote].from === 'sender' ? IDS.sender : IDS.receiver}">\n${excerpt(t.msgs[m.quote].text)}\n</quote>` : '';
  return `<agent-message from="${from}" title="${title}" message="${IDS.msg[id]}" hop="${fromSender ? 1 : 2}">\n${head}${q}\n</agent-message>\n\n${m.text}`;
}
