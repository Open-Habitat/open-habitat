// The round's own words in both languages: review chrome, the synthetic
// story in two conversations and the pieces this round draws. Production
// components bring their own words through the app's i18n.

export type Lang = 'fi' | 'en';
/** The story's steps, cumulative: each adds to the one before. Steps 1–5 are
 * round 2's story; 6–7 run the exchange on until the runaway guard holds a
 * message, and the person lets it through. */
export const STEPS = ['sent', 'back', 'midturn', 'several', 'quote', 'guard', 'continued'] as const;
export type Step = (typeof STEPS)[number];
export const LOOP = ['m6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13'] as const;
export type MsgId = 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | (typeof LOOP)[number] | 'm14';
export type Side = 'sender' | 'receiver';
/** The proposed guard: agent messages in a row between conversations without
 * the person writing, after which the next one waits for the person. */
export const GUARD_N = 10;

export const IDS = {
  receiver: 'pi:7d2e41c0-5a1b-4c8e-9f3d-2b6a0e8c71f4',
  sender: 'pi:3b9f0a62-81d4-4e7a-b2c5-9e1f7a3d6c08',
};
/** Each message's id is the sending command's idempotency key. */
export const msgId = (id: MsgId) => {
  const n = Number(id.slice(1));
  return `${(0x5c1e8f20 + n * 0x1f3a7).toString(16).padStart(8, '0')}-7b3a-4d9e-a6f2-${(0x0c4b8e1d93a7 + n * 0x9e15).toString(16).padStart(12, '0')}`;
};

/** hop: the chain count the daemon computes (agent messages in a row since
 * the person last wrote in either conversation). */
type Msg = {from: Side; time: string; text: string; hop: number; quote?: MsgId; queued?: boolean; held?: boolean};

const loopFi: Record<(typeof LOOP)[number], Pick<Msg, 'time' | 'text'>> = {
  m6: {time: '9.55', text: 'Raportin tekstissä neljännes on "kolmas neljännes". Vaihda kuvaajan 2 selite samaksi.'},
  m7: {time: '9.57', text: 'Vaihdoin selitteen. Kuvaajassa 1 lukee yhä "Q2 2026"; vaihdetaanko senkin muoto?'},
  m8: {time: '9.58', text: 'Raportin tyyliohje käyttää kuvaajissa lyhenteitä. Palauta kuvaajaan 2 "Q3 2026".'},
  m9: {time: '9.59', text: 'Palautin "Q3 2026". Raportin tekstissä on silti "kolmas neljännes"; yhtenäistätkö sen?'},
  m10: {time: '10.00', text: 'Yhtenäistin tekstin muotoon "Q3 2026". Tarkista vielä kuvaajan otsikko.'},
  m11: {time: '10.01', text: 'Otsikossa lukee "Kolmas neljännes 2026". Vaihdanko senkin?'},
  m12: {time: '10.02', text: 'Vaihda. Tarkista samalla kuvaaja 1.'},
  m13: {time: '10.03', text: 'Vaihdoin otsikon. Kuvaajassa 1 lukee "kolmas neljännes"; vaihdanko senkin?'},
};
const loopEn: typeof loopFi = {
  m6: {time: '9.55', text: 'The report text calls the quarter "third quarter". Change the legend of chart 2 to match.'},
  m7: {time: '9.57', text: 'I changed the legend. Chart 1 still says "Q2 2026"; shall we change its form too?'},
  m8: {time: '9.58', text: 'The report style guide uses abbreviations in charts. Put "Q3 2026" back in chart 2.'},
  m9: {time: '9.59', text: 'I put "Q3 2026" back. The report text still says "third quarter"; will you align it?'},
  m10: {time: '10.00', text: 'I aligned the text to "Q3 2026". Check the chart title too.'},
  m11: {time: '10.01', text: 'The title says "Third quarter 2026". Shall I change that too?'},
  m12: {time: '10.02', text: 'Change it. Check chart 1 while you are at it.'},
  m13: {time: '10.03', text: 'I changed the title. Chart 1 says "third quarter"; shall I change that too?'},
};
const loopMsgs = (src: typeof loopFi) => Object.fromEntries(LOOP.map((id, k) => [id, {...src[id], from: k % 2 ? 'receiver' : 'sender', hop: 3 + k}]));

const fi = {
  lang: 'fi',
  title: 'Agentin viesti toiselle keskustelulle · kierros 3',
  theme: 'Teema', themes: {light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti'},
  language: 'Kieli',
  step: 'Vaihe',
  steps: {
    sent: '1 Viesti lähtee',
    back: '2 Yksi takaisin',
    midturn: '3 Tulee kesken vuoron',
    several: '4 Useita takaisin',
    quote: '5 Lainaus',
    guard: '6 Vahti pysäyttää',
    continued: '7 Jatkat',
  } as Record<Step, string>,
  prev: 'Edellinen', next: 'Seuraava',
  reset: 'Alusta',
  hint: 'Vasemmalla lähettävä keskustelu, oikealla vastaanottava. Vaiheet 6–7 näyttävät karkaamisvahdin.',
  all: 'Näytä kaikki suunnat ja suositus', fewer: 'Näytä vain valittu',
  picker: ['Nyt', 'A Peili', 'B Rivi', 'C Upotettu'],
  axis: 'Akseli: lähtevä viesti lähettäjän puolella – aina omana kuplanaan vai vain, kun agentin teksti ei kerro sitä, ja minkä muotoisena',
  lines: [
    'Nyt (kierroksen 2 A): katkoviivakupla aina siinä, missä viesti lähti, ja agentti kertoo lisäksi tekstissään lähettäneensä. Vaiheissa 6–7 kierroksen 2 hyppyraja.',
    'A Peili: aina oma kupla, tulevan kirjeen peilikuva agentin puolella: sama pinta ja reuna, otsikossa tämä agentti → keskustelu.',
    'B Rivi: aina, mutta tiivis rivi agentin vastauksen alla: kenelle, viestin alku, avautuu. Ennen vastausta rivi on siinä, missä viesti lähti.',
    'C Upotettu: kun agentin vastaus linkittää viestin, viesti on vastauksessa lainauslohkona eikä omaa kuplaa ole. Vain jos vastaus ei mainitse sitä, lohko on omana rivinään.',
  ],
  recommend: 'Suositus C: agentti kertoo joka tapauksessa lähettäneensä viestin, joten viesti kuuluu siihen kohtaan eikä toiseksi kuplaksi. Näet sanatarkasti, mitä lähti, eikä mitään toisteta. A toistaa agentin lauseen kuplana; B on siisti mutta piilottaa sisällön avattavaksi.',
  sender: 'Lähettävä keskustelu', receiver: 'Vastaanottava keskustelu',
  receives: 'Viimeisin agentin viesti, jonka tämän keskustelun Pi sai',
  nothingYet: 'Ei vielä yhtään.',
  senderTitle: 'Kvartaaliraportti', senderWs: 'raportit',
  receiverTitle: 'Kaaviot', receiverWs: 'kaaviot',
  msgs: {
    m1: {from: 'sender', hop: 1, time: '9.39', text: 'Q3-luvut ovat valmiit tiedostossa `data/q3.csv`. Päivitä kuvaaja 2 niillä samalla värillä kuin Q2:ssa ja kerro minulle, kun se on valmis.'},
    m2: {from: 'receiver', hop: 2, time: '9.43', text: 'Kuvaaja 2 on päivitetty Q3-luvuilla: `charts/q3.svg`. Väri on sama sininen kuin Q2:ssa.'},
    m3: {from: 'receiver', hop: 2, time: '9.46', text: 'Huomasin vielä, että `data/q3.csv`:stä puuttuu syyskuu. Kuvaajassa on nyt vain heinä- ja elokuu.', queued: true},
    m4: {from: 'sender', hop: 1, time: '9.51', text: 'Lisäsin syyskuun rivin tiedostoon `data/q3.csv`. Päivitä kuvaaja 2 vielä kerran.', quote: 'm3'},
    m5: {from: 'receiver', hop: 2, time: '9.54', text: 'Kuvaaja 2 kattaa nyt heinä–syyskuun: `charts/q3.svg`.', quote: 'm4'},
    ...loopMsgs(loopFi),
    m14: {from: 'sender', hop: 11, time: '10.04', text: 'Vaihda. Tarkista samalla taulukoiden otsikot.', held: true},
  } as Record<MsgId, Msg>,
  s: {
    ask: 'Q3-luvut ovat valmiit. Kerro Kaaviot-keskustelun agentille, että tiedosto on `data/q3.csv`, ja pyydä sitä päivittämään kuvaaja 2. Tee sillä välin taulukot.',
    sent: 'Lähetin viestin keskusteluun [Kaaviot](#oh-receiver-m1). Teen sillä välin taulukot.',
    tables: 'Taulukot 1–3 ovat raportissa. Kuvaaja 2 tulee lukuun 3, kun se on valmis.',
    placed: 'Lisäsin päivitetyn kuvaajan 2 raportin lukuun 3.',
    intro: 'Kirjoita raportille lyhyt johdanto.',
    introStreaming: 'Johdanto kertoo ensin neljänneksen päätulokset, sitten',
    introDone: 'Johdanto on raportin alussa: neljänneksen päätulokset ja mitä seuraavaksi.',
    missing: 'Kaaviot huomasi, että syyskuu puuttuu tiedostosta `data/q3.csv`. Syyskuun luvut ovat tiedostossa `data/syyskuu.csv`. Yhdistänkö ne ja kerron Kaavioille?',
    yes: 'Kyllä, yhdistä ja kerro sille.',
    told: 'Yhdistin syyskuun tiedostoon `data/q3.csv` ja kerroin [Kaavioille](#oh-receiver-m4).',
    final: 'Raportin kuvaaja 2 kattaa nyt koko neljänneksen.',
    selite: 'Selitteessä lukee "Q3 2026", tekstissä "kolmas neljännes". Pyysin [Kaavioita](#oh-receiver-m6) yhtenäistämään.',
    loop: (id: string) => `Kerroin [Kaavioille](#oh-receiver-${id}).`,
    held: (n: number) => `Viesti [Kaavioille](#oh-receiver-m14) odottaa sinua: keskustelut ovat vaihtaneet ${n} viestiä peräkkäin ilman sinua.`,
    hopRefused: 'Habitat ei päästänyt viestiä Kaavioille: hyppyraja täyttyi, koska et ole kirjoittanut välissä. Selitteessä lukee "Q3 2026" ja tekstissä "kolmas neljännes". Yhtenäistänkö itse, vai kerronko Kaavioille, kun sanot?',
  },
  r: {
    earlierAsk: 'Tee kuvaaja 2 Q2-luvuista, palkit kuukausittain.',
    earlierReply: 'Kuvaaja 2 on valmis: `charts/q2.svg`. Palkit ovat kuukausittain, ja Q2:n väri on sininen.',
    told: 'Päivitin kuvaajan 2 ja kerroin [Kvartaaliraportille](#oh-sender-m2). Syyskuu puuttuu datasta, joten [kerroin siitäkin](#oh-sender-m3).',
    again: 'Päivitin kuvaajan heinä–syyskuulle ja kerroin [Kvartaaliraportille](#oh-sender-m5).',
    loop: (id: string) => `Kerroin [Kvartaaliraportille](#oh-sender-${id}).`,
  },
  done: 'Valmis', running: 'Käynnissä', refused: 'Hylätty',
  activity: {idle: 'Odottaa sinua', working: 'Työskentelee'},
  agentWord: 'agentti',
  inLabel: (t: string) => `Agentin viesti keskustelusta ${t}`,
  outTo: 'Lähetetty keskusteluun',
  msgTo: 'Viesti keskusteluun',
  outQueued: (t: string) => `Jonossa: ${t} oli kesken`,
  outHeld: 'Odottaa sinua',
  quoteOf: (who: string, time: string) => `${who} · ${time}`,
  quoteJump: (time: string) => `Siirry lainattuun viestiin (klo ${time})`,
  quoteLabel: 'Viittaa viestiin',
  thisAgent: 'Tämä agentti',
  queuedFrom: (t: string) => `Agentti keskustelusta ${t}: `,
  expand: 'Näytä koko viesti', collapse: 'Pienennä',
  // The runaway guard.
  guardHead: 'Agentit odottavat sinua',
  guardWhy: (a: string, b: string, n: number) => `${a} ja ${b} ovat vaihtaneet ${n} viestiä peräkkäin ilman, että kirjoitit kumpaankaan.`,
  guardHere: (b: string) => `Tämä viesti keskusteluun ${b} lähtee, kun jatkat.`,
  guardThere: (a: string) => `Keskustelusta ${a} on tulossa viesti, joka odottaa, kunnes jatkat.`,
  guardShow: 'Näytä viesti',
  continueLabel: 'Jatka',
  discard: 'Älä lähetä',
  notSent: 'Ei lähetetty',
  continued: (time: string, n: number) => `Jatkoit klo ${time}. Viesti lähti, ja agentit voivat taas vaihtaa ${n} viestiä ilman sinua.`,
  continuedThere: (time: string, a: string) => `Jatkoit klo ${time}, ja keskustelun ${a} viesti tuli perille.`,
  continueTime: '10.06',
};

export type Text = typeof fi;

const en: Text = {
  lang: 'en',
  title: 'Agent message to another conversation · round 3',
  theme: 'Theme', themes: {light: 'Day', dark: 'Night', contrast: 'High contrast'},
  language: 'Language',
  step: 'Step',
  steps: {
    sent: '1 The message goes',
    back: '2 One back',
    midturn: '3 Arrives mid-turn',
    several: '4 Several back',
    quote: '5 Quote',
    guard: '6 The guard holds',
    continued: '7 You continue',
  },
  prev: 'Previous', next: 'Next',
  reset: 'Reset',
  hint: 'Sending conversation on the left, receiving on the right. Steps 6–7 show the runaway guard.',
  all: 'Show every direction and the recommendation', fewer: 'Show the chosen one only',
  picker: ['Now', 'A Mirror', 'B Line', 'C Folded'],
  axis: 'Axis: the outgoing message on the sender\'s side – always its own bubble or only when the agent\'s text does not say so, and in what shape',
  lines: [
    'Now (round 2\'s A): a dashed bubble always, where the message went, and the agent also says in its text that it sent one. Steps 6–7 show round 2\'s hop limit.',
    'A Mirror: always its own bubble, the incoming letter mirrored on the agent\'s side: the same surface and edge, headed this agent → conversation.',
    'B Line: always, but as a compact line under the agent\'s reply: to whom, the start of the message, opens. Before the reply the line sits where the message went.',
    'C Folded: when the agent\'s reply links the message, the message sits in the reply as a quote block and has no bubble of its own. Only if the reply does not mention it does the block stand on its own row.',
  ],
  recommend: 'Recommendation C: the agent says it sent the message anyway, so the message belongs there and not in a second bubble. You see word for word what went, and nothing repeats. A repeats the agent\'s sentence as a bubble; B is tidy but hides the content behind a toggle.',
  sender: 'Sending conversation', receiver: 'Receiving conversation',
  receives: 'The latest agent message this conversation\'s Pi received',
  nothingYet: 'None yet.',
  senderTitle: 'Quarterly report', senderWs: 'raportit',
  receiverTitle: 'Charts', receiverWs: 'kaaviot',
  msgs: {
    m1: {from: 'sender', hop: 1, time: '9.39', text: 'The Q3 figures are ready in `data/q3.csv`. Update chart 2 with them in the same colour as Q2 and tell me when it is done.'},
    m2: {from: 'receiver', hop: 2, time: '9.43', text: 'Chart 2 is updated with the Q3 figures: `charts/q3.svg`. The colour is the same blue as Q2.'},
    m3: {from: 'receiver', hop: 2, time: '9.46', text: 'I also noticed that September is missing from `data/q3.csv`. The chart now shows only July and August.', queued: true},
    m4: {from: 'sender', hop: 1, time: '9.51', text: 'I added the September row to `data/q3.csv`. Update chart 2 once more.', quote: 'm3'},
    m5: {from: 'receiver', hop: 2, time: '9.54', text: 'Chart 2 now covers July to September: `charts/q3.svg`.', quote: 'm4'},
    ...loopMsgs(loopEn),
    m14: {from: 'sender', hop: 11, time: '10.04', text: 'Change it. Check the table titles while you are at it.', held: true},
  } as Record<MsgId, Msg>,
  s: {
    ask: 'The Q3 figures are done. Tell the agent in the Charts conversation the file is `data/q3.csv` and ask it to update chart 2. Do the tables meanwhile.',
    sent: 'I sent the message to the [Charts](#oh-receiver-m1) conversation. I will do the tables meanwhile.',
    tables: 'Tables 1–3 are in the report. Chart 2 goes into chapter 3 when it is ready.',
    placed: 'I added the updated chart 2 to chapter 3 of the report.',
    intro: 'Write a short introduction for the report.',
    introStreaming: 'The introduction first gives the quarter\'s main results, then',
    introDone: 'The introduction opens the report: the quarter\'s main results and what comes next.',
    missing: 'Charts noticed that September is missing from `data/q3.csv`. The September figures are in `data/september.csv`. Shall I merge them and tell Charts?',
    yes: 'Yes, merge them and tell it.',
    told: 'I merged September into `data/q3.csv` and told [Charts](#oh-receiver-m4).',
    final: 'Chart 2 in the report now covers the whole quarter.',
    selite: 'The legend says "Q3 2026", the text "third quarter". I asked [Charts](#oh-receiver-m6) to align them.',
    loop: (id: string) => `I told [Charts](#oh-receiver-${id}).`,
    held: (n: number) => `The message to [Charts](#oh-receiver-m14) waits for you: the conversations have exchanged ${n} messages in a row without you.`,
    hopRefused: 'Habitat did not let the message to Charts through: the hop limit was reached because you have not written in between. The legend says "Q3 2026" and the text "third quarter". Shall I align them myself, or tell Charts when you say so?',
  },
  r: {
    earlierAsk: 'Make chart 2 from the Q2 figures, bars by month.',
    earlierReply: 'Chart 2 is done: `charts/q2.svg`. Bars are by month, and Q2\'s colour is blue.',
    told: 'I updated chart 2 and told [Quarterly report](#oh-sender-m2). September is missing from the data, so [I told it that too](#oh-sender-m3).',
    again: 'I updated the chart for July to September and told [Quarterly report](#oh-sender-m5).',
    loop: (id: string) => `I told [Quarterly report](#oh-sender-${id}).`,
  },
  done: 'Done', running: 'Running', refused: 'Refused',
  activity: {idle: 'Waiting for you', working: 'Working'},
  agentWord: 'agent',
  inLabel: (t: string) => `Agent message from ${t}`,
  outTo: 'Sent to',
  msgTo: 'Message to',
  outQueued: (t: string) => `Queued: ${t} was busy`,
  outHeld: 'Waiting for you',
  quoteOf: (who: string, time: string) => `${who} · ${time}`,
  quoteJump: (time: string) => `Go to the quoted message (${time})`,
  quoteLabel: 'Refers to',
  thisAgent: 'This agent',
  queuedFrom: (t: string) => `Agent from ${t}: `,
  expand: 'Show the whole message', collapse: 'Collapse',
  guardHead: 'The agents are waiting for you',
  guardWhy: (a: string, b: string, n: number) => `${a} and ${b} have exchanged ${n} messages in a row without you writing in either.`,
  guardHere: (b: string) => `This message to ${b} goes when you continue.`,
  guardThere: (a: string) => `A message from ${a} is waiting until you continue.`,
  guardShow: 'Show the message',
  continueLabel: 'Continue',
  discard: 'Do not send',
  notSent: 'Not sent',
  continued: (time: string, n: number) => `You continued at ${time}. The message went, and the agents may again exchange ${n} messages without you.`,
  continuedThere: (time: string, a: string) => `You continued at ${time}, and the message from ${a} arrived.`,
  continueTime: '10.06',
};

export const TEXT: Record<Lang, Text> = {fi, en};

/** A quote's excerpt: the first sentence, at most 160 characters, as the
 * reply-to-message quote takes it. */
export function excerpt(text: string): string {
  const first = text.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? text;
  return first.length > 160 ? `${first.slice(0, 159)}…` : first;
}

/** The native text the receiving Pi gets: the daemon's block first, with the
 * quoted message's id and excerpt when there is one (design.md). A message
 * the person let through after the guard held it starts a new count. */
export function nativeText(t: Text, id: MsgId, released = false, attr: 'hop' | 'count' = 'count'): string {
  const m = t.msgs[id];
  const fromSender = m.from === 'sender';
  const title = fromSender ? t.senderTitle : t.receiverTitle;
  const from = fromSender ? IDS.sender : IDS.receiver;
  const head = `Habitat: the agent of the person's conversation "${title}" sends this. It is not the person's own words.`;
  const let_ = released ? `\nThe person let this message through after ${GUARD_N} agent messages in a row.` : '';
  const q = m.quote ? `\n<quote message="${msgId(m.quote)}" from="${t.msgs[m.quote].from === 'sender' ? IDS.sender : IDS.receiver}">\n${excerpt(t.msgs[m.quote].text)}\n</quote>` : '';
  return `<agent-message from="${from}" title="${title}" message="${msgId(id)}" ${attr}="${released ? 1 : m.hop}">\n${head}${let_}${q}\n</agent-message>\n\n${m.text}`;
}
