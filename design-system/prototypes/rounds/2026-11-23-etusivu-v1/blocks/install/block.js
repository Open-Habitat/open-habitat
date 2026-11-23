// The install stub and the footer: the rest of the page is not this round's.
// Ported from round 6, unchanged.
import { mark } from '../../engine/kit.mjs';

const REPO = 'https://github.com/Open-Habitat/open-habitat';

export default {
  id: 'install',
  kind: 'section',
  html: () => `<section class="stub" id="install">
  <p class="kicker">The rest of the page</p>
  <h2>Nobody in these days had anything to set up. Somebody did, once.</h2>
  <p>One person who administers a Linux server installs Open Habitat for the team, by giving their coding agent the operator guide. After that, everyone signs in with a browser and gets an agent of their own.</p>
  <p class="cta"><a class="btn" href="${REPO}">Install on your server</a><a class="btn ghost" href="${REPO}#limits">What it does not do</a></p>
  <p class="stub-note">Install, limits and the pre-release note follow here, as in round 2.</p>
</section>
<footer class="foot"><span class="brandword">${mark(18)} Open Habitat</span><span>Free and open source under the MIT License.</span><a href="${REPO}">GitHub</a><a href="${REPO}/releases">Releases</a><span class="quiet">This page sets no cookies and loads nothing from anywhere else.</span></footer>`,
};
