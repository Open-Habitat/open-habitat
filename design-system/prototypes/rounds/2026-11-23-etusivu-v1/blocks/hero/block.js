// The hero: the page's top bar, headline, call to action and the product
// capture (made by assets.mjs). Ported from round 6 (round 2's hero), unchanged.
import { mark, assets } from '../../engine/kit.mjs';

const asset = assets(import.meta.url);
const REPO = 'https://github.com/Open-Habitat/open-habitat';

export default {
  id: 'hero',
  kind: 'section',
  html: () => `<header class="top"><a class="brandword" href="#">${mark(24)} Open Habitat</a><nav><a href="#day">A day</a><a href="#can">What it can do</a><a href="#install">Install</a><a href="/docs/">Docs</a><a href="${REPO}">GitHub</a></nav></header>
<section class="hero">
  <p class="eyebrow">Open source · on your own server · pre-release 0.1</p>
  <h1>Coding-grade AI agents <br>for your whole team.</h1>
  <p class="lede">No terminal required. Everyone gets a real agent with its own Linux account, in a browser tab. One person sets up one server; everyone else signs in and gets to work.</p>
  <p class="cta"><a class="btn" href="#install">Install on your server</a><a class="btn ghost" href="#day">See a day</a></p>
</section>
<figure class="hero-band"><img class="hero-img" src="${asset('hero.webp')}" width="2000" height="1321" alt="A conversation with an agent in Open Habitat on a desktop browser, with running and waiting conversations in the sidebar, and the same conversation on a phone"></figure>`,
};
