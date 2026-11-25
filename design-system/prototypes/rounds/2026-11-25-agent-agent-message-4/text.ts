// The round's own words in both languages: review chrome, the synthetic
// story in two conversations and every word the message blocks say, per
// direction. Production components bring their own words through the app's
// i18n.

export type Lang = 'fi' | 'en';
/** Round 2's five steps, cumulative: each adds to the one before. */
export const STEPS = ['sent', 'back', 'midturn', 'several', 'quote'] as const;
export type Step = (typeof STEPS)[number];
export type MsgId = 'm1' | 'm2' | 'm3' | 'm4' | 'm5';
export type Side = 'sender' | 'receiver';

export const IDS = {
  receiver: 'pi:7d2e41c0-5a1b-4c8e-9f3d-2b6a0e8c71f4',
  sender: 'pi:3b9f0a62-81d4-4e7a-b2c5-9e1f7a3d6c08',
};
/** Each message's id is the sending command's idempotency key. */
export const msgId = (id: MsgId) => {
  const n = Number(id.slice(1));
  return `${(0x5c1e8f20 + n * 0x1f3a7).toString(16).padStart(8, '0')}-7b3a-4d9e-a6f2-${(0x0c4b8e1d93a7 + n * 0x9e15).toString(16).padStart(12, '0')}`;
};

/** queued: the CLI result said pending, because the target was busy. */
type Msg = {from: Side; time: string; text: string; quote?: MsgId; queued?: boolean};

/** Every word a block says in one direction, besides the conversation's
 * name, the time and the message itself. Nyt is round 3's A Peili as it was. */
export type Copy = {
  /** Visible words before the sending conversation's name (incoming). */
  inKind: string;
  /** Visible words before the receiving conversation's name (outgoing). */
  outLead: string;
  /** Accessible names of the blocks. */
  inAria: (from: string) => string;
  outAria: (to: string) => string;
  /** Whether a quote shows at all, and how: 'full' (round 3: head and
   * excerpt), 'line' (one line, the excerpt only), 'none'. */
  quote: 'full' | 'line' | 'none';
  quoteLabel?: string;
  quoteWho?: (who: string, time: string) => string;
  quoteAria: (who: string, time: string) => string;
  /** The delivery state, only when it was not "delivered". */
  queued?: (to: string) => string;
  queuedTitle?: (to: string) => string;
  /** Prefix of a follow-up waiting in the receiver's composer queue. */
  queueFrom: (from: string) => string;
};

const fi = {
  lang: 'fi',
  title: 'Agentin viesti toiselle keskustelulle · kierros 4',
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
  hint: 'Vasemmalla lähettävä keskustelu, oikealla vastaanottava. Suunnat eroavat vain siinä, mitä viestilohkot sanovat.',
  all: 'Näytä kaikki suunnat ja suositus', fewer: 'Näytä vain valittu',
  picker: ['Nyt', 'A Minimi', 'B Hiljainen', 'C Konteksti'],
  axis: 'Akseli: kuinka paljon viestilohko sanoo nimen ja viestin lisäksi',
  lines: [
    'Nyt (kierroksen 3 A Peili): tuleva "Kvartaaliraportti · agentti", lähtevä "Tämä agentti › Kaaviot", aika oikeassa reunassa, lainaus "Viittaa viestiin · kuka · klo", tila "Jonossa: … oli kesken".',
    'A Minimi: vain kuvake, keskustelun nimi linkkinä, aika nimen perässä ja viesti. Ei lainausta eikä tilaa.',
    'B Hiljainen: A ja lainaus yhtenä rivinä (kuvake ja ote), kun agentti lainasi viestiä. Ei tilaa.',
    'C Konteksti: B ja toimituksen tila yhdellä sanalla vain silloin, kun viesti ei mennyt suoraan perille ("Meni jonoon").',
  ],
  recommend: 'Suositus B: nimi kertoo, keneltä tai kenelle, linkki vie samaan viestiin toisessa keskustelussa, ja lainausrivi näkyy vain, kun agentti lainasi. Tila jää pois, koska agentti sanoo jonon joka tapauksessa ja vastaanottajan jono nimeää lähettäjän.',
  sender: 'Lähettävä keskustelu', receiver: 'Vastaanottava keskustelu',
  receives: 'Viimeisin agentin viesti, jonka tämän keskustelun Pi sai',
  nothingYet: 'Ei vielä yhtään.',
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
    tables: 'Taulukot 1–3 ovat raportissa. Kuvaaja 2 tulee lukuun 3, kun se on valmis.',
    placed: 'Lisäsin päivitetyn kuvaajan 2 raportin lukuun 3.',
    intro: 'Kirjoita raportille lyhyt johdanto.',
    introStreaming: 'Johdanto kertoo ensin neljänneksen päätulokset, sitten',
    introDone: 'Johdanto on raportin alussa: neljänneksen päätulokset ja mitä seuraavaksi.',
    missing: 'Kaaviot huomasi, että syyskuu puuttuu tiedostosta `data/q3.csv`. Syyskuun luvut ovat tiedostossa `data/syyskuu.csv`. Yhdistänkö ne ja kerron Kaavioille?',
    yes: 'Kyllä, yhdistä ja kerro sille.',
    told: 'Yhdistin syyskuun tiedostoon `data/q3.csv` ja kerroin [Kaavioille](#oh-receiver-m4).',
    final: 'Raportin kuvaaja 2 kattaa nyt koko neljänneksen.',
  },
  r: {
    earlierAsk: 'Tee kuvaaja 2 Q2-luvuista, palkit kuukausittain.',
    earlierReply: 'Kuvaaja 2 on valmis: `charts/q2.svg`. Palkit ovat kuukausittain, ja Q2:n väri on sininen.',
    told: 'Päivitin kuvaajan 2 ja kerroin [Kvartaaliraportille](#oh-sender-m2). Syyskuu puuttuu datasta, joten [kerroin siitäkin](#oh-sender-m3).',
    again: 'Päivitin kuvaajan heinä–syyskuulle ja kerroin [Kvartaaliraportille](#oh-sender-m5).',
  },
  done: 'Valmis', running: 'Käynnissä',
  activity: {idle: 'Odottaa sinua', working: 'Työskentelee'},
  thisAgent: 'Tämä agentti',
  /** Per direction: Nyt, A, B, C. */
  copy: [
    {
      inKind: '· agentti', outLead: 'Tämä agentti',
      inAria: (f) => `Agentin viesti keskustelusta ${f}`, outAria: (to) => `Viesti keskusteluun ${to}`,
      quote: 'full', quoteLabel: 'Viittaa viestiin', quoteWho: (w, tm) => `${w} · ${tm}`,
      quoteAria: (_w, tm) => `Siirry lainattuun viestiin (klo ${tm})`,
      queued: (to) => `Jonossa: ${to} oli kesken`,
      queueFrom: (f) => `Agentti keskustelusta ${f}: `,
    },
    {
      inKind: '', outLead: '',
      inAria: (f) => `Viesti keskustelusta ${f}`, outAria: (to) => `Viesti keskusteluun ${to}`,
      quote: 'none', quoteAria: () => '',
      queueFrom: (f) => `${f}: `,
    },
    {
      inKind: '', outLead: '',
      inAria: (f) => `Viesti keskustelusta ${f}`, outAria: (to) => `Viesti keskusteluun ${to}`,
      quote: 'line', quoteAria: (w, tm) => `Lainaus: ${w} klo ${tm}. Siirry viestiin.`,
      queueFrom: (f) => `${f}: `,
    },
    {
      inKind: '', outLead: '',
      inAria: (f) => `Viesti keskustelusta ${f}`, outAria: (to) => `Viesti keskusteluun ${to}`,
      quote: 'line', quoteAria: (w, tm) => `Lainaus: ${w} klo ${tm}. Siirry viestiin.`,
      queued: () => 'Meni jonoon', queuedTitle: (to) => `${to} oli kesken, joten viesti odotti sen vuoron loppuun.`,
      queueFrom: (f) => `${f}: `,
    },
  ] as Copy[],
};

export type Text = typeof fi;

const en: Text = {
  lang: 'en',
  title: 'Agent message to another conversation · round 4',
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
  hint: 'Sending conversation on the left, receiving on the right. The directions differ only in what the message blocks say.',
  all: 'Show every direction and the recommendation', fewer: 'Show the chosen one only',
  picker: ['Now', 'A Minimal', 'B Quiet', 'C Contextual'],
  axis: 'Axis: how much the message block says besides the name and the message',
  lines: [
    'Now (round 3\'s A Mirror): incoming "Quarterly report · agent", outgoing "This agent › Charts", time at the right edge, quote "Refers to · who · time", state "Queued: … was busy".',
    'A Minimal: only the icon, the conversation\'s name as a link, the time after the name and the message. No quote, no state.',
    'B Quiet: A plus the quote as one line (icon and excerpt) when the agent quoted a message. No state.',
    'C Contextual: B plus the delivery state in one word, only when the message did not go straight through ("Queued").',
  ],
  recommend: 'Recommendation B: the name says from or to whom, the link opens the same message in the other conversation, and the quote line shows only when the agent quoted. The state goes, because the agent says it queued anyway and the receiver\'s queue names the sender.',
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
  },
  r: {
    earlierAsk: 'Make chart 2 from the Q2 figures, bars by month.',
    earlierReply: 'Chart 2 is done: `charts/q2.svg`. Bars are by month, and Q2\'s colour is blue.',
    told: 'I updated chart 2 and told [Quarterly report](#oh-sender-m2). September is missing from the data, so [I told it that too](#oh-sender-m3).',
    again: 'I updated the chart for July to September and told [Quarterly report](#oh-sender-m5).',
  },
  done: 'Done', running: 'Running',
  activity: {idle: 'Waiting for you', working: 'Working'},
  thisAgent: 'This agent',
  copy: [
    {
      inKind: '· agent', outLead: 'This agent',
      inAria: (f) => `Agent message from ${f}`, outAria: (to) => `Message to ${to}`,
      quote: 'full', quoteLabel: 'Refers to', quoteWho: (w, tm) => `${w} · ${tm}`,
      quoteAria: (_w, tm) => `Go to the quoted message (${tm})`,
      queued: (to) => `Queued: ${to} was busy`,
      queueFrom: (f) => `Agent from ${f}: `,
    },
    {
      inKind: '', outLead: '',
      inAria: (f) => `Message from ${f}`, outAria: (to) => `Message to ${to}`,
      quote: 'none', quoteAria: () => '',
      queueFrom: (f) => `${f}: `,
    },
    {
      inKind: '', outLead: '',
      inAria: (f) => `Message from ${f}`, outAria: (to) => `Message to ${to}`,
      quote: 'line', quoteAria: (w, tm) => `Quote: ${w} at ${tm}. Go to the message.`,
      queueFrom: (f) => `${f}: `,
    },
    {
      inKind: '', outLead: '',
      inAria: (f) => `Message from ${f}`, outAria: (to) => `Message to ${to}`,
      quote: 'line', quoteAria: (w, tm) => `Quote: ${w} at ${tm}. Go to the message.`,
      queued: () => 'Queued', queuedTitle: (to) => `${to} was busy, so the message waited for its turn to end.`,
      queueFrom: (f) => `${f}: `,
    },
  ],
};

export const TEXT: Record<Lang, Text> = {fi, en};

/** A quote's excerpt: the first sentence, at most 160 characters, as the
 * reply-to-message quote takes it. */
export function excerpt(text: string): string {
  const first = text.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? text;
  return first.length > 160 ? `${first.slice(0, 159)}…` : first;
}

/** The native text the receiving Pi gets: the daemon's block first, with the
 * quoted message's id and excerpt when there is one (design.md). With no
 * runaway guard the block carries no count. */
export function nativeText(t: Text, id: MsgId): string {
  const m = t.msgs[id];
  const fromSender = m.from === 'sender';
  const title = fromSender ? t.senderTitle : t.receiverTitle;
  const from = fromSender ? IDS.sender : IDS.receiver;
  const head = `Habitat: the agent of the person's conversation "${title}" sends this. It is not the person's own words.`;
  const q = m.quote ? `\n<quote message="${msgId(m.quote)}" from="${t.msgs[m.quote].from === 'sender' ? IDS.sender : IDS.receiver}">\n${excerpt(t.msgs[m.quote].text)}\n</quote>` : '';
  return `<agent-message from="${from}" title="${title}" message="${msgId(id)}">\n${head}${q}\n</agent-message>\n\n${m.text}`;
}
