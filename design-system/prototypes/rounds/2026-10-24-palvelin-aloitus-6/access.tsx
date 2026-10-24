import {type ReactNode, useEffect, useRef, useState} from 'react';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';

// Round 6: Settings › Palvelimen ylläpito › Käyttäjät ja pääsy. There are no
// invitations (Jari r2): admission is the list of allowed GitHub usernames, and
// the same tab lists the people who have joined (Jari r4). Admission is the
// root broker's authority, so every change here is a request the server
// confirms; the page never shows a change as in force before that.

export type Direction = 0|1|2;
type State = 'allowed'|'joined'|'removed';
type Pending = 'add'|'remove'|'restore';
export type Person = {
 login: string; name: string; id: number; state: State; pending?: Pending;
 allowedOn: string; unix?: string; joinedOn?: string; seen?: string;
 outcome?: string; outcomeTone?: 'warning'|'info'; removedOn?: string; admin?: boolean;
};

// ---------- Synthetic GitHub directory ----------

type GhUser = {name: string; id: number; type?: 'User'|'Organization'};
const github: Record<string, GhUser> = {
 'kaisa-admin': {name: 'Kaisa Ylläpitäjä', id: 51234000},
 'maija-esim': {name: 'Maija Esimerkki', id: 51234001},
 'teppo-esim': {name: 'Teppo Esimerkki', id: 51234002},
 'northstar-ops': {name: 'Northstar Ops', id: 51234003},
 'ville-vanha': {name: 'Ville Vanhanen', id: 51234004},
 'aino-demo': {name: 'Aino Demo', id: 51234005},
 'lauri-k': {name: 'Lauri Koskinen', id: 51234006},
 'sanna-s': {name: 'Sanna Saarinen', id: 51234007},
 'northstar-demo': {name: 'Northstar Demo', id: 61230001, type: 'Organization'},
};
const today = '24.10.';
const restricted = 'northstar-demo/infra';
export const initialPeople: Person[] = [
 {login: 'kaisa-admin', ...pick('kaisa-admin'), state: 'joined', allowedOn: '18.10.', unix: 'kaisa', joinedOn: '18.10.', seen: 'nyt', outcome: 'Ylläpitäjä', admin: true},
 {login: 'maija-esim', ...pick('maija-esim'), state: 'joined', allowedOn: '20.10.', unix: 'maija', joinedOn: '21.10.', seen: 'tänään 10.12', outcome: '3/3 oletusrepoa haettu'},
 {login: 'teppo-esim', ...pick('teppo-esim'), state: 'joined', allowedOn: '22.10.', unix: 'teppo', joinedOn: '23.10.', seen: 'eilen 16.40', outcome: `2/3 oletusrepoa haettu · ei pääsyä: ${restricted}`, outcomeTone: 'warning'},
 {login: 'aino-demo', ...pick('aino-demo'), state: 'joined', allowedOn: '23.10.', unix: 'aino', joinedOn: today, seen: 'tänään 11.48', outcome: 'kesken, AI-tilin kirjautuminen', outcomeTone: 'info'},
 {login: 'northstar-ops', ...pick('northstar-ops'), state: 'allowed', allowedOn: '22.10.'},
 {login: 'ville-vanha', ...pick('ville-vanha'), state: 'removed', allowedOn: '12.10.', unix: 'ville', joinedOn: '12.10.', seen: '19.10.', removedOn: '20.10.'},
];
function pick(login: string) {const g = github[login]; return {name: g.name, id: g.id};}

// ---------- Validating a GitHub login ----------

/** Accepts @name and a pasted profile URL; GitHub's own login rule otherwise. */
export const normalize = (raw: string) => raw.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/+$/, '').replace(/^@/, '');
const shape = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
type Check =
 | {kind: 'empty'}
 | {kind: 'invalid'|'org'|'not-found'|'dup'; login: string; msg: string}
 | {kind: 'ok'|'restore'; login: string; msg: string; user: GhUser};
export function checkLogin(raw: string, people: Person[], also: string[] = []): Check {
 const login = normalize(raw);
 if (!login) return {kind: 'empty'};
 if (!shape.test(login)) return {kind: 'invalid', login, msg: 'GitHub-tunnuksessa voi olla kirjaimia, numeroita ja yksittäisiä yhdysmerkkejä, enintään 39 merkkiä.'};
 const lower = login.toLowerCase();
 const p = people.find(x => x.login.toLowerCase() === lower);
 if (p?.pending) return {kind: 'dup', login: p.login, msg: `@${p.login}: edellinen muutos odottaa palvelinta.`};
 if (p?.state === 'joined') return {kind: 'dup', login: p.login, msg: `@${p.login} on jo käyttäjä (Unix: ${p.unix}).`};
 if (p?.state === 'allowed') return {kind: 'dup', login: p.login, msg: `@${p.login} on jo sallittu. Hän ei ole vielä kirjautunut.`};
 if (also.some(x => x.toLowerCase() === lower)) return {kind: 'dup', login, msg: `@${login} on listassa jo aiemmin.`};
 const key = Object.keys(github).find(k => k.toLowerCase() === lower);
 const user = key ? github[key] : undefined;
 if (!user) return {kind: 'not-found', login, msg: `GitHub-käyttäjää @${login} ei löydy.`};
 if (user.type === 'Organization') return {kind: 'org', login: key!, msg: `@${key} on organisaatio. Lisää henkilön oma GitHub-tunnus.`};
 if (p?.state === 'removed') return {kind: 'restore', login: p.login, user, msg: `Pääsy poistettiin ${p.removedOn}. Sallimalla hän pääsee taas Unix-tililleen ${p.unix}.`};
 return {kind: 'ok', login: key!, user, msg: 'Löytyi GitHubista.'};
}

// ---------- Server confirmation ----------

/** Admission changes are applied by the root broker, not by the browser. The
 * prototype stands in for its confirmation with a short delay. */
export function useConfirm(setPeople: (f: (p: Person[]) => Person[]) => void) {
 const timers = useRef<number[]>([]);
 useEffect(() => () => timers.current.forEach(clearTimeout), []);
 return (login: string, pending: Pending, done: (p: Person) => Person|null) => {
  setPeople(ps => ps.map(p => p.login === login ? {...p, pending} : p));
  timers.current.push(window.setTimeout(() => setPeople(ps => ps.flatMap(p => {
   if (p.login !== login) return [p];
   const next = done({...p, pending: undefined});
   return next ? [next] : [];
  })), 900));
 };
}

// ---------- Pieces shared by the directions ----------

const Avatar = ({p}: {p: {login: string; name: string}}) => <span className="ua-avatar" aria-hidden="true">{p.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>;
function StateMark({p}: {p: Person}) {
 const id = `person-state-${p.login}`;
 if (p.pending) return <StatusMark data-testid={id} tone="info" animated="running" label={p.pending === 'remove' ? 'Poistetaan · odottaa palvelinta' : p.pending === 'restore' ? 'Palautetaan · odottaa palvelinta' : 'Lisätään · odottaa palvelinta'}/>;
 if (p.state === 'allowed') return <StatusMark data-testid={id} tone="neutral" label="Ei vielä kirjautunut"/>;
 if (p.state === 'removed') return <StatusMark data-testid={id} tone="warning" label="Pääsy poistettu"/>;
 return <StatusMark data-testid={id} tone="success" label={p.admin ? 'Ylläpitäjä' : 'Käyttäjä'}/>;
}
function Facts({p, full = false}: {p: Person; full?: boolean}) {
 const items: ReactNode[] = [];
 if (p.state === 'allowed') items.push(<span key="a">Sallittu {p.allowedOn}</span>);
 if (p.unix) items.push(<span key="u">Unix: <code>{p.unix}</code></span>);
 if (p.joinedOn) items.push(<span key="j">Liittyi {p.joinedOn}</span>);
 if (p.seen) items.push(<span key="s">Viimeksi {p.seen}</span>);
 if (p.state === 'removed') items.push(<span key="r">Pääsy poistettu {p.removedOn}</span>);
 if (full) items.unshift(<span key="id">GitHub-id {p.id}</span>);
 return <span className="ua-facts">{items}</span>;
}
function Outcome({p}: {p: Person}) {
 if (p.state === 'removed') return <span className="ua-outcome" data-testid={`outcome-${p.login}`}><span>Unix-tili <code>{p.unix}</code> ja sen tiedostot ovat yhä palvelimella.</span></span>;
 if (!p.outcome || p.admin) return null;
 return <span className={`ua-outcome${p.outcomeTone ? ` ua-${p.outcomeTone}` : ''}`} data-testid={`outcome-${p.login}`}>{p.outcomeTone === 'warning' && <Icon name="warning" width={14} height={14}/>}<span>Käyttöönotto: {p.outcome}</span></span>;
}

/** The action a row offers. The administrator's own access comes from the
 * server's configuration and is not removable here. */
function RowAction({p, onRemove, onRestore, compact = false}: {p: Person; onRemove: (p: Person) => void; onRestore: (p: Person) => void; compact?: boolean}) {
 if (p.admin) return <span className="muted ua-note" title="Ylläpitäjät määritellään palvelimen asetuksissa">{compact ? 'Palvelimen asetuksista' : 'Ylläpitäjän pääsy tulee palvelimen asetuksista'}</span>;
 if (p.state === 'removed') return <Button data-testid={`restore-${p.login}`} size="row" variant="secondary" isDisabled={!!p.pending} onPress={() => onRestore(p)}>Palauta pääsy</Button>;
 return <Button data-testid={`remove-${p.login}`} size="row" variant="quiet" isDisabled={!!p.pending} aria-label={`Poista @${p.login} sallituista`} onPress={() => onRemove(p)}><Icon name="cross" width={14} height={14}/>{p.state === 'joined' ? 'Poista pääsy' : 'Poista'}</Button>;
}

// ---------- Adding: one login with a GitHub lookup (directions 1 and 2) ----------

function AddLogin({people, onAdd, label = 'Salli GitHub-tunnus'}: {people: Person[]; onAdd: (login: string, user: GhUser, restore: boolean) => void; label?: string}) {
 const [raw, setRaw] = useState('');
 const c = checkLogin(raw, people);
 const can = c.kind === 'ok' || c.kind === 'restore';
 const submit = () => {if (c.kind === 'ok' || c.kind === 'restore') {onAdd(c.login, c.user, c.kind === 'restore'); setRaw('');}};
 return <form className="ua-add" data-testid="add-login" onSubmit={e => {e.preventDefault(); submit();}}>
  <label className="field"><strong>{label}</strong>
   <span className="ua-inline"><span className="ua-at" aria-hidden="true">@</span><input data-testid="login-input" value={raw} autoComplete="off" spellCheck={false} placeholder="github-tunnus tai profiilin osoite" aria-describedby="login-check" onChange={e => setRaw(e.target.value)}/>
    <Button data-testid="login-add" size="row" variant="primary" isDisabled={!can} onPress={submit}>{c.kind === 'restore' ? 'Palauta pääsy' : 'Salli'}</Button></span></label>
  <div id="login-check" className="ua-check" data-testid="login-check" data-kind={c.kind} aria-live="polite">
   {c.kind === 'empty' ? <span className="muted">Kirjoita GitHub-tunnus. Pääsy sidotaan GitHub-tilin numeroon, joten tunnuksen vaihto ei vie sitä.</span>
    : c.kind === 'ok' || c.kind === 'restore' ? <span className="ua-found"><Avatar p={{login: c.login, name: c.user.name}}/><span><strong>{c.user.name}</strong> <span className="muted">@{c.login} · GitHub-id {c.user.id}</span><br/><span className="muted">{c.msg}</span></span></span>
    : <span className={c.kind === 'dup' ? 'ua-dup' : 'ua-bad'}><Icon name={c.kind === 'dup' ? 'info' : 'warning'} width={14} height={14}/>{c.msg}</span>}
  </div>
 </form>;
}

// ---------- Adding: several logins at once (direction 3) ----------

function AddMany({people, theme, onAdd, onClose}: {people: Person[]; theme: string; onAdd: (items: {login: string; user: GhUser; restore: boolean}[]) => void; onClose: () => void}) {
 const [text, setText] = useState('');
 const lines = text.split(/[\s,]+/).map(normalize).filter(Boolean);
 const results = lines.map((l, i) => checkLogin(l, people, lines.slice(0, i)));
 const good = results.filter((r): r is Extract<Check, {user: GhUser}> => r.kind === 'ok' || r.kind === 'restore');
 return <ModalOverlay className="ah-overlay rp-overlay" isOpen isDismissable onOpenChange={o => !o && onClose()}><Modal className="ah-modal rp-modal" data-theme={theme}><Dialog className="ah-dialog rp-dialog ua-dialog" aria-label="Salli GitHub-tunnuksia">
  <Heading slot="title">Salli GitHub-tunnuksia</Heading>
  <label className="field"><strong>Tunnukset</strong><textarea data-testid="add-lines" rows={4} value={text} spellCheck={false} placeholder={'lauri-k\n@sanna-s\nhttps://github.com/…'} onChange={e => setText(e.target.value)}/></label>
  <p className="muted">Yksi tai useampi, rivinvaihdoin tai pilkuin erotettuna. Jokainen tarkistetaan GitHubista.</p>
  {results.length > 0 && <ul className="ua-results" data-testid="add-results">{results.map((r, i) => r.kind === 'empty' ? null : <li key={i} data-kind={r.kind} data-testid={`add-result-${r.login}`}>
   <code>@{r.login}</code>{r.kind === 'ok' || r.kind === 'restore' ? <span><Icon name="check" width={14} height={14}/>{r.user.name} · GitHub-id {r.user.id}{r.kind === 'restore' && <> · {r.msg}</>}</span> : <span className={r.kind === 'dup' ? 'ua-dup' : 'ua-bad'}>{r.msg}</span>}</li>)}</ul>}
  <div className="rp-foot"><Button size="page" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="add-submit" size="page" variant="primary" isDisabled={!good.length} onPress={() => {onAdd(good.map(g => ({login: g.login, user: g.user, restore: g.kind === 'restore'}))); onClose();}}>{good.length ? `Salli ${good.length} ${good.length === 1 ? 'tunnus' : 'tunnusta'}` : 'Salli'}</Button></div>
 </Dialog></Modal></ModalOverlay>;
}

// ---------- Removing ----------

function RemoveDialog({p, theme, onConfirm, onClose}: {p: Person; theme: string; onConfirm: () => void; onClose: () => void}) {
 const joined = p.state === 'joined';
 return <ModalOverlay className="ah-overlay rp-overlay" isOpen isDismissable onOpenChange={o => !o && onClose()}><Modal className="ah-modal rp-modal ua-confirm" data-theme={theme}><Dialog className="ah-dialog rp-dialog" aria-label={joined ? `Poista @${p.login} pääsy` : `Poista @${p.login} sallituista`} data-testid="remove-dialog">
  <Heading slot="title">{joined ? `Poista @${p.login} pääsy?` : `Poista @${p.login} sallituista?`}</Heading>
  {joined ? <ul className="ua-consequences" data-testid="remove-consequences">
   <li><Icon name="cross" width={14} height={14}/><span>{p.name} ei voi enää kirjautua. Avoimet selainistunnot päättyvät, kun palvelin on vahvistanut muutoksen.</span></li>
   <li><Icon name="lock" width={14} height={14}/><span>Unix-käyttäjä <code>{p.unix}</code>, kotihakemisto, työtilat ja tunnukset jäävät palvelimelle. Selaimesta niitä ei poisteta.</span></li>
   <li><Icon name="terminal" width={14} height={14}/><span>Tilin poisto ja muut tarkemmat toimet tehdään palvelimella komentorivillä.</span></li>
  </ul> : <p>Unix-käyttäjää ei ole luotu, koska @{p.login} ei ole kirjautunut. Hän ei voi enää kirjautua.</p>}
  <div className="rp-foot"><Button size="page" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="confirm-remove" size="page" variant="danger" onPress={() => {onConfirm(); onClose();}}>{joined ? 'Poista pääsy' : 'Poista'}</Button></div>
 </Dialog></Modal></ModalOverlay>;
}

// ---------- The directions ----------

function PersonRow({p, onRemove, onRestore}: {p: Person; onRemove: (p: Person) => void; onRestore: (p: Person) => void}) {
 return <li className={`ua-row ua-${p.state}`} data-testid={`person-${p.login}`} data-state={p.state} data-pending={p.pending}>
  <Avatar p={p}/>
  <span className="ua-main"><span className="ua-who"><strong>@{p.login}</strong><span className="muted">{p.name}</span><StateMark p={p}/></span><Facts p={p}/><Outcome p={p}/></span>
  <span className="ua-act"><RowAction p={p} onRemove={onRemove} onRestore={onRestore}/></span>
 </li>;
}

type Filter = 'all'|'joined'|'allowed'|'removed';
function OneList({people, onAdd, onRemove, onRestore}: Ops) {
 const [filter, setFilter] = useState<Filter>('all');
 const n = (s: State) => people.filter(p => p.state === s).length;
 const shown = people.filter(p => filter === 'all' || p.state === filter);
 return <>
  <div className="s-card ua-card"><AddLogin people={people} onAdd={onAdd}/></div>
  <div className="ua-listhead"><h3>Henkilöt <span className="muted">{people.length}</span></h3>
   <Segmented data-testid="filter" label="Näytä" size="row" value={filter} onChange={setFilter} options={[{id: 'all', label: 'Kaikki'}, {id: 'joined', label: `Liittyneet ${n('joined')}`}, {id: 'allowed', label: `Ei kirjautuneet ${n('allowed')}`}, {id: 'removed', label: `Poistetut ${n('removed')}`}]}/></div>
  <ul className="s-card ua-list" data-testid="people">{shown.map(p => <PersonRow key={p.login} p={p} onRemove={onRemove} onRestore={onRestore}/>)}{!shown.length && <li className="ua-empty muted">Ei henkilöitä tässä näkymässä.</li>}</ul>
 </>;
}

function TwoLists({people, onAdd, onRemove, onRestore}: Ops) {
 const waiting = people.filter(p => p.state === 'allowed');
 const joined = people.filter(p => p.state === 'joined');
 const removed = people.filter(p => p.state === 'removed');
 return <>
  <section className="ua-section" data-testid="section-allowed"><h3>Sallitut, eivät vielä kirjautuneet <span className="muted">{waiting.length}</span></h3>
   <p className="muted">Unix-käyttäjä luodaan, kun henkilö kirjautuu ensimmäisen kerran.</p>
   <div className="s-card ua-card">{waiting.length > 0 && <ul className="ua-list ua-plain" data-testid="people-allowed">{waiting.map(p => <PersonRow key={p.login} p={p} onRemove={onRemove} onRestore={onRestore}/>)}</ul>}<AddLogin people={people} onAdd={onAdd} label="Lisää GitHub-tunnus"/></div></section>
  <section className="ua-section" data-testid="section-joined"><h3>Käyttäjät <span className="muted">{joined.length}</span></h3>
   <ul className="s-card ua-list" data-testid="people-joined">{joined.map(p => <PersonRow key={p.login} p={p} onRemove={onRemove} onRestore={onRestore}/>)}</ul></section>
  {removed.length > 0 && <section className="ua-section" data-testid="section-removed"><h3>Pääsy poistettu <span className="muted">{removed.length}</span></h3>
   <p className="muted">Nämä henkilöt eivät voi kirjautua. Heidän Unix-tilinsä ovat yhä palvelimella; tilin poisto tehdään komentorivillä.</p>
   <ul className="s-card ua-list" data-testid="people-removed">{removed.map(p => <PersonRow key={p.login} p={p} onRemove={onRemove} onRestore={onRestore}/>)}</ul></section>}
 </>;
}

function Detail({p, onRemove, onRestore, onBack}: {p: Person; onRemove: (p: Person) => void; onRestore: (p: Person) => void; onBack: () => void}) {
 return <section className="s-card ua-detail" data-testid="detail" aria-label={`@${p.login}`}>
  <button type="button" className="ua-back" data-testid="detail-back" onClick={onBack}><Icon name="back" width={14} height={14}/>Kaikki henkilöt</button>
  <header className="ua-dhead"><Avatar p={p}/><div><h3>@{p.login}</h3><p className="muted">{p.name}</p></div><StateMark p={p}/></header>
  <dl className="ua-dl">
   <dt>GitHub-id</dt><dd>{p.id}</dd>
   <dt>Unix-käyttäjä</dt><dd>{p.unix ? <code>{p.unix}</code> : <span className="muted">Luodaan ensimmäisellä kirjautumisella</span>}</dd>
   <dt>Sallittu</dt><dd>{p.allowedOn}</dd>
   {p.joinedOn && <><dt>Liittyi</dt><dd>{p.joinedOn}</dd></>}
   {p.seen && <><dt>Viimeksi nähty</dt><dd>{p.seen}</dd></>}
   {p.removedOn && <><dt>Pääsy poistettu</dt><dd>{p.removedOn}</dd></>}
   {p.outcome && !p.admin && <><dt>Käyttöönotto</dt><dd className={p.outcomeTone === 'warning' ? 'ua-warning' : undefined}>{p.outcome}</dd></>}
  </dl>
  {(p.state === 'joined' || p.state === 'removed') && !p.admin && <p className="ua-cli" data-testid="detail-cli"><Icon name="terminal" width={14} height={14}/><span>Unix-tilin poisto ja muut tarkemmat toimet tehdään palvelimella komentorivillä.</span></p>}
  <div className="ua-dact"><RowAction p={p} onRemove={onRemove} onRestore={onRestore}/></div>
 </section>;
}
function MasterDetail({people, onAddMany, onRemove, onRestore, theme}: Ops & {onAddMany: (items: {login: string; user: GhUser; restore: boolean}[]) => void; theme: string}) {
 const [open, setOpen] = useState<string|null>(null), [adding, setAdding] = useState(false);
 const sel = people.find(p => p.login === open);
 return <>
  <div className="ua-listhead"><h3>Henkilöt <span className="muted">{people.length}</span></h3><Button data-testid="add-open" size="row" variant="secondary" onPress={() => setAdding(true)}><Icon name="plus" width={14} height={14}/>Salli GitHub-tunnuksia…</Button></div>
  <div className={`ua-md${sel ? ' has-detail' : ''}`}>
   <ul className="s-card ua-list ua-compact" data-testid="people">{people.map(p => <li key={p.login} className={`ua-row ua-${p.state}`} data-testid={`person-${p.login}`} data-state={p.state} data-pending={p.pending}>
    <button type="button" className="ua-open" data-testid={`open-${p.login}`} aria-current={open === p.login ? 'true' : undefined} onClick={() => setOpen(p.login)}><Avatar p={p}/><span className="ua-main"><span className="ua-who"><strong>@{p.login}</strong><StateMark p={p}/></span><span className="ua-facts">{p.unix ? <span>Unix: <code>{p.unix}</code></span> : <span>Sallittu {p.allowedOn}</span>}{p.outcomeTone === 'warning' && <span className="ua-warning"><Icon name="warning" width={12} height={12}/>Oletusrepo puuttuu</span>}</span></span><Icon name="forward" width={14} height={14}/></button></li>)}</ul>
   {sel ? <Detail p={sel} onRemove={onRemove} onRestore={onRestore} onBack={() => setOpen(null)}/> : <div className="s-card ua-detail ua-placeholder muted">Valitse henkilö nähdäksesi tiedot ja toiminnot.</div>}
  </div>
  {adding && <AddMany people={people} theme={theme} onAdd={onAddMany} onClose={() => setAdding(false)}/>}
 </>;
}

type Ops = {people: Person[]; onAdd: (login: string, user: GhUser, restore: boolean) => void; onRemove: (p: Person) => void; onRestore: (p: Person) => void};

export function UsersTab({direction, people, setPeople, theme}: {direction: Direction; people: Person[]; setPeople: (f: (p: Person[]) => Person[]) => void; theme: string}) {
 const confirm = useConfirm(setPeople);
 const [removing, setRemoving] = useState<Person|null>(null);
 const add = (login: string, user: GhUser, restore: boolean) => {
  if (restore) {confirm(login, 'restore', p => ({...p, state: 'joined', removedOn: undefined})); return;}
  setPeople(ps => [...ps, {login, name: user.name, id: user.id, state: 'allowed', allowedOn: today}]);
  confirm(login, 'add', p => p);
 };
 const remove = (p: Person) => confirm(p.login, 'remove', x => x.state === 'joined' ? {...x, state: 'removed', removedOn: today} : null);
 const restore = (p: Person) => add(p.login, github[p.login], true);
 const ops = {people, onAdd: add, onRemove: (p: Person) => setRemoving(p), onRestore: restore};
 return <div className={`users variant-${direction}`} data-testid="users-tab">
  <div className="tab-head"><div><h2>Käyttäjät ja pääsy</h2><p className="lede">Vain sallitut GitHub-tunnukset voivat kirjautua. Ensimmäisellä kirjautumisella henkilölle luodaan oma Unix-käyttäjä.</p></div></div>
  <p className="ua-authority" data-testid="authority"><Icon name="server" width={16} height={16}/><span>Palvelin tekee pääsymuutokset. Selain lähettää pyynnön, ja muutos on voimassa, kun palvelin on vahvistanut sen. Unix-tilin poisto ja muut tarkemmat toimet tehdään komentorivillä.</span></p>
  {direction === 0 ? <OneList {...ops}/> : direction === 1 ? <TwoLists {...ops}/> : <MasterDetail {...ops} theme={theme} onAddMany={items => items.forEach(i => add(i.login, i.user, i.restore))}/>}
  {removing && <RemoveDialog p={removing} theme={theme} onConfirm={() => remove(removing)} onClose={() => setRemoving(null)}/>}
 </div>;
}
