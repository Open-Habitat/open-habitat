// The install section and the footer: the page's close. One person sets up
// one ordinary server, everyone else signs in, and the server stays theirs to
// build on. Requirements and limits are the README's (Install, Good to know).
import { mark, esc } from '../../engine/kit.mjs';

const REPO = 'https://github.com/Open-Habitat/open-habitat';
const GUIDE = 'https://raw.githubusercontent.com/Open-Habitat/open-habitat/main/docs/operations.md';

export default {
  id: 'install',
  kind: 'section',
  html: () => `<section class="stub" id="install">
  <p class="kicker">Your own server</p>
  <h2>Nobody in these days set anything up. Somebody did, once.</h2>
  <p>One person who looks after an ordinary Linux server installs Open Habitat, by handing the operator guide to their coding agent. Then everyone signs in from a browser, and every program added to the server is there for all their agents.</p>
  <div class="in-ask">
    <p class="in-ask-h">Ask your coding agent</p>
    <p class="in-ask-q">Install Open Habitat on my server. Follow this guide: <code>${esc(GUIDE)}</code></p>
    <p class="in-ask-n">It asks for what only you can supply and shows each plan before it changes anything.</p>
  </div>
  <ul class="in-need" aria-label="What you bring">
    <li><b>A server</b>Ubuntu 24.04 LTS, amd64 or arm64</li>
    <li><b>A name</b>A DNS name and a TLS certificate</li>
    <li><b>Sign-in</b>A GitHub OAuth app; people sign in with GitHub</li>
    <li><b>AI</b>Each person’s own subscription or key, or one key for the server</li>
  </ul>
  <p class="cta"><a class="btn" href="${REPO}#install">Install on your server</a><a class="btn ghost" href="${REPO}#good-to-know">Good to know first</a></p>
  <p class="in-pre">Early pre-release (0.1.x): it runs on real multi-person servers, but formats and interfaces still change between releases.</p>
</section>
<footer class="foot"><span class="brandword">${mark(18)} Open Habitat</span><span>Free and open source under the MIT License.</span><a href="${REPO}">GitHub</a><a href="${REPO}/releases">Releases</a><a href="${REPO}/discussions">Discussions</a><span class="quiet">This page sets no cookies and loads nothing from anywhere else.</span></footer>`,
};
