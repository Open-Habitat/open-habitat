(() => {
  document.querySelector('.topbar').hidden = true;
  document.querySelector('.composer').hidden = true;
  document.querySelector('#slow').closest('label').hidden = true;
  const goals = [
    {title:'Tutustu repoon', when:'Kun aloitat tässä repossa ensimmäistä kertaa.', prompt:'Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.'},
    {title:'Korjaa havaittu ongelma', when:'Kun löydät toistettavan virheen.', skill:'korjaa', prompt:'Selvitä ongelman syy: [kuvaile havainto]. Tee ensin pieni toistava testi. Korjaa juurisyy ja aja aiheeseen liittyvät testit. Kerro, mitä tarkistit ja mikä jäi tarkistamatta.'},
    {title:'Valmistele seuraava julkaisu', when:'Kun haluat tarkistaa julkaisuvalmiuden.', prompt:'Tarkista seuraavan julkaisun valmius.\n\n1. Lue repon julkaisuohje.\n2. Tarkista työpuun tila muuttamatta sitä.\n3. Kokoa edellisen julkaisun jälkeiset käyttäjälle näkyvät muutokset.\n4. Erota korjaukset uusista ominaisuuksista.\n5. Tarkista dokumenttien esimerkit.\n6. Aja ohjeen nimeämät testit.\n7. Kerro myös tarkistukset, joita et voinut ajaa.\n8. Listaa avoimet esteet.\n9. Ehdota seuraava versio ja perustele se.\n10. Kirjoita lyhyt julkaisuluonnos.\n\nÄlä luo tagia, pushaa tai julkaise mitään. Odota hyväksyntää. Tarkistettava esimerkkipolku: docs/esimerkit/erittain-pitka-synteettinen-julkaisun-valmistelun-tarkistuslistan-tiedostonimi.md'},
    {title:'Päivitä ohje', when:'Kun käytäntö on muuttunut.', prompt:'Tarkista ohjeen [polku] esimerkit nykyistä toteutusta vasten. Ehdota täsmälliset korjaukset. Älä muuta muita ohjeita.'},
    {title:'Arvioi muutos', when:'Ennen muutoksen yhdistämistä.', prompt:'Arvioi nykyisen haaran muutos. Etsi vain toistettavia ongelmia ja kerro kunkin vaikutus, ei tyylitoiveita.'},
    {title:'Suunnittele pieni lisäys', when:'Kun haluat uuden toiminnon.', prompt:'Suunnittele lisäys: [tavoite]. Lue nykyinen toteutus. Ehdota pienin hyödyllinen muutos ja sen testi ennen koodausta.'},
  ];
  const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prompt = i => `<div class="s-prompt" tabindex="0" role="region" aria-label="Koko pyyntö: ${esc(goals[i].title)}">${goals[i].skill ? `<code>/skill:${goals[i].skill}</code><br>` : ''}${esc(goals[i].prompt)}</div>`;
  const insert = i => `<button class="s-button" data-insert="${i}" aria-label="${esc(goals[i].title)} — lisää luonnokseen">Lisää luonnokseen</button>`;
  function card(i) {const g=goals[i]; return `<article><h3>${g.title}</h3><p>${g.when}</p><details class="s-reveal"><summary>Näytä pyyntö</summary>${prompt(i)}</details>${insert(i)}</article>`;}
  function row(i) {const g=goals[i]; return `<details class="s-row" name="start-goals"><summary><strong>${g.title}</strong><span>${g.when}</span></summary><div class="s-row-body">${prompt(i)}${insert(i)}</div></details>`;}
  function choice(i) {const g=goals[i]; return `<button class="s-choice" data-choice="${i}" aria-pressed="false"><strong>${g.title}</strong><span>${g.when}</span></button>`;}
  const descriptions = {
    cards:'Kortit · suositus: vertaile tavoitteita. Pyyntö avautuu korttiin vain tarvittaessa.',
    rows:'Rivit: avaa tavoite nähdäksesi pyynnön ja luonnokseen lisäämisen. Vain yksi rivi auki kerrallaan.',
    preview:'Esikatselu: valitse tavoite ja tarkista koko pyyntö ennen luonnokseen lisäämistä.',
  };
  function render(mode) {
    const item = mode === 'cards' ? card : mode === 'rows' ? row : choice;
    return `<div class="s-demo" data-direction="${mode}"><p class="s-note">${descriptions[mode]} <span>Synteettinen prototyyppi · vain aloitussivu ja luonnos toimivat. Linkkiversio käyttää järjestelmäfontteja.</span></p><div class="s-app"><aside class="s-rail" aria-label="Navigaatio (sommitelma)"><strong>Open Habitat</strong><p>Etusivu</p><small>TYÖTILAT</small><p><code>aurinkopolku</code>　＋</p><div class="s-current">Uusi keskustelu</div><p>Ohjeen päivitys</p><p>Valmiit · 2</p><div class="s-account">Aino · esimerkkikäyttäjä</div></aside><main class="s-main"><header class="s-header"><strong>Uusi keskustelu</strong><code>aurinkopolku</code><button class="s-header-info" aria-label="Tiedot (vain sommitelma)" aria-disabled="true" title="Tiedot · vain sommitelma"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></button></header><div class="s-scroll"><section class="ah-start"><h2>Aurinkopolku</h2><p class="s-intro">Pieni retkireittien suunnittelija. Tässä repossa ovat sovellus, testit ja käyttöohjeet.</p><details class="s-about"><summary>Lisätietoa reposta</summary><p>Reittilaskenta on hakemistossa <code>src/routes</code> ja testit hakemistossa <code>tests</code>. Lue <code>AGENTS.md</code> ennen muutoksia. Esimerkkiaineisto on keksittyä.</p></details><h3 class="s-heading">Mitä haluat tehdä?</h3><div class="s-goal-layout"><div class="s-goal-list ${mode==='cards'?'ah-start-goals':''}">${[0,1,2].map(item).join('')}<details class="s-more"><summary>Muut tavoitteet · 3</summary><div class="s-extra">${[3,4,5].map(item).join('')}</div></details></div>${mode==='preview'?'<section class="s-preview" aria-label="Valitun tavoitteen pyyntö"><p>Valitse tavoite vasemmalta.</p></section>':''}</div><p class="s-help">Lisääminen ei lähetä viestiä. Voit muokata pyyntöä luonnoksessa.</p></section></div><footer class="s-compose"><div class="s-entry"><div class="s-field"><textarea aria-label="Viesti Pi:lle" placeholder="Kirjoita agentille…"></textarea><span class="s-model">gpt-5.5 · high⌄</span></div><button class="s-send" aria-label="Lähetä (ei käytössä prototyypissä)" disabled>↑</button></div><p class="s-feedback" role="status" aria-live="polite">Lähetys ei ole käytössä prototyypissä.</p></footer></main></div></div>`;
  }
  window.startCards = () => render('cards'); window.startRows = () => render('rows'); window.startPreview = () => render('preview');
  stage.addEventListener('click', e => {
    const c=e.target.closest('[data-choice]');
    if(c) {const i=+c.dataset.choice; stage.querySelectorAll('[data-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b===c))); stage.querySelector('.s-preview').innerHTML=`<h3>${goals[i].title}</h3>${prompt(i)}${insert(i)}`;}
    const b=e.target.closest('[data-insert]');
    if(b) {const g=goals[+b.dataset.insert], field=stage.querySelector('textarea'); const text=(g.skill?`/skill:${g.skill} `:'')+g.prompt; field.value=text+(field.value.trim()?'\n\n'+field.value:''); field.focus(); field.setSelectionRange(0,0); stage.querySelector('.s-feedback').textContent='Pyyntö lisätty luonnokseen. Aiempi tekstisi säilyi. Mitään ei lähetetty.';}
  });
})();
