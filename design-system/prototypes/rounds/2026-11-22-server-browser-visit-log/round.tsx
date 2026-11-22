import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import { BrowserChip, BrowserStrip } from '../../../../web/src/components/ServerBrowser';
import type { BrowserStatus } from '../../../../web/src/app/serverBrowser';
import { setPersonalLanguage } from '../../../../web/src/i18n';
import { ControlButton } from '../../../../web/src/components/ControlElements';
import { Icon } from '../../../../web/src/components/Icon';
import { HabitatMark } from '../../../../web/src/components/HabitatMark';
import './round.css';

let language: 'fi'|'en' = 'fi';
let theme = 'light';
let scenario = 'done';
const text = {
 fi: {
  title:'Selaimen käytöstä jää jälki', prototype:'Prototyyppi · synteettinen keskustelu',
  lines:['1 Rivi — Habitat kertoo käynnistä yhdellä rauhallisella rivillä.', '2 Kortti — sivustot ja määrät näkyvät heti, erittely avautuu alle.', '3 Työkalurivi — selauskäynti on osa agentin näkyvää työtä.'],
  recommendation:'Suositus: 2 Kortti. Selainkäynti löytyy myös ilman työvaiheiden avaamista.',
  state:'Esimerkkitila', states:['Valmis', 'Käynnissä', 'Yhteys katkesi'],
  workspace:'Matkakulut', conversation:'Majoitusten kuitit', user:'Hae majoitusvarauksieni kuitit selaimesta. Älä muuta varauksia.',
  agent:'Käyn kirjautuneen selaimesi varaukset läpi ja lataan kuitit.',
  answer:'Latasin 13 kuittia. Ne ovat nyt matkakulujen kansiossa.',
  working:'Haen vielä viimeisiä kuitteja.', uncertain:'Selaimen yhteys katkesi. En tiedä, valmistuivatko loput lataukset.',
  used:'Agentti käytti selaintasi', using:'Agentti käyttää selaintasi', partial:'Selaimen käytöstä on vain osittainen tieto',
  pages:'sivukäyntiä', downloads:'latausta', actions:'lomakkeen lähetys',
  detail:'Näytä käynnin tiedot', hide:'Piilota käynnin tiedot', habitat:'Habitat · selaimen käyttö',
  observed:'Havaitut sivustot', activity:'Käynnin tapahtumat', downloaded:'Valmistuneet lataukset',
  privacy:'Tallenteessa ovat sivustot, eivät sivujen osoitteet, otsikot tai lomakkeiden sisältö.',
  count:'Sivukäynti tarkoittaa agentin välilehden siirtymistä sivulle. Sama sivu voi olla mukana useasti.',
  submitted:'Lomake lähetetty', outcome:'Lähetys havaittu. Sivustolla syntynyttä vaikutusta ei vahvistettu.',
  actionNote:'Lomakkeen lähetys ei yksin kerro, syntyikö varaus tai maksu.',
  visit:'Sivukäynti', complete:'Valmistui',
  incomplete:'Viimeinen havainto 4.46. Myöhemmät käynnit, lataukset ja toiminnot eivät ole tiedossa.',
  until:'Havainnot tähän asti', closed:'Agentin välilehti sulkeutui 4.48. Käyntimerkintä säilyy tässä.',
  open:'Avaa ikkunaluettelo', windows:'Selaimen ikkunat nyt', liveNote:'Agentin oma välilehti on merkitty, oma ikkunasi säilyy erillisenä.',
  own:'Oma ikkuna', tab:'Varausten kuitit', watch:'Katselun esimerkki', close:'Sulje katselu',
  preview:'Tässä olisi selaimen suora kuva. Tämä prototyyppi ei avaa sivustoa eikä anna hallintaa.',
  showWork:'Näytä työ', hideWork:'Piilota työ', tool:'Selauskäynti', hidden:'Työvaiheet piilotettu. Tässä suunnassa myös käyntimerkintä jää niiden sisään.',
  input:'Kirjoita viesti…', mock:'Katselu ei siirrä selaimen hallintaa.', footer:'Vertailu koskee merkinnän paikkaa. Kaikissa suunnissa samat tapahtumat ja sama ikkunaluettelo.',
 },
 en: {
  title:'A record of browser use', prototype:'Prototype · synthetic conversation',
  lines:['1 Line — Habitat acknowledges each visit in one quiet line.', '2 Card — sites and counts up front, details expand below.', '3 Tool row — the visit belongs to the agent’s visible work.'],
  recommendation:'Recommendation: 2 Card. Browser use remains findable even with work steps hidden.',
  state:'Example state', states:['Finished', 'In progress', 'Connection lost'],
  workspace:'Travel expenses', conversation:'Accommodation receipts', user:'Get the receipts for my accommodation bookings from the browser. Do not change the bookings.',
  agent:'I’ll go through the bookings in your signed-in browser and download the receipts.',
  answer:'I downloaded 13 receipts. They are now in the travel expenses folder.',
  working:'I’m fetching the remaining receipts.', uncertain:'The browser connection was lost. I don’t know whether the remaining downloads finished.',
  used:'The agent used your browser', using:'The agent is using your browser', partial:'Only part of the browser activity is known',
  pages:'page visits', downloads:'downloads', actions:'form submission',
  detail:'Show visit details', hide:'Hide visit details', habitat:'Habitat · browser use',
  observed:'Observed sites', activity:'Visit events', downloaded:'Completed downloads',
  privacy:'The record contains sites, not page addresses, titles or form contents.',
  count:'A page visit is a navigation in the agent’s tab. The same page may be counted more than once.',
  submitted:'Form submitted', outcome:'Submission observed. Its effect on the site was not confirmed.',
  actionNote:'A form submission alone does not establish that a booking or payment was made.',
  visit:'Page visit', complete:'Completed',
  incomplete:'Last observation at 4:46. Subsequent visits, downloads and actions are unknown.',
  until:'Observed so far', closed:'The agent’s tab closed at 4:48. This visit record remains here.',
  open:'Open window list', windows:'Browser windows now', liveNote:'The agent’s own tab is marked; your window remains separate.',
  own:'Your window', tab:'Booking receipts', watch:'Example live view', close:'Close view',
  preview:'The live browser picture would appear here. This prototype neither opens the site nor grants control.',
  showWork:'Show work', hideWork:'Hide work', tool:'Browser visit', hidden:'Work steps are hidden. In this direction the visit record is hidden with them.',
  input:'Write a message…', mock:'Viewing does not take control of the browser.', footer:'The comparison is about placement. Every direction has the same events and window list.',
 }
};
function App({direction}:{direction:number}) {
 const [lang,setLang]=useState(language), [mode,setMode]=useState(scenario), [skin,setSkin]=useState(theme);
 const [expanded,expand]=useState(false), [work,setWork]=useState(true), [windows,setWindows]=useState(false), [view,setView]=useState(false);
 useEffect(()=>{document.querySelectorAll('.proto-picker-item').forEach((el,i)=>{el.textContent=(lang==='fi'?['1 Rivi','2 Kortti','3 Työ']:['1 Line','2 Card','3 Work'])[i].replace(' ','\u00a0');});window.dispatchEvent(new Event('resize'));},[lang]);
 const t=text[lang], done=mode==='done', lost=mode==='lost';
 const n=done?10:6, downloads=done?13:7;
 const time=lang==='fi'?(done?'4.42–4.48':lost?'4.42–4.46':'4.42–'):(done?'4:42–4:48':lost?'4:42–4:46':'4:42–');
 const label=done?t.used:lost?t.partial:t.using;
 const status:BrowserStatus={schema_version:1,state:'running',survives_restart:true,control:'agent',agent_connected:!done&&!lost,windows:[{id:'person',title:t.own,origin:'https://stays.example',agent:false},...(!done?[{id:'agent',title:t.tab,origin:'https://stays.example',agent:true}]:[])]};
 const button=(id:string,click:()=>void,content:React.ReactNode,open?:boolean)=><ControlButton size="row" data-testid={id} onPress={click} aria-expanded={open}>{content}</ControlButton>;
 const counts=<span data-testid="counts">{n} {t.pages} · {downloads} {t.downloads} · 1 {t.actions}</span>;
 const detail=expanded&&<section id="visit-details" data-testid="details" className="visit-details">
  <p className="muted">{t.privacy}</p>
  <h3>{t.observed}</h3><code>https://stays.example</code><p>{n} {t.pages} · {downloads} {t.downloads}</p>
  <p className="muted">{t.count}</p>
  <h3>{t.activity}</h3><ol className="events">{Array.from({length:n},(_,i)=><li key={i}><time>4:{String(42+Math.floor(i/2)).padStart(2,'0')}</time><span>{t.visit} {i+1} · <code>stays.example</code></span></li>)}</ol>
  <div className="submission"><time>4:43</time><strong>{t.submitted} · stays.example</strong><p>{t.outcome}</p><p className="muted">{t.actionNote}</p></div>
  <details data-testid="downloads"><summary>{t.downloaded} · {downloads}</summary><ul>{Array.from({length:downloads},(_,i)=><li key={i}><code>receipt-{String(i+1).padStart(2,'0')}.pdf</code> · {t.complete}</li>)}</ul></details>
  <p className="muted">{done?t.closed:lost?t.incomplete:t.until}</p>
 </section>;
 const disclosure=<ControlButton size="row" data-testid="details-toggle" aria-expanded={expanded} aria-controls="visit-details" onPress={()=>expand(!expanded)}><Icon name={expanded?'up':'down'}/>{expanded?t.hide:t.detail}</ControlButton>;
 const record=<div data-testid="record" data-state={mode} className={`record record-${direction}`}>
  {direction===1?<><div className="record-title"><HabitatMark size={20}/><span>{t.habitat}</span><time>{time}</time></div><h2>{label}</h2><code>stays.example</code><p className="stats">{counts}</p>{disclosure}</>:
   direction===0?<><div className="line"><HabitatMark size={18}/><div><span>{label} {time}: </span><code>stays.example</code><span> · {n} {t.pages}, {downloads} {t.downloads}, 1 {t.actions}.</span></div></div>{disclosure}</>:
   <><div className="tool"><Icon name="globe"/><code>browser</code><strong>{t.tool}</strong><span>{time}</span></div><p>{label} · <code>stays.example</code></p><p>{counts}</p>{disclosure}</>}
  {lost&&<p className="uncertain" role="status">{t.incomplete}</p>}
  {!done&&!lost&&<p className="muted">{t.until}</p>}
  {detail}
 </div>;
 return <div className="review" data-direction={direction}>
  <header className="review-header"><div className="eyebrow">{t.prototype}</div><h1>{t.title}</h1><ol className="directions">{t.lines.map((line,i)=><li key={i} aria-current={i===direction?'true':undefined}>{line}</li>)}</ol><p className="recommendation">{t.recommendation}</p>
   <div className="review-controls"><label>Language <select id="language" value={lang} onChange={e=>{language=e.target.value as 'fi'|'en';setPersonalLanguage(language);setLang(language);document.documentElement.lang=language;}}><option value="fi">Suomi</option><option value="en">English</option></select></label>
   <label>{lang==='fi'?'Teema':'Theme'} <select id="theme" value={skin} onChange={e=>{theme=e.target.value;document.documentElement.dataset.theme=theme;setSkin(theme);}}><option value="light">{lang==='fi'?'Päivä':'Light'}</option><option value="dark">{lang==='fi'?'Yö':'Dark'}</option><option value="contrast">{lang==='fi'?'Kontrasti':'Contrast'}</option></select></label>
   <label>{t.state} <select id="scenario" value={mode} onChange={e=>{scenario=e.target.value;setMode(scenario);setView(false);}}>{['done','live','lost'].map((s,i)=><option key={s} value={s}>{t.states[i]}</option>)}</select></label></div>
  </header>
  <div className="app-frame"><aside className="rail"><HabitatMark size={28}/><b>Open Habitat</b><hr/><span>{t.workspace}</span><strong>{t.conversation}</strong></aside>
  <main><header className="conversation-header"><span>{t.workspace}</span><h2>{t.conversation}</h2><small>Pi · 22.11.2026</small></header>
   <div className="conversation"><div className="message user"><small>{lang==='fi'?'Sinä':'You'} · 4:41</small><p>{t.user}</p></div><div className="message assistant"><small>Agent</small><p>{t.agent}</p></div>
   <div className="work-controls">{button('work-toggle',()=>setWork(!work),work?t.hideWork:t.showWork,work)}</div>
   {work&&<div className="work"><div className="tool"><Icon name="folder"/><code>mkdir receipts</code><span>4:42</span></div>{direction===2&&record}</div>}
   {!work&&direction===2&&<p className="hidden-note">{t.hidden}</p>}
   {direction!==2&&record}
   <div className="message assistant"><small>Agent · {done?'4:48':'4:46'}</small><p>{done?t.answer:lost?t.uncertain:t.working}</p></div>
   <div className="browser-dock">{windows&&<section data-testid="window-panel"><h3>{t.windows}</h3><p className="muted">{lost?t.incomplete:done?t.closed:t.liveNote}</p>{lost?<ul data-testid="stale-windows">{status.windows.map(w=><li key={w.id}>{w.title} · <code>{w.origin}</code></li>)}</ul>:<BrowserStrip status={status} summary={{kind:done?'idle':'agent'}} pictures={{}} onLook={()=>setView(true)} onTakeForRequest={()=>{}} onGiveBack={()=>{}}/>}{lost&&<p className="uncertain">{lang==='fi'?'Ikkunaluettelo on viimeinen tunnettu tila.':'The window list is the last known state.'}</p>}</section>}
   {lost?button('stale-chip',()=>setWindows(!windows),lang==='fi'?'Selain · tila ei tiedossa':'Browser · state unknown',windows):<BrowserChip status={status} summary={{kind:done?'idle':'agent'}} open={windows} onToggle={()=>setWindows(!windows)} onStart={()=>{}}/>}</div>
   {view&&<section className="view-example" data-testid="view-example"><h3>{t.watch}</h3><p>{t.preview}</p><p>{t.mock}</p>{button('view-close',()=>setView(false),t.close)}</section>}
   <div className="composer" aria-disabled="true">{t.input}<span>↵</span></div>
   </div>
  </main></div><footer>{t.footer}</footer>
 </div>;
}
setPersonalLanguage('fi');
const root=createRoot(document.getElementById('root')!);
const stageSink={set innerHTML(view:React.ReactNode){flushSync(()=>root.render(view===''?null:view));}};
const variants=[0,1,2].map(direction=>()=> <App key={direction} direction={direction}/>);
const picker=document.createElement('nav');picker.className='proto-picker';picker.setAttribute('aria-label','Prototype variants');
picker.innerHTML='<span class="proto-picker-highlight" aria-hidden="true"></span>';
['1 Rivi','2 Kortti','3 Työ'].forEach((name,i)=>{const b=document.createElement('button');b.className='proto-picker-item';b.textContent=name.replace(' ','\u00a0');if(i===0){b.setAttribute('data-active','');b.setAttribute('aria-current','true');}picker.append(b);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
