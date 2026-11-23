// Alice's day: who she is, where she is through Thursday, her ten
// conversations and how their states change, the section's intro and its end.
// The twelve glimpses are their own blocks (alice-01 … alice-12); the order is
// in blocks/index.js. Copy tightened in v1 (see NOTES.md).
export default {
  id: 'alice-day',
  kind: 'day',
  person: {
    id: 'alice', name: 'Alice', role: 'Founder, CEO', org: 'Example Studio', color: 'var(--ah-accent)',
    blurb: 'Alice runs Example Studio, a small shop for hand-printed linen. Six people work with her.',
    places: [
      ['08:00', 'At home', 'home'], ['08:25', 'On the tram', 'tram'], ['09:10', 'In the studio', 'studio'],
      ['10:15', 'Planning with Bob and Carol', 'meet'], ['11:00', 'In the studio', 'studio'],
      ['12:20', 'Out for lunch', 'lunch'], ['13:25', 'In the studio', 'studio'],
      ['15:40', 'Packing orders with Bob', 'box'], ['16:40', 'In the studio', 'studio'], ['17:40', 'Gone home', 'home'],
    ],
    sess: [
      { id: 'today', title: 'What’s waiting today', segs: [['08:02', 'run', 'Reading mail and calendar'], ['08:04', 'turn', 'Five things today'], ['08:10', 'quiet', 'Read']] },
      { id: 'receipts', title: 'October receipts', segs: [['08:12', 'run', 'Searching 1,284 emails'], ['08:41', 'turn', '3 charges not found'], ['12:39', 'run', 'Searching the info inbox'], ['12:44', 'quiet', '25 of 26 done']] },
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
  // The through-line starts here: one person, many agents, one server.
  intro: (blurb) => `<p class="kicker">One person, ten agents</p>
  <h2>Alice’s Thursday.</h2>
  <p>${blurb} On Thursday she asked her agents for ten things, in her own words, from her desk, the tram and her phone. Some took a minute. One worked through lunch with every tab closed. She never sat and waited for any of them.</p>
  <p class="ad-hint">Scroll: her sidebar moves through the day.</p>`,
  end: `<p>At 17:40 Alice goes home. The newsletter waits for her yes, and the order page is still taking orders.</p>
  <p class="ad-sum"><span><b>10</b> conversations</span><span><b>1</b> sidebar</span><span><b>1</b> ordinary server</span></p>
  <p class="ad-next">Tomorrow her agents start from tonight’s notes, and so do Bob’s.</p>`,
};
