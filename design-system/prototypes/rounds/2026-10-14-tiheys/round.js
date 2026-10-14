// Kierros 14.10.2026: keskustelunäkymän tiheys. Suunta asettaa kehykselle
// data-density-arvon; säännöt ovat round.css:ssä.
(() => {
const set = (d) => () => { uiFrame.dataset.density = d; return appView(); };
window.v1 = set('nykyinen'); window.v2 = set('kevyempi'); window.v3 = set('tiivis'); window.v4 = set('kortiton');
})();
