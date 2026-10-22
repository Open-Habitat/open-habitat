(() => {
  document.querySelector('.topbar').hidden = true;
  document.querySelector('.composer').hidden = true;
  document.querySelector('#slow').closest('label').hidden = true;
  // No animated scenario to replay in this round. Picker itself is unchanged.
  document.querySelector('.proto-picker-replay').hidden = true;
  document.querySelector('.proto-picker-divider').hidden = true;
  const goals = [
    {id:'tutustu', title:'Tutustu repoon', when:'Kun aloitat tässä repossa ensimmäistä kertaa.', what:'Saat kartan Aurinkopolun rakenteesta, tärkeimmistä ohjeista ja testien ajamisesta. Tiedostoja ei muuteta.', steps:['Agentti lukee repon ohjeet ja tärkeimmät aloitustiedostot.','Agentti kokoaa hakemistokartan ja testien ajotavat.','Tarkistat yhteenvedon ja valitset seuraavan tehtävän.'], prompt:'Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.'},
    {id:'korjaa', title:'Korjaa havaittu ongelma', when:'Kun löydät toistettavan virheen.', what:'Saat ongelman juurisyyn, rajatun korjauksen ja tiedon ajetuista testeistä. Lisää luonnokseen havainto ja toisto-ohje ennen lähettämistä.', steps:['Kuvaile havainto, odotettu tulos ja miten virhe toistuu.','Agentti selvittää syyn ja tekee pienen toistavan testin.','Agentti korjaa juurisyyn, ajaa testit ja kertoo tarkistamatta jääneen.'], skill:'korjaa', prompt:'Selvitä ongelman syy: [kuvaile havainto]. Tee ensin pieni toistava testi. Korjaa juurisyy ja aja aiheeseen liittyvät testit. Kerro, mitä tarkistit ja mikä jäi tarkistamatta.'},
    {id:'julkaise', title:'Valmistele seuraava julkaisu', when:'Kun haluat tarkistaa julkaisuvalmiuden.', what:'Saat julkaisuvalmiuden tarkistuksen, estelistan ja julkaisuluonnoksen. Tämä ei luo tagia, pushaa tai julkaise mitään.', steps:['Agentti lukee julkaisuohjeen ja tarkistaa työpuun tilan muuttamatta sitä.','Agentti kokoaa muutokset, tarkistaa esimerkit ja ajaa julkaisuohjeen testit.','Saat estelistan, versioehdotuksen ja julkaisuluonnoksen hyväksyttäväksi.'], prompt:'Tarkista seuraavan julkaisun valmius.\n\n1. Lue repon julkaisuohje.\n2. Tarkista työpuun tila muuttamatta sitä.\n3. Kokoa edellisen julkaisun jälkeiset käyttäjälle näkyvät muutokset.\n4. Erota korjaukset uusista ominaisuuksista.\n5. Tarkista dokumenttien esimerkit.\n6. Aja ohjeen nimeämät testit.\n7. Kerro myös tarkistukset, joita et voinut ajaa.\n8. Listaa avoimet esteet.\n9. Ehdota seuraava versio ja perustele se.\n10. Kirjoita lyhyt julkaisuluonnos.\n\nÄlä luo tagia, pushaa tai julkaise mitään. Odota hyväksyntää. Tarkistettava esimerkkipolku: docs/esimerkit/erittain-pitka-synteettinen-julkaisun-valmistelun-tarkistuslistan-tiedostonimi.md'},
    {id:'ohje', title:'Päivitä ohje', when:'Kun käytäntö on muuttunut.', what:'Saat täsmälliset korjausehdotukset valitsemaasi ohjeeseen. Lisää tarkistettavan ohjeen polku luonnokseen.', steps:['Nimeä tarkistettava ohje.','Agentti vertaa esimerkkejä nykyiseen toteutukseen.','Tarkistat rajatut korjausehdotukset ennen muutoksia.'], prompt:'Tarkista ohjeen [polku] esimerkit nykyistä toteutusta vasten. Ehdota täsmälliset korjaukset. Älä muuta muita ohjeita.'},
    {id:'arvioi', title:'Arvioi muutos', when:'Ennen muutoksen yhdistämistä.', what:'Saat listan toistettavista ongelmista ja niiden vaikutuksista. Tyylitoiveet eivät kuulu tähän arvioon.', steps:['Tarkista, että arvioitava muutos on nykyisessä haarassa.','Agentti lukee muutoksen ja varmistaa epäillyt ongelmat.','Päätät löydösten perusteella, mitä korjataan ennen yhdistämistä.'], prompt:'Arvioi nykyisen haaran muutos. Etsi vain toistettavia ongelmia ja kerro kunkin vaikutus, ei tyylitoiveita.'},
    {id:'suunnittele', title:'Suunnittele pieni lisäys', when:'Kun haluat uuden toiminnon.', what:'Saat ehdotuksen pienimmästä hyödyllisestä muutoksesta ja sen testistä. Lisää tavoite luonnokseen; koodaus ei kuulu tähän pyyntöön.', steps:['Kuvaile uuden toiminnon tavoite.','Agentti lukee nykyisen toteutuksen.','Tarkistat muutosehdotuksen ja testin ennen koodausta.'], prompt:'Suunnittele lisäys: [tavoite]. Lue nykyinen toteutus. Ehdota pienin hyödyllinen muutos ja sen testi ennen koodausta.'},
  ];
  goals.forEach(g => g.prompt=g.prompt.replaceAll('\\n','\n'));
  const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const href=(mode,id)=>`#opas/${mode}/${id}`;
  const names={read:'Opas · suositus: lue ohje kokonaan yhdellä sivulla.',steps:'Vaiheet: käy ohjeen kolme osaa läpi ennen aloitusta.',index:'Hakemisto: vaihda oppaasta suoraan toiseen.'};
  const goalLink=(g,mode,compact=false)=>`<a class="s-goal ${compact?'s-compact':''}" href="${href(mode,g.id)}" data-goal="${g.id}"><strong>${esc(g.title)}</strong>${compact?'':`<span>${esc(g.when)}</span>`}<b aria-hidden="true">›</b></a>`;
  const listing=mode=>`<section class="ah-start s-home"><h2 tabindex="-1">Aurinkopolku</h2><p class="s-intro">Pieni retkireittien suunnittelija. Tässä repossa ovat sovellus, testit ja käyttöohjeet.</p><h3 class="s-heading">Mitä haluat tehdä?</h3><nav class="s-goals" aria-label="Tavoitteet">${goals.map(g=>goalLink(g,mode)).join('')}</nav><p class="s-help">Tavoite avaa oman oppaan. Voit myös kirjoittaa suoraan agentille.</p></section>`;
  const prompt=g=>`<details class="s-reveal"><summary>Tarkista agentille tuleva pyyntö</summary><pre class="s-prompt" tabindex="0" aria-label="Koko pyyntö">${esc((g.skill?`/skill:${g.skill} `:'')+g.prompt)}</pre></details>`;
  const sections=g=>[
    `<section><h3>Mitä tämä tekee?</h3><p>${esc(g.what)}</p></section>`,
    `<section><h3>Milloin käytät tätä?</h3><p>${esc(g.when)}</p></section>`,
    `<section><h3>Näin etenet</h3><ol>${g.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></section>`,
  ];
  const start=g=>`${prompt(g)}<div class="s-start"><button class="s-button s-primary" data-start="${g.id}">Aloita</button><p>Lisää pyynnön luonnokseen. Muokkaa ja lähetä itse.</p></div>`;
  function guide(mode,g,step=0) {
    const parts=sections(g);
    return `<section class="ah-start s-guide" data-id="${g.id}" data-step="${step}"><a class="s-back" href="#aloitus" data-back>‹ Kaikki tavoitteet</a><div class="s-guide-layout">${mode==='index'?`<nav class="s-guide-index" aria-label="Vaihda opasta"><h3>Tavoitteet</h3>${goals.map(x=>goalLink(x,mode,true).replace(`data-goal="${g.id}"`,`data-goal="${g.id}" aria-current="page"`)).join('')}</nav>`:''}<article class="s-guide-body"><p class="s-eyebrow">OPAS · AURINKOPOLKU</p><h2 tabindex="-1">${esc(g.title)}</h2>${mode==='steps'?`<nav class="s-step-nav" aria-label="Ohjeen osat">${['Mitä','Milloin','Eteneminen'].map((s,i)=>`<button class="s-step" data-step="${i}" ${i===step?'aria-current="step"':''}>${i+1}. ${s}</button>`).join('')}</nav><p class="s-help">Ohjeen osa ${step+1}/3 · ei agentin työn tila</p>${parts[step]}${step===2?start(g):''}<div class="s-step-actions">${step>0?`<button class="s-button" data-step="${step-1}">Edellinen</button>`:''}${step<2?`<button class="s-button" data-step="${step+1}">Seuraava</button>`:''}</div>`:parts.join('')+start(g)}</article></div></section>`;
  }
  function activeGoal(mode) {
    const [root,m,id]=location.hash.slice(1).split('/');
    return root==='opas'&&m===mode?goals.find(g=>g.id===id):null;
  }
  function paint(focus=true) {
    const demo=stage.querySelector('.s-demo');if(!demo)return;
    const mode=demo.dataset.direction, g=activeGoal(mode), scroll=demo.querySelector('.s-scroll');
    scroll.innerHTML=g?guide(mode,g):listing(mode);scroll.scrollTop=g?0:(+demo.dataset.homeScroll||0);
    if(focus) {const target=g?scroll.querySelector('h2'):scroll.querySelector(`[data-goal="${demo.dataset.lastGoal}"]`)||scroll.querySelector('h2');target.focus({preventScroll:true});}
  }
  function render(mode) {
    const g=activeGoal(mode);
    return `<div class="s-demo" data-direction="${mode}"><p class="s-note">${names[mode]}<span>Synteettinen prototyyppi · vain tavoitteet, oppaat ja luonnos toimivat. Linkkiversiossa järjestelmäfontit.</span></p><div class="s-app"><aside class="s-rail" aria-label="Navigaatio (sommitelma)"><strong>Open Habitat</strong><p>Etusivu</p><small>TYÖTILAT</small><p><code>aurinkopolku</code>　＋</p><div class="s-current">Uusi keskustelu</div><p>Ohjeen päivitys</p><p>Valmiit · 2</p><div class="s-account">Aino · esimerkkikäyttäjä</div></aside><main class="s-main"><header class="s-header"><strong>Uusi keskustelu</strong><code>aurinkopolku</code><span class="s-info" title="Tiedot · vain sommitelma" aria-label="Tiedot (sommitelma)">ⓘ</span></header><div class="s-scroll">${g?guide(mode,g):listing(mode)}</div><footer class="s-compose"><div class="s-entry"><div class="s-field"><textarea aria-label="Viesti Pi:lle" placeholder="Kirjoita agentille…"></textarea><span class="s-model">gpt-5.5 · high⌄</span></div><button class="s-send" aria-label="Lähetä (ei käytössä prototyypissä)" disabled>↑</button></div><p class="s-feedback" role="status" aria-live="polite">Lähetys ei ole käytössä prototyypissä.</p></footer></main></div></div>`;
  }
  window.guideRead=()=>render('read');window.guideSteps=()=>render('steps');window.guideIndex=()=>render('index');
  window.addEventListener('hashchange',()=>paint());
  stage.addEventListener('click',e=>{
    const demo=stage.querySelector('.s-demo');if(!demo)return;
    const link=e.target.closest('[data-goal]');
    if(link) {if(!demo.querySelector('.s-guide'))demo.dataset.homeScroll=demo.querySelector('.s-scroll').scrollTop;demo.dataset.lastGoal=link.dataset.goal;}
    const step=e.target.closest('button[data-step]');
    if(step) {const g=activeGoal(demo.dataset.direction);demo.querySelector('.s-scroll').innerHTML=guide(demo.dataset.direction,g,+step.dataset.step);demo.querySelector('.s-scroll').scrollTop=0;demo.querySelector('.s-guide h3').setAttribute('tabindex','-1');demo.querySelector('.s-guide h3').focus();}
    const b=e.target.closest('[data-start]');
    if(b) {const g=goals.find(g=>g.id===b.dataset.start),field=demo.querySelector('textarea'),had=!!field.value.trim();field.value=(g.skill?`/skill:${g.skill} `:'')+g.prompt+(had?'\n\n'+field.value:'');
      // Replace the reading view, not the composer. No host call and no send.
      history.replaceState(null,'','#aloitus');paint(false);field.focus();field.setSelectionRange(0,0);
      demo.querySelector('.s-feedback').textContent=`${g.title}: pyyntö lisätty luonnokseen.${had?' Aiempi tekstisi säilyi.':''} Mitään ei lähetetty.`;
    }
  });
})();
