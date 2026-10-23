import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {Icon} from '../../../../web/src/components/Icon';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {IntegrationsOverview, ConnectDialog, type ConnectStage} from '../../../../web/src/components/Integrations';
import {PiDeviceSignIn} from '../../../../web/src/components/PiDeviceSignIn';
import type {Provider, Account} from '../../../../web/src/app/integrations';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import './round.css';

// Synthetic presentation only: no application owner, API, persistence or auth.
const google:Provider={id:'google',available:true,login:'pasted_redirect',services:['mail','calendar','contacts','drive']};
const account:Account={provider:'google',address:'aino@example.test',checked_at:'2026-10-23T12:00:00Z',services:[{id:'mail',state:'ok'},{id:'calendar',state:'ok'},{id:'contacts',state:'ok'},{id:'drive',state:'syncing',directory:'~/GoogleDrive',progress:{phase:'transferring',bytes:100000000,total_bytes:400000000,files:12,total_files:45,elapsed_seconds:25}}]};
const repos=[{name:'aurinkolabra/tuote',days:2,description:'Tiimin yhteinen tuotekehitys',default:true},{name:'aurinkolabra/design',days:8,description:'Käyttöliittymän aineistot'},{name:'aurinkolabra/vanha-pilotti',days:70,description:'Aiempi kokeilu'},{name:'aurinkolabra/paivays-puuttuu',days:null,description:'Viimeisen commitin aika ei ole tiedossa'}];
const directions=['Askelkortti','Reitti rinnalla','Yksi sivu'];
const notes=['Yksi asia kerrallaan, tuttu kortti · suositus','Koko reitti näkyy työpöydällä rinnalla','Avautuvat vaiheet samalla sivulla'];
function Btn({id,children,onClick,secondary=false}:{id?:string,children:React.ReactNode,onClick:()=>void,secondary?:boolean}){return <ControlButton data-testid={id} size="page" variant={secondary?'secondary':'primary'} onPress={onClick}>{children}</ControlButton>}
function DemoConsent({onApprove}:{onApprove:()=>void}){
 const [target,setTarget]=useState<Element|null>(null);
 useEffect(()=>setTarget(document.querySelector('[data-testid=integration-dialog]')),[]);
 return target?createPortal(<div className="person-simulation"><span>Vain prototyyppi · ulkoista Google-sivua ei avata</span><Btn id="simulate-consent" onClick={onApprove}>Simuloi hyväksyntä → kansiot</Btn></div>,target):null;
}
function Round(){
 const [direction,setDirection]=useState(0),[theme,setTheme]=useState('light'),[phone,setPhone]=useState(false);
 const [mode,setMode]=useState('preselected'),[integration,setIntegration]=useState('optional'),[fault,setFault]=useState('none');
 const [step,setStep]=useState(0),[selected,setSelected]=useState<string[]>(['aurinkolabra/tuote']),[showStale,setShowStale]=useState(false),[query,setQuery]=useState('');
 const [repoState,setRepoState]=useState('not-started'),[connected,setConnected]=useState(false),[ai,setAI]=useState(false),[paused,setPaused]=useState(false),[settings,setSettings]=useState(false);
 const [dialog,setDialog]=useState<ConnectStage|undefined>(),[demoMessage,setDemoMessage]=useState('');
 const reset=()=>{setStep(0);setSelected(mode==='none'?[]:['aurinkolabra/tuote']);setRepoState('not-started');setConnected(false);setAI(false);setPaused(false);setSettings(false);setDialog(undefined);setQuery('');setShowStale(false);setDemoMessage('')};
 useEffect(()=>{document.documentElement.dataset.theme=theme},[theme]);
 useEffect(()=>{document.querySelector<HTMLElement>('[data-active-heading]')?.focus()},[step,paused,settings]);
 useEffect(reset,[direction,mode,integration,fault]);
 const labels=['GitHub','Repot',...(integration==='off'?[]:['Integraatiot']),'AI-tili'];
 const stepIDs=[0,1,...(integration==='off'?[]:[2]),3];
 const nextAfterRepo=()=>setStep(integration==='off'?3:2);
 const signIn=()=>{if(mode==='auto'){setRepoState(fault==='checkout'?'uncertain':'confirmed');nextAfterRepo()}else setStep(1)};
 const continueRepos=()=>{if(selected.length){if(fault==='checkout'){setRepoState('uncertain');return}setRepoState('confirmed')}else setRepoState('skipped');nextAfterRepo()};
 const skipRepos=()=>{setRepoState('skipped');nextAfterRepo()};
 const visible=repos.filter(r=>(showStale||r.days===null||r.days<=14||selected.includes(r.name)||r.default&&mode!=='none')&&r.name.includes(query.toLowerCase()));
 const title=['Kirjaudu GitHubilla','Valitse työtilasi','Yhdistä Google','Liitä AI-tili'][step];
 const startDialog=()=>setDialog({stage:'intro'});
 const login=()=>setDialog({stage:'login',view:{schema_version:1,state:'open_url',provider:'google',authorization_url:'https://accounts.example.test/synthetic-consent',redirect_prefix:'http://localhost:8080/oauth2/callback',expires_at:new Date(Date.now()+600000).toISOString()}});
 const folders=()=>setDialog({stage:'login',view:{schema_version:1,state:'choose_folders',provider:'google',address:account.address,directory:'~/GoogleDrive',free_bytes:8000000000,quota_bytes:10000000000,folders:[{id:'work',name:'Tiimin materiaalit',bytes:400000000,suggested:true},{id:'archive',name:'Arkisto',bytes:1000000000,suggested:false}]}});
 const connectedDialog=()=>{setConnected(true);setDialog({stage:'connected',address:account.address})};
 const summary=repoState==='confirmed'?(mode==='auto'?'Sivuston oletusrepo haettu automaattisesti.':'Valitut repot haettu.') :repoState==='uncertain'?'Repon haun tulosta ei tunneta. Mitään ei haeta uudelleen itsestään.':repoState==='skipped'?'Jatkoit ilman repoja. Voit hakea niitä myöhemmin työtiloista.':'Repoja ei ole vielä haettu.';
 const integrationView=<IntegrationsOverview list={{schema_version:1,providers:[google],accounts:connected?[account]:[],skill:connected?'current':'none'}} checking={new Set()} onConnect={startDialog} onCheck={()=>setDemoMessage('Simulaatio: tilin tila tarkistettiin.')} onSignInAgain={startDialog} onRemove={()=>{setConnected(false);setDemoMessage('Simulaatio: liitos poistettiin.')}}/>;
 const contents=(s:number)=>s===0?<><p>GitHub-tunnuksesi kertoo, kuka olet. Kirjautuminen ei vielä yhdistä Googlea eikä AI-tiliä.</p><div className="person-note">Aurinkolabra · Synteettinen kutsuttu henkilö <code>aino-demo</code><br/>{mode==='none'?'Sivusto ei määritä oletusrepoja.':<>Oletusrepo: <code>aurinkolabra/tuote</code> · {mode==='auto'?'haetaan automaattisesti kirjautumisen jälkeen':'esivalittuna, voit poistaa valinnan'}.</>}</div><p className="person-meta">Tuotannon Git-identiteetin vahvistus säilyy ennen ensimmäistä hakua. Tässä simulaatiossa se on jo vahvistettu.</p><Btn id="signin" onClick={signIn}>Simuloi GitHub-kirjautuminen</Btn><p className="person-meta">Kirjaudu vain omalla tunnuksellasi. Tästä prototyypistä ei avata oikeaa kirjautumista.</p></>:s===1?<>
 <p>Sivusto ehdottaa yhteistä repoa. Valinta ei vielä hae mitään. Voit poistaa sen tai jatkaa kokonaan ilman repoja.</p>
 {fault==='catalog'?<div className="person-note" role="alert">Repojen luetteloa ei voitu hakea. Oletusrepon oikeuksiakaan ei ole vahvistettu.<div className="person-actions"><Btn secondary id="retry" onClick={()=>setFault('none')}>Simuloi uusi tarkistus</Btn></div></div>:<>
 <label className="person-search">Etsi repoa<input type="search" data-testid="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
 <div className="person-filter"><span>Viimeinen commit enintään 14 päivää sitten</span><label><input data-testid="stale" type="checkbox" checked={showStale} onChange={e=>setShowStale(e.target.checked)}/> Näytä myös vanhemmat (1)</label></div>
 <p className="person-meta">Esivalinnat ja tuntemattomat päivämäärät pysyvät näkyvissä. Suodatus ei poista valintoja.</p>
 <div className="person-repos">{fault==='empty'?<p role="status">Tällä GitHub-tunnuksella ei löytynyt repoja. Sivuston ehdotus ei anna uusia oikeuksia.</p>:visible.length?visible.map(r=><label className="person-repo" key={r.name}><input type="checkbox" data-testid={`repo-${r.name.split('/')[1]}`} checked={selected.includes(r.name)} onChange={e=>setSelected(v=>e.target.checked?[...v,r.name]:v.filter(x=>x!==r.name))}/><span><code>{r.name}</code>{r.default&&mode!=='none'?<span className="person-tag">Sivuston ehdotus</span>:null}<small>{r.description} · {r.days===null?'Commitin aika tuntematon':`${r.days} päivää viimeisestä commitista`}</small></span></label>):<p role="status">Ei osumia. Voit muuttaa hakua tai jatkaa ilman repoja.</p>}</div>
 </>}
 {repoState==='uncertain'?<div className="person-note" role="alert">{summary}<div className="person-actions"><Btn id="check-clone" secondary onClick={()=>{setRepoState('confirmed');nextAfterRepo()}}>Simuloi tilan tarkistus: repo löytyi</Btn></div></div>:null}
 <div className="person-actions">{!['catalog','empty'].includes(fault)&&repoState!=='uncertain'?<Btn id="checkout" onClick={continueRepos}>{selected.length?`Hae ${selected.length} ja jatka`:'Jatka ilman repoja'}</Btn>:null}<Btn secondary id="skip-repos" onClick={skipRepos}>Jatka ilman repoja</Btn></div>
 </>:s===2?<>
 <p>{integration==='required'?'Sivusto edellyttää Google-tilin liittämistä ennen työtiloihin siirtymistä. Voit keskeyttää ja palata tähän.':'Google on valinnainen. Voit liittää sen nyt tai myöhemmin kohdassa Asetukset › Integraatiot.'}</p>
 <div className="person-receipt" role="status">{summary}{repoState==='confirmed'?<> <code>{mode==='auto'?'aurinkolabra/tuote':selected.join(', ')}</code></>:null}{repoState==='uncertain'?<div className="person-actions"><Btn secondary id="auto-check" onClick={()=>{setRepoState('confirmed');setDemoMessage('Simulaatio: työtila löytyi. Hakua ei toistettu.')}}>Tarkista haun tila</Btn></div>:null}</div>
 {integrationView}
 <div className="person-actions">{connected?<Btn id="next-integration" onClick={()=>setStep(3)}>Jatka AI-tiliin</Btn>:integration==='required'?<Btn id="pause-required" secondary onClick={()=>setPaused(true)}>Tallenna ja jatka myöhemmin</Btn>:<Btn id="skip-google" secondary onClick={()=>setStep(3)}>Jatka ilman Googlea</Btn>}</div>
 </>:<>
 <p>AI-tili on eri asia kuin GitHub tai Google. Se tarvitaan agentin käyttämiseen. Voit siirtyä työtiloihin myös ilman sitä.</p>
 <PiDeviceSignIn embedded view={ai?{phase:'connected'}:{phase:'start'}} onRetry={()=>setAI(true)} onRefresh={()=>setAI(true)}/>
 {!ai?<Btn id="connect-ai" onClick={()=>setAI(true)}>Simuloi AI-kirjautuminen</Btn>:null}
 <div className="person-actions"><Btn id="finish" onClick={()=>setStep(4)}>{ai?'Avaa työtilat':'Jatka työtiloihin ilman AI-tiliä'}</Btn></div>
 </>;
 return <>
 <header className="person-review"><h1>Käyttöönotto · uuden henkilön näkymä</h1><p><strong>Suositus: Askelkortti.</strong> Tuttu rauhallinen eteneminen; sama Google-näkymä kuin asetuksissa. Vertailuakseli on reitin esitystapa, ei sivuston säännöt.</p><div className="person-variants">{directions.map((d,i)=><button key={d} data-testid={`direction-${i}`} aria-pressed={direction===i} onClick={()=>setDirection(i)}>{i+1}. {d}</button>)}</div><p>{notes[direction]}</p>
 <div className="person-demo"><label>Teema<select data-testid="theme" value={theme} onChange={e=>setTheme(e.target.value)}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input type="checkbox" checked={phone} onChange={e=>setPhone(e.target.checked)}/>390 px kehys</label><label>Oletusrepot<select data-testid="mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="preselected">Esivalittu</option><option value="auto">Automaattinen haku · ohita repovaihe</option><option value="none">Ei oletusrepoja</option></select></label><label>Google<select data-testid="integration-mode" value={integration} onChange={e=>setIntegration(e.target.value)}><option value="optional">Valinnainen</option><option value="required">Pakollinen</option><option value="off">Pois käytöstä</option></select></label><label>Poikkeustila<select data-testid="fault" value={fault} onChange={e=>setFault(e.target.value)}><option value="none">Ei poikkeusta</option><option value="empty">Ei repo-oikeuksia</option><option value="catalog">Repojen haku ei vastaa</option><option value="checkout">Repon haun tulos epäselvä</option><option value="google">Googlen lupa evätty</option></select></label><Btn secondary id="reset" onClick={reset}>Aloita alusta</Btn></div>
 <p className="person-meta">Vain prototyypin ohjaimet yllä. Kaikki tiedot ovat keksittyjä. Sivua ei yhdistetä palveluihin eikä valintoja tallenneta.</p></header>
 <main className={`person-frame direction-${direction} ${phone?'phone':''}`} data-testid="prototype" data-step={step}>
 <div className="person-brand"><strong>Open Habitat</strong><span>Aurinkolabra</span><code>habitat.example.test</code></div>
 {settings?<section className="person-card"><h2 tabIndex={-1} data-active-heading>Asetukset › Integraatiot</h2>{integrationView}<Btn secondary id="settings-back" onClick={()=>setSettings(false)}>Takaisin</Btn></section>:paused?<section className="person-card"><h2 tabIndex={-1} data-active-heading>Käyttöönotto kesken</h2><p>Google on vielä liittämättä. Työtiloihin ei siirrytty. Voit palata tähän vaiheeseen tai kirjautua ulos.</p><Btn id="resume" onClick={()=>setPaused(false)}>Jatka käyttöönottoa</Btn><Btn secondary id="logout-paused" onClick={reset}>Simuloi uloskirjautuminen</Btn></section>:step===4?<section className="person-card"><h2 tabIndex={-1} data-active-heading>Työtilat</h2><div className="person-receipt">{summary}</div>{repoState==='confirmed'?<div className="person-repo"><code>{mode==='auto'?'aurinkolabra/tuote':selected.join(', ')}</code></div>:<p>Voit hakea GitHub-repon tai luoda tyhjän työtilan myöhemmin.</p>}<p>{connected?'Google yhdistetty; synkronointi jatkuu taustalla.':'Googlea ei yhdistetty.'}</p><p>{ai?'AI-tili yhdistetty. Voit aloittaa keskustelun.':'AI-tili puuttuu. Voit selata työtiloja; agentti ei vielä käynnisty.'}</p><Btn id="settings-open" secondary onClick={()=>setSettings(true)}>Asetukset › Integraatiot</Btn><Btn id="restart" secondary onClick={reset}>Toista käyttöönotto</Btn></section>:<div className="person-layout">
 <nav className="person-steps" aria-label="Käyttöönoton vaiheet"><ol>{labels.map((l,i)=><li key={l} aria-current={step===stepIDs[i]?'step':undefined}><span>{step>stepIDs[i]?(stepIDs[i]===1&&repoState==='uncertain'?<Icon name="warning"/>:stepIDs[i]===1&&repoState==='skipped'||stepIDs[i]===2&&!connected?'–':<Icon name="check"/>):i+1}</span>{l}{step>stepIDs[i]&&(stepIDs[i]===1&&repoState==='skipped'||stepIDs[i]===2&&!connected)?<small>Ohitettu</small>:null}{stepIDs[i]===1&&mode==='auto'?<small>Automaattinen</small>:null}</li>)}</ol></nav>
 <div className="person-body">{direction===2?stepIDs.map((s,i)=><section className={`person-card ${s===step?'active':'collapsed'}`} key={s}>{s===step?<><h2 tabIndex={-1} data-active-heading>{title}</h2>{contents(s)}</>:<h2>{labels[i]} <small>{s<step?'Käsitelty':'Seuraavaksi'}</small></h2>}</section>):<section className="person-card"><p className="person-eyebrow">Käyttöönotto · {stepIDs.indexOf(step)+1}/{labels.length}</p><h2 tabIndex={-1} data-active-heading>{title}</h2>{contents(step)}</section>}
 {step>0?<div className="person-exit"><Btn secondary id="back" onClick={()=>setStep(step===3&&integration==='off'?1:step-1)}>Takaisin</Btn><Btn secondary id="exit" onClick={reset}>Simuloi uloskirjautuminen</Btn></div>:null}</div>
 </div>}
 {demoMessage?<p role="status" className="person-note">{demoMessage}</p>:null}
 </main>
 <footer className="person-review"><h2>Kysymys Jarille</h2><p>Valitaanko Askelkortti? Saako pakollisen Google-vaiheen jättää kesken vain palaamista varten (ei vielä työtiloihin)? Automaattisen haun tulos näytetään seuraavalla sivulla; esivalinta ei koskaan käynnistä hakua ilman painallusta.</p></footer>
 <ConnectDialog provider={dialog?google:undefined} stage={dialog??{stage:'intro'}} onContinue={()=>fault==='google'?setDialog({stage:'login',view:{schema_version:1,state:'failed',provider:'google',failure:'cancelled'}}):login()} onPassword={()=>{}} onPaste={folders} onFolders={connectedDialog} onRestart={login} onClose={()=>setDialog(undefined)}/>
 {dialog?.stage==='login'&&dialog.view.state==='open_url'?<DemoConsent onApprove={folders}/>:null}
 </>;
}
// Prevent provider navigation in the synthetic review artifact, including AI links.
document.addEventListener('click',e=>{const a=(e.target as Element).closest('a');if(a?.href.startsWith('https:')){e.preventDefault();e.stopPropagation();}},true);
createRoot(document.getElementById('root')!).render(<Round/>);
