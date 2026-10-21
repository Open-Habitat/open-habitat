(() => {
 const S={direction:'gallery',open:false,query:'',topic:'Kaikki',filter:'all',draft:'',first:false,seen:'2026-10-16T12:00:00Z',notice:''};
 document.querySelector('.topbar').hidden=true;
 document.querySelector('.composer').hidden=true;
 document.querySelector('#slow').closest('label').hidden=true;
  const paths = {
    editor: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16m5-11-2 3 2 3m3-6 2 3-2 3"/>',
    forward: '<path d="m9 5 7 7-7 7"/>', back: '<path d="m15 5-7 7 7 7"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 8 4 4-4 4M14 16h3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>',
    message: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
    cross: '<path d="M5 5 19 19M19 5 5 19"/>',
    branch: '<circle cx="7" cy="6" r="2"/><path d="M7 8v10M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>',
    retitle: '<path fill="currentColor" stroke="none" d="M0.5 13.5 0.61 12.87 2.12 12.64 3.84 2.86 2.41 2.63 2.52 2H8L7.89 2.63L6.37 2.86L5.63 7.11H9.81L10.56 2.86L9.13 2.63L9.24 2H14.74L14.62 2.63L13.1 2.86L11.37 12.64L12.81 12.87L12.7 13.5H7.21L7.32 12.87L8.84 12.64L9.64 8.05H5.46L4.65 12.64L6.08 12.87L5.97 13.5Z"/><g transform="translate(12.5 12) scale(.5)" stroke-width="3.4"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/></g>',
  };
  const icon = name => `<svg data-icon="${name}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
  const btn = (action, label, name, pressed) => `<button type="button" class="e-icon" data-action="${action}" aria-label="${label}" title="${label}"${pressed === undefined ? '' : ` aria-pressed="${pressed}"`}>${icon(name)}</button>`;
  const context = (label, name) => `<button type="button" class="e-icon e-context" aria-disabled="true" aria-label="${label} (vain sommitelma)" title="${label} · vain sommitelma">${icon(name)}</button>`;
  function titleRow() {
    return `<header class="e-titlebar" aria-label="Keskustelun otsake"><div class="e-title"><h1 title="${false?'Kuukartta':'Aurinkokello'}">${false?'Kuukartta':'Aurinkokello'}</h1></div><span class="e-workspace-link">${false?'kuukartta':'aurinkokello'}</span><span class="e-ready">● Valmis</span><span class="e-chip e-git">${icon('branch')} main · +2 −1</span><span class="e-chip">gpt-5.5 · high</span>${S.direction==='gallery'?'<button class="s-discover" data-act="open">Mitä agentti osaa?'+newBadge()+'</button>':''}${context('Editori','editor')}${context('Pääte','terminal')}${context('Luo otsikko uudelleen','retitle')}${context('Arkistoi','archive')}${context('Tiedot','info')}</header>`;
  }

 // Every record is invented. Provenance is the adding Git commit, NOT claimed authorship.
 const groups=[
 ['Viestintä',[
 ['email-draft','Kirjoita sähköpostiluonnos','Kun haluat vastata viestiin mutta sävy tai rakenne kaipaa apua.','Luonnostele ystävällinen vastaus tähän viestiin: …'],
 ['meeting-notes','Tiivistä palaveri','Kun litteroinnista pitää löytää päätökset ja seuraavat tehtävät.','Poimi tästä palaverista päätökset ja sovitut tehtävät: …'],
 ['tone-check','Tarkista viestin sävy','Kun viesti voi kuulostaa liian jyrkältä tai epäselvältä.','Tarkista tämän viestin sävy muuttamatta sisältöä: …'],
 ['weekly-update','Kokoa viikkokatsaus','Kun haluat kertoa tiimille viikon etenemisestä.','Kokoa näistä muistiinpanoista lyhyt viikkokatsaus: …'],
 ['translate','Käännä teksti','Kun tarvitset luonnollisen käännöksen toiselle kielelle.','Käännä tämä teksti englanniksi säilyttäen sävy: …']]],
 ['Koodi ja testit',[
 ['slow-tests','Selvitä testien hitaus','Kun testiajo hidastaa työtä eikä syy ole selvillä.','Selvitä tämän repon testien hitaus. Ehdota ensin mittausta.'],
 ['review','Tarkista muutos','Kun haluat löytää virheet ennen yhdistämistä.','Arvioi nykyisen haaran muutoksista oikeat virheriskit.'],
 ['test-cases','Etsi puuttuvat testit','Kun muutoksen reunatapaukset mietityttävät.','Etsi tämän muutoksen kattamatta jäävät reunatapaukset.'],
 ['explain-code','Ymmärrä vieras koodi','Kun aloitat uuden moduulin parissa.','Selitä miten tämän repon kellolaskenta toimii.'],
 ['repro','Rakenna toistotapa','Kun bugiraportti ei vielä kerro mistä vika syntyy.','Muodosta tästä bugiraportista pienin toistotapa: …']]],
 ['Suunnittelu',[
 ['scope','Rajaa tehtävä','Kun ideasta pitäisi saada toteutettava kokonaisuus.','Auta rajaamaan tämä idea ensimmäiseksi kokeiluksi: …'],
 ['options','Vertaa vaihtoehtoja','Kun valintaa varten tarvitaan perusteltu suositus.','Vertaa näitä kahta ratkaisua ylläpidon kannalta: …'],
 ['prototype','Suunnittele kokeilu','Kun haluat testata idean ennen rakentamista.','Ehdota pieni kokeilu tämän oletuksen testaamiseen: …'],
 ['risks','Tunnista riskit','Kun suunnitelman heikot kohdat pitää löytää ajoissa.','Mitkä tämän suunnitelman oletukset pitää varmistaa? …'],
 ['questions','Valmistele haastattelu','Kun haluat oppia käyttäjän arjesta ilman johdattelua.','Ehdota haastattelukysymykset tästä käyttötarpeesta: …']]],
 ['Tieto ja aineistot',[
 ['csv-check','Tarkista taulukko','Kun aineistossa saattaa olla puuttuvia tai ristiriitaisia arvoja.','Tarkista liittämäni CSV:n puuttuvat arvot ja poikkeamat.'],
 ['compare-docs','Vertaa asiakirjoja','Kun haluat tietää mikä versioiden välillä muuttui.','Vertaa näitä kahta tekstiä. Nosta sisällölliset muutokset.'],
 ['sources','Tarkista lähteet','Kun väitteiden tueksi pitää löytää alkuperäinen lähde.','Tarkista tämän tekstin väitteet ja nimeä epävarmuudet: …'],
 ['chart','Hahmota luvut','Kun taulukon kehityssuunta ei näy pelkistä riveistä.','Ehdota tästä aineistosta selkeä kuvaaja ja perustele valinta.'],
 ['summary','Tiivistä pitkä teksti','Kun haluat olennaisen ennen koko tekstin lukemista.','Tiivistä tämä raportti ja erottele faktat suosituksista: …']]],
 ['Julkaisu ja arki',[
 ['release-check','Tarkista julkaisuvalmius','Kun julkaisu on lähellä ja haluat varmistaa lähtötiedot.','Tarkista tämän repon julkaisuvalmius muuttamatta tiedostoja.'],
 ['changelog','Kirjoita muutosluettelo','Kun teknisistä muutoksista pitää kertoa käyttäjälle.','Muotoile tämän haaran muutoksista käyttäjän muutosluettelo.'],
 ['readme','Paranna aloitusohjetta','Kun uusi käyttäjä ei tiedä miten päästä alkuun.','Arvioi tämän repon aloitusohje uuden käyttäjän silmin.'],
 ['handoff','Valmistele työn luovutus','Kun toisen pitää pystyä jatkamaan työtäsi.','Kokoa näistä muistiinpanoista seuraavalle tekijälle luovutus: …'],
 ['checklist','Tee muistilista','Kun toistuva tehtävä unohtuu helposti kesken.','Tee tästä tehtävästä lyhyt käytännön muistilista: …']]]
 ];
 const skills=groups.flatMap(([topic,items],g)=>items.map(([name,title,when,prompt],j)=>{
 const i=g*5+j,repo=i%4!==3;
 return {id:i,name,title,when,prompt,topic,repo,generated:i%3===0,path:repo?`${i%2?'.agents':'.pi'}/skills/${name}/SKILL.md`:`~/.pi/agent/skills/${name}/SKILL.md`,added:repo?(j<2?'2026-10-20T09:20:00Z':'2026-10-10T10:00:00Z'):null,author:repo?['Aino Esimerkki','Leo Malli','Sade Demo'][i%3]:null,commit:repo?(0xa710000+i).toString(16):null};
 }));
 const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const isNew=s=>!S.first&&s.added&&s.added>S.seen;
 function newBadge(){const n=skills.filter(isNew).length;return n?` <span class="s-tag">${n} uutta</span>`:'';}
 function card(s,compact=false){return `<article class="a-card" data-skill="${s.id}"><div class="a-meta">${esc(s.topic)} ${s.generated?'<span class="s-tag">AI-ehdotus</span>':''} ${isNew(s)?'<span class="a-new">Uusi sinulle</span>':''}</div><h3>${esc(s.title)}</h3><p>${esc(s.when)}</p><small>${s.repo?`Repon taito · lisäsi ${esc(s.author)}`:'Oma taito'}</small><button data-detail="${s.id}" class="a-detail">${compact?'Tutustu ja kokeile':'Katso esimerkki →'}</button></article>`;}
 function filtered(){return skills.filter(s=>(S.topic==='Kaikki'||s.topic===S.topic)&&(S.filter!=='new'||isNew(s))&&(S.filter!=='repo'||s.repo)&&`${s.title} ${s.when} ${s.name} ${s.author||''}`.toLowerCase().includes(S.query.toLowerCase()));}
 function results(){const list=filtered();return `<p class="s-help" role="status">${list.length} taitoa</p>${list.length?`<div class="a-cards">${list.map(s=>card(s)).join('')}</div>`:'<p class="s-empty">Ei sopivia taitoja. Vaihda aihetta tai tyhjennä haku.</p>'}`;}
 function catalogue(){return `<section class="a-catalogue" aria-label="Mitä agentti osaa"><header class="s-catalogue-head"><div><small>aurinkokello · Pi:n saatavilla olevat taidot</small><h2>Mitä agentti osaa?</h2></div><button data-act="close" aria-label="Sulje taidot">×</button></header><p>Valitse tavoite. Saat esimerkin, jonka voit muokata omaksi pyynnöksesi. AI-ehdotus on merkitty erikseen; muut esittelyt tulevat skillin omasta metatiedosta.</p><div class="a-filters"><label>Hae tekemistä<input id="a-search" type="search" value="${esc(S.query)}" placeholder="Esim. sähköposti, testit tai Aino"></label><label>Aihe<select id="a-topic">${['Kaikki',...groups.map(g=>g[0])].map(t=>`<option ${S.topic===t?'selected':''}>${t}</option>`).join('')}</select></label></div><div class="a-tabs" aria-label="Rajaa taitoja">${[['all','Kaikki'],['new','Uutta sinulle'+newBadge()],['repo','Repon yhteiset']].map(([f,t])=>`<button data-filter="${f}" aria-pressed="${S.filter===f}">${t}</button>`).join('')}</div><p class="s-help">${S.first?'Ensimmäinen katselu: tutustu rauhassa kaikkiin taitoihin.':`Viimeksi katsoit ${S.seen.startsWith('2026-10-21')?'21.10.2026':'16.10.2026'}. Uudet on lisätty Gitissä tämän jälkeen.`} <button data-act="seen">Merkitse katsotuksi</button></p><div class="a-results">${results()}</div><p class="s-footnote">Repon yhteiset taidot ovat tämän repon .pi/skills- ja .agents/skills-tiedostoja. Ei suosituimmuuslistaa eikä muiden kotihakemistoja.</p></section>`;}
 function intro(){return `<section class="a-intro"><small>Uusi keskustelu · aurinkokello</small><h2>Mitä haluaisit saada aikaan?</h2><p>Agentti voi auttaa kirjoittamaan, selvittämään ja tarkistamaan. Taidot antavat sille tehtävään sopivan työtavan.</p><button class="a-primary" data-act="open">Tutustu taitoihin${newBadge()}</button><div class="a-cards">${[skills[0],skills[5],skills[10]].map(s=>card(s,true)).join('')}</div><p class="s-help">Voit myös kirjoittaa oman pyynnön. /-lista toimii kuten ennenkin.</p></section>`;}
 function workspace(){return `<section class="a-intro"><small>Työtila / aurinkokello</small><h2>Taidot</h2><p>Tämän repon ja omat taitosi yhdessä. Mitä kokeilisit seuraavaksi?</p><button class="a-primary" data-act="open">Selaa kaikkia 25 taitoa${newBadge()}</button><h3>Aiheittain</h3><div class="a-topics">${groups.map(([t])=>`<button data-topic="${t}"><strong>${t}</strong><span>5 taitoa →</span></button>`).join('')}</div><h3>Tiimi lisäsi repoon</h3><div class="a-cards">${skills.filter(s=>s.repo).sort((a,b)=>b.added.localeCompare(a.added)).slice(0,3).map(s=>card(s,true)).join('')}</div></section>`;}
 function composer(){return `<footer class="s-composer"><p class="a-notice" role="status">${esc(S.notice)}</p><div class="s-input"><textarea aria-label="Viesti Pi:lle" placeholder="Mitä haluaisit tehdä?">${esc(S.draft)}</textarea><div><span class="s-help">/　　gpt-5.5 · high</span><button disabled aria-label="Lähetä (ei käytössä prototyypissä)">↑</button></div></div><small>Luonnos · mitään ei lähetetä</small></footer>`;}
 function conversation(){return `<div class="s-conversation"><div class="s-messages"><article class="e-user"><small>Sinä</small><p>Haluaisin selvittää miksi testit hidastuivat.</p></article><article><small>Pi</small><p>Voimme aloittaa mittaamalla, mihin testiajon aika kuluu.</p></article>${S.direction==='start'?`<aside class="a-suggestion"><strong>Haluatko valmiin työtavan?</strong><p>Repon taito ”Selvitä testien hitaus” auttaa aloittamaan mittauksesta.</p><button data-detail="5">Tutustu taitoon</button><button data-act="open">Kaikki taidot${newBadge()}</button></aside>`:''}</div>${composer()}</div>`;}
 function render(){return `<div class="e-demo s-demo a-demo" data-direction="${S.direction}"><p class="s-note">Kierros 2 · synteettinen prototyyppi. Taidot, haku ja luonnos toimivat; otsakkeen muut kuvakkeet eivät. Linkissä järjestelmäfontit.</p><div class="a-scenario"><label>Esimerkkitilanne <select id="a-scenario"><option value="return" ${!S.first?'selected':''}>Palaava käyttäjä · katsoi 16.10.</option><option value="first" ${S.first?'selected':''}>Ensimmäinen käyttökerta</option></select></label><span>Vain prototyypin ohjain</span></div><div class="s-app"><aside class="s-rail"><strong>Open Habitat</strong><small>Yhdistetty · esimerkkipalvelin</small><p>Työtilat　＋</p><code>aurinkokello</code>${S.direction==='workspace'?`<button data-act="home">Työtilan etusivu · Taidot${newBadge()}</button>`:''}<p class="e-selected">${S.first?'Uusi keskustelu':'Aurinkokello'}</p><p>Testien siivous</p><div class="s-account">Testikäyttäjä<small>Asetukset · sommitelma</small></div></aside><main class="s-main">${titleRow()}${S.direction==='workspace'?'<nav class="s-entry"><button data-act="home">Työtila › Taidot</button><button data-act="conversation">Keskustelu</button></nav>':''}<div class="s-body">${S.open?catalogue():S.direction==='workspace'&&!S.chat?workspace():S.direction==='start'&&S.first&&!S.chat?`<div class="a-start">${intro()}${composer()}</div>`:conversation()}</div></main></div><dialog class="a-dialog" aria-labelledby="a-detail-title"></dialog></div>`;}
 function redraw(){stage.innerHTML=render();}
 function start(direction){Object.assign(S,{direction,open:false,query:'',topic:'Kaikki',filter:'all',draft:'',first:direction==='start',seen:'2026-10-16T12:00:00Z',notice:'',chat:false});return render();}
 window.adoptionGallery=()=>start('gallery');window.adoptionWorkspace=()=>start('workspace');window.adoptionStart=()=>start('start');
 let opener;
 function showDetail(id){const s=skills[id],d=stage.querySelector('.a-dialog');opener=stage.querySelector(`[data-detail="${id}"]`);d.innerHTML=`<header class="s-catalogue-head"><small>${esc(s.topic)} ${isNew(s)?'· Uusi sinulle':''}</small><button data-act="detail-close" aria-label="Sulje taitokortti">×</button></header><h2 id="a-detail-title">${esc(s.title)}</h2><p class="a-origin">${s.generated?'AI:n ehdottama esittely · ei vielä tallennettu taitoon':'Esittely skillin omasta metatiedosta'}</p><h3>Mitä se tekee / milloin käytät</h3><p>${esc(s.when)}</p><h3>Esimerkkipyyntö</h3><blockquote>${esc(s.prompt)}</blockquote><button class="a-primary" data-use="${id}">Kokeile luonnoksessa</button><p class="s-help">Lisää taitokomento ja esimerkki tähän keskusteluun. Muokkaa ennen lähettämistä. Olemassa oleva teksti säilyy.</p><details class="a-metadata"><summary>Esittelytietojen alkuperä</summary><p>${s.generated?'Nimi, aihe, käyttötarkoitus ja esimerkki ovat AI:n ehdotus tämän taitotiedoston pohjalta. Tässä prototyypissä ehdotus on valmiiksi keksitty, mitään ei generoida verkossa. Suositus: tarkista ja tallenna hyväksytty esittely skillin frontmatteriin repon muutoksena.':'Nimi, aihe, käyttötarkoitus ja esimerkki tulevat skillin frontmatterista. Ne ovat tekijän kirjoittamia tai aiemmin tarkistettuja esittelytietoja.'}</p><p>Skillin alkuperäinen description: <q>${esc(s.when)}</q></p></details><details><summary>Mistä taito tulee?</summary><p>${s.repo?`Repon yhteinen taito. Lisäävän commitin tekijä: ${esc(s.author)}. Lisätty ${s.added.slice(0,10)} · <code>${s.commit}</code>. Tekijä ei välttämättä ole alkuperäinen kirjoittaja.`:'Oma taito. Git-lisäysaikaa tai tekijää ei tunneta; ei uutuusmerkkiä.'}</p><code class="s-path">${esc(s.path)}</code><code>/skill:${s.name}</code></details>`;d.showModal();d.querySelector('button').focus();}
 function closeCatalogue(){S.open=false;redraw();(stage.querySelector('[data-act="open"]')||stage.querySelector('.s-entry [data-act="home"]'))?.focus();}
 stage.addEventListener('input',e=>{if(e.target.matches('textarea'))S.draft=e.target.value;if(e.target.id==='a-search'){S.query=e.target.value;stage.querySelector('.a-results').innerHTML=results();}});
 stage.addEventListener('change',e=>{if(e.target.id==='a-topic'){S.topic=e.target.value;stage.querySelector('.a-results').innerHTML=results();}if(e.target.id==='a-scenario'){S.first=e.target.value==='first';S.seen='2026-10-16T12:00:00Z';S.open=false;S.chat=false;redraw();stage.querySelector('#a-scenario').focus();}});
 stage.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.detail!==undefined)showDetail(Number(b.dataset.detail));
 if(b.dataset.filter){S.filter=b.dataset.filter;redraw();stage.querySelector(`[data-filter="${S.filter}"]`).focus();}
 if(b.dataset.topic){S.topic=b.dataset.topic;S.open=true;redraw();stage.querySelector('#a-topic').focus();}
 if(b.dataset.use!==undefined){const s=skills[Number(b.dataset.use)];S.draft=`/skill:${s.name} ${s.prompt}${S.draft?'\n\n'+S.draft:''}`;S.open=false;S.chat=true;S.notice='Taito lisätty luonnokseen. Muokkaa pyyntöä ennen lähettämistä.';redraw();stage.querySelector('textarea').focus();}
 if(b.dataset.act==='open'){S.open=true;redraw();stage.querySelector('#a-search').focus();}
 if(b.dataset.act==='close')closeCatalogue();
 if(b.dataset.act==='detail-close'){stage.querySelector('.a-dialog').close();opener?.focus();}
 if(b.dataset.act==='home'){S.chat=false;S.open=false;redraw();}
 if(b.dataset.act==='conversation'){S.chat=true;S.open=false;redraw();}
 if(b.dataset.act==='seen'){S.seen='2026-10-21T12:00:00Z';S.first=false;S.filter='all';redraw();stage.querySelector('[data-act="seen"]').focus();}
 });
 stage.addEventListener('keydown',e=>{if(e.key==='Escape'&&!stage.querySelector('.a-dialog').open&&S.open)closeCatalogue();});
})();
