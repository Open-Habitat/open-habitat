// Capabilities: Documents and print. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, offer, screen, view, working } from '../../engine/kit.mjs';
import { sw, toggles } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const certMock = (names = ['Aino Berg', 'Leo Marsh', 'Sofia Nyman'], title = 'Swimming certificate', sub = 'Level 3 · 25 metres', foot = '118 certificates · sorted by class') => `<div class="cert"><div class="cert-st">${names.map((n, k) => `<div class="cert-p" style="--k:${k}"><small>Maple Lane School</small><b>${esc(title)}</b><i>${esc(n)}</i><span>${esc(sub)}</span></div>`).join('')}</div><p class="cert-n">${esc(foot)}</p></div>`;
const scoreMock = () => `<div class="score" data-view data-state="low">${toggles([['high', 'As written'], ['low', 'A whole tone lower']], 'low')}${sw(`<g stroke="#4b5563" stroke-width="1">${[0, 1, 2, 3, 4].map((k) => `<path d="M10 ${40 + k * 10} H310"/>`).join('')}</g><text x="14" y="78" font-size="44" font-family="serif" fill="#1d2a3a">𝄞</text><g class="score-notes">${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const y = [55, 50, 45, 50, 40, 45, 50, 55][k]; return `<g transform="translate(${70 + k * 30} ${y})"><ellipse rx="6" ry="4.4" transform="rotate(-20)" fill="#1d2a3a"/><path d="M5.5 -1 V-28" stroke="#1d2a3a" stroke-width="1.4"/></g>`; }).join('')}</g><text x="12" y="120" font-size="11" font-family="system-ui" fill="#5a6b5d">Soprano · bars 9–10</text>`, '', '0 0 320 130')}<p class="score-n"><span>full score · 4 part books</span><span>4 practice tracks, one per voice</span></p></div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [20, 'print', 'A print-ready poster, flyer and social image', 'Inkscape, Typst, Scribus', 'Carol', 'Example Studio', 'Open day in May: here are the date, three lines and last year’s photo.', 'An A3 poster for the print shop, an A5 flyer and a square image, all from one layout.'],
  [21, 'print', '120 certificates, invoices or name tags from one template', 'Typst, WeasyPrint', 'Judy', 'Maple Lane School', 'Swimming certificates for the end of term; here are the class lists and last year’s paper one.', '118 certificates with each pupil’s name, level and date, sorted by class.'],
  [23, 'print', 'Choir parts separated, transposed, with practice tracks', 'LilyPond, MuseScore, music21', 'Trent', 'Harbour Singers', 'The new piece sits too high for the sopranos. A whole tone lower, with separate parts.', 'The full score, four part books and four practice tracks, one for each voice.'],
  [32, 'print', 'One handbook as Word, PDF, web page and e-book', 'Pandoc, Typst', 'Alice', 'Example Studio', 'The opening hours changed. Update the handbook everywhere.', 'The printed PDF, the web version and the e-book rebuilt from the same text, so they never disagree.'],
  [33, 'print', 'A programme imposed as a folded booklet', 'pdfimpose', 'Trent', 'Harbour Singers', 'Sixteen A5 pages of concert programme.', 'One file to print double-sided on A4, fold and staple.'],
  [40, 'print', 'Documents translated without leaving the office', 'Argos Translate', 'Kirsi', 'Example Studio', 'A new linen supplier’s contract arrived in Polish.', 'A working English translation made on the studio’s server, marked as for understanding, not for signing.'],
  [41, 'print', 'QR codes and barcodes for products, shelves and tickets', 'Zint, qrcode, zxing-cpp', 'Bob', 'Example Studio', 'Labels for the stockroom’s 300 shelf positions.', 'A label for each, and after stocktaking a list of shelves missed, read from Bob’s phone photos.'],
  [48, 'print', 'Season fixtures or shifts in everyone’s phone calendar', 'icalendar', 'Peggy', 'Riverside Rowing Club', 'The season plan is a table in a PDF.', 'One calendar file per crew; every rower has their own sessions in their phone.'],
  [49, 'print', 'Revision cards from your own teaching material', 'genanki', 'Erin', 'Example Studio', 'Biology test on the cell next week.', 'A deck of 60 cards from her own slides, with her diagrams on them.'],
  [50, 'print', 'Your own material as an e-book', 'calibre, Pandoc', 'Peggy', 'Riverside Rowing Club', 'Sixty years of annual reports for the centenary.', 'One e-book with a chapter per decade.'],
  [51, 'print', 'A whole handbook proofread', 'LanguageTool', 'Alice', 'Example Studio', 'Check the handbook before it goes to print.', '112 corrections grouped by kind; she rejects the nine that are the shop’s deliberate style.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-print',
  kind: 'caps',
  group: { id: 'print', name: "Documents and print", line: "One layout, every format; 118 certificates from one template." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [21, 23],
  full: {
    21: () => capScreen(21, 'Swimming certificates', you('13:10', capOf[21][6], att('classes-2026.xlsx', '6 classes · 118 pupils')) + turn({ tools: [
        tool('write', 'certificates/template.typ', 'the old certificate, redrawn'),
        tool('bash', 'typst compile certificates/all.typ', '118 pages · sorted by class · one PDF per class'),
      ], reply: '**118 certificates**, one PDF per class so each teacher prints their own.', extra: offer('certificates-7B.pdf', 'PDF · 21 pages') }), view('certificates-7B.pdf', certMock())),
    23: () => capScreen(23, 'New piece, lower', you('18:45', capOf[23][6], att('winter-carol.musicxml', 'Score · 4 voices')) + turn({ tools: [
        tool('bash', 'python3 -c "music21 … transpose(\'M-2\')"', 'a whole tone lower · range checked for every voice'),
        tool('bash', 'lilypond parts/*.ly', 'score.pdf · soprano.pdf · alto.pdf · tenor.pdf · bass.pdf'),
        tool('bash', 'fluidsynth … practice-*.wav', '4 practice tracks · own voice loud, others soft'),
      ], reply: 'Done: **a whole tone lower**, so the top note is now a G. Four part books and four practice tracks are in *winter-carol/*.' }), view('soprano.pdf', scoreMock())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 20: ['carol', 'poster'], 49: ['erin', 'cards'] },
};
