(() => {
  let direction='breath', timer, serial=0, pending=false, scene='again', pace='normal', long=false;
  const oldTitle=()=>long ? 'CI-ajon aikakatkaisu, joka toistuu vain maanantaiaamuisin' : 'Status-skripti';
  const nextTitle=()=>long ? 'Maanantain CI-aikakatkaisun syyn selvittäminen ja korjaus' : 'Viikon statusrivit JSONiksi';
  const conversation=()=>UI.ws[0].convs[0];
  const controls=document.createElement('section');
  controls.className='title-controls';
  controls.setAttribute('aria-label','Prototyypin tilanteet');
  controls.innerHTML=`<label>Tilanne <select id="title-scene"><option value="again">Uudelleenluonti</option><option value="first">Ensimmäinen otsikko</option></select></label><label>Vastaus <select id="title-pace"><option value="normal">1,4 s</option><option value="fast">180 ms</option><option value="slow">5 s</option><option value="error">Virhe 1,4 s</option></select></label><label><input type="checkbox" id="title-long"> Pitkä otsikko</label><button type="button" id="title-replay">Toista otsikon luonti</button><p>Synteettinen keskustelu · otsikon odotus, ei agentin työtila. Uusi otsikko näkyy vasta vastauksen jälkeen.</p><p id="title-announcement" role="status" aria-live="polite"></p>`;
  document.querySelector('.frame-wrap').before(controls);
  document.querySelector('#slow').closest('label').hidden=true;
  document.querySelector('.composer').hidden=true;
  function announce(text) {document.querySelector('#title-announcement').textContent=text;}
  function titleMarkup(c) {
    const busy=pending && c.id==='c1';
    return `<div class="title-name" data-motion="${direction}" data-busy="${busy}" aria-busy="${busy}"><h1 title="${esc(c.title)}">${esc(c.title)}</h1><span class="title-motion" aria-hidden="true">${direction==='dots'?'<i></i><i></i><i></i>':'<i></i>'}</span></div>`;
  }
  // Round-local replacement; the shared library and production stay untouched.
  paintTop = function() {
    const c=selConv();
    uiTop.innerHTML=`<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko">${ICON_MENU}</button>${titleMarkup(c)}<a href="#" class="tb-ws" data-ui="ws">${esc(c.ws.id)}</a><div class="tb-right">${stateChip(c)}<span class="title-git mono">main</span><span class="tb-actions">${APP.actions(c)}</span></div>`;
    const b=uiTop.querySelector('[data-ui="retitle"]');
    if(b) {b.setAttribute('aria-disabled', String(pending)); b.title=pending?'Otsikkoa luodaan…':'Luo uusi otsikko'; b.setAttribute('aria-label',b.title);}
  };
  content = function() {
    run++;
    return `<div class="title-context"><article class="bubble user"><header><strong>Sinä</strong><time>14:32</time></header><p>Tee skripti, joka kokoaa viime viikon statusrivit JSONiksi. Lisää testi puuttuvalle päivälle.</p></article><article class="bubble reply"><header><strong>Pi</strong><span class="mono">gpt-5.5 · high</span><time>14:33</time></header><p>Skripti ja testi ovat valmiit. Puuttuva päivä näkyy tyhjänä listana, joten viikkokooste säilyttää saman rakenteen.</p><p>Kaikki 12 testiä menevät läpi. Voit kokeilla: <code>./status.sh --week previous --json</code>.</p></article><p class="title-context-note">Keskustelun sisältö säilyy luettavana otsikon luonnin ajan.</p></div>`;
  };
  retitle = function() {
    if(pending || UI.sel!=='c1') return;
    const id=++serial;
    const focusAction=uiTop.contains(document.activeElement)?document.activeElement.dataset.ui:null;
    pending=true; UI.pending=false; paintTop();
    if(focusAction) uiTop.querySelector(`[data-ui="${focusAction}"]`)?.focus({preventScroll:true});
    announce('Otsikkoa luodaan…');
    timer=setTimeout(()=>{
      if(id!==serial) return;
      pending=false;
      if(pace!=='error') conversation().title=nextTitle();
      const focused=uiTop.contains(document.activeElement)?document.activeElement.dataset.ui:null;
      paint();
      if(focused) uiTop.querySelector(`[data-ui="${focused}"]`)?.focus({preventScroll:true});
      announce(pace==='error'?'Otsikon luonti epäonnistui. Aiempi otsikko säilyi. Yritä uudelleen H-painikkeesta.':'Otsikko päivitetty.');
    },pace==='fast'?180:pace==='slow'?5000:1400);
  };
  function start(d) {
    clearTimeout(timer); serial++; pending=false; direction=d;
    UI.sel='c1'; UI.working=false; UI.pending=false;
    conversation().title=scene==='first'?'Uusi keskustelu':oldTitle();
    appView();
    retitle();
    return content();
  }
  window.titleBreath=()=>start('breath');
  window.titleLine=()=>start('line');
  window.titleDots=()=>start('dots');
  controls.addEventListener('change',()=>{
    scene=document.querySelector('#title-scene').value;
    pace=document.querySelector('#title-pace').value;
    long=document.querySelector('#title-long').checked;
    stage.innerHTML=start(direction);
  });
  document.querySelector('#title-replay').addEventListener('click',()=>{stage.innerHTML=start(direction);});
  // Leaving the synthetic conversation cancels its pending presentation.
  APP.painted.push(()=>{if(UI.sel!=='c1' && pending){clearTimeout(timer); serial++; pending=false; announce(''); paintTop();}});
})();
