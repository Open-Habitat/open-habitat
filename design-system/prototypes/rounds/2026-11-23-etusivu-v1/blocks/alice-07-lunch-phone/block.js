// Alice · 12:38 · October receipts. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { MIC_IC, you, tool, turn, drafts, working } from '../../engine/kit.mjs';

// ---------- This block's own views ----------
const phoneMock = () => `<div class="ph-stage"><div class="ph" role="img" aria-label="Alice’s phone"><div class="ph-notch" aria-hidden="true"></div>
  <div class="ph-top"><b>October receipts</b><span class="ph-chips"><i class="c-turn">3 Your turn</i><i class="c-run">1 Running</i></span></div>
  <div class="ph-body">
    <div class="away"><p class="away-h">While you were away</p><p>Found and filed 23 of 26 receipts. Not found: Northside Packaging €230.00, city parking €12.60, Fjord Fonts €49.00.</p></div>
    ${you('12:38', 'The packaging one is Bob’s, ask him. Skip the parking. Fonts come to the info inbox.', '', `${MIC_IC}Dictated`)}
    ${turn({ tools: [
        tool('bash', 'himalaya -a info search "Fjord Fonts"', '1 found · 28 Oct · invoice FF-10291.pdf'),
        drafts([['sent', 'Bob', 'Receipt: Northside Packaging €230', 'Hi Bob, do you have the receipt for 6 October?']]),
      ], reply: 'Fonts invoice filed. Asked Bob for the packaging receipt; parking marked *no receipt*. **25 of 26** done, in the folder Kirsi reads.' })}
  </div>
  <div class="ph-comp">${MIC_IC}<span>Message</span></div></div></div>`;

export default {
  id: 'alice-07-lunch-phone',
  kind: 'glimpse',
  day: 'alice',
  s: 'receipts',
  at: '12:38',
  ask: 'The packaging one is Bob’s, ask him. Skip the parking. Fonts come to the info inbox.',
  did: 'At lunch Alice opens her phone. Three conversations wait for her, and the returns job has been working since ten with the tab closed. She reads the summary and answers by voice; the agent searches the shop’s other inbox and writes to Bob, as she asked.',
  screen: phoneMock,
};
