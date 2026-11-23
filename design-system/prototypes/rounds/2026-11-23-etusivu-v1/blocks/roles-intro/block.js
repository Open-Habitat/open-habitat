// "Same place, other work": the intro to the six colleagues and the row of
// links to them. The people themselves are the role-* blocks. The through-line
// (one person, many agents, one server) widens here to the whole studio.
import { esc } from '../../engine/kit.mjs';

export default {
  id: 'roles-intro',
  kind: 'section',
  // roles: the role blocks' people, in page order; avatar(person, px) draws their initial.
  html: ({ roles, avatar }) => `<p class="kicker">Same place, other work</p>
    <h2>Six colleagues, each with agents of their own.</h2>
    <p>The rest of Example Studio uses the same Habitat on the same server. Each person has their own Linux account, with their own files and agents. Work passes between them through shared folders, and the history says who did what.</p>
    <nav class="role-nav" aria-label="People">${roles.map((d) => `<a href="#role-${d.id}">${avatar(d, 28)}<span><b>${esc(d.name)}</b>${esc(d.role)}</span></a>`).join('')}</nav>`,
};
