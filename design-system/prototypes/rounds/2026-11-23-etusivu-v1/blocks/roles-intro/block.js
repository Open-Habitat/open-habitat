// "Same place, other work": the intro to the six colleagues and the row of
// links to them. The people themselves are the role-* blocks. Ported from
// round 6 variant 1, unchanged.
import { esc } from '../../engine/kit.mjs';

export default {
  id: 'roles-intro',
  kind: 'section',
  // roles: the role blocks' people, in page order; avatar(person, px) draws their initial.
  html: ({ roles, avatar }) => `<p class="kicker">Same place, other work</p>
    <h2>Six colleagues, the same kind of screen.</h2>
    <p>The rest of Example Studio. Bob sells, Kirsi keeps the books, Carol designs, Dave looks after the office and the people, Erin teaches the printing courses and Frank runs the dye research with the university. They work in the same Habitat, each in their own account with their own agents, so they can hand each other files, and the history shows who did what.</p>
    <nav class="role-nav" aria-label="People">${roles.map((d) => `<a href="#role-${d.id}">${avatar(d, 22)}<span><b>${esc(d.name)}</b>${esc(d.role)}</span></a>`).join('')}</nav>`,
};
