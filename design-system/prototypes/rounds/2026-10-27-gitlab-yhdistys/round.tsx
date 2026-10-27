import React, {type ReactNode, useEffect, useId, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton, ExternalLink, LinkRow, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {LetterMark} from '../../../../web/src/components/Integrations';
import {GiteaCard} from '../../../../web/src/components/GiteaConnection';
import {StatusMark} from '../../../../web/src/components/Status';
import {giteaAddress, type GiteaConnection} from '../../../../web/src/app/gitea';
import {sectionLimit, type Since, sinceChoices, size, when} from '../../../../web/src/components/repoCatalog';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import '../../../../web/src/components/ClonePage.css';
import './round.css';

// GitLab in Asetukset › Koodipalvelut and in Uusi työtila's common list
// (research-gitlab-integration, recommendation A: glab's config.yml is the
// only store, a PAT with read_api + write_repository). The connect form is
// the approved Gitea form with its error at the top (connect-riff round 2);
// the list is the approved common list of the production chooser
// (workspace-import round 3). The axis is what GitLab adds to that list:
// nested group paths. Everything below the picker is the same in every
// direction except how the list arranges a path like
// konepaja/verkkokauppa/infra/terraform. All data is synthetic.
const directions = ['Koko polku', 'Pääryhmä', 'Ryhmäsuodatin'];
const NOW = Date.parse('2026-10-27T10:00:00+02:00');
const DAY = 86400000;

// ---------- What GitLab and the daemon would say ----------

type Push = 'yes' | 'no' | 'unknown';
/** One glab hosts entry: glab keeps one account per server. */
type GL = {
 host: string; user: string;
 token: 'pat' | 'fine';
 scopes: string[];
 /** GET /personal_access_tokens/self: expires_at. */
 expires: string;
 state: 'ok' | 'expired';
 push: Push;
 /** Projects whose http_url_to_repo is not under the connected address. */
 excluded?: {count: number; url: string};
};
type Outcome = 'ok' | 'readonly' | 'api' | 'fine' | 'excluded' | 'rejected' | 'expired' | 'noscope' | 'notgitlab' | 'tls' | 'unreachable';
const outcomes: Record<Outcome, string> = {
 ok: 'Onnistuu: read_api + write_repository',
 readonly: 'Onnistuu: vain read_api (push ei)',
 api: 'Onnistuu: api-oikeus',
 fine: 'Onnistuu: hienojakoinen tunnus',
 excluded: 'Onnistuu, mutta external_url väärin',
 rejected: 'Tunnus hylätty',
 expired: 'Tunnus vanhentunut',
 noscope: 'Tunnukselta puuttuu read_api',
 notgitlab: 'Osoitteessa ei ole GitLabia',
 tls: 'Varmenne ei kelpaa',
 unreachable: 'Palvelin ei vastaa',
};
type FormError = {field: 'server' | 'token' | 'form'; text: string};
const refusals: Partial<Record<Outcome, FormError>> = {
 rejected: {field: 'token', text: 'GitLab hylkäsi tunnuksen. Se voi olla peruttu tai kopioitu vajaana.'},
 expired: {field: 'token', text: 'Tunnus on vanhentunut. Luo GitLabissa uusi tunnus ja liitä se tähän.'},
 noscope: {field: 'token', text: 'Tunnukselta puuttuu read_api-oikeus, joten Habitat ei näe projektejasi. Luo tunnus oikeuksilla read_api ja write_repository.'},
 notgitlab: {field: 'server', text: 'Osoitteesta ei vastannut GitLab. Anna sama osoite, jolla avaat GitLabin selaimessa, esimerkiksi https://gitlab.yritys.fi.'},
 tls: {field: 'server', text: 'Palvelimen varmennetta ei voitu tarkistaa, eikä Habitat ohita tarkistusta. Jos GitLab käyttää yrityksen omaa varmentajaa, tämän palvelimen ylläpitäjä voi lisätä sen luotettaviin.'},
 unreachable: {field: 'server', text: 'Palvelin ei vastaa. Tarkista osoite. Jos GitLab on yrityksen sisäverkossa, tämän palvelimen ylläpitäjän pitää sallia yhteys sinne.'},
};
const date = (iso: string) => {const d = new Date(iso); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;};
const daysLeft = (iso: string) => Math.ceil((Date.parse(iso) - NOW) / DAY);
const tokenPage = (base: string) => `${base}/-/user_settings/personal_access_tokens?name=Open+Habitat&scopes=read_api,write_repository`;
const hostOf = (base: string) => base.replace(/^https:\/\//, '').replace(/\/$/, '');
function validAddress(v: string) {
 if (!/^https:\/\//i.test(v) || /[\s\\]/.test(v)) return false;
 try {const u = new URL(v); return !!u.hostname && !u.username && !u.password && !u.search && !u.hash;} catch {return false;}
}
function connectAs(host: string, o: Outcome, user = host === 'gitlab.com' ? 'aino.virtanen' : 'aino'): GL {
 const scopes = o === 'readonly' ? ['read_api'] : o === 'api' ? ['api'] : o === 'fine' ? [] : ['read_api', 'write_repository'];
 return {host, user, token: o === 'fine' ? 'fine' : 'pat', scopes, expires: o === 'fine' ? '2027-01-25' : '2027-10-27', state: 'ok',
  push: o === 'readonly' ? 'no' : o === 'fine' ? 'unknown' : 'yes',
  excluded: o === 'excluded' ? {count: 3, url: `http://gitlab.internal/…`} : undefined};
}

// ---------- Synthetic person ----------

type Src = {kind: 'github'} | {kind: 'gitea'; label: string; login: string} | {kind: 'gitlab'; host: string};
type Repo = {
 src: Src; path: string; private: boolean;
 visibility?: 'private' | 'internal' | 'public';
 description: string; pushed_at: string | null;
 /** GitLab gives statistics only with at least Reporter access. */
 size_kib: number | null;
 default_branch: string | null;
 archived?: boolean; empty?: boolean;
 /** GitLab namespace.kind = user. */
 personal?: boolean;
 /** The top-level group enforces SSO for Git (gitlab.com SAML). */
 sso?: boolean;
};
const srcKey = (s: Src) => s.kind === 'github' ? 'github' : s.kind === 'gitea' ? `gitea:${s.label}` : `gitlab:${s.host}`;
const srcLabel = (s: Src) => s.kind === 'github' ? 'github.com' : s.kind === 'gitea' ? s.label : s.host;
const keyOf = (r: Repo) => `${srcKey(r.src)}/${r.path}`;
const nameOf = (r: Repo) => r.path.split('/').pop()!;
const nsOf = (r: Repo) => r.path.split('/').slice(0, -1).join('/');
const ago = (h: number) => new Date(NOW - h * 3600000).toISOString();
const GH: Src = {kind: 'github'}, GT: Src = {kind: 'gitea', label: 'git.koti.example', login: 'esimerkki'};
const COM: Src = {kind: 'gitlab', host: 'gitlab.com'}, OWN: Src = {kind: 'gitlab', host: 'gitlab.yritys.fi'};
const p = (src: Src, path: string, h: number, kib: number | null, description = '', more: Partial<Repo> = {}): Repo =>
 ({src, path, private: true, visibility: 'private', description, pushed_at: ago(h), size_kib: kib, default_branch: 'main', ...more});
const githubRepos = [
 p(GH, 'esimerkki/notes', 20, 820, 'Muistiinpanot'),
 p(GH, 'esimerkki/blogi', 400, 15400, 'Henkilökohtainen blogi', {private: false, visibility: 'public'}),
 p(GH, 'esimerkki-org/habitat-plugin', 30, 2100, 'Pi-laajennus'),
];
const giteaRepos = [
 p(GT, 'esimerkki/notes', 300, 640, 'Muistiinpanot kotipalvelimella'),
 p(GT, 'esimerkki/kotiautomaatio', 50, 3300, 'Home Assistantin asetukset'),
];
const comRepos = [
 p(COM, 'aino.virtanen/dotfiles', 5, 180, 'Shell- ja editoriasetukset', {personal: true}),
 p(COM, 'aino.virtanen/notes', 100, 90, 'Työmuistiinpanot', {personal: true}),
 p(COM, 'konepaja/verkkokauppa/api', 2, 48200, 'Verkkokaupan REST-rajapinta'),
 p(COM, 'konepaja/verkkokauppa/web', 7, 96300, 'Kaupan käyttöliittymä (Next.js)'),
 p(COM, 'konepaja/verkkokauppa/infra/terraform', 26, 2900, 'Pilvi-infra', {visibility: 'internal'}),
 p(COM, 'konepaja/verkkokauppa/infra/ansible', 190, 1200, 'Palvelinten asennus', {visibility: 'internal', size_kib: null}),
 p(COM, 'konepaja/sisainen/wiki', 70, 5100, 'Talon käytännöt', {visibility: 'internal'}),
 p(COM, 'konepaja/sisainen/uusi-palvelu', 30, 0, 'Aloitettu, ei vielä committeja', {empty: true, pushed_at: null, default_branch: null}),
 p(COM, 'konepaja/asiakkaat/kauppa-oy/kassajarjestelma', 50, 210000, 'Kassajärjestelmän taustapalvelu'),
 p(COM, 'konepaja/asiakkaat/kauppa-oy/raportointi', 600, 8800, 'Myyntiraportit', {size_kib: null}),
 p(COM, 'konepaja/asiakkaat/rakennus-ab/tyomaa-app', 140, 33100, 'Työmaapäiväkirja mobiilisovelluksena'),
 p(COM, 'konepaja/vanhat/intranet-2019', 9000, 41000, 'Vanha intranet', {archived: true}),
 p(COM, 'pankki-oy/digi/mobiilisovellus', 9, 120500, 'Asiakkaan mobiilipankki', {sso: true}),
 p(COM, 'pankki-oy/digi/tunnistus-sdk', 80, 6400, 'Vahvan tunnistuksen SDK', {sso: true, size_kib: null}),
];
const ownRepos = [
 p(OWN, 'tuotanto/backend/laskutus', 12, 18800, 'Laskutuspalvelu'),
 p(OWN, 'tuotanto/backend/integraatiot/sap-silta', 160, 4200, 'SAP-integraatio'),
 p(OWN, 'tuotanto/frontend/asiakasportaali', 40, 61000, 'Asiakasportaali'),
 p(OWN, 'tiimi/tyokalut/ci-skriptit', 900, 300, 'Yhteiset CI-skriptit', {visibility: 'internal'}),
];
const reposFor = (g: GL) => g.host === 'gitlab.com' ? comRepos : g.host === 'gitlab.yritys.fi' ? ownRepos
 : ownRepos.map(r => ({...r, src: {kind: 'gitlab', host: g.host} as Src}));

type Scenario = 'none' | 'com' | 'own' | 'expired';
const scenarios: Record<Scenario, {label: string; hint: string; gitlab: GL[]}> = {
 none: {label: 'Ei GitLabia', hint: 'GitHub ja oma Gitea ovat yhdistetty. Yhdistä GitLab Koodipalveluissa; Koetilanne valitsee, mitä GitLab vastaa.', gitlab: []},
 com: {label: 'gitlab.com', hint: 'gitlab.com yhdistetty. Ryhmä pankki-oy vaatii SSO-istunnon Gitille: sen kloonaus epäonnistuu.', gitlab: [connectAs('gitlab.com', 'ok')]},
 own: {label: 'Myös oma GitLab', hint: 'Lisäksi gitlab.yritys.fi hienojakoisella tunnuksella, joka vanhenee 9 päivän päästä, ja väärä external_url.', gitlab: [connectAs('gitlab.com', 'ok'), {...connectAs('gitlab.yritys.fi', 'fine'), expires: '2026-11-05', excluded: {count: 3, url: 'http://gitlab.internal/…'}}]},
 expired: {label: 'Tunnus vanhentunut', hint: 'gitlab.comin tunnus vanheni 20.10. Lista ei näytä sen projekteja, ja tuodut työtilat eivät synkronoi.', gitlab: [{...connectAs('gitlab.com', 'ok'), state: 'expired', expires: '2026-10-20'}]},
};
type WS = {name: string; repo: string; src: Src};
const initialWorkspaces = (s: Scenario): WS[] => [
 {name: 'notes', repo: 'esimerkki/notes', src: GH},
 {name: 'kotiautomaatio', repo: 'esimerkki/kotiautomaatio', src: GT},
 ...(s === 'none' ? [] : [{name: 'api', repo: 'konepaja/verkkokauppa/api', src: COM}]),
];
const gitea: GiteaConnection = {id: 'tea-1', base_url: 'https://git.koti.example', user: 'esimerkki', kind: 'pat', owned: true, ambiguous: false, git: 'registered'};

// ---------- Asetukset › Koodipalvelut: the GitLab card ----------

function GitLabCard({c, check, onCheck, onReplace, onDisconnect}: {c: GL; check?: string; onCheck: () => void; onReplace: () => void; onDisconnect: () => void}) {
 const left = daysLeft(c.expires), expired = c.state === 'expired', soon = !expired && left <= 30;
 const gitText = expired
  ? `GitLab ei enää hyväksy tunnusta, joten pull ja push eivät onnistu ennen kuin vaihdat sen. Paikallinen työ jatkuu.`
  : c.push === 'yes' ? 'Kloonaus, pull ja push käyttävät tätä tunnusta. Myös agenttisi voivat käyttää sitä.'
  : c.push === 'no' ? 'Kloonaus ja pull käyttävät tätä tunnusta. Push ei onnistu: tunnukselta puuttuu write_repository.'
  : 'Kloonaus ja pull käyttävät tätä tunnusta. Hienojakoisesta tunnuksesta ei näe, saako sillä pushata; se selviää ensimmäisellä pushilla.';
 const scopeText = c.token === 'fine' ? 'Hienojakoinen tunnus' : c.scopes.join(', ');
 return <article className="ig-card" data-testid="gitlab-connection" data-host={c.host} data-state={c.state} data-push={c.push} aria-label={`GitLab · ${c.user} · ${c.host}`}>
  <div className="ig-acc">
   <LetterMark mark="GL" tone={2}/>
   <div><span className="ig-rn">GitLab</span><span className="ig-meta ah-mono">{c.user} · {c.host}</span></div>
   <ControlButton data-testid="gitlab-check" size="row" variant="quiet" onPress={onCheck}><Icon name="refresh"/>Tarkista</ControlButton>
   <ControlButton data-testid="gitlab-replace" size="row" variant="quiet" onPress={onReplace}>Vaihda tunnus…</ControlButton>
   <ControlButton data-testid="gitlab-disconnect-open" size="row" variant="quiet" onPress={onDisconnect}>Irrota…</ControlButton>
  </div>
  <div className="ig-svc" data-testid="gitlab-git">
   <span className="ig-ic sm"><Icon name="branch"/></span>
   <div><span className="ig-rn">Git-repot</span><span className={`ig-meta${expired ? ' ig-bad' : ''}`}>{gitText}</span></div>
   <div className="ig-sv">
    {expired ? <StatusMark label="Ei toimi" kind="error" tone="danger"/>
     : c.push === 'yes' ? <StatusMark data-testid="gitlab-push" label="Push toimii" kind="success" tone="success"/>
     : c.push === 'no' ? <StatusMark data-testid="gitlab-push" label="Vain luku" tone="warning"/>
     : <StatusMark data-testid="gitlab-push" label="Push ei tiedossa" kind="unknown" tone="warning"/>}
    {check ? <span className={`ig-meta${check === 'Tunnus toimii' ? '' : ' ig-bad'}`} data-testid="gitlab-check-result">{check}</span> : null}
   </div>
  </div>
  <div className="ig-svc" data-testid="gitlab-token" data-soon={soon ? '' : undefined}>
   <span className="ig-ic sm"><Icon name="key"/></span>
   <div>
    <span className="ig-rn">Pääsytunnus</span>
    <span className="ig-meta"><span className="ah-mono">{scopeText}</span> · {expired ? `vanheni ${date(c.expires)}` : `voimassa ${date(c.expires)} asti`}</span>
    {soon ? <span className="ig-meta gl-soon">Luo GitLabissa uusi tunnus ja vaihda se tähän ennen {date(c.expires)}, niin kloonit eivät lakkaa toimimasta.</span> : null}
    {c.scopes.includes('api') ? <span className="ig-meta" data-testid="gitlab-api-note">Tunnuksella on api-oikeus: agenttisi voivat glabilla myös muuttaa GitLabissa merge requesteja, issueita ja asetuksia sinun nimissäsi.</span> : null}
    {soon || expired ? <ControlButton data-testid="gitlab-renew" size="row" variant="secondary" onPress={onReplace}>Vaihda tunnus…</ControlButton> : null}
   </div>
   <div className="ig-sv">
    {expired ? <StatusMark label="Vanhentunut" kind="error" tone="danger"/>
     : soon ? <StatusMark label={`Vanhenee ${left} pv:n päästä`} tone="warning"/>
     : <StatusMark label="Voimassa" kind="success" tone="success"/>}
   </div>
  </div>
  {c.excluded ? <p className="ig-notice" role="status" data-testid="gitlab-excluded"><Icon name="warning"/><span>
   {c.excluded.count} projektia ei näy repolistassa. GitLab ilmoittaa niiden osoitteeksi <span className="ah-mono">{c.excluded.url}</span>, joka ei ole yhdistämäsi <span className="ah-mono">https://{c.host}</span>, eikä Habitat lähetä tunnusta muualle. GitLabin ylläpitäjän pitää korjata palvelimen <span className="ah-mono">external_url</span>-asetus.
  </span></p> : null}
 </article>;
}

// ---------- The connect dialog: the Gitea form with GitLab's facts ----------

type Stage = {stage: 'form'; error?: FormError; busy?: boolean} | {stage: 'done'; c: GL; replaced?: boolean; projects: number};

function GitLabDialog({replace, stage, taken, theme, onSubmit, onClose, onNewWorkspace}: {
 replace?: GL; stage: Stage; taken: GL[]; theme: string;
 onSubmit: (base: string, token: string, local?: FormError) => void; onClose: () => void; onNewWorkspace: () => void;
}) {
 const [address, setAddress] = useState('https://gitlab.com');
 const [token, setToken] = useState('');
 const [reveal, setReveal] = useState(false), [help, setHelp] = useState(false);
 const [local, setLocal] = useState<FormError>();
 const heading = useRef<HTMLHeadingElement>(null), errorRef = useRef<HTMLDivElement>(null), errorId = useId();
 const busy = stage.stage === 'form' && !!stage.busy;
 const error = local ?? (stage.stage === 'form' ? stage.error : undefined);
 useEffect(() => {if (stage.stage !== 'form') setToken('');}, [stage.stage]);
 useEffect(() => {heading.current?.focus();}, [stage.stage]);
 useEffect(() => {if (error) errorRef.current?.focus({preventScroll: true});}, [error]);
 const base = replace ? `https://${replace.host}` : giteaAddress(address).replace(/\/$/, '');
 const submit = () => {
  if (busy) return;
  if (!replace) setAddress(base);
  if (!replace && !validAddress(base)) {setLocal({field: 'server', text: 'Anna GitLabin HTTPS-osoite, esimerkiksi https://gitlab.com tai https://gitlab.yritys.fi.'}); return;}
  const same = !replace && taken.find(g => g.host === hostOf(base));
  if (same) {setLocal({field: 'server', text: `Palvelimella ${same.host} on jo yhdistetty tili ${same.user}. glab pitää yhden tilin palvelinta kohden: vaihda sen tunnus tai irrota se ensin.`}); return;}
  if (!token.trim()) {setLocal({field: 'token', text: 'Anna pääsytunnus.'}); return;}
  setLocal(undefined);
  onSubmit(base, token.trim());
 };
 const invalid = (f: FormError['field']) => error?.field === f ? {'aria-invalid': true as const, 'aria-describedby': errorId} : {};
 const title = stage.stage === 'done' ? (stage.replaced ? 'Tunnus vaihdettu' : 'Tili yhdistetty') : replace ? 'Vaihda GitLabin pääsytunnus' : 'Yhdistä GitLab';
 const createLink = validAddress(base)
  ? <ExternalLink data-testid="gitlab-token-link" href={tokenPage(base)} target="_blank" rel="noreferrer">Luo tunnus GitLabissa <Icon name="external" width={13} height={13}/></ExternalLink>
  : <span className="ig-meta" data-testid="gitlab-token-link-missing">Anna ensin osoite, niin linkki avaa sen GitLabin tunnussivun.</span>;
 let body: ReactNode, foot: ReactNode;
 if (stage.stage === 'done') {
  const c = stage.c;
  body = <>
   <p className="ig-result ok" role="status" data-testid="gitlab-connected" data-push={c.push}><Icon name="check"/><span><b className="ah-mono">{c.user}</b> <span className="ah-mono">{c.host}</span></span></p>
   <dl className="gl-done" data-testid="gitlab-done-facts">
    <dt>Repolista</dt><dd>{stage.projects} projektia</dd>
    <dt>Push</dt><dd>{c.push === 'yes' ? 'Toimii' : c.push === 'no' ? 'Ei toimi: tunnukselta puuttuu write_repository' : 'Ei tiedossa: selviää ensimmäisellä pushilla'}</dd>
    <dt>Tunnus</dt><dd>Voimassa {date(c.expires)} asti</dd>
   </dl>
   {c.push === 'no' ? <p className="ig-result bad" role="alert" data-testid="gitlab-readonly"><Icon name="warning"/><span>Voit kloonata ja hakea muutoksia, mutta agentit eivät voi pushata. Jos haluat pushata, luo tunnus oikeuksilla read_api ja write_repository ja vaihda se.</span></p> : null}
   {c.scopes.includes('api') ? <p className="ig-p" data-testid="gitlab-api-done">Tunnuksella on api-oikeus. Se toimii, mutta antaa agenteillesi oikeuden muuttaa GitLabissa kaikkea, mitä sinä voit. Suppeampi tunnus riittää kloonaukseen ja pushiin.</p> : null}
   {c.excluded ? <p className="ig-result bad" role="alert" data-testid="gitlab-excluded-done"><Icon name="warning"/><span>{c.excluded.count} projektia jäi pois listasta, koska GitLab ilmoittaa niiden osoitteeksi <span className="ah-mono">{c.excluded.url}</span>. GitLabin ylläpitäjän pitää korjata <span className="ah-mono">external_url</span>.</span></p> : null}
   {stage.replaced ? null : <p className="ig-p">GitLabin projektit näkyvät nyt Uusi työtila -sivun listassa.</p>}
  </>;
  foot = <>
   {stage.replaced ? null : <ControlButton data-testid="gitlab-to-new" size="page" variant="secondary" onPress={onNewWorkspace}>Uusi työtila…</ControlButton>}
   <ControlButton data-testid="gitlab-done" size="page" variant="primary" onPress={onClose}>Valmis</ControlButton>
  </>;
 } else {
  body = <form className="ig-flow-form" noValidate onSubmit={e => {e.preventDefault(); submit();}}>
   {replace
    ? <p className="ig-p">Anna tilin <b className="ah-mono">{replace.user}</b> uusi tunnus palvelimelle <span className="ah-mono">{replace.host}</span>. Vanha jää voimaan, jos GitLab ei hyväksy uutta.</p>
    : <label className="s-field" data-field="server"><span>GitLab-palvelimen osoite</span>
      <input data-testid="gitlab-address" className="ah-mono" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://gitlab.com" value={address} readOnly={busy} maxLength={2048}
       onChange={e => setAddress(e.target.value)} onBlur={() => setAddress(v => giteaAddress(v))}
       onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault(); submit();}}} {...invalid('server')}/>
     </label>}
   <label className="s-field" data-field="token"><span>Henkilökohtainen pääsytunnus</span>
    <span className="ig-gitea-line">
     <input data-testid="gitlab-token-input" className="ah-mono" type={reveal ? 'text' : 'password'} autoComplete="off" spellCheck={false} placeholder="glpat-…" value={token} readOnly={busy} maxLength={1024}
      onChange={e => setToken(e.target.value)} onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault(); submit();}}} {...invalid('token')}/>
     <ControlButton size="row" variant="quiet" aria-label={reveal ? 'Piilota tunnus' : 'Näytä tunnus'} onPress={() => setReveal(r => !r)}>{reveal ? 'Piilota' : 'Näytä'}</ControlButton>
    </span>
   </label>
   <p className="gl-link">{createLink}</p>
   <ControlButton data-testid="gitlab-token-help" size="inline" variant="quiet" aria-expanded={help} onPress={() => setHelp(h => !h)}>Mistä saan tunnuksen? {help ? '−' : '+'}</ControlButton>
   {help ? <div className="ig-p" data-testid="gitlab-token-instructions">
    <strong>GitLabissa: Edit profile → Access tokens</strong>
    <p>Linkki avaa sivun valmiiksi täytettynä: nimi Open Habitat ja oikeudet <code>read_api</code> ja <code>write_repository</code>. Valitse vanhenemispäivä (GitLab sallii yleensä enintään vuoden) ja luo tunnus.</p>
    <p><code>read_api</code> näyttää projektisi, <code>write_repository</code> sallii kloonauksen ja pushin. Myös <code>api</code> kelpaa, mutta sillä agentit voivat muuttaa GitLabissa kaikkea, mitä sinä voit.</p>
    <p>Ryhmän tai projektin tunnus ja hienojakoinen tunnus käyvät samaan kenttään.</p>
   </div> : null}
   <p className="ig-p" data-testid="gitlab-agent-note">Myös agenttisi voivat käyttää yhdistämääsi GitLab-tiliä.</p>
  </form>;
  foot = <>
   <ControlButton size="page" variant="secondary" onPress={onClose} isDisabled={busy}>Peruuta</ControlButton>
   <ControlButton data-testid="gitlab-submit" size="page" variant="primary" isDisabled={busy} onPress={submit}>{busy ? 'Tarkistetaan…' : replace ? 'Vaihda tunnus' : 'Yhdistä tili'}</ControlButton>
  </>;
 }
 return <ModalOverlay className="ah-overlay" isOpen isDismissable={!busy} isKeyboardDismissDisabled={busy} onOpenChange={o => {if (!o) onClose();}}>
  <Modal className="ah-modal ig-dlg ig-gitea-dlg" data-theme={theme}>
   <AriaDialog data-testid="gitlab-dialog" data-stage={stage.stage} className="ah-dialog" aria-label={title}>
    <div className="ig-gitea-head">
     <div className="ig-dh">
      <LetterMark mark="GL" tone={2} small/>
      <Heading slot="title" ref={heading} tabIndex={-1}>{title}</Heading>
      <ControlButton data-testid="dialog-close" size="row" variant="quiet" presentation="icon" aria-label="Sulje" isDisabled={busy} onPress={onClose}><Icon name="cross"/></ControlButton>
     </div>
     {error && stage.stage === 'form' ? <div id={errorId} ref={errorRef} data-testid="gitlab-error" data-field={error.field} className="ig-gitea-error" role="alert" tabIndex={-1}><Icon name="warning"/><p>{error.text}</p></div> : null}
    </div>
    <div className="ig-gitea-body">{body}</div>
    <div className="ig-gitea-foot ig-row">{foot}</div>
   </AriaDialog>
  </Modal>
 </ModalOverlay>;
}

function DisconnectDialog({c, theme, onClose, onConfirm}: {c: GL; theme: string; onClose: () => void; onConfirm: () => void}) {
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o => {if (!o) onClose();}}>
  <Modal className="ah-modal ig-dlg" data-theme={theme}>
   <AriaDialog data-testid="gitlab-disconnect-dialog" role="alertdialog" className="ah-dialog" aria-label="Irrota GitLab-tili">
    <div className="ig-dh"><Heading slot="title">Irrota GitLab-tili</Heading></div>
    <div className="ig-flow">
     <p><b className="ah-mono">{c.user}</b> <span className="ah-mono">{c.host}</span></p>
     <p className="ig-p">Tunnus poistetaan glab-asetuksistasi tällä palvelimella. Kloonatut työtilat jäävät, mutta niiden pull ja push eivät enää käytä tätä tunnusta. Tunnus ei peruunnu GitLabissa: peru se GitLabin Access tokens -sivulla, jos et enää tarvitse sitä. Agentti, joka jo ehti saada tunnuksen, voi käyttää sitä, kunnes perut sen.</p>
     <div className="ig-row">
      <ControlButton size="page" variant="secondary" onPress={onClose}>Peruuta</ControlButton>
      <ControlButton data-testid="gitlab-disconnect-confirm" size="page" variant="primary" onPress={onConfirm}>Irrota</ControlButton>
     </div>
    </div>
   </AriaDialog>
  </Modal>
 </ModalOverlay>;
}

function CodeHosts({gitlab, workspaces, checks, onConnect, onCheck, onReplace, onDisconnect, onNewWorkspace}: {
 gitlab: GL[]; workspaces: WS[]; checks: Record<string, string>;
 onConnect: () => void; onCheck: (c: GL) => void; onReplace: (c: GL) => void; onDisconnect: (c: GL) => void; onNewWorkspace: () => void;
}) {
 const hosted = [...workspaces].sort((a, b) => a.name.localeCompare(b.name, 'fi'));
 const expiredHost = (s: Src) => s.kind === 'gitlab' && gitlab.find(g => g.host === s.host)?.state === 'expired';
 return <div className="s-stack" data-testid="code-hosts">
  <p className="s-intro">Palvelut, joista työtilat kloonataan ja joihin agentit pushaavat.</p>
  <div className="s-card"><div className="s-row s-marked" data-settings-row="github">
   <LetterMark mark="GH" tone={0}/>
   <div className="s-lbl"><strong>GitHub</strong><span className="s-desc">Kirjautunut käyttäjänä esimerkki. Git ja gh toimivat työtiloissa. Selaimesta uloskirjautuminen ei poista palvelimen valtuutusta.</span></div>
   <div className="s-val"><StatusMark label="Yhdistetty" kind="success" tone="success"/></div>
  </div></div>
  <div className="s-gitea"><div className="ig-main"><section className="ig-provider" aria-label="Gitea">
   <GiteaCard connection={gitea} onCheck={() => {}} onReplace={() => {}} onRepair={() => {}} onDisconnect={() => {}}/>
  </section></div></div>
  <div className="s-gitea" data-settings-row="gitlab"><div className="ig-main">
   {gitlab.length ? <section className="ig-provider" aria-label="GitLab">
    {gitlab.map(c => <GitLabCard key={c.host} c={c} check={checks[c.host]} onCheck={() => onCheck(c)} onReplace={() => onReplace(c)} onDisconnect={() => onDisconnect(c)}/>)}
    <div className="ig-another"><ControlButton data-testid="gitlab-add" size="row" variant="quiet" onPress={onConnect}><Icon name="plus"/>Lisää toinen GitLab-palvelin</ControlButton></div>
   </section> : <div className="ig-tiles"><div className="ig-tile" data-testid="gitlab-tile">
    <LetterMark mark="GL" tone={2}/>
    <div><span className="ig-rn">GitLab</span><span className="ig-meta">gitlab.com tai yrityksen oma GitLab</span></div>
    <ControlButton data-testid="gitlab-open" size="row" variant="secondary" onPress={onConnect}>Yhdistä…</ControlButton>
   </div></div>}
  </div></div>
  <section className="s-stack" aria-labelledby="code-host-workspaces">
   <h3 className="s-h3" id="code-host-workspaces">Tuodut työtilat<span className="s-count">{hosted.length}</span></h3>
   <div className="s-card" data-testid="code-host-workspaces">
    {hosted.map(w => <div className="s-ws" key={w.name} data-testid="code-host-workspace" data-host={w.src.kind}>
     <Icon name="folder"/><strong>{w.name}</strong>
     <LetterMark mark={w.src.kind === 'github' ? 'GH' : w.src.kind === 'gitea' ? 'Gt' : 'GL'} tone={w.src.kind === 'github' ? 0 : w.src.kind === 'gitea' ? 3 : 2} small/>
     <span className="s-desc"><code>{w.repo}</code> · {w.src.kind === 'github' ? 'GitHub' : w.src.kind === 'gitea' ? `Gitea ${w.src.label}` : `GitLab ${w.src.host}`}</span>
     {expiredHost(w.src) ? <span className="s-desc s-bad">Pull ja push eivät onnistu ennen kuin GitLab-tunnus on vaihdettu. Paikallinen työ jatkuu.</span> : null}
    </div>)}
    <div className="s-row"><p className="s-desc">Työtilat avataan ja poistetaan sivupalkista. Täällä näkyy, minkä palvelun tunnuksella kukin synkronoi.</p>
     <div className="s-val"><ControlButton data-testid="code-host-new-workspace" size="row" onPress={onNewWorkspace}>Uusi työtila…</ControlButton></div></div>
   </div>
  </section>
 </div>;
}

// ---------- Uusi työtila: the common list with GitLab's paths ----------

type Sec = {key: string; title: string; src: Src; kind: string; rows: Repo[]; total: number; hidden: number; base: string};
type GroupOption = {value: string; label: string; depth: number; count: number};

/** Every namespace that holds projects, from the projects themselves
 * (no /groups call): "gitlab.com konepaja/verkkokauppa" with its subtree. */
function groupOptions(repos: Repo[]): {host: string; options: GroupOption[]}[] {
 const hosts = new Map<string, Map<string, number>>();
 for (const r of repos) {
  if (r.src.kind !== 'gitlab') continue;
  const m = hosts.get(r.src.host) ?? new Map<string, number>();
  const parts = nsOf(r).split('/');
  for (let i = 1; i <= parts.length; i++) {const ns = parts.slice(0, i).join('/'); m.set(ns, (m.get(ns) ?? 0) + 1);}
  hosts.set(r.src.host, m);
 }
 return [...hosts.entries()].map(([host, m]) => ({host, options: [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'fi'))
  .map(([ns, count]) => ({value: `${host} ${ns}`, label: ns.split('/').pop()!, depth: ns.split('/').length - 1, count}))}));
}

function arrange(repos: Repo[], {direction, query, since, group, taken}: {direction: number; query: string; since: Since; group: string; taken: (r: Repo) => boolean}) {
 const days = Number(since);
 const pushed = (r: Repo) => r.pushed_at ? Date.parse(r.pushed_at) : -Infinity;
 const fresh = (r: Repo) => !days || pushed(r) >= NOW - days * DAY;
 let pool = [...repos].sort((a, b) => pushed(b) - pushed(a));
 const [gHost, gNs] = group ? group.split(' ') : ['', ''];
 if (direction === 2 && group) pool = pool.filter(r => r.src.kind === 'gitlab' && r.src.host === gHost && r.path.startsWith(gNs + '/'));
 const q = query.trim().toLocaleLowerCase();
 if (q) {
  const hits = pool.filter(r => `${r.path} ${r.description} ${srcLabel(r.src)}`.toLocaleLowerCase().includes(q));
  const shown = hits.filter(fresh);
  return {kind: 'search' as const, hits: shown, hidden: hits.length - shown.length};
 }
 const recent = direction === 2 && group ? [] : pool.filter(r => pushed(r) >= NOW - 3 * DAY && !taken(r)).slice(0, 4);
 // The section a repository falls in. GitHub and Gitea keep their owner.
 const sectionOf = (r: Repo) => r.src.kind !== 'gitlab' ? r.path.split('/')[0]
  : direction === 0 ? nsOf(r) : direction === 2 && group ? gNs : r.path.split('/')[0];
 const m = new Map<string, Repo[]>();
 for (const r of pool) {const k = `${srcKey(r.src)}\u0000${sectionOf(r)}`; m.set(k, [...(m.get(k) ?? []), r]);}
 const kindOf = (rs: Repo[], title: string) => {
  const s = rs[0].src;
  if (s.kind === 'github') return title === 'esimerkki' ? 'Omat' : 'Organisaatio';
  if (s.kind === 'gitea') return 'Omat';
  return rs[0].personal ? 'Omat' : title.includes('/') ? 'Aliryhmä' : 'Ryhmä';
 };
 const order: Record<string, number> = {Omat: 0, Organisaatio: 1, Ryhmä: 1, Aliryhmä: 1};
 const sections: Sec[] = [...m.entries()].map(([key, rs]) => {
  const title = key.split('\u0000')[1];
  const visible = rs.filter(fresh);
  return {key, title, src: rs[0].src, kind: kindOf(rs, title), rows: visible, total: rs.length, hidden: rs.length - visible.length, base: title};
 }).sort((a, b) => order[a.kind] - order[b.kind] || a.title.localeCompare(b.title, 'fi') || srcLabel(a.src).localeCompare(srcLabel(b.src)));
 return {kind: 'browse' as const, recent, sections};
}

function Row({r, selected, mark, base, sectioned}: {r: Repo; selected: boolean; mark?: {label: string; tone: string}; base?: string; sectioned?: boolean}) {
 // In a section, a GitLab row shows its path below the section's group;
 // elsewhere the full path, as GitHub's owner/name.
 const ns = nsOf(r);
 const prefix = sectioned && base !== undefined && r.src.kind === 'gitlab' && ns.startsWith(base) ? ns.slice(base.length).replace(/^\//, '') : ns;
 return <li><LinkRow data-testid={`repository-option-${srcLabel(r.src)}/${r.path}`} href={`/new?repo=${encodeURIComponent(keyOf(r))}`} kind="nav" current={selected} className="ah-clone-row">
  <span className="ah-clone-row-name">
   <span className="ah-mono gl-path">{prefix ? <span className="ah-clone-owner">{prefix}/</span> : null}<b>{nameOf(r)}</b></span>
   {r.private ? <span className="ah-clone-lock" title="Yksityinen"><Icon name="lock" width={12} height={12}/><span className="ah-visually-hidden">Yksityinen</span></span> : null}
   {sectioned ? null : <span className="ah-clone-chip ah-clone-source ah-mono">{srcLabel(r.src)}</span>}
   {mark ? <span className={`ah-clone-chip ah-clone-chip-${mark.tone}`}>{mark.label}</span> : null}
   {r.archived ? <span className="ah-clone-chip">arkistoitu</span> : null}
   {r.empty ? <span className="ah-clone-chip">tyhjä</span> : null}
  </span>
  {r.description ? <span className="ah-clone-row-desc">{r.description}</span> : null}
  <span className="ah-clone-row-meta"><span>{when(r.pushed_at, NOW)}</span>{r.size_kib === null ? <span>koko ei tiedossa</span> : <span>{size(r.size_kib * 1024)}</span>}</span>
 </LinkRow></li>;
}

type Job = {key: string; repo: Repo; state: 'running' | 'confirmed' | 'failed'; percent: number; reason?: string};

function NewWorkspace({direction, repos, notes, workspaces, jobs, connections, onClone, onDismiss, onOpen}: {
 direction: number; repos: Repo[]; notes: {key: string; text: string; failed: boolean}[]; workspaces: WS[]; jobs: Job[]; connections: GL[];
 onClone: (r: Repo) => void; onDismiss: (k: string) => void; onOpen: (name: string) => void;
}) {
 const loc = useLocation(), navigate = useNavigate();
 const selKey = new URLSearchParams(loc.search).get('repo') ?? '';
 const [query, setQuery] = useState(''), [since, setSince] = useState<Since>('0'), [group, setGroup] = useState('');
 const [open, setOpen] = useState<Record<string, boolean>>({});
 const searchId = useId(), groupId = useId();
 const sameWs = (r: Repo) => workspaces.find(w => w.name.toLocaleLowerCase() === nameOf(r).toLocaleLowerCase());
 const isWs = (r: Repo) => {const w = sameWs(r); return !!w && srcKey(w.src) === srcKey(r.src) && w.repo === r.path;};
 const jobOf = (r: Repo) => jobs.find(j => j.key === keyOf(r));
 const markOf = (r: Repo) => {const j = jobOf(r); return j?.state === 'running' ? {label: 'kloonataan', tone: 'run'} : isWs(r) ? {label: 'työtila', tone: 'ok'} : undefined;};
 const a = arrange(repos, {direction, query, since, group, taken: isWs});
 const sel = repos.find(r => keyOf(r) === selKey);
 const groups = direction === 2 ? groupOptions(repos) : [];
 const hiddenNote = (n: number) => n ? <span>{n} ei päivitetty valitulla aikavälillä</span> : null;
 const conn = (r?: Repo) => r?.src.kind === 'gitlab' ? connections.find(c => c.host === (r.src as {host: string}).host) : undefined;
 const finder = <div className="ah-clone-finder">
  <div className="ah-clone-find">
   <label className="ah-clone-search" htmlFor={searchId}><Icon name="search" width={15} height={15}/><span className="ah-visually-hidden">Hae repoa</span>
    <input data-testid="repository-search" id={searchId} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Hae nimellä, ryhmällä tai kirjoita omistaja/repo" autoComplete="off" spellCheck={false}/></label>
   <Segmented label="Päivitetty" className="ah-clone-since" options={sinceChoices} value={since} onChange={setSince}/>
  </div>
  {direction === 2 && groups.length ? <div className="gl-filter">
   <label htmlFor={groupId}>Ryhmä</label>
   <select id={groupId} data-testid="group-filter" value={group} onChange={e => {setGroup(e.target.value); setOpen({});}}>
    <option value="">Kaikki lähteet</option>
    {groups.map(g => <optgroup key={g.host} label={`GitLab ${g.host}`}>
     {g.options.map(o => <option key={o.value} value={o.value}>{' '.repeat(o.depth)}{o.label} ({o.count})</option>)}
    </optgroup>)}
   </select>
   {group ? <ControlButton data-testid="group-clear" size="inline" variant="quiet" onPress={() => setGroup('')}>Näytä kaikki</ControlButton> : null}
  </div> : null}
  {notes.map(n => <p key={n.key} data-testid="repository-source-note" data-failed={n.failed ? '' : undefined} className={n.failed ? 'ah-clone-empty' : 'ah-clone-hint'} role={n.failed ? 'alert' : undefined}>
   {n.text} <a data-testid="repository-source-fix" href="#" onClick={e => {e.preventDefault(); navigate('/settings');}}>Koodipalvelut</a></p>)}
  {a.kind === 'search' ? (a.hits.length
   ? <section className="ah-clone-sec"><h3>Hakutulokset <span className="ah-clone-n">{a.hits.length}</span></h3>
     <ul>{a.hits.map(r => <Row key={keyOf(r)} r={r} selected={keyOf(r) === selKey} mark={markOf(r)}/>)}</ul>
     <p className="ah-clone-secfoot">{hiddenNote(a.hidden)}</p></section>
   : <p className="ah-clone-empty" data-testid="no-hits">Ei osumia haulle <b>{query.trim()}</b>.</p>)
  : <>
   {a.recent.length ? <section className="ah-clone-sec"><h3>Viimeksi päivitetyt</h3><ul>{a.recent.map(r => <Row key={keyOf(r)} r={r} selected={keyOf(r) === selKey} mark={markOf(r)}/>)}</ul></section> : null}
   {a.sections.map(s => {
    const all = open[s.key], shown = all ? s.rows : s.rows.slice(0, sectionLimit);
    return <section className="ah-clone-sec" key={s.key} data-testid="repo-section" data-title={s.title} data-source={s.src.kind}>
     <h3><span className="ah-mono ah-clone-sec-owner gl-sec-path">{s.title}</span>
      <span className="ah-clone-chip ah-clone-source ah-mono">{srcLabel(s.src)}</span>
      <span className="ah-clone-kind">{s.kind}</span><span className="ah-clone-n">{s.total}</span></h3>
     {shown.length ? <ul>{shown.map(r => <Row key={keyOf(r)} r={r} selected={keyOf(r) === selKey} mark={markOf(r)} base={s.base} sectioned/>)}</ul> : null}
     <p className="ah-clone-secfoot">
      {s.rows.length > sectionLimit ? <ControlButton data-testid="expand-repos" size="inline" variant="quiet" aria-expanded={!!all} onPress={() => setOpen({...open, [s.key]: !all})}>{all ? 'Näytä vähemmän' : `Näytä kaikki ${s.rows.length}`}</ControlButton> : null}
      {hiddenNote(s.hidden)}
     </p>
    </section>;
   })}
  </>}
 </div>;
 const c = conn(sel);
 const job = sel && jobOf(sel);
 const ws = sel && sameWs(sel);
 const detail = !sel ? <aside data-testid="repo-details" className="ah-clone-detail ah-clone-none" aria-label="Repon tiedot"><p>Valitse repo nähdäksesi sen tiedot ennen kloonausta.</p></aside>
  : <aside data-testid="repo-details" className="ah-clone-detail" aria-label="Repon tiedot" data-state={job ? 'job' : ws ? (isWs(sel) ? 'workspace' : 'taken') : 'ready'}>
   <LinkRow data-testid="all-repos" href="/new" kind="inline" className="ah-clone-back"><Icon name="back" width={15} height={15}/>Kaikki repot</LinkRow>
   <h2 className="ah-mono gl-path">{nsOf(sel) ? <span className="ah-clone-owner">{nsOf(sel)}/</span> : null}{nameOf(sel)}</h2>
   {sel.description ? <p className="ah-clone-desc">{sel.description}</p> : null}
   <dl className="ah-clone-facts">
    {sel.src.kind !== 'github' ? <><dt>Lähde</dt><dd><span className="ah-mono" data-testid="repo-details-source">{sel.src.kind === 'gitea' ? `${sel.src.login} · ${sel.src.label}` : `${c?.user ?? ''} · GitLab ${sel.src.host}`}</span></dd></> : null}
    {sel.src.kind === 'gitlab' && nsOf(sel).includes('/') ? <><dt>Ryhmä</dt><dd data-testid="repo-details-group">{nsOf(sel).split('/').join(' › ')}</dd></> : null}
    <dt>Näkyvyys</dt><dd>{sel.visibility === 'internal' ? 'Sisäinen: kaikki palvelimen kirjautuneet' : sel.private ? <><Icon name="lock" width={12} height={12} className="ah-clone-ic-muted"/>Yksityinen</> : 'Julkinen'}</dd>
    {sel.archived ? <><dt>Tila</dt><dd>Arkistoitu: vain luku GitLabissa</dd></> : null}
    <dt>Oletushaara</dt><dd><span className="ah-mono">{sel.default_branch ?? 'ei haaraa'}</span></dd>
    <dt>{sel.src.kind === 'gitlab' ? 'Viimeisin toiminta' : 'Viimeisin push'}</dt><dd>{when(sel.pushed_at, NOW)}</dd>
    <dt>Koko</dt><dd>{sel.size_kib === null ? <>Ei tiedossa <span className="ah-clone-sub">GitLab kertoo koon vain Reporter-roolille tai ylemmälle</span></> : <>{size(sel.size_kib * 1024)} <span className="ah-clone-sub">{sel.src.kind === 'gitlab' ? 'GitLabin ilmoittama koko' : sel.src.kind === 'gitea' ? 'Gitean ilmoittama koko' : 'GitHubin arvio pakatusta historiasta'}</span></>}</dd>
    {c ? <><dt>Push</dt><dd data-testid="repo-details-push">{c.state === 'expired' ? 'Ei toimi: tunnus vanhentunut' : c.push === 'yes' ? 'Toimii' : c.push === 'no' ? 'Ei toimi: tunnukselta puuttuu write_repository' : 'Ei tiedossa'}</dd></> : null}
    <dt>Kohde</dt><dd><span className="ah-mono">~/src/{nameOf(sel)}</span></dd>
   </dl>
   {job ? <p className="ah-clone-note"><Icon name="info" width={15} height={15} className="ah-clone-ic-muted"/><span>Tämän repon kloonaus näkyy sivun yläosassa.</span></p>
    : ws && isWs(sel) ? <><p className="ah-clone-note ah-clone-note-ok"><Icon name="check" width={15} height={15} className="ah-clone-ic-ok"/><span>Repo on jo työtilana <span className="ah-mono">~/src/{ws.name}</span>.</span></p>
     <div className="ah-clone-actions"><ControlButton data-testid="cloned-workspace-open" size="row" variant="primary" onPress={() => onOpen(ws.name)}>Avaa työtila</ControlButton></div></>
    : ws ? <p className="ah-clone-note ah-clone-note-warn" data-testid="repo-taken"><Icon name="warning" width={15} height={15} className="ah-clone-ic-warn"/><span>Hakemisto <span className="ah-mono">~/src/{ws.name}</span> on jo olemassa ({ws.src.kind === 'gitlab' ? `GitLab ${ws.repo}` : ws.src.kind === 'gitea' ? `Gitea ${ws.repo}` : `GitHub ${ws.repo}`}), joten tätä repoa ei voi kloonata sinne. Nimeä tai poista nykyinen työtila ensin.</span></p>
    : <>
     {sel.empty ? <p className="ah-clone-note"><Icon name="info" width={15} height={15} className="ah-clone-ic-muted"/><span>Projektissa ei ole vielä yhtään committia. Saat tyhjän repon, johon voit pushata ensimmäisen.</span></p> : null}
     <div className="ah-clone-actions"><ControlButton data-testid="repository-clone" size="page" variant="primary" isDisabled={c?.state === 'expired'} onPress={() => onClone(sel)}><Icon name="branch"/>Kloonaa työtilaksi</ControlButton></div>
     <p className="ah-clone-hint" data-testid="clone-hint">{c?.state === 'expired' ? 'GitLab-tunnus on vanhentunut. Vaihda se Koodipalveluissa ennen kloonausta.'
      : sel.src.kind === 'gitlab' ? 'Kloonataan tämän GitLab-yhteyden tunnuksella. Kloonaus jatkuu palvelimella, vaikka poistut sivulta.'
      : sel.src.kind === 'gitea' ? 'Kloonataan tämän Gitea-yhteyden tunnuksella. Kloonaus jatkuu palvelimella, vaikka poistut sivulta.'
      : 'Kloonataan sinun GitHub-tunnuksillasi. Kloonaus jatkuu palvelimella, vaikka poistut sivulta.'}</p>
    </>}
  </aside>;
 return <div className="ah-clone-page" data-testid="new-workspace">
  <header className="ah-clone-head"><h1>Uusi työtila</h1><p>Kloonaa repo GitHubista, Giteasta tai GitLabista tai luo tyhjä hakemisto kotihakemistosi <span className="ah-mono">~/src</span>-kansioon.</p></header>
  {jobs.length ? <section className="ah-clone-jobs" aria-labelledby="clone-jobs-title"><h2 className="ah-clone-h2" id="clone-jobs-title">Kloonaukset</h2>
   {jobs.map(j => <JobCard key={j.key} j={j} onDismiss={() => onDismiss(j.key)} onOpen={() => onOpen(nameOf(j.repo))} onRetry={() => onClone(j.repo)}/>)}
  </section> : null}
  <section className="ah-clone-card" aria-label="Työtilan lähde">
   <Segmented label="Työtilan lähde" size="row" options={[{id: 'repo', label: 'Kloonaa repo', icon: <Icon name="branch"/>}, {id: 'dir', label: 'Uusi hakemisto', icon: <Icon name="folderPlus"/>}]} value="repo" onChange={() => {}}/>
   <div className="ah-clone-pick" data-selected={sel ? '' : undefined}>{finder}{detail}</div>
  </section>
 </div>;
}

function JobCard({j, onDismiss, onOpen, onRetry}: {j: Job; onDismiss: () => void; onOpen: () => void; onRetry: () => void}) {
 const dest = `~/src/${nameOf(j.repo)}`;
 const state = j.state;
 return <article data-testid="clone-job" data-state={state} data-repository={j.repo.path} className={`ah-clone-job ah-clone-job-${state}`} aria-label={`Kloonaus ${j.repo.path}`}>
  <header className="ah-clone-jhead">
   <span className={`ah-clone-jic ah-clone-jic-${state}`}>{state === 'running' ? <span className="ah-clone-spin" aria-hidden="true"/> : <Icon name={state === 'confirmed' ? 'check' : 'warning'} width={16} height={16}/>}</span>
   <div><strong className="ah-mono gl-path">{j.repo.path}</strong><span className="ah-clone-sub">{srcLabel(j.repo.src)} · koko historia → <span className="ah-mono">{dest}</span></span></div>
  </header>
  {state === 'running' ? <>
   <div className="ah-clone-bar" role="progressbar" aria-label={`Kloonauksen ${j.repo.path} edistyminen`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={j.percent}><span style={{width: `${j.percent}%`}}/></div>
   <p className="ah-clone-line" role="status">{j.percent < 10 ? `Yhdistetään GitLabiin ${srcLabel(j.repo.src)}` : `Vastaanotetaan objekteja · ${j.percent} %`}</p>
  </> : state === 'confirmed' ? <p>Valmis. Repo on kloonattu hakemistoon <span className="ah-mono">{dest}</span>.</p>
  : <><p data-testid="clone-failed" className="ah-clone-title">Kloonaus epäonnistui</p><p data-testid="clone-reason">{j.reason} Keskeneräinen hakemisto poistettiin, joten levylle ei jäänyt mitään.</p></>}
  <div className="ah-clone-actions">
   {state === 'confirmed' ? <><ControlButton size="row" onPress={onDismiss}>Sulje</ControlButton><ControlButton data-testid="cloned-workspace-open" size="row" variant="primary" onPress={onOpen}>Avaa työtila</ControlButton></>
    : state === 'failed' ? <><ControlButton size="row" onPress={onDismiss}>Poista ilmoitus</ControlButton><ControlButton data-testid="retry" size="row" variant="primary" onPress={onRetry}><Icon name="refresh"/>Yritä uudelleen</ControlButton></> : null}
  </div>
 </article>;
}

// ---------- The review frame ----------

let reviewTheme = 'light', reviewPhone = false, reviewScenario: Scenario = 'none', reviewOutcome: Outcome = 'ok', reviewPath = '/settings';
// The person's state survives a direction switch, as the page would.
let reviewGitlab: GL[] = scenarios.none.gitlab, reviewWorkspaces: WS[] = initialWorkspaces('none');

function Shell({direction}: {direction: number}) {
 const loc = useLocation(), navigate = useNavigate();
 useEffect(() => {reviewPath = loc.pathname + loc.search;}, [loc]);
 const [theme, setTheme] = useState(reviewTheme), [phone, setPhone] = useState(reviewPhone);
 const [scenario, setScenario] = useState<Scenario>(reviewScenario), [outcome, setOutcome] = useState<Outcome>(reviewOutcome);
 const [gitlab, setGitlab] = useState<GL[]>(reviewGitlab);
 const [workspaces, setWorkspaces] = useState<WS[]>(reviewWorkspaces);
 const [jobs, setJobs] = useState<Job[]>([]);
 const [dialog, setDialog] = useState<{key: number; replace?: GL; stage: Stage} | null>(null);
 const [disconnect, setDisconnect] = useState<GL | null>(null);
 const [checks, setChecks] = useState<Record<string, string>>({});
 const [notice, setNotice] = useState('');
 useEffect(() => {reviewGitlab = gitlab; reviewWorkspaces = workspaces;}, [gitlab, workspaces]);
 const choose = (s: Scenario) => {reviewScenario = s; setScenario(s); setGitlab(scenarios[s].gitlab); setWorkspaces(initialWorkspaces(s)); setJobs([]); setChecks({}); setDialog(null); setNotice('');};
 // Clone progress: a few ticks, then the result.
 useEffect(() => {
  if (!jobs.some(j => j.state === 'running')) return;
  const t = setTimeout(() => setJobs(js => js.map(j => {
   if (j.state !== 'running') return j;
   if (j.repo.sso && j.percent >= 5) return {...j, state: 'failed', reason: `GitLab hylkäsi Gitin kirjautumisen. Ryhmä ${j.repo.path.split('/')[0]} vaatii voimassa olevan SSO-istunnon: kirjaudu selaimessa ryhmän kertakirjautumisella gitlab.comiin ja yritä uudelleen.`};
   const percent = Math.min(100, j.percent + 35);
   if (percent < 100) return {...j, percent};
   setWorkspaces(w => [...w, {name: nameOf(j.repo), repo: j.repo.path, src: j.repo.src}]);
   return {...j, percent, state: 'confirmed'};
  })), 450);
  return () => clearTimeout(t);
 }, [jobs]);
 const repos = [...githubRepos, ...giteaRepos, ...gitlab.filter(g => g.state === 'ok').flatMap(reposFor)];
 const notes = gitlab.flatMap(g => g.state === 'expired'
  ? [{key: g.host, failed: true, text: `GitLab ${g.host}: tunnus vanheni ${date(g.expires)}, joten sen projekteja ei näytetä. Vaihda tunnus:`}]
  : g.excluded ? [{key: g.host, failed: false, text: `GitLab ${g.host}: ${g.excluded.count} projektia jäi pois, koska palvelin ilmoittaa niiden osoitteeksi ${g.excluded.url}. GitLabin ylläpitäjän pitää korjata external_url. Lisää:`}] : []);
 const submit = (base: string) => {
  setDialog(d => d && {...d, stage: {stage: 'form', busy: true}});
  setTimeout(() => setDialog(d => {
   if (!d) return d;
   const refused = refusals[outcome];
   if (refused) return {...d, stage: {stage: 'form', error: refused}};
   const host = d.replace?.host ?? hostOf(base);
   const c = {...connectAs(host, outcome, d.replace?.user), excluded: outcome === 'excluded' ? {count: 3, url: 'http://gitlab.internal/…'} : d.replace?.excluded};
   setGitlab(gs => d.replace ? gs.map(g => g.host === host ? c : g) : [...gs, c]);
   setChecks(cs => ({...cs, [host]: ''}));
   return {...d, stage: {stage: 'done', c, replaced: !!d.replace, projects: reposFor(c).length}};
  }), 600);
 };
 const clone = (r: Repo) => setJobs(js => [{key: keyOf(r), repo: r, state: 'running', percent: 2}, ...js.filter(j => j.key !== keyOf(r))]);
 const settings = <CodeHosts gitlab={gitlab} workspaces={workspaces} checks={checks}
  onConnect={() => setDialog(d => ({key: (d?.key ?? 0) + 1, stage: {stage: 'form'}}))}
  onCheck={c => setChecks(cs => ({...cs, [c.host]: c.state === 'expired' ? 'Tunnus on vanhentunut' : 'Tunnus toimii'}))}
  onReplace={c => setDialog(d => ({key: (d?.key ?? 0) + 1, replace: c, stage: {stage: 'form'}}))}
  onDisconnect={c => setDisconnect(c)}
  onNewWorkspace={() => navigate('/new')}/>;
 const view = loc.pathname.startsWith('/new') ? 'new' : loc.pathname.startsWith('/ws') ? 'ws' : 'settings';
 return <div data-theme={theme} className={phone ? 'review phone' : 'review'} onClickCapture={e => {
  // LinkRow is react-aria's link; keep it in the memory router.
  const a = (e.target as HTMLElement).closest('a[href^="/"]');
  if (a) {e.preventDefault(); navigate(a.getAttribute('href')!);}
 }}>
  <header className="reviewbar"><strong>GitLab Koodipalveluihin</strong>
   <label>Teema <select id="theme" value={theme} onChange={e => {reviewTheme = e.target.value; setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
   <label><input id="phone" type="checkbox" checked={phone} onChange={e => {reviewPhone = e.target.checked; setPhone(reviewPhone);}}/> 390 px</label>
   <label>Koetilanne <select id="outcome" data-testid="outcome" value={outcome} onChange={e => {reviewOutcome = e.target.value as Outcome; setOutcome(reviewOutcome);}}>
    {(Object.keys(outcomes) as Outcome[]).map(o => <option key={o} value={o}>{outcomes[o]}</option>)}</select></label>
   <p>Synteettiset tiedot. Ei yhteyttä GitLabiin; mikä tahansa tunnus kelpaa.</p></header>
  <div className="scenario"><span className="muted">Esimerkkihenkilö</span>
   <Segmented data-testid="scenario" label="Esimerkkihenkilö" size="row" options={(Object.keys(scenarios) as Scenario[]).map(s => ({id: s, label: scenarios[s].label}))} value={scenario} onChange={choose}/>
   <span className="muted" data-testid="scenario-hint">{scenarios[scenario].hint}</span></div>
  <p className="axis">Akseli: miten GitLabin sisäkkäinen ryhmäpolku näkyy yhteisessä repolistassa. Yhdistäminen ja Koodipalvelut ovat kaikissa samat. Suositus: Pääryhmä.</p>
  <div className={`shell variant-${direction}`}>
   <div className="hostbar"><strong>Open Habitat</strong>
    <nav className="gl-views" aria-label="Näkymä">
     <a href="/settings" data-testid="nav-settings" aria-current={view === 'settings' ? 'page' : undefined}>Asetukset › Koodipalvelut</a>
     <a href="/new" data-testid="nav-new" aria-current={view === 'new' ? 'page' : undefined}>Uusi työtila</a>
    </nav><Icon name="user"/></div>
   {view === 'settings'
    ? <section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili', 'Laitteet', 'Tekoäly', 'Koodipalvelut', 'Tiedot agenteille', 'Ulkoasu'].map(n => <span className="s-nav-i" key={n} aria-current={n === 'Koodipalvelut' ? 'page' : undefined}>{n}</span>)}</nav>
     <main className="s-main"><p className="muted mobilecrumb">Asetukset › Koodipalvelut</p><h2>Koodipalvelut</h2>{notice ? <p role="status" className="ig-notice" data-testid="notice"><Icon name="check"/><span>{notice}</span></p> : null}{settings}</main></section>
    : view === 'new'
    ? <main className="gl-page"><NewWorkspace direction={direction} repos={repos} notes={notes} workspaces={workspaces} jobs={jobs} connections={gitlab}
       onClone={clone} onDismiss={k => setJobs(js => js.filter(j => j.key !== k))} onOpen={n => navigate(`/ws/${n}`)}/></main>
    : <main className="gl-page" data-testid="workspace-open"><h1 className="ah-mono">~/src/{loc.pathname.slice(4)}</h1><p className="muted">Synteettinen työtila: tässä aukeaisi keskustelu.</p><LinkRow href="/new" kind="inline">Takaisin Uusi työtila -sivulle</LinkRow></main>}
  </div>
  {dialog ? <div data-theme={theme}><GitLabDialog key={dialog.key} replace={dialog.replace} stage={dialog.stage} taken={gitlab} theme={theme}
   onSubmit={submit} onClose={() => setDialog(null)} onNewWorkspace={() => {setDialog(null); navigate('/new');}}/></div> : null}
  {disconnect ? <DisconnectDialog c={disconnect} theme={theme} onClose={() => setDisconnect(null)} onConfirm={() => {
   setGitlab(gs => gs.filter(g => g.host !== disconnect.host)); setNotice(`GitLab ${disconnect.host} irrotettu.`); setDisconnect(null);
  }}/> : null}
 </div>;
}

function App({direction}: {direction: number}) {
 return <MemoryRouter initialEntries={[reviewPath]}><Shell direction={direction}/></MemoryRouter>;
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) {flushSync(() => root.render(view === '' ? null : view));}};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction}/>);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {const b = document.createElement('button'); b.className = 'proto-picker-item'; b.textContent = n.replaceAll(' ', ' '); if (i === 0) {b.setAttribute('data-active', ''); b.setAttribute('aria-current', 'true');} picker.append(b);});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
