// The round's own words in both languages: review chrome, the synthetic
// story and the pieces this round draws. Production components bring their
// own words through the app's i18n. Everything here is invented: the
// conversation, the email, the traceback and the demo token.

export type Lang = 'fi' | 'en';
/** The story. copy..given run on from each other; secret and declined
 * branch from ask (the clipboard holds a key, the person does not give it);
 * away is ask with nobody answering until the request expires. */
export const STEPS = ['copy', 'copied', 'ask', 'preview', 'given', 'secret', 'declined', 'away'] as const;
export type Step = (typeof STEPS)[number];
export type Browser = 'chromium' | 'gesture';

export const EXPIRES = '10.26';

const replyFi = `Hei Aino,

kiitos tarjouksesta. Aloitetaan maanantaina 2.12., kuten ehdotit.
Lähetän Q3-luvut ja kaaviot perjantaihin mennessä, ja käydään ne
läpi yhdessä seuraavalla viikolla.

Yksi tarkennus: raportin liitteet tulevat PDF:nä, ei taulukkona.

Terveisin
Sami`;
const replyEn = `Hi Aino,

thank you for the offer. Let's start on Monday 2 December, as you
suggested. I will send the Q3 figures and charts by Friday, and we
can go through them together the week after.

One detail: the report's appendices come as PDF, not as a sheet.

Best regards
Sami`;

export const TRACE = `Traceback (most recent call last):
  File "charts/build.py", line 41, in <module>
    df = load("data/q3.csv")
  File "charts/build.py", line 12, in load
    return pd.read_csv(path, sep=";")
pandas.errors.ParserError: Error tokenizing data.
C error: Expected 6 fields in line 118, saw 7`;

/** Clearly not a real credential, but shaped like the ones people copy. */
export const SECRET = `OH_DEMO_TOKEN=demo-7f3a-0000-not-a-real-key-91c2`;

const fi = {
  title: 'pbcopy ja pbpaste – kierros 1',
  theme: 'Teema', language: 'Kieli', step: 'Vaihe', browser: 'Selain',
  browsers: {chromium: 'Chromium, kenttä fokuksessa', gesture: 'Safari tai Firefox'} as Record<Browser, string>,
  themes: {light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti'} as Record<string, string>,
  prev: '‹ Edellinen', next: 'Seuraava ›', reset: 'Alusta', all: 'Kaikki suunnat', fewer: 'Vähemmän',
  hint: 'Kortin painikkeet vievät tarinaa eteenpäin. Pikanäppäimet 1–4 vaihtavat suuntaa.',
  steps: {
    copy: '1 Agentti kopioi', copied: '2 Kopioitu', ask: '3 Agentti pyytää leikepöytää', preview: '4 Liitetty, ei vielä annettu',
    given: '5 Annettu', secret: '6 Leikepöydällä avain', declined: '7 Ei annettu', away: '8 Kukaan ei vastannut',
  } as Record<Step, string>,
  picker: ['Nyt', 'A Kortti', 'B Kenttä', 'C Ilmoitus'],
  axis: 'Akseli: missä kopiointi ja leikepöydän pyyntö näkyvät',
  lines: [
    'Nyt: komentoja ei ole. Agentti kirjoittaa tekstin vastaukseensa, ja sinä liität leikepöydän viestiksi itse.',
    'A Kortti: Habitatin kortti agentin vuorossa heti komennon jälkeen. Kopioi yhdellä painalluksella; leikepöytä näytetään ennen kuin se annetaan.',
    'B Kenttä: kopiointi menee suoraan leikepöydälle, kun selain sallii. Pyyntö avautuu kentän yläpuolelle, ja liitetyn tekstin voi muokata ennen antamista.',
    'C Ilmoitus: kumpikin on sivun ilmoitus, joka näkyy missä keskustelussa tahansa olet. Aikajanalla on vain komennon rivi.',
  ],
  recommend: 'Suositus: A Kortti. Kopiointi ja pyyntö jäävät siihen kohtaan, jossa agentti ne teki, näkyvät joka laitteella ja toimivat samoin kaikissa selaimissa.',
  // The conversation
  convTitle: 'Kvartaaliraportti', ws: 'raportit',
  askCopy: 'Kirjoita vastaus Ainon sähköpostiin ja laita se leikepöydälleni, liitän sen itse.',
  wroteReply: 'Kirjoitin vastauksen tiedostoon `drafts/vastaus-aino.txt`.',
  copiedReply: 'Vastaus on tarjolla leikepöydällesi yllä. Kopioi se ja liitä sähköpostiin.',
  copiedReplyB: 'Vastaus on leikepöydälläsi. Liitä se sähköpostiin.',
  copiedReplyBAsk: 'Selain ei antanut kopioida suoraan, joten vastaus odottaa yllä: paina Kopioi.',
  copiedReplyC: 'Vastaus on tarjolla sivun yläreunan ilmoituksessa. Kopioi se sieltä.',
  nowReply: 'Tällä koneella ei ole `pbcopy`-komentoa, joten en voi laittaa tekstiä leikepöydällesi. Tässä se on, kopioi se:',
  askPaste: 'Ajoin kaaviot omalla koneellani ja sain virheen. Kopioin sen leikepöydälle, katso.',
  waitPaste: 'Pyysin leikepöytääsi. Odotan, että annat sen.',
  nowPaste: '`pbpaste` ei ole käytössä tällä koneella, joten en näe leikepöytääsi. Liitä virheilmoitus tähän viestinä.',
  gotPaste: 'Rivillä 118 on seitsemän kenttää kuuden sijaan: osoitekentässä on puolipiste. Lisään lukuun `quotechar`-asetuksen ja tarkistan rivin.',
  declinedPaste: 'Selvä, en saanut leikepöytää. Liitä virheilmoitus viestiin, kun haluat, tai kerro sen viimeinen rivi.',
  timeoutPaste: 'Leikepöytää ei annettu kymmenessä minuutissa, joten pyyntö vanheni. Liitä virheilmoitus viestiin, kun palaat.',
  // Pieces this round draws
  copyHead: 'Agentti kopioi sinulle tekstin', copyKind: 'pbcopy',
  linesOf: (n: number, b: string) => `${n} riviä · ${b}`,
  more: (n: number) => `… ja ${n} riviä lisää`,
  copy: 'Kopioi', copyAgain: 'Kopioi uudelleen', show: 'Näytä', hide: 'Piilota',
  copiedAt: (time: string) => `Kopioitu leikepöydällesi ${time} tällä laitteella.`,
  copiedDirect: (n: number, time: string) => `Kopioitu leikepöydällesi ${time} · ${n} riviä`,
  copyWaits: (n: number) => `Agentti haluaa kopioida ${n} riviä leikepöydällesi.`,
  copyNotice: (from: string, n: number) => `${from} kopioi sinulle ${n} riviä.`,
  copyNoticeDone: (from: string, time: string) => `${from}: teksti kopioitu leikepöydällesi ${time}.`,
  askHead: 'Agentti pyytää leikepöytääsi', askKind: 'pbpaste',
  askWhy: 'Mitä annat, menee agentille ja mallin tarjoajalle. Mitään ei lueta ennen kuin painat.',
  askNotice: (from: string) => `${from} pyytää leikepöytääsi.`,
  pasteFrom: 'Liitä leikepöydältä', pasteKey: 'tai paina ⌘V tai Ctrl+V tässä',
  pasteField: 'Liitä tähän (⌘V tai Ctrl+V)', pasteFieldLabel: 'Leikepöydän teksti agentille',
  editable: 'Voit poistaa tekstistä osan ennen kuin annat sen.',
  give: 'Anna agentille', dontGive: 'Älä anna', cancel: 'Peru',
  previewHead: 'Tämä menee agentille', previewOf: (n: number, b: string) => `${n} riviä · ${b} · ei vielä annettu`,
  browserHint: {chromium: 'Chromium kysyy ensimmäisellä kerralla luvan lukea leikepöydän.', gesture: 'Selaimesi näyttää vielä oman Liitä-painikkeensa: paina sitä.'} as Record<Browser, string>,
  secretWarn: 'Tämä näyttää avaimelta tai salasanalta. Jos annat sen, agentti ja mallin tarjoaja näkevät sen.',
  givenLine: (time: string, n: number) => `Annoit leikepöydän ${time} · ${n} riviä`,
  declinedLine: (time: string) => `Et antanut leikepöytää ${time}. Agentti sai tiedon, ei tekstiä.`,
  expiredLine: (time: string) => `Pyyntö vanheni ${time}. Agentti ei saanut leikepöytää.`,
  waiting: (time: string) => `Odottaa sinua klo ${time} asti`,
  givenAs: 'Annettu pyyntöön pbpaste',
  receives: 'Mitä agentti saa (komennon tuloste ja exit-koodi)',
  activity: {working: 'Työskentelee', idle: 'Valmis', waiting: 'Odottaa sinua'},
  running: 'käynnissä', waitingTool: 'odottaa sinua', done: 'valmis', failed: 'epäonnistui',
  notInC: 'Ilmoitus näkyy sivun yläreunassa missä keskustelussa tahansa olet; tässä se on tämän keskustelun päällä.',
};
export type Text = typeof fi;

const en: Text = {
  title: 'pbcopy and pbpaste – round 1',
  theme: 'Theme', language: 'Language', step: 'Step', browser: 'Browser',
  browsers: {chromium: 'Chromium, field focused', gesture: 'Safari or Firefox'},
  themes: {light: 'Day', dark: 'Night', contrast: 'High contrast'},
  prev: '‹ Previous', next: 'Next ›', reset: 'Reset', all: 'All directions', fewer: 'Fewer',
  hint: 'The card buttons move the story on. Keys 1–4 switch direction.',
  steps: {
    copy: '1 Agent copies', copied: '2 Copied', ask: '3 Agent asks for the clipboard', preview: '4 Pasted, not yet given',
    given: '5 Given', secret: '6 A key on the clipboard', declined: '7 Not given', away: '8 Nobody answered',
  },
  picker: ['Now', 'A Card', 'B Field', 'C Notice'],
  axis: 'Axis: where copying and the clipboard request appear',
  lines: [
    'Now: no commands. The agent writes the text into its reply, and you paste your clipboard as a message yourself.',
    'A Card: a Habitat card in the agent\'s turn right after the command. Copy with one press; the clipboard is shown before it is given.',
    'B Field: copying goes straight to the clipboard when the browser allows. The request opens above the field, and the pasted text can be edited before giving.',
    'C Notice: both are a page notice that shows in whichever conversation you are in. The timeline has only the command row.',
  ],
  recommend: 'Recommendation: A Card. Copying and the request stay where the agent made them, show on every device and work the same in every browser.',
  convTitle: 'Quarterly report', ws: 'reports',
  askCopy: 'Write a reply to Aino\'s email and put it on my clipboard, I\'ll paste it myself.',
  wroteReply: 'I wrote the reply to `drafts/reply-aino.txt`.',
  copiedReply: 'The reply is offered for your clipboard above. Copy it and paste it into the email.',
  copiedReplyB: 'The reply is on your clipboard. Paste it into the email.',
  copiedReplyBAsk: 'The browser did not allow copying directly, so the reply waits above: press Copy.',
  copiedReplyC: 'The reply is offered in the notice at the top of the page. Copy it there.',
  nowReply: 'This machine has no `pbcopy` command, so I cannot put text on your clipboard. Here it is, copy it:',
  askPaste: 'I ran the charts on my own machine and got an error. I copied it to the clipboard, have a look.',
  waitPaste: 'I asked for your clipboard. Waiting for you to give it.',
  nowPaste: '`pbpaste` is not available on this machine, so I cannot see your clipboard. Paste the error here as a message.',
  gotPaste: 'Line 118 has seven fields instead of six: the address field contains a semicolon. I will add a `quotechar` setting to the reader and check the line.',
  declinedPaste: 'All right, I did not get the clipboard. Paste the error into a message when you like, or tell me its last line.',
  timeoutPaste: 'The clipboard was not given within ten minutes, so the request expired. Paste the error into a message when you are back.',
  copyHead: 'The agent copied text for you', copyKind: 'pbcopy',
  linesOf: (n, b) => `${n} lines · ${b}`,
  more: (n) => `… and ${n} more lines`,
  copy: 'Copy', copyAgain: 'Copy again', show: 'Show', hide: 'Hide',
  copiedAt: (time) => `Copied to your clipboard at ${time} on this device.`,
  copiedDirect: (n, time) => `Copied to your clipboard at ${time} · ${n} lines`,
  copyWaits: (n) => `The agent wants to copy ${n} lines to your clipboard.`,
  copyNotice: (from, n) => `${from} copied ${n} lines for you.`,
  copyNoticeDone: (from, time) => `${from}: text copied to your clipboard at ${time}.`,
  askHead: 'The agent asks for your clipboard', askKind: 'pbpaste',
  askWhy: 'What you give goes to the agent and the model provider. Nothing is read before you press.',
  askNotice: (from) => `${from} asks for your clipboard.`,
  pasteFrom: 'Paste from clipboard', pasteKey: 'or press ⌘V or Ctrl+V here',
  pasteField: 'Paste here (⌘V or Ctrl+V)', pasteFieldLabel: 'Clipboard text for the agent',
  editable: 'You can remove part of the text before you give it.',
  give: 'Give to the agent', dontGive: 'Don\'t give', cancel: 'Cancel',
  previewHead: 'This goes to the agent', previewOf: (n, b) => `${n} lines · ${b} · not yet given`,
  browserHint: {chromium: 'Chromium asks for permission to read the clipboard the first time.', gesture: 'Your browser still shows its own Paste button: press it.'},
  secretWarn: 'This looks like a key or a password. If you give it, the agent and the model provider will see it.',
  givenLine: (time, n) => `You gave the clipboard at ${time} · ${n} lines`,
  declinedLine: (time) => `You did not give the clipboard at ${time}. The agent was told, without text.`,
  expiredLine: (time) => `The request expired at ${time}. The agent did not get the clipboard.`,
  waiting: (time) => `Waiting for you until ${time}`,
  givenAs: 'Given to the pbpaste request',
  receives: 'What the agent gets (command output and exit code)',
  activity: {working: 'Working', idle: 'Done', waiting: 'Waiting for you'},
  running: 'running', waitingTool: 'waiting for you', done: 'done', failed: 'failed',
  notInC: 'The notice shows at the top of the page in whichever conversation you are in; here it sits over this one.',
};

export const TEXT: Record<Lang, Text> = {fi, en};
export const REPLY: Record<Lang, string> = {fi: replyFi, en: replyEn};
export const bytes = (s: string) => new TextEncoder().encode(s).length;
export const size = (s: string, lang: Lang) => {
  const b = bytes(s);
  return b < 1024 ? `${b} t`.replace(' t', lang === 'fi' ? ' t' : ' B') : `${(b / 1024).toFixed(1).replace('.', lang === 'fi' ? ',' : '.')} ${lang === 'fi' ? 'kt' : 'KB'}`;
};
export const lineCount = (s: string) => s.split('\n').length;
/** The proposed heuristic: something shaped like a credential gets a warning,
 * never a refusal; the person decides. */
export const looksSecret = (s: string) => /(^|\s)[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD)[A-Z0-9_]*=\S{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s);

/** What the command hands the agent, per step and direction. */
export function nativeText(t: Text, lang: Lang, d: number, step: Step, browser: Browser): string {
  const reply = REPLY[lang];
  const nCopy = lineCount(reply), bCopy = bytes(reply);
  if (d === 0) {
    if (step === 'copy' || step === 'copied') return `$ pbcopy < drafts/${lang === 'fi' ? 'vastaus-aino' : 'reply-aino'}.txt\nbash: pbcopy: command not found\n[exit 127]`;
    return `$ pbpaste\nbash: pbpaste: command not found\n[exit 127]`;
  }
  if (step === 'copy' || step === 'copied') {
    const direct = d === 2 && browser === 'chromium';
    return `$ pbcopy < drafts/${lang === 'fi' ? 'vastaus-aino' : 'reply-aino'}.txt\n` + (direct
      ? `pbcopy: copied ${nCopy} lines (${bCopy} bytes) to the person's clipboard; their browser had this conversation open and focused\n[exit 0]`
      : `pbcopy: offered ${nCopy} lines (${bCopy} bytes) to the person in this conversation; it is on their clipboard once they press Copy. Do not tell them it is already copied.\n[exit 0]`);
  }
  if (step === 'ask' || step === 'preview' || step === 'secret') return `$ pbpaste\npbpaste: asked the person for their clipboard in this conversation; waiting until ${EXPIRES} (--timeout 10m)\n(still running; nothing on stdout yet)`;
  if (step === 'given') return `$ pbpaste\n${TRACE}\n[exit 0, ${lineCount(TRACE)} lines, ${bytes(TRACE)} bytes on stdout]`;
  if (step === 'declined') return `$ pbpaste\npbpaste: the person chose not to give their clipboard (clipboard_declined). Do not ask again in this turn; ask them to paste what you need into the conversation.\n[exit 1]`;
  return `$ pbpaste\npbpaste: nobody answered in 10 minutes; the request expired at ${EXPIRES} (clipboard_timeout). The person may be away; ask them to paste what you need into the conversation.\n[exit 4]`;
}
