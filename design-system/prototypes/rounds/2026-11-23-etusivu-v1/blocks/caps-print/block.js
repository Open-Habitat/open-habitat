// Capabilities: Documents and print. The two screens show real output:
// the certificates are set by Typst from pupils.csv, the choir parts are
// engraved by LilyPond and the practice track is rendered by FluidSynth
// (assets.mjs). The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, offer, screen, view, diff, image, assets, PLAY_SVG } from '../../engine/kit.mjs';
import { toggles } from '../../engine/views.mjs';
const asset = assets(import.meta.url);

// ---------- This block's own views ----------
// Class 7B's PDF: three certificates large, then every page of the class.
const CLASSES = [['7A', 19], ['7B', 21], ['7C', 20], ['8A', 18], ['8B', 21], ['8C', 19]];
const certView = () => `<div class="cp-cert">
<div class="cp-fan">${[[2, 'Tobias Abbot, Level 4, 200 metres'], [3, 'Amir Eklund, Level 2, 50 metres'], [1, 'Lena Ashby, Level 3, 100 metres']].map(([k, who]) => image(asset(`certificate-${k}.webp`), `Swimming certificate of Maple Lane School: ${who}`, 1000, 705, `cp-c cp-c${k}`)).join('')}</div>
<figure class="cp-sheet">${image(asset('certificates-7B-sheet.webp'), 'All 21 certificates of class 7B, each with its own name and level', 1200, 387)}<figcaption><b>Class 7B</b> · 21 pages, one pupil each</figcaption></figure>
<ul class="cp-classes" aria-label="One PDF per class">${CLASSES.map(([c, n]) => `<li${c === '7B' ? ' class="on"' : ''}><b>${c}</b><span>${n}</span></li>`).join('')}<li class="cp-sum"><b>118</b><span>certificates</span></li></ul>
</div>`;
// The soprano part in both keys. The lower one is the practice track: the
// part with a playhead on the notes, and the sound FluidSynth made of it.
const BOOKS = [['score', 'Score'], ['soprano', 'Soprano'], ['alto', 'Alto'], ['tenor', 'Tenor'], ['bass', 'Bass']];
const scoreView = () => `<div class="cp-score" data-view data-state="low">
${toggles([['high', 'As written, in D'], ['low', 'A whole tone lower, in C']], 'low')}
<div class="cp-page cp-high">${image(asset('soprano-d.webp'), 'The soprano part of Silent Night as written, in D major; the top note is a G', 1200, 900)}</div>
<div class="cp-page cp-low"><video class="cp-video" src="${esc(asset('practice-soprano.mp4'))}" poster="${esc(asset('soprano-c.webp'))}" width="1200" height="900" playsinline preload="none" aria-label="The soprano part a whole tone lower, in C major, with its practice track: the soprano line on a clarinet, the other voices on a quiet piano"></video></div>
<p class="cp-n cp-high"><span>Top note <b>G</b></span><span>The copy the choir had</span></p>
<p class="cp-n cp-low"><span>Top note <b>F</b></span><button type="button" class="cp-play" data-play="Play the practice track" data-pause="Pause">${PLAY_SVG}<span class="cp-play-l">Play the practice track</span><span class="cp-play-t">0:33 · sound</span></button></p>
<ul class="cp-books" aria-label="The five books in C">${BOOKS.map(([f, n]) => `<li${f === 'soprano' ? ' class="on"' : ''}>${image(asset(`book-${f}.webp`), `${n}: first page`, 360, 270)}<span>${n}</span></li>`).join('')}</ul>
</div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [20, 'print', 'A print-ready poster, flyer and social image', 'Inkscape, Typst, Scribus', 'Carol', 'Example Studio', 'Open day in May: here are the date, three lines and last year’s photo.', 'An A3 poster for the print shop, an A5 flyer and a square image, all from one layout.'],
  [21, 'print', '120 certificates, invoices or name tags from one template', 'Typst', 'Judy', 'Maple Lane School', 'Swimming certificates for the end of term. Here are the class lists and last year’s paper one.', 'Every pupil gets their own: name, level and distance from the class list, on a certificate redrawn from the old paper one. 118 pages, one PDF per class, so each teacher prints their own.'],
  [23, 'print', 'Choir parts separated, transposed, with practice tracks', 'LilyPond, FluidSynth', 'Trent', 'Harbour Singers', 'Silent Night sits too high for our sopranos. Take it down a whole tone, and give every voice its own part.', 'The score and four part books a whole tone lower, engraved like printed music, and a practice track for each voice to sing along to at home.'],
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
  group: { id: 'print', name: "Documents and print", line: "From a class list to 118 certificates; from one score to a part and a practice track for every voice." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [21, 23],
  full: {
    21: () => capScreen(21, 'Swimming certificates', you('13:10', capOf[21][6], att('classes-2026.xlsx', '6 classes · 118 pupils') + att('certificate-2025.jpg', 'Photo')) + turn({
      thoughts: ['Last year’s certificate has the school, the pupil’s name, the level and two lines for signatures. I will redraw it as one template and fill it from the class lists, so nobody types a name twice.'],
      tools: [
        tool('bash', 'xlsx2csv -a classes-2026.xlsx certificates/ && cat certificates/*.csv > certificates/pupils.csv && wc -l certificates/pupils.csv', '119 certificates/pupils.csv', '118 pupils + header'),
        tool('write', 'certificates/certificate.typ', '#let rows = csv("pupils.csv", row-type: dictionary)\n  .filter(r => r.class == sys.inputs.class)\n\n#for r in rows {\n  certificate(r)   // name, class, level, metres\n}', 'new · 108 lines'),
        tool('bash', 'for c in 7A 7B 7C 8A 8B 8C; do typst compile --input class=$c certificates/certificate.typ certificates/certificates-$c.pdf; done; for f in certificates/*.pdf; do echo "$f: $(pdfinfo $f | grep Pages)"; done', CLASSES.map(([c, n]) => `certificates/certificates-${c}.pdf: Pages:           ${n}`).join('\n')),
      ],
      time: '1 min 46 s',
      reply: '**118 certificates**, one PDF per class, so each teacher prints their own. Names, levels and distances come straight from your class lists, and the two signature lines are left empty for signing by hand.\n\nClass 7B is open beside this. If the wording should change, say so: it changes on all 118 at once.',
      extra: offer('certificates-7B.pdf', 'PDF · 21 pages · A5'),
    }), view('certificates-7B.pdf', certView())),
    23: () => capScreen(23, 'Silent Night, lower', you('18:45', capOf[23][6], att('silent-night.musicxml', 'Score · 4 voices')) + turn({
      thoughts: ['The piece is in D and the sopranos’ top note is a G. A whole tone down it is an F. The basses’ lowest note becomes a low G, which is still comfortable.'],
      tools: [
        tool('bash', 'musicxml2ly silent-night.musicxml -o silent-night.ily', 'musicxml2ly: Reading MusicXML from silent-night.musicxml ...\nmusicxml2ly: Converting to LilyPond expressions...\nmusicxml2ly: Output to `silent-night.ily\''),
        diff('parts/soprano.ly', ['   \\new Voice = "soprano" {', '-    { \\global \\soprano }', '+    \\transpose d c { \\global \\soprano }', '   }'], 'in all five books'),
        tool('bash', 'lilypond -o books parts/score.ly parts/soprano.ly parts/alto.ly parts/tenor.ly parts/bass.ly', 'Processing `parts/score.ly\'\nConverting to `books/score.pdf\'...\nProcessing `parts/soprano.ly\'\nConverting to `books/soprano.pdf\'...\nProcessing `parts/alto.ly\'\nConverting to `books/alto.pdf\'...\nProcessing `parts/tenor.ly\'\nConverting to `books/tenor.pdf\'...\nProcessing `parts/bass.ly\'\nConverting to `books/bass.pdf\'...\nSuccess: compilation successfully completed'),
        tool('bash', 'for v in soprano alto tenor bass; do fluidsynth -ni -F practice/$v.wav FluidR3_GM.sf2 practice/$v.midi; done', ['soprano', 'alto', 'tenor', 'bass'].map((v) => `Rendering audio to file 'practice/${v}.wav'..`).join('\n')),
      ],
      time: '58 s',
      reply: 'A whole tone lower, in C: the sopranos’ top note is now an **F** instead of a G, and the basses still have room at the bottom.\n\nThe score, four part books and a practice track for each voice are in *silent-night/*. In a practice track your own line is a clarinet up front and the other voices a quiet piano. The soprano one is open beside this.',
      extra: offer('silent-night-in-C.zip', '5 PDFs · 4 practice tracks'),
    }), view('soprano.pdf', scoreView())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 20: ['carol', 'poster'], 49: ['erin', 'cards'] },
};
