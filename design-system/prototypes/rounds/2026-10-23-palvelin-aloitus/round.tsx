import React, {useState} from 'react';
import {flushSync} from 'react-dom';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {createRoot} from 'react-dom/client';
import {ControlButton as Button} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {GitHubRepoChooser} from '../../../../web/src/components/GitHubRepoChooser';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import './round.css';

const directions=['Vaikutus vieressä','Vaihelista','Yksi lomake'];
const initial={mode:'preselected',repo:'northstar-demo/product',days:14,google:'optional',order:'repos-first'};
const names=['GitHub-kirjautuminen','Repot','Integraatiot','AI-tili'];
let reviewTheme='light', reviewPhone=false;
function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [draft,setDraft]=useState(initial),[saved,setSaved]=useState(initial),[step,setStep]=useState(1),[tab,setTab]=useState('onboarding');
 const [notice,setNotice]=useState(''),[username,setUsername]=useState(''),[inviteError,setInviteError]=useState('');
 const [people,setPeople]=useState([{name:'aino-demo',state:'Odottaa ensimmäistä kirjautumista'},{name:'leo-demo',state:'Liittynyt'}]);
 const [revoke,setRevoke]=useState(''),[current,setCurrent]=useState(false),[selected,setSelected]=useState(['northstar-demo/product']);
 const dirty=JSON.stringify(draft)!==JSON.stringify(saved);
 const patch=(key:string,value:unknown)=>{setDraft(d=>({...d,[key]:value}));setNotice('');};
 const steps=draft.order==='repos-first'?[0,1,2,3]:[0,2,1,3];
 const valid=(draft.mode==='skip'||/^[\w.-]+\/[\w.-]+$/.test(draft.repo))&&Number.isInteger(draft.days)&&draft.days>=0;
 const field=(title:string,node:React.ReactNode,hint?:string)=><label className="field"><strong>{title}</strong>{node}{hint&&<span className="muted">{hint}</span>}</label>;
 const config=(s:number)=><section className="config" data-step={s}><h3>{names[s]}</h3>{s===0?<p>GitHub-kirjautuminen on aina ensimmäinen. Henkilö vahvistaa myös Git-identiteettinsä ennen repoja.</p>:s===1?<>
 {field('Repojen aloitustapa',<select data-testid="repo-mode" value={draft.mode} onChange={e=>patch('mode',e.target.value)}><option value="preselected">Esivalitse oletusrepot</option><option value="auto">Hae oletusrepot automaattisesti</option><option value="skip">Ohita repovaihe</option></select>)}
 {draft.mode!=='skip'&&<>{field('Oletusrepo',<input data-testid="default-repo" value={draft.repo} onChange={e=>patch('repo',e.target.value)}/>, 'GitHubin omistaja/repo. Oikeus repoon tarkistetaan henkilön omalla tilillä.')}
 {draft.mode==='preselected'&&field('Piilota yli näin monta päivää sitten päivitetyt repot',<input data-testid="stale-days" type="number" min="0" step="1" value={draft.days} onChange={e=>patch('days',Number(e.target.value))}/>, '0 = ei aikarajausta. Oletusrepo säilyy näkyvissä; tuntematon päivitysaika ei piilota repoa.')}
 <p className="effect">{draft.mode==='auto'?'Uudelle henkilölle: oletusrepo haetaan ilman repovalitsinta. Puuttuva oikeus tai haun virhe pysäyttää etenemisen; onnistumista ei oleteta.':'Uudelle henkilölle: oletusrepo on valittuna. Henkilö voi poistaa valinnan tai näyttää myös vanhemmat repot.'}</p></>}
 {draft.mode==='skip'&&<p className="effect">Uudelle henkilölle: repovalitsinta ei näytetä eikä mitään haeta. Repoja voi lisätä myöhemmin.</p>}
 </>:s===2?<>
 {field('Google käyttöönotossa',<select data-testid="google-mode" value={draft.google} onChange={e=>patch('google',e.target.value)}><option value="optional">Vapaaehtoinen</option><option value="required">Pakollinen</option><option value="off">Ei käyttöönotossa</option></select>)}
 <p className="effect">{draft.google==='required'?'Uudelle henkilölle: Google pitää liittää ennen käyttöönoton valmistumista. Jos liittäminen ei onnistu, henkilö ei pääse eteenpäin.':draft.google==='optional'?'Uudelle henkilölle: Googlea ehdotetaan, mutta vaiheen voi ohittaa.':'Uudelle henkilölle: Google-vaihetta ei näytetä. Sen voi liittää myöhemmin asetuksissa.'}</p>
 <p className="muted">Liittäminen käyttää samaa näkymää kuin Asetukset › Integraatiot. Henkilö valtuuttaa itse tilinsä ja näkee, mitä agentti saa käyttää. Ylläpitäjä ei yhdistä tilejä kenenkään puolesta.</p>
 </>:<p>Henkilö kirjautuu omalle AI-tililleen. Sivusto ei jaa ylläpitäjän tunnuksia eikä valitse henkilön palvelutiliä.</p>}</section>;
 const preview=<aside className="preview" aria-label="Vaikutus uudelle henkilölle"><p className="eyebrow">{dirty?'Luonnoksen vaikutus':'Tallennetun mallin vaikutus'}</p><h3>Näin uusi henkilö aloittaa</h3><ol>{steps.map(s=><li key={s}><strong>{names[s]}</strong><p>{s===0?'Kirjautuu omalla GitHub-tilillään.':s===1?draft.mode==='auto'?`Haetaan ${draft.repo||'oletusrepo'} automaattisesti.`:draft.mode==='skip'?'Ohitettu. Repoja ei haeta.':`${draft.repo||'Oletusrepo'} valittuna. ${draft.days?`Muut repot: viimeiset ${draft.days} päivää.`:'Kaikki repot näkyvissä.'}`:s===2?`Google: ${{optional:'voi ohittaa',required:'pakollinen, ei ohitusta',off:'ei näytetä'}[draft.google]}.`:'Kirjautuu omalle AI-tililleen.'}</p></li>)}</ol><p className="muted">Ei muuta jo liittyneiden työtiloja tai liitoksia. Tallennus koskee seuraavaa uutta käyttöönottoa; kesken olevan käyttöönoton käsittely odottaa suunnittelupäätöstä.</p></aside>;
 function invite(){const name=username.trim();if(!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(name)||name.includes('--')){setInviteError('Kirjoita GitHub-käyttäjänimi, ei sähköpostia tai osoitetta.');return;}if(people.some(p=>p.name.toLowerCase()===name.toLowerCase())){setInviteError('Tämä henkilö on jo listalla. Uutta kutsua ei luotu.');return;}setPeople([...people,{name,state:'Odottaa ensimmäistä kirjautumista'}]);setUsername('');setInviteError('');setNotice(`Kutsu luotu käyttäjälle ${name}. Jaa sivuston osoite itse; viestiä ei lähetetty.`);}
 return <div data-theme={theme} className={phone?'review phone':'review'}><header className="reviewbar"><strong>Palvelin · prototyyppi</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä palvelimeen, GitHubiin tai Googleen.</p></header>
 <p className="axis">Suositus: Vaikutus vieressä — koko aloituspolku näkyy asetusten rinnalla. Valitaanko se jatkoon? Vaihtoehto 2 näyttää yhden muokattavan vaiheen kerrallaan; vaihtoehto 3 kokoaa yhteenvedon lomakkeen loppuun.</p>
 <div className="shell"><div className="hostbar"><strong>Open Habitat</strong><span>Northstar · esimerkkisivusto</span><Icon name="user"/></div><section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n}>{n}</span>)}<span className="s-nav-h">Palvelimen ylläpito</span><span className="s-nav-i" aria-current="page">Palvelin</span><span className="s-nav-i">Käyttäjät</span><span className="s-nav-i">Levytila</span><p className="muted">Muut osiot ovat tässä vain kontekstia.</p></nav><main className="s-main">
 <p className="mobileback">Asetukset › Palvelin</p><h2>Palvelin</h2><div className="facts s-card"><div className="s-row"><strong>Northstar</strong><code>habitat.example.test</code></div><div className="s-row"><strong>Versio</strong><code>v0.0.0-prototype</code></div></div>
 <nav className="subnav" aria-label="Palvelimen sisältö"><Button size="row" variant={tab==='onboarding'?'primary':'secondary'} onPress={()=>setTab('onboarding')}>Käyttöönotto</Button><Button size="row" variant={tab==='invites'?'primary':'secondary'} onPress={()=>setTab('invites')}>Kutsut ja pääsy ({people.length})</Button></nav>
 {notice&&<p role="status" className="notice">{notice}</p>}
 {tab==='onboarding'?<><h3>Uuden henkilön käyttöönotto</h3><p>Valitse vaiheet ja oletukset. Kutsut eivät muutu tätä tallennettaessa.</p><div className={`layout direction-${direction}`}>
 <div className="editor"><div className="s-card order">{field('Vaiheiden järjestys',<select data-testid="step-order" value={draft.order} onChange={e=>patch('order',e.target.value)}><option value="repos-first">GitHub → Repot → Integraatiot → AI-tili</option><option value="google-first">GitHub → Integraatiot → Repot → AI-tili</option></select>, 'GitHub pysyy ensimmäisenä ja AI-tili viimeisenä tässä kokeilussa.')}</div>
 {direction===1?<><nav className="stepnav" aria-label="Muokattava vaihe">{steps.map(s=><Button key={s} size="row" variant={step===s?'primary':'secondary'} onPress={()=>setStep(s)}>{names[s]}</Button>)}</nav><div className="s-card">{config(step)}</div></>:<div className="s-card">{steps.map(s=><React.Fragment key={s}>{config(s)}</React.Fragment>)}</div>}
 </div>{preview}</div>
 {!valid&&<p role="alert">Anna repo muodossa omistaja/repo ja aikarajaksi kokonaisluku 0 tai suurempi.</p>}
 <div className="save"><span>{dirty?'Tallentamattomia muutoksia':'Ei tallentamattomia muutoksia'}</span><Button data-testid="discard" size="row" variant="secondary" isDisabled={!dirty} onPress={()=>{setDraft(saved);setNotice('Luonnos peruttu.');}}>Peru muutokset</Button><Button data-testid="save" size="page" isDisabled={!dirty||!valid} onPress={()=>{setSaved({...draft});setNotice('Prototyypin malli tallennettu. Oikea palvelin ei muuttunut.');}}>Tallenna käyttöönotto</Button></div>
 <details><summary>Nykyinen tuotantokomponentti vertailuksi</summary><p>GitHubRepoChooser samalla synteettisellä repolla; ei ehdotetun käyttöönoton toteutus.</p><Button size="row" variant="secondary" onPress={()=>setCurrent(!current)}>{current?'Sulje repovalitsin':'Näytä repovalitsin'}</Button>{current&&<GitHubRepoChooser view={{phase:'catalog',repositories:[{full_name:'northstar-demo/product',private:true,description:'Synteettinen tuotekehitysrepo',pushed_at:'2026-10-22T10:00:00Z'}]}} selectedNames={selected} checkout={{phase:'idle'}} onToggle={(n,yes)=>setSelected(yes?[n]:[])} onProceed={()=>setNotice('Vain vertailu: repoa ei haettu.')}/>}</details>
 <details><summary>Yhteinen käsitteistö suunnittelua varten</summary><pre>{JSON.stringify({onboarding:{steps:steps.map(s=>['github','repositories','integrations','ai_account'][s]),repositories:{defaults:draft.mode==='skip'?[]:[{repository:draft.repo,mode:draft.mode}],stale_after_days:draft.days},integrations:{google:draft.google}},invitations:people},null,2)}</pre></details>
 </>:<section className="invites"><h3>Kutsut ja pääsy</h3><p>Kutsu sallii liittymisen tällä GitHub-käyttäjänimellä. Se ei anna GitHub-repojen oikeuksia, ylläpitäjän asemaa tai liitä Googlen tiliä.</p><div className="s-card inviteform">{field('GitHub-käyttäjänimi',<input data-testid="invite-name" placeholder="esim. sara-demo" value={username} onChange={e=>setUsername(e.target.value)}/>)}<Button data-testid="invite" size="page" onPress={invite}>Luo kutsu</Button><p className="muted">Jaa <code>https://habitat.example.test</code> henkilölle itse. Sähköpostia tai GitHub-viestiä ei lähetetä.</p>{inviteError&&<p role="alert">{inviteError}</p>}</div><ul className="people s-card">{people.map(p=><li key={p.name}><div><code>{p.name}</code><p>{p.state}</p></div>{p.state.startsWith('Odottaa')?<div className="person-actions"><Button size="row" variant="secondary" onPress={()=>{setPeople(people.map(x=>x.name===p.name?{...x,state:'Liittynyt'}:x));setNotice('Simuloitu ensimmäinen kirjautuminen.');}}>Simuloi liittyminen</Button><Button size="row" variant="danger-subtle" onPress={()=>setRevoke(p.name)}>Peru kutsu</Button></div>:<p className="muted">Pääsyn poisto kuuluu Käyttäjät-osioon, ei kutsun perumiseen.</p>}</li>)}</ul>
 {revoke&&<div role="group" aria-label="Vahvista kutsun peruminen" className="confirm"><h4>Perutaanko käyttäjän {revoke} kutsu?</h4><p>Henkilö ei voi liittyä tämän kutsun perusteella. Olemassa olevaa tiliä tai istuntoja ei poisteta.</p><Button size="row" variant="secondary" onPress={()=>setRevoke('')}>Säilytä kutsu</Button><Button data-testid="confirm-revoke" size="row" variant="danger" onPress={()=>{setPeople(people.filter(p=>p.name!==revoke));setNotice(`Kutsu peruttu: ${revoke}.`);setInviteError('');setRevoke('');}}>Vahvista peruminen</Button></div>}
 <p className="muted">Tässä mallissa pääsy on vain hyväksytyillä GitHub-käyttäjillä. Jo hyväksytyt henkilöt näkyvät Käyttäjät-osiossa. Pääsyn myöntämisen tekninen auktoriteetti ratkaistaan erillisessä suunnitelmassa.</p></section>}
 </main></section></div></div>;
}
const root=createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
// Flush the empty commit so switching (and R) really unmounts the old fixture.
const stage={set innerHTML(view:React.ReactNode){flushSync(()=>root.render(view===''?null:view));}};
const variants=directions.map((_,direction)=>()=> <App direction={direction}/>);
const picker=document.createElement('nav');
picker.className='proto-picker';picker.setAttribute('aria-label','Prototype variants');
picker.innerHTML='<span class="proto-picker-highlight" aria-hidden="true"></span>';
// Non-breaking label spaces keep the fixed reference pill single-line at 390 px.
directions.forEach((name,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=name.replaceAll(' ','\u00a0');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
// Static comparison: no replay button or divider (R still remounts the fixture).
document.body.append(picker);
new Function('stage','variants',pickerSource)(stage,variants);
