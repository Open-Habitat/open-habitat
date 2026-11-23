// Alice · 12:38 · October receipts, continued at lunch on her phone: the
// morning's questions waiting where she left them, her dictated answer, the
// shop's second mailbox searched and the last receipt filed.
// The morning half is ../alice-03-october-receipts; the matcher's output here
// is the real output that block's assets.mjs checks (RUNS.fjord).
// The block contract is in ../../BLOCKS.md.
import { MIC_IC, you, reply, tool, turn, drafts, mark, md } from '../../engine/kit.mjs';
import { RUNS } from '../alice-03-october-receipts/block.js';

const sv = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const MENU = sv('<path d="M4 7h16M4 12h16M4 17h16"/>');
const SEND = sv('<path d="M12 19V5m-6 6 6-6 6 6"/>');
const FOLDER = sv('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>');
const BARS = '<svg viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>';
const BATT = '<svg viewBox="0 0 26 12" aria-hidden="true"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="15" height="8" rx="1.6"/><rect x="23.5" y="4" width="2" height="4" rx="1" opacity=".45"/></svg>';

const ASK = 'The packaging one is Bob’s, ask him. Skip the parking. Fonts come to the info inbox.';

// The morning's reply, as it waits in the conversation (alice-03), with its folder folded to one line.
const MORNING = `**23 of 26** receipts are in Kirsi’s folder, each named date, vendor, amount.`;
const MORNING_Q = `Three charges have no receipt anywhere in your mail:

1. **Northside Packaging, €230.00, 6 Oct.** Did someone else order this?
2. **City parking, €12.60, 14 Oct.** File it without a receipt?
3. **Fjord Fonts, €49.00, 28 Oct.** Do their invoices go to another address?`;
const folderLine = `<p class="lp-folder">${FOLDER}<span><b>bookkeeping/2026-10</b><small>23 receipts</small></span></p>`;

const phone = () => `<div class="lp-stage"><div class="lp-phone" aria-label="Alice’s phone: the October receipts conversation in Open Habitat">
  <div class="lp-status" aria-hidden="true"><b>12:38</b><span class="lp-island"></span><span class="lp-sys">${BARS}${BATT}</span></div>
  <div class="scr lp-scr">
    <div class="lp-bar"><span class="lp-menu" aria-hidden="true">${MENU}<i>3</i></span><span class="lp-title">${mark(16, 'waiting')}<b>October receipts</b></span><span class="lp-org">Example Studio</span></div>
    <div class="lp-feed"><div class="c-feed">
      <p class="lp-day">Today · 08:41</p>
      ${reply(MORNING, folderLine + `<div class="ah-prose lp-q">${md(MORNING_Q)}</div>`)}
      ${you('12:38', ASK, '', `${MIC_IC}Dictated`)}
      ${turn({
        tools: [
          tool('bash', 'himalaya envelope search -a info from:fjord', 'ID  SUBJECT           FROM         DATE\n1   Invoice FF-10291  Fjord Fonts  2026-10-28 14:07'),
          tool('bash', RUNS.fjord.cmd, RUNS.fjord.out),
          tool('write', 'bookkeeping/2026-10/no-receipt.txt', '2026-10-14  City parking  12.60  no receipt (Alice, 12:38)', 'new · 1 line'),
          drafts([['sent', 'Bob', 'Receipt for Northside Packaging, €230.00', 'Hi Bob, the €230.00 Northside order on 6 October was yours, Alice says. Could you forward me the receipt?']]),
        ],
        time: '1 min 52 s',
        reply: 'Found the Fjord Fonts invoice in **info@example.org** and filed it. Bob has a note asking for the Northside receipt, and parking is marked *no receipt*.\n\n**24 of 26** are in Kirsi’s folder. The last one waits for Bob.',
      })}
    </div></div>
    <div class="lp-comp" aria-hidden="true"><span class="lp-field">Message</span><span class="lp-mic">${MIC_IC}</span><span class="lp-send">${SEND}</span></div>
  </div>
  <span class="lp-home" aria-hidden="true"></span>
</div></div>`;

export default {
  id: 'alice-07-lunch-phone',
  kind: 'glimpse',
  day: 'alice',
  s: 'receipts',
  at: '12:38',
  ask: ASK,
  did: 'Lunch, phone in hand. The morning’s three questions wait where she left them. She answers all three by voice in one breath; the agent finds the font invoice in the shop’s info@ mailbox, files it, and writes to Bob as she asked. Meanwhile the returns job has worked on since ten without an open tab.',
  screen: phone,
};
