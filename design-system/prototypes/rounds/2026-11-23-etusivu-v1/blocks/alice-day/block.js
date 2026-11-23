// Alice's day: who she is, where she is through Thursday, her ten
// conversations and how their states change, the section's intro and its end.
// The twelve glimpses are their own blocks (alice-01 … alice-12); the order is
// in blocks/index.js. Ported from round 6, content unchanged.
export default {
  id: 'alice-day',
  kind: 'day',
  person: {
    id: 'alice', name: 'Alice', role: 'Founder, CEO', org: 'Example Studio', color: 'var(--ah-accent)',
    blurb: 'Alice runs Example Studio, a small shop for hand-printed linen, with a website, a wholesale list and a staff handbook. Six people work with her: Bob sells, Kirsi keeps the books, Carol designs, Dave runs the office, Erin teaches the studio’s printing courses and Frank works on dyes with the university.',
    places: [
      ['08:00', 'At home', 'home'], ['08:25', 'On the tram', 'tram'], ['09:10', 'In the studio', 'studio'],
      ['10:15', 'Planning with Bob and Carol', 'meet'], ['11:00', 'In the studio', 'studio'],
      ['12:20', 'Out for lunch', 'lunch'], ['13:25', 'In the studio', 'studio'],
      ['15:40', 'Packing orders with Bob', 'box'], ['16:40', 'In the studio', 'studio'], ['17:40', 'Gone home', 'home'],
    ],
    sess: [
      { id: 'today', title: 'What’s waiting today', segs: [['08:02', 'run', 'Reading mail and calendar'], ['08:04', 'turn', 'Five things today'], ['08:10', 'quiet', 'Read']] },
      { id: 'receipts', title: 'October receipts', segs: [['08:12', 'run', 'Searching 1,284 emails'], ['08:41', 'turn', '3 charges not found'], ['12:39', 'run', 'Searching the info inbox'], ['12:44', 'quiet', '25 of 26 filed']] },
      { id: 'video', title: 'Market video', segs: [['08:20', 'run', 'Installing a video program'], ['09:02', 'turn', 'Video ready to watch'], ['09:14', 'quiet', 'market-30s.mp4']] },
      { id: 'prices', title: 'Northside prices', segs: [['08:30', 'run', 'Running last week’s margin check'], ['08:34', 'turn', '4 products under 40 %'], ['09:15', 'run', 'Writing to Bob'], ['09:16', 'quiet', 'Sent to Bob']] },
      { id: 'banner', title: 'Shipping banner', segs: [['09:40', 'run', 'Reading the site’s history'], ['09:44', 'turn', 'Bob’s agent, Tuesday'], ['09:47', 'run', 'Editing the banner'], ['09:48', 'turn', 'Publish?'], ['09:49', 'run', 'Publishing'], ['09:50', 'quiet', 'Published']] },
      { id: 'returns', title: 'Returns: 30 days', segs: [['10:10', 'run', '5 workers'], ['13:35', 'turn', '17 pages ready to review'], ['13:50', 'run', 'Merging'], ['13:55', 'quiet', 'Merged'], ['15:30', 'run', 'Undoing one page'], ['15:32', 'quiet', 'Wholesale back to 14 days']] },
      { id: 'memo', title: 'Planning memo', segs: [['11:05', 'run', 'Transcribing 58 minutes'], ['11:24', 'turn', 'Memo and 7 tasks'], ['13:38', 'quiet', 'memo-2026-11-19.docx']] },
      { id: 'orders', title: 'Wholesale order page', segs: [['11:40', 'run', 'Building the order page'], ['12:10', 'turn', 'Live · send the codes?'], ['13:40', 'quiet', 'Running at wholesale.example.org'], ['16:47', 'run', 'Reading today’s orders'], ['16:50', 'turn', '3 shops ordered'], ['16:58', 'quiet', 'Running · 3 orders today']] },
      { id: 'newsletter', title: 'December newsletter', segs: [['14:05', 'run', 'Counting this year’s buyers'], ['14:30', 'turn', 'Draft for 386 people']] },
      { id: 'wrapup', title: 'Before I go', segs: [['17:25', 'run', 'Reading back through the day'], ['17:28', 'turn', 'Saved: 3 for you, 4 for the team'], ['17:32', 'quiet', 'Saved']] },
    ],
  },
  intro: (blurb) => `<p class="kicker">One person, one day</p>
  <h2>Alice’s Thursday, ten agents.</h2>
  <p>${blurb} On Thursday she started ten conversations with her agents: some were done in a minute, one worked through lunch, one is still running tonight. Scroll, and her sidebar moves through the day.</p>`,
  end: '<p>At 17:40 the newsletter still waits for her: it goes out when she says so. The order page is still taking orders. Tomorrow her agents start from what this one wrote down, and so do Bob’s.</p>',
};
