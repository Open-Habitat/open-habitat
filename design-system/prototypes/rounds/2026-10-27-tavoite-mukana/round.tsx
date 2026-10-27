// Stylesheets first, in main.tsx's order, so component CSS wins as in production.
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {type ReactNode, useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {AssistantMessage, Composer, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {Icon} from '../../../../web/src/components/Icon';
import {Markdown} from '../../../../web/src/components/Markdown';
import {AgentHeader, AppShell, NowSections, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {SkillInvocation} from '../../../../web/src/components/SkillInvocation';
import {goalDraft, StartHere} from '../../../../web/src/components/StartHere';
import {ViewSplit} from '../../../../web/src/components/ViewPanel';
import type {StartGoal, StartPage} from '../../../../web/src/app/composerReads';
import {GoalChipContext} from './chips';
import '../../../../web/src/components/EditorSplit.css';
import './round.css';

// Round "Tavoite mukana keskustelussa": where the request and the guide's
// steps live after Aloita. The start page, guide, composer, timeline, skill
// chip and right-hand split are the production components; the goal chip,
// its card and the guide panel's content are this round's. Everything is
// synthetic and in memory; nothing is sent anywhere.

type Dir = 0 | 1 | 2; // A Siru ja paneeli, B Siru ja kortti, C Teksti ja paneeli
const directions = ['A Siru ja paneeli', 'B Siru ja kortti', 'C Teksti ja paneeli'];
const axis = [
 'A · Aloita lisää viestikenttään tavoitesirun; pyyntö aukeaa sirusta. Oppaan vaiheet ovat paneelissa keskustelun vieressä, kunnes suljet sen. Lähetetty viesti näkyy historiassa sirulla.',
 'B · Siru kuten A:ssa, mutta ei paneelia: sirusta aukeava kortti näyttää vaiheet ja pyynnön vain pyydettäessä. Lähetetty viesti näkyy historiassa sirulla, joka avaa samat vaiheet.',
 'C · Nykyinen raakateksti viestikentässä (näkyvä ja muokattava), mutta vaiheet paneelissa. Historiaan jää se, mitä nykyinen tuotanto jättää.',
];

// Same synthetic Aurinkopolku goals as proto-start-page-presentation round 2,
// with placeholders last as the start-page skill now asks.
type Goal = StartGoal & {id: string};
const goals: Goal[] = [
 {id:'tutustu', title:'Tutustu repoon', when:'Kun aloitat tässä repossa ensimmäistä kertaa.', what:'Saat kartan Aurinkopolun rakenteesta, tärkeimmistä ohjeista ja testien ajamisesta. Tiedostoja ei muuteta.', steps:['Agentti lukee repon ohjeet ja tärkeimmät aloitustiedostot.','Agentti kokoaa hakemistokartan ja testien ajotavat.','Tarkistat yhteenvedon ja valitset seuraavan tehtävän.'], prompt:'Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.'},
 {id:'korjaa', title:'Korjaa havaittu ongelma', when:'Kun löydät toistettavan virheen.', what:'Saat ongelman juurisyyn, rajatun korjauksen ja tiedon ajetuista testeistä. Lisää luonnokseen havainto ja toisto-ohje ennen lähettämistä.', steps:['Kuvaile havainto, odotettu tulos ja miten virhe toistuu.','Agentti selvittää syyn ja tekee pienen toistavan testin.','Agentti korjaa juurisyyn, ajaa testit ja kertoo tarkistamatta jääneen.'], skill:'korjaa', prompt:'Selvitä ongelman syy. Tee ensin pieni toistava testi. Korjaa juurisyy ja aja aiheeseen liittyvät testit. Kerro, mitä tarkistit ja mikä jäi tarkistamatta.\n\n[kuvaile havainto]'},
 {id:'julkaise', title:'Valmistele seuraava julkaisu', when:'Kun haluat tarkistaa julkaisuvalmiuden.', what:'Saat julkaisuvalmiuden tarkistuksen, estelistan ja julkaisuluonnoksen. Tämä ei luo tagia, pushaa tai julkaise mitään.', steps:['Agentti lukee julkaisuohjeen ja tarkistaa työpuun tilan muuttamatta sitä.','Agentti kokoaa muutokset, tarkistaa esimerkit ja ajaa julkaisuohjeen testit.','Saat estelistan, versioehdotuksen ja julkaisuluonnoksen hyväksyttäväksi.'], prompt:'Tarkista seuraavan julkaisun valmius.\n\n1. Lue repon julkaisuohje.\n2. Tarkista työpuun tila muuttamatta sitä.\n3. Kokoa edellisen julkaisun jälkeiset käyttäjälle näkyvät muutokset.\n4. Erota korjaukset uusista ominaisuuksista.\n5. Tarkista dokumenttien esimerkit.\n6. Aja ohjeen nimeämät testit.\n7. Kerro myös tarkistukset, joita et voinut ajaa.\n8. Listaa avoimet esteet.\n9. Ehdota seuraava versio ja perustele se.\n10. Kirjoita lyhyt julkaisuluonnos.\n\nÄlä luo tagia, pushaa tai julkaise mitään. Odota hyväksyntää. Tarkistettava esimerkkipolku: docs/esimerkit/erittain-pitka-synteettinen-julkaisun-valmistelun-tarkistuslistan-tiedostonimi.md'},
 {id:'paivita-ohje', title:'Päivitä ohje', when:'Kun käytäntö on muuttunut.', what:'Saat täsmälliset korjausehdotukset valitsemaasi ohjeeseen. Lisää tarkistettavan ohjeen polku luonnokseen.', steps:['Nimeä tarkistettava ohje.','Agentti vertaa esimerkkejä nykyiseen toteutukseen.','Tarkistat rajatut korjausehdotukset ennen muutoksia.'], prompt:'Tarkista ohjeen esimerkit nykyistä toteutusta vasten. Ehdota täsmälliset korjaukset. Älä muuta muita ohjeita.\n\n[tarkistettavan ohjeen polku]'},
 {id:'arvioi', title:'Arvioi muutos', when:'Ennen muutoksen yhdistämistä.', what:'Saat listan toistettavista ongelmista ja niiden vaikutuksista. Tyylitoiveet eivät kuulu tähän arvioon.', steps:['Tarkista, että arvioitava muutos on nykyisessä haarassa.','Agentti lukee muutoksen ja varmistaa epäillyt ongelmat.','Päätät löydösten perusteella, mitä korjataan ennen yhdistämistä.'], prompt:'Arvioi nykyisen haaran muutos. Etsi vain toistettavia ongelmia ja kerro kunkin vaikutus, ei tyylitoiveita.'},
 {id:'suunnittele', title:'Suunnittele pieni lisäys', when:'Kun haluat uuden toiminnon.', what:'Saat ehdotuksen pienimmästä hyödyllisestä muutoksesta ja sen testistä. Lisää tavoite luonnokseen; koodaus ei kuulu tähän pyyntöön.', steps:['Kuvaile uuden toiminnon tavoite.','Agentti lukee nykyisen toteutuksen.','Tarkistat muutosehdotuksen ja testin ennen koodausta.'], prompt:'Suunnittele lisäys. Lue nykyinen toteutus. Ehdota pienin hyödyllinen muutos ja sen testi ennen koodausta.\n\n[uuden toiminnon tavoite]'},
];
const page: StartPage = {title:'Aurinkopolku', body:'Pieni retkireittien suunnittelija. Tässä repossa ovat sovellus, testit ja käyttöohjeet.', goals};
// In A and B every goal is a native skill (ideation 1b): the start-page skill
// writes the long request into .agents/skills/<id>/SKILL.md, and the chip
// carries only its name. The skill's description is the goal's title.
const goalSkill = (g: Goal) => g.id;
const placeholderOf = (prompt: string) => {const b = prompt.match(/\[[^[\]\r\n]+\]/g); return b?.length === 1 ? b[0] : undefined;};
const recorded = (g: Goal) => {const p = placeholderOf(g.prompt); return p ? g.prompt.replace(p, '').trim() : g.prompt;};

type Sent = {id: string; text: string; goal?: Goal; skill?: string; reply: boolean};
const noop = () => {};
const desktop = () => !window.matchMedia('(max-width: 800px)').matches;

function GuideSteps({goal, request}: {goal: Goal; request?: boolean}) {
 return <>
  <section><h4>Näin etenet</h4><ol>{goal.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></section>
  <section><h4>Mitä saat</h4><p>{goal.what}</p></section>
  <p className="g-honest" data-testid="steps-honest">Ohje, ei agentin edistyminen: Habitat ei tiedä, missä vaiheessa agentti on.</p>
  {request ? <details className="ah-guide-disclosure"><summary>Näytä agentille annettava pyyntö</summary><pre className="ah-guide-prompt" tabIndex={0}>{goal.prompt}</pre></details> : null}
 </>;
}

function GuidePanel({goal, request, onClose}: {goal: Goal; request: boolean; onClose: () => void}) {
 const title = useRef<HTMLHeadingElement>(null);
 return <section className="ah-view-pane g-pane" aria-label={`Opas: ${goal.title}`} data-testid="guide-panel" onKeyDown={e => {if (e.key === 'Escape') onClose();}}>
  <header className="ah-editor-header"><h2 ref={title} tabIndex={-1} className="ah-view-title">Opas</h2>
   <span className="ah-editor-controls"><ControlButton data-testid="guide-panel-close" size="row" variant="quiet" aria-label="Sulje opas" title="Sulje opas" onPress={onClose}><Icon name="cross"/></ControlButton></span></header>
  <div className="g-pane-body"><p className="ah-guide-eyebrow">OPAS · AURINKOPOLKU</p><h3 className="g-pane-title">{goal.title}</h3><GuideSteps goal={goal} request={request}/></div>
 </section>;
}

function GoalCard({dir, goal, onEdit, onClose}: {dir: Dir; goal: Goal; onEdit: () => void; onClose: () => void}) {
 return <section className="g-card" role="dialog" aria-label={`Tavoite: ${goal.title}`} data-testid="goal-card" onKeyDown={e => {if (e.key === 'Escape') onClose();}}>
  <header><div><p className="ah-guide-eyebrow">TAVOITE · <code>/skill:{goalSkill(goal)}</code></p><h3>{goal.title}</h3></div>
   <ControlButton size="row" variant="quiet" presentation="icon" aria-label="Sulje" data-testid="goal-card-close" onPress={onClose}><Icon name="cross"/></ControlButton></header>
  <div className="g-card-body">
   {dir === 1 ? <GuideSteps goal={goal}/> : null}
   <section><h4>Pyyntö agentille</h4><pre className="ah-guide-prompt" tabIndex={0} data-testid="goal-card-request">{recorded(goal)}</pre>
    <p className="g-muted">Agentti saa tämän ohjeen ja sen perään kentän tekstisi.</p></section>
  </div>
  <footer><ControlButton size="row" variant="secondary" data-testid="goal-edit" onPress={onEdit}><Icon name="pencil"/>Muokkaa tekstinä</ControlButton><ControlButton size="row" variant="quiet" onPress={onClose}>Sulje</ControlButton></footer>
 </section>;
}

function Conversation({dir, reloads, onTitle}: {dir: Dir; reloads: number; onTitle: (t: string) => void}) {
 const [draft, setDraft] = useState('');
 const [chip, setChip] = useState<Goal | null>(null);   // A/B: goal attached as a chip
 const [known, setKnown] = useState<Goal | null>(null); // the goal this tab knows about
 const [panel, setPanel] = useState(false);
 const [card, setCard] = useState(false);
 const [sent, setSent] = useState<Sent[]>([]);
 const [width, setWidth] = useState(380);
 const [focusSel, setFocusSel] = useState<[number, number] | null>(null);
 const frame = useRef<HTMLDivElement>(null);
 const hasPanel = dir !== 1;
 // A page reload forgets everything the tab held; only the native history
 // (the sent messages) remains. The panel comes back only when a sent
 // message carries a skill that names a start-page goal.
 useEffect(() => {
  if (!reloads) return;
  setPanel(false); setCard(false); setChip(null); setDraft('');
  const last = [...sent].reverse().find(s => s.skill);
  setKnown(last ? goals.find(g => (dir === 2 ? g.skill : goalSkill(g)) === last.skill) ?? null : null);
 }, [reloads]);
 useEffect(() => {
  if (!focusSel) return;
  const field = frame.current?.querySelector('textarea');
  if (field) {field.focus(); field.setSelectionRange(...focusSel); field.scrollTop = field.scrollHeight;}
  setFocusSel(null);
 }, [focusSel]);
 const start = (goal: StartGoal) => {
  const g = goal as Goal;
  setKnown(g);
  if (hasPanel && desktop()) setPanel(true);
  if (dir === 2) {
   // Production goalDraft, unchanged: the raw request goes into the field.
   const d = goalDraft(g, draft); setDraft(d.text); setFocusSel([d.selectionStart, d.selectionEnd]);
  } else {
   // Only the placeholder (or the person's earlier draft) stays in the field.
   const p = placeholderOf(g.prompt);
   const text = [draft.trim() ? draft.replace(/\n+$/, '') : '', p ?? ''].filter(Boolean).join('\n\n');
   setChip(g); setDraft(text); setCard(false);
   setFocusSel(p ? [text.length - p.length, text.length] : [text.length, text.length]);
  }
 };
 const unwrap = () => {
  if (!chip) return;
  const d = goalDraft({...chip, skill: undefined, prompt: recorded(chip).replace(/\n+$/, '')}, draft);
  setChip(null); setCard(false); setDraft(d.text); setFocusSel([d.text.length, d.text.length]);
 };
 const send = (text = draft) => {
  if (!text.trim() && !chip) return;
  let s: Sent;
  if (chip) s = {id: `m${sent.length}`, text: text.trim(), goal: chip, skill: goalSkill(chip), reply: false};
  else {
   // As Pi records it: a leading /skill:name becomes the native skill wrapper.
   const m = /^\/skill:([a-z0-9-]+)\s*([\s\S]*)$/.exec(text.trim());
   s = {id: `m${sent.length}`, text: m ? m[2] : text.trim(), skill: m?.[1], goal: m ? goals.find(g => g.skill === m[1]) : undefined, reply: false};
  }
  setSent(x => [...x, s]); setDraft(''); setChip(null); setCard(false);
  setTimeout(() => setSent(x => x.map(y => y.id === s.id ? {...y, reply: true} : y)), 700);
 };
 const first = sent[0];
 const title = !first ? 'Uusi keskustelu' : dir !== 2 && first.goal ? first.goal.title : `${first.skill ? `/skill:${first.skill} ` : ''}${first.text}`.slice(0, 60);
 useEffect(() => onTitle(title), [title]);
 const items = sent.flatMap(s => {
  const goal = s.goal;
  const chipNode = s.skill ? <SkillInvocation name={s.skill} description={dir === 2 ? (goal ? `${goal.title} · taito` : undefined) : goal?.title}>
   {dir === 1 && goal ? <div className="g-sheet-steps"><p className="g-muted">Oppaan vaiheet aloitussivulta nyt:</p><GuideSteps goal={goal}/></div> : null}
   <pre className="ah-guide-prompt">{dir === 2 ? `(${s.skill}-taidon oma ohje)` : goal ? recorded(goal) : ''}</pre>
  </SkillInvocation> : undefined;
  const out: {id: string; kind: 'user' | 'assistant'; content: ReactNode}[] = [{id: s.id, kind: 'user', content: <UserMessage sourceText={s.text} skill={chipNode} onCopy={noop}/>}];
  if (s.reply) out.push({id: `${s.id}r`, kind: 'assistant', content: <AssistantMessage onCopy={noop}><Markdown text={goal ? `Selvä. ${goal.steps.find(x => x.startsWith('Agentti')) ?? 'Aloitan.'}\n\n*Synteettinen vastaus: prototyyppi ei kutsu agenttia.*` : 'Selvä.\n\n*Synteettinen vastaus: prototyyppi ei kutsu agenttia.*'}/></AssistantMessage>});
  return out;
 });
 const guideToggle = hasPanel && known ? <ControlButton size="row" variant={panel ? 'secondary' : 'quiet'} className="g-guide-toggle" data-testid="guide-toggle" aria-pressed={panel} aria-label={panel ? 'Piilota opas' : 'Näytä opas'} title={panel ? 'Piilota opas' : `Opas: ${known.title}`} onPress={() => setPanel(!panel)}><Icon name="scroll"/><span className="g-guide-toggle-label">Opas</span></ControlButton> : undefined;
 useEffect(() => {
  if (!card) return;
  const esc = (e: KeyboardEvent) => {if (e.key === 'Escape') setCard(false);};
  window.addEventListener('keydown', esc);
  return () => window.removeEventListener('keydown', esc);
 }, [card]);
 const chipValue = chip ? {title: chip.title, skill: goalSkill(chip), open: card, onOpen: () => setCard(!card), onRemove: () => {setChip(null); setCard(false);}} : null;
 const conversation = <ConversationFrame className="g-frame">
  <AgentHeader title={title} workspaceLabel="aurinkopolku" workspaceHref="#" activityLabel={sent.length ? 'Odottaa sinua' : ''} activityKind="neutral" controlLabel="" detailsExpanded={false} onToggleDetails={noop} terminal={guideToggle}/>
  <ConversationStream>
   <ConversationTimeline state={sent.length ? 'ready' : 'empty'} emptyLabel={<div data-reading-intro><StartHere key={reloads} page={page} state="ready" onRetry={noop} onGoal={start}/></div>} historyMode="pagedAccessible" onJumpToLatest={noop} items={items}/>
  </ConversationStream>
  {chip && card ? <GoalCard dir={dir} goal={chip} onEdit={unwrap} onClose={() => {setCard(false); frame.current?.querySelector('textarea')?.focus();}}/> : null}
  <GoalChipContext.Provider value={chipValue}>
   <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="follow_up" onSendNow={send} onSteer={noop} onFollowUp={noop} onModeChange={noop}
    modelPicker={<span className="md-pill g-model" aria-disabled="true">gpt-5.5 · high</span>}
    sources={{workspaceName: 'aurinkopolku', commands: async () => ({answered_by: 'helper', commands: (dir === 2 ? [{name: 'skill:korjaa', description: 'Korjaa havaittu ongelma'}] : goals.map(g => ({name: `skill:${goalSkill(g)}`, description: g.title}))).map(c => ({...c, source: 'skill' as const, scope: 'project' as const, terminal_only: false}))}), files: async () => ({files: [], truncated: false})}}/>
  </GoalChipContext.Provider>
 </ConversationFrame>;
 return <div ref={frame} className="ah-state g-state">
  <ViewSplit open={hasPanel && panel && !!known} expanded={false} width={width} min={300} max={560} onResize={w => setWidth(Math.min(560, Math.max(300, w)))} onReset={() => setWidth(380)} onShowConversation={noop}
   panel={known ? <GuidePanel goal={known} request={dir === 2 ? false : false} onClose={() => setPanel(false)}/> : null}>
   {conversation}
  </ViewSplit>
 </div>;
}

function Rail({title}: {title: string}) {
 return <WorkspaceRail collapsed={false} serverLabel="habitat.example.test" connectionLabel="Yhdistetty" connectionTone="success" filterValue="" resultSummary="3 työtilaa" listState="ready"
  now={<NowSections yours={[]} running={[{agentId: 'pi:new', title, href: '#', activityLabel: title === 'Uusi keskustelu' ? 'Odottaa viestiä' : 'Odottaa sinua', controlLabel: '', workspaceName: 'aurinkopolku', detail: 'aurinkopolku'}]}/>}
  onToggle={noop} onFilter={noop} onRefresh={noop}>
  <WorkspaceNavRow name="aurinkopolku" href="#" selected/>
  <WorkspaceNavRow name="kotisivu" href="#"/>
  <WorkspaceNavRow name="muistiinpanot" href="#"/>
 </WorkspaceRail>;
}

const params = new URLSearchParams((window as unknown as {protoParams?: string}).protoParams ?? location.search);
const inFrame = params.get('frame') === '1';
const source = document.documentElement.outerHTML;
let reviewTheme = params.get('theme') === 'dark' ? 'dark' : 'light', reviewPhone = false;
document.documentElement.dataset.theme = reviewTheme;
if (inFrame) document.documentElement.classList.add('g-in-frame');

function App({dir}: {dir: Dir}) {
 const [theme, setTheme] = useState(reviewTheme), [phone, setPhone] = useState(reviewPhone), [reloads, setReloads] = useState(0), [title, setTitle] = useState('Uusi keskustelu');
 useEffect(() => {document.documentElement.dataset.theme = theme;}, [theme]);
 const app = <MemoryRouter><AppShell mobileTitle="Uusi keskustelu" rail={<Rail title={title}/>} main={<Conversation key={dir} dir={dir} reloads={reloads} onTitle={setTitle}/>}/></MemoryRouter>;
 if (inFrame) return app;
 // The phone view is this same page at 390 px in a frame, so the production
 // media queries (≤ 800 px) apply as they would on a phone.
 const frameDoc = source.replace('<head>', `<head><script>window.protoParams='frame=1&v=${dir + 1}&theme=${theme}'</script>`);
 return <div className="g-review">
  <header className="g-reviewbar"><strong>Tavoite mukana keskustelussa</strong>
   <label>Teema <select id="theme" value={theme} onChange={e => {reviewTheme = e.target.value; setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
   <label><input id="phone" type="checkbox" checked={phone} onChange={e => {reviewPhone = e.target.checked; setPhone(reviewPhone);}}/> Puhelin 390 px</label>
   {phone ? null : <ControlButton size="row" variant="secondary" data-testid="reload" title="Unohda välilehden muisti; jäljelle jää vain lähetetty historia" onPress={() => setReloads(r => r + 1)}><Icon name="refresh"/>Lataa sivu uudelleen</ControlButton>}
   <span className="g-review-note">Synteettinen. Ei lähetä mitään.</span></header>
  <p className="g-axis" data-testid="axis">{axis[dir]}</p>
  {phone ? <div className="g-phone"><iframe title="Puhelinnäkymä" data-testid="phone-frame" srcDoc={frameDoc} width={390} height={844}/></div> : <div className="g-desktop">{app}</div>}
 </div>;
}

const root = createRoot(document.getElementById('root')!);
const stageSink = {set innerHTML(view: ReactNode) {flushSync(() => root.render(view === '' ? null : view));}};
const variants = directions.map((_, d) => () => <App dir={d as Dir}/>);
if (inFrame) root.render(<App dir={(Math.min(3, Math.max(1, Number(params.get('v')) || 1)) - 1) as Dir}/>);
else {
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((name, i) => {const b = document.createElement('button'); b.className = 'proto-picker-item'; b.textContent = name.replaceAll(' ', ' '); if (i === 0) {b.setAttribute('data-active', ''); b.setAttribute('aria-current', 'true');} picker.append(b);});
const replay = document.createElement('button'); replay.className = 'proto-picker-item proto-picker-replay'; replay.textContent = 'Alusta'; replay.title = 'Aloita suunta alusta (R)';
const divider = document.createElement('span'); divider.className = 'proto-picker-divider'; divider.setAttribute('aria-hidden', 'true');
picker.append(divider, replay);
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
}
