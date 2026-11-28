import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {initialTheme} from '../../lib/view-theme.js';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Badge, StatusMark} from '../../../../web/src/components/Status';
import {LetterMark} from '../../../../web/src/components/Integrations';
import {type ModelChoice, ModelPicker} from '../../../../web/src/components/ModelPicker';
import {ModelChip} from '../../../../web/src/components/ModelChip';
import {ComposerModelPicker} from '../../../../web/src/components/ComposerModelPicker';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/AIOfferList.css';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {type Lang, type Region, TEXT, type Text, type Way} from './text';
import './round.css';

// AI provider registry, round 1. Every model surface of Habitat with the
// providers of the pinned Pi (1.5.2): OpenAI, Anthropic, Google, xAI,
// DeepSeek, GLM (Z.ai), Kimi, MiniMax and Qwen. A route is (service, way,
// region), the way being a sign-in subscription, a coding plan whose key is
// pasted, or a pay-as-you-go key. Two directions differ in how the routes
// are grouped: by how you pay (today's split, extended) or by service. The
// rest is the same in both: region before key, no prices in Habitat, and
// a China-region server that moves services unavailable there to the end.
// Production pieces (settings rows, LetterMark, StatusMark, ModelPicker,
// ModelChip, ComposerModelPicker, Segmented, the onboarding list's CSS) are
// used unchanged; the round composes them. Everything shown is synthetic.

const params = new URLSearchParams(location.search);
const lang: Lang = params.get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);
const T: Text = TEXT[lang];
const theme = initialTheme(['light', 'dark']);
const SCENARIOS = ['asetukset', 'lisaa', 'tilaus', 'avain', 'valitsin', 'uusi', 'kayttoonotto', 'kayttoonotto-cn', 'yllapito'] as const;
type Scenario = (typeof SCENARIOS)[number];
const NAMES = lang === 'fi' ? ['Maksutavan mukaan', 'Palvelun mukaan'] : ['By how you pay', 'By service'];
const noop = () => {};

// ---------- Registry (from Pi 1.5.2's providers) ----------
type ServiceId = 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'zai' | 'kimi' | 'minimax' | 'qwen';
type Service = {id: ServiceId; name: string; mark: string; tone: 0 | 1 | 2 | 3; china: boolean; site: string};
const SERVICES: Service[] = [
  {id: 'openai', name: 'OpenAI', mark: 'OA', tone: 1, china: false, site: 'platform.openai.com'},
  {id: 'anthropic', name: 'Anthropic', mark: 'An', tone: 2, china: false, site: 'console.anthropic.com'},
  {id: 'google', name: 'Google Gemini', mark: 'Ge', tone: 3, china: false, site: 'aistudio.google.com'},
  {id: 'xai', name: 'xAI Grok', mark: 'xA', tone: 0, china: false, site: 'console.x.ai'},
  {id: 'deepseek', name: 'DeepSeek', mark: 'DS', tone: 3, china: true, site: 'platform.deepseek.com'},
  {id: 'zai', name: 'GLM (Z.ai)', mark: 'GL', tone: 1, china: true, site: 'z.ai · bigmodel.cn'},
  {id: 'kimi', name: 'Kimi', mark: 'Ki', tone: 0, china: true, site: 'kimi.com · platform.moonshot.ai'},
  {id: 'minimax', name: 'MiniMax', mark: 'MM', tone: 2, china: true, site: 'minimax.io · minimaxi.com'},
  {id: 'qwen', name: 'Qwen (Alibaba Cloud)', mark: 'Qw', tone: 3, china: true, site: 'alibabacloud.com · aliyun.com'},
];
const svc = (id: ServiceId) => SERVICES.find((s) => s.id === id)!;

type RouteId = 'chatgpt' | 'claude' | 'kimi-code' | 'grok-sub' | 'glm-plan' | 'minimax-plan' | 'qwen-plan' | 'openai' | 'anthropic' | 'gemini' | 'xai' | 'deepseek' | 'moonshot';
type Route = {
  id: RouteId; service: ServiceId; way: Way; name: string; mark: string;
  // Pi's provider id per region; one entry when the route has no region.
  pi: Partial<Record<Region, string>>;
  host?: string; prefix?: string; buy?: Partial<Record<Region, string>>; editions?: boolean; models: number;
};
const ROUTES: Route[] = [
  {id: 'chatgpt', service: 'openai', way: 'signin', name: 'ChatGPT', mark: 'Ch', pi: {global: 'openai-codex'}, host: 'auth.openai.com/codex/device', models: 8},
  {id: 'claude', service: 'anthropic', way: 'signin', name: 'Claude', mark: 'Cl', pi: {global: 'claude-bridge'}, host: 'claude.ai', models: 6},
  {id: 'kimi-code', service: 'kimi', way: 'signin', name: 'Kimi Code', mark: 'Ki', pi: {global: 'kimi-coding'}, host: 'auth.kimi.com', models: 6},
  {id: 'grok-sub', service: 'xai', way: 'signin', name: 'SuperGrok / X Premium', mark: 'xA', pi: {global: 'xai'}, host: 'accounts.x.ai/device', models: 4},
  {id: 'glm-plan', service: 'zai', way: 'plan', name: 'GLM Coding Plan', mark: 'GL', pi: {global: 'zai', cn: 'zai-coding-cn'}, buy: {global: 'z.ai/subscribe', cn: 'bigmodel.cn/glm-coding'}, models: 7},
  {id: 'minimax-plan', service: 'minimax', way: 'plan', name: 'MiniMax M Plan', mark: 'MM', pi: {global: 'minimax', cn: 'minimax-cn'}, buy: {global: 'platform.minimax.io', cn: 'platform.minimaxi.com'}, models: 4},
  {id: 'qwen-plan', service: 'qwen', way: 'plan', name: 'Qwen Token Plan', mark: 'Qw', pi: {global: 'qwen-token-plan', cn: 'qwen-token-plan-cn'}, buy: {global: 'modelstudio.console.alibabacloud.com', cn: 'bailian.console.aliyun.com'}, prefix: 'sk-sp-', editions: true, models: 21},
  {id: 'openai', service: 'openai', way: 'key', name: 'OpenAI API', mark: 'OA', pi: {global: 'openai'}, prefix: 'sk-', models: 12},
  {id: 'anthropic', service: 'anthropic', way: 'key', name: 'Anthropic API', mark: 'An', pi: {global: 'anthropic'}, prefix: 'sk-ant-', models: 9},
  {id: 'gemini', service: 'google', way: 'key', name: 'Gemini API (AI Studio)', mark: 'Ge', pi: {global: 'google'}, models: 10},
  {id: 'xai', service: 'xai', way: 'key', name: 'xAI API', mark: 'xA', pi: {global: 'xai'}, prefix: 'xai-', models: 4},
  {id: 'deepseek', service: 'deepseek', way: 'key', name: 'DeepSeek API', mark: 'DS', pi: {global: 'deepseek'}, prefix: 'sk-', models: 2},
  {id: 'moonshot', service: 'kimi', way: 'key', name: 'Moonshot API (Kimi)', mark: 'Ki', pi: {global: 'moonshotai', cn: 'moonshotai-cn'}, prefix: 'sk-', models: 6},
];
const route = (id: RouteId) => ROUTES.find((r) => r.id === id)!;
const WAYS: Way[] = ['signin', 'plan', 'key'];
const regional = (r: Route) => !!r.pi.cn;
const regionName = (r: Route, g: Region) => (r.id === 'qwen-plan' ? T.regionsQwen : T.regions)[g];
const toneOf = (r: Route) => svc(r.service).tone;

// The person's credentials: two subscriptions, a GLM plan key on its China
// account and a DeepSeek key.
type Conn = {route: RouteId; region: Region; suffix?: string};
const CONNECTED: Conn[] = [
  {route: 'chatgpt', region: 'global'},
  {route: 'kimi-code', region: 'global'},
  {route: 'glm-plan', region: 'cn', suffix: 'a41c'},
  {route: 'deepseek', region: 'global', suffix: '9f2e'},
];
const connOf = (id: RouteId) => CONNECTED.find((c) => c.route === id);
const m = (provider: string, id: string, name: string, levels = ['off', 'low', 'medium', 'high']) =>
  ({provider, id, name, thinking_levels: levels} as unknown as ModelChoice);
const MODELS: Record<string, ModelChoice[]> = {
  chatgpt: [m('openai-codex', 'gpt-6-astra', 'GPT-6 Astra', ['low', 'medium', 'high', 'xhigh']), m('openai-codex', 'gpt-6.1-sol', 'GPT-6.1 Sol', ['low', 'medium', 'high', 'xhigh']), m('openai-codex', 'gpt-6.1-terra', 'GPT-6.1 Terra'), m('openai-codex', 'gpt-6-luna', 'GPT-6 Luna')],
  'kimi-code': [m('kimi-coding', 'k3.1-pro', 'Kimi K3.1 Pro'), m('kimi-coding', 'k3', 'Kimi K3'), m('kimi-coding', 'kimi-for-coding', 'Kimi for Coding')],
  'glm-plan': [m('zai-coding-cn', 'glm-5.3', 'GLM-5.3'), m('zai-coding-cn', 'glm-5.3-flash', 'GLM-5.3 Flash'), m('zai-coding-cn', 'glm-4.6v', 'GLM-4.6V', ['off'])],
  deepseek: [m('deepseek', 'deepseek-v4-pro', 'DeepSeek V4 Pro', ['off', 'high']), m('deepseek', 'deepseek-flash', 'DeepSeek Flash', ['off', 'high'])],
};
const ALL_MODELS = Object.values(MODELS).flat();
const DEFAULT = {route: 'kimi-code' as RouteId, model: 'k3.1-pro', thinking: 'medium'};
const qualified = (r: RouteId, id: string) => `${MODELS[r].find((x) => x.id === id)?.provider}/${id}`;
const routeLabel = (c: Conn) => {
  const r = route(c.route);
  return `${r.name}${regional(r) ? ` · ${regionName(r, c.region)}` : ''}`;
};

// ---------- Shared pieces ----------
let toastSink: (m: string) => void = noop;

function Mark({r, small}: {r: Route; small?: boolean}) { return <LetterMark mark={r.mark} tone={toneOf(r)} small={small} />; }
function SvcMark({s, small}: {s: Service; small?: boolean}) { return <LetterMark mark={s.mark} tone={s.tone} small={small} />; }

function Shell({admin = false, children}: {admin?: boolean; children: ReactNode}) {
  const own = Object.entries(T.nav) as [string, string][];
  const adm = Object.entries(T.navAdminItems) as [string, string][];
  const icons: Record<string, Parameters<typeof Icon>[0]['name']> = {tili: 'user', tekoaly: 'agent', avaimet: 'link', tiedot: 'disk', ulkoasu: 'eye', aiavain: 'server', kayttoonotto: 'users'};
  const current = admin ? 'aiavain' : 'tekoaly';
  return (
    <div className="rq-shell" data-testid="rq-page">
      <nav className="s-nav rq-nav" aria-label={T.settings}>
        <h1>{T.settings}</h1>
        <span className="s-nav-h">{T.navOwn}</span>
        {own.map(([id, label]) => <button key={id} type="button" className="s-nav-i" aria-current={id === current ? 'page' : undefined} onClick={() => toastSink(T.notInRound)}><Icon name={icons[id]} />{label}</button>)}
        <span className="s-nav-h">{T.navAdmin}</span>
        {adm.map(([id, label]) => <button key={id} type="button" className="s-nav-i" aria-current={id === current ? 'page' : undefined} onClick={() => toastSink(T.notInRound)}><Icon name={icons[id]} />{label}</button>)}
      </nav>
      <main className="rq-main">{children}</main>
    </div>
  );
}

function DefaultRow() {
  return (
    <div className="s-row" data-settings-row="default-model">
      <div className="s-lbl"><strong>{T.defaultModel}</strong><span className="s-desc">{T.defaultModelDesc} · {routeLabel(connOf(DEFAULT.route)!)}</span></div>
      <div className="s-val"><button type="button" className="rq-chip-btn" onClick={() => toastSink(T.notInRound)}><ModelChip model={qualified(DEFAULT.route, DEFAULT.model)} thinking={DEFAULT.thinking} models={ALL_MODELS} /></button></div>
    </div>
  );
}

const connDesc = (c: Conn) => {
  const r = route(c.route);
  const s = svc(r.service);
  const parts: string[] = [];
  if (regional(r)) parts.push(regionName(r, c.region));
  if (c.suffix) parts.push(T.keyEnds(c.suffix));
  parts.push(T.models(MODELS[c.route]?.length ?? r.models));
  parts.push(r.way === 'key' ? T.billedBy(s.name) : T.inPlan(r.name));
  return parts.join(' · ');
};

function ConnRow({c, by}: {c: Conn; by: 'way' | 'service'}) {
  const r = route(c.route);
  return (
    <div className="s-row s-marked" data-testid={`rq-conn-${c.route}`}>
      <Mark r={r} small={by === 'service'} />
      <div className="s-lbl">
        <strong className="s-key-name">{r.name}{by === 'service' || r.way === 'plan' ? <> <Badge label={T.ways[r.way]} /></> : null}</strong>
        <span className="s-desc">{connDesc(c)}</span>
      </div>
      <div className="s-val">
        {r.way === 'signin' ? <StatusMark kind="success" tone="success" label={T.signedIn} /> : null}
        <Button size="row" variant="secondary" onPress={() => toastSink(T.notInRound)}>{r.way === 'signin' ? T.signInAgain : T.change}</Button>
        <Button size="row" variant="quiet" onPress={() => toastSink(T.notInRound)}>{T.remove}</Button>
      </div>
    </div>
  );
}

// ---------- Flows: sign-in and key ----------
function SignInStep({r, onDone, lead = true}: {r: Route; onDone: () => void; lead?: boolean}) {
  const [done, setDone] = useState(false);
  return (
    <div className="rq-flow" data-testid="rq-signin" data-route={r.id}>
      {lead ? <p className="s-desc">{T.waysLong.signin}</p> : null}
      <p>{T.codeLead(r.host ?? '')}</p>
      <div className="rq-code" data-testid="rq-code"><code>KQ7M-4TXP</code>
        <Button size="row" onPress={() => toastSink(T.notInRound)}><Icon name="copy" />{T.copyCode}</Button>
        <Button size="row" variant="primary" onPress={() => toastSink(`${T.wouldOpen} https://${r.host}`)}><Icon name="external" />{T.openPage}</Button>
      </div>
      {r.id === 'grok-sub' ? <p className="s-desc">{T.grokNote}</p> : null}
      {done ? <p role="status" data-testid="rq-signed"><StatusMark kind="success" tone="success" label={T.doneSignIn(r.name, r.models)} /></p>
        : <p role="status" className="rq-wait"><StatusMark tone="info" animated label={T.waiting} /></p>}
      {!done ? <button type="button" className="rq-control" data-testid="rq-simulate" onClick={() => { setDone(true); onDone(); }}>{T.simulate}</button> : null}
    </div>
  );
}

function KeyStep({r, initialRegion = 'global', onSaved, lead = true}: {r: Route; initialRegion?: Region; onSaved: () => void; lead?: boolean}) {
  const [region, setRegion] = useState<Region>(initialRegion);
  const [edition, setEdition] = useState<'team' | 'personal'>('personal');
  const [key, setKey] = useState('');
  const s = svc(r.service);
  const pi = r.pi[region] ?? r.pi.global!;
  const piId = r.editions && edition === 'personal' ? pi.replace('qwen-token-plan', 'qwen-token-plan-individual') : pi;
  return (
    <form className="rq-flow" data-testid="rq-keyform" data-route={r.id} data-region={region} onSubmit={(e) => { e.preventDefault(); if (key.length >= 8) onSaved(); }}>
      {lead ? <p className="s-desc">{T.waysLong[r.way]}</p> : null}
      {regional(r) ? (
        <div className="rq-field">
          <span className="rq-field-l">{T.region}</span>
          <Segmented data-testid="rq-region" label={T.region} size="row" value={region} onChange={setRegion}
            options={(['global', 'cn'] as Region[]).map((g) => ({id: g, label: regionName(r, g)}))} />
          <span className="s-desc">{T.regionHelp}</span>
        </div>
      ) : null}
      {r.editions ? (
        <div className="rq-field">
          <span className="rq-field-l">{T.edition}</span>
          <Segmented data-testid="rq-edition" label={T.edition} size="row" value={edition} onChange={setEdition}
            options={[{id: 'personal', label: T.editions.personal}, {id: 'team', label: T.editions.team}]} />
        </div>
      ) : null}
      {r.buy ? <p className="s-desc">{T.keyBuy(r.buy[region] ?? '')} · <a href={`https://${r.buy[region]}`}>{T.pricesThere}</a></p> : null}
      <label className="s-field">
        {T.keyLabel(r.name)}
        <input data-testid="rq-key-input" type="password" autoComplete="off" spellCheck={false} value={key}
          placeholder={r.prefix ? `${r.prefix}…` : '…'} onChange={(e) => setKey(e.target.value)} />
      </label>
      {connOf(r.id)?.suffix ? <p className="s-desc" data-testid="rq-replaces">{T.replaces(connOf(r.id)!.suffix!)}</p> : null}
      <p className="s-desc">{T.keyOnce} {r.way === 'key' ? T.billedBy(s.name) : T.inPlan(r.name)}</p>
      <p className="s-desc rq-mono" data-testid="rq-pi-id">{T.endpoint}: <code>{piId}</code></p>
      <div className="ah-dialog-actions">
        <Button size="row" variant="primary" type="submit" data-testid="rq-key-save" isDisabled={key.length < 8}>{T.saveKey}</Button>
      </div>
    </form>
  );
}

function Flow({r, region, onDone, lead = true}: {r: Route; region?: Region; onDone: () => void; lead?: boolean}) {
  return r.way === 'signin' ? <SignInStep r={r} onDone={onDone} lead={lead} /> : <KeyStep r={r} initialRegion={region} onSaved={onDone} lead={lead} />;
}

// ---------- Add dialog ----------
type Step = {kind: 'list'} | {kind: 'route'; id: RouteId; region?: Region} | {kind: 'service'; id: ServiceId; route?: RouteId; region?: Region};

function OptionButton({mark, title, desc, testId, onClick, pressed, end}: {mark: ReactNode; title: string; desc: string; testId: string; onClick: () => void; pressed?: boolean; end?: ReactNode}) {
  return (
    <button type="button" className="s-prov-opt" data-testid={testId} aria-pressed={pressed} onClick={onClick}>
      {mark}
      <span className="s-lbl"><strong>{title}</strong><span className="s-desc">{desc}</span></span>
      {end}
    </button>
  );
}

function AddDialog({direction, step, setStep, onClose}: {direction: number; step: Step | null; setStep: (s: Step) => void; onClose: () => void}) {
  const [query, setQuery] = useState('');
  if (!step) return null;
  const q = query.trim().toLowerCase();
  const matchR = (r: Route) => !q || `${r.name} ${svc(r.service).name}`.toLowerCase().includes(q);
  const matchS = (s: Service) => !q || s.name.toLowerCase().includes(q) || ROUTES.some((r) => r.service === s.id && r.name.toLowerCase().includes(q));
  const finish = () => window.setTimeout(onClose, 900);
  let title = T.addTitle;
  let body: ReactNode = null;
  const search = (
    <label className="s-field rq-search">
      <span className="ah-visually-hidden">{T.search}</span>
      <input data-testid="rq-search" type="search" placeholder={T.search} value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
  );
  if (step.kind === 'list' && direction === 0) {
    body = (
      <>
        <p className="s-desc">{T.addIntro}</p>
        {search}
        {WAYS.map((w) => {
          const rs = ROUTES.filter((r) => r.way === w && matchR(r));
          if (!rs.length) return null;
          return (
            <fieldset key={w} className="s-prov-opts rq-group" data-testid={`rq-group-${w}`}>
              <legend className="rq-group-h">{T.groupHeads[w]}</legend>
              {rs.map((r) => {
                const c = connOf(r.id);
                return <OptionButton key={r.id} testId={`rq-opt-${r.id}`} mark={<Mark r={r} />} title={r.name}
                  desc={[regional(r) ? T.globalAndChina : null, svc(r.service).china ? null : T.noChina].filter(Boolean).join(' · ') || T.worksInChina}
                  end={c ? <Badge label={T.connected} tone="success" /> : null}
                  onClick={() => setStep({kind: 'route', id: r.id})} />;
              })}
              {w === 'signin' && !q ? <p className="s-desc rq-group-note">{T.noSubscription}</p> : null}
            </fieldset>
          );
        })}
      </>
    );
  } else if (step.kind === 'list') {
    const groups: [string, Service[]][] = [[T.intl, SERVICES.filter((s) => !s.china)], [T.chinese, SERVICES.filter((s) => s.china)]];
    body = (
      <>
        <p className="s-desc">{T.addIntroB}</p>
        {search}
        {groups.map(([h, ss]) => {
          const shown = ss.filter(matchS);
          if (!shown.length) return null;
          return (
            <fieldset key={h} className="s-prov-opts rq-group rq-grid" data-testid={`rq-svcgroup-${h === T.intl ? 'intl' : 'cn'}`}>
              <legend className="rq-group-h">{h}</legend>
              {shown.map((s) => {
                const ways = [...new Set(ROUTES.filter((r) => r.service === s.id).map((r) => r.way))];
                const has = CONNECTED.some((c) => route(c.route).service === s.id);
                return <OptionButton key={s.id} testId={`rq-svc-${s.id}`} mark={<SvcMark s={s} />} title={s.name}
                  desc={ways.map((w) => T.ways[w]).join(' · ')} end={has ? <Badge label={T.connected} tone="success" /> : null}
                  onClick={() => setStep({kind: 'service', id: s.id})} />;
              })}
            </fieldset>
          );
        })}
      </>
    );
  } else if (step.kind === 'route') {
    const r = route(step.id);
    title = r.way === 'signin' ? T.signInTitle(r.name) : T.keyLabel(r.name);
    body = (
      <>
        <button type="button" className="rq-back" data-testid="rq-back" onClick={() => setStep({kind: 'list'})}><Icon name="back" />{T.back}</button>
        <div className="rq-flow-head"><Mark r={r} /><strong>{r.name}</strong><Badge label={T.ways[r.way]} /></div>
        <Flow r={r} region={step.region} onDone={finish} />
      </>
    );
  } else {
    const s = svc(step.id);
    const rs = ROUTES.filter((r) => r.service === s.id);
    const chosen = step.route ?? (rs.length === 1 ? rs[0].id : undefined);
    title = s.name;
    body = (
      <>
        <button type="button" className="rq-back" data-testid="rq-back" onClick={() => setStep({kind: 'list'})}><Icon name="back" />{T.back}</button>
        <div className="rq-flow-head"><SvcMark s={s} /><strong>{s.name}</strong>{s.china ? <Badge label={T.worksInChina} /> : <Badge label={T.noChina} />}</div>
        <fieldset className="s-prov-opts rq-group" data-testid="rq-ways">
          <legend className="rq-group-h">{T.how}</legend>
          {rs.map((r) => {
            const c = connOf(r.id);
            return <OptionButton key={r.id} testId={`rq-way-${r.id}`} pressed={chosen === r.id} mark={<Mark r={r} small />} title={`${T.ways[r.way]}: ${r.name}`}
              desc={T.waysLong[r.way]} end={c ? <Badge label={T.connected} tone="success" /> : null}
              onClick={() => setStep({kind: 'service', id: s.id, route: r.id, region: step.region})} />;
          })}
          {s.id === 'google' ? <p className="s-desc rq-group-note">{T.noSubscription}</p> : null}
        </fieldset>
        {chosen ? <Flow key={chosen} r={route(chosen)} region={step.region} onDone={finish} lead={false} /> : null}
      </>
    );
  }
  return (
    <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="ah-modal s-key-dialog rq-dialog">
        <AriaDialog className="ah-dialog" data-testid="rq-dialog" data-step={step.kind} aria-label={title}>
          <Heading slot="title">{title}</Heading>
          {body}
          {step.kind === 'list' ? <div className="ah-dialog-actions"><Button size="row" data-testid="rq-cancel" onPress={onClose}>{T.cancel}</Button></div> : null}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- Settings › AI ----------
function SettingsPage({direction, initial}: {direction: number; initial: Step | null}) {
  const [step, setStep] = useState<Step | null>(initial);
  const open = (s: Step) => setStep(s);
  const subs = CONNECTED.filter((c) => route(c.route).way !== 'key');
  const keys = CONNECTED.filter((c) => route(c.route).way === 'key');
  const byService = SERVICES.map((s) => ({s, cs: CONNECTED.filter((c) => route(c.route).service === s.id)})).filter((x) => x.cs.length);
  return (
    <Shell>
      <h2>{T.ai}</h2>
      <div className="s-stack">
        <p className="s-intro">{T.aiIntro}</p>
        <div className="s-card"><DefaultRow /></div>
        {direction === 0 ? (
          <>
            <h3 className="s-h3">{T.subscriptions}<span className="s-count">{subs.length}</span></h3>
            <div className="s-card" data-testid="rq-subs">
              {subs.map((c) => <ConnRow key={c.route} c={c} by="way" />)}
              <div className="s-row s-key-add">
                <p className="s-desc">{lang === 'fi' ? 'Tilauksia: ChatGPT, Claude, Kimi Code, SuperGrok sekä GLM:n, MiniMaxin ja Qwenin coding planit.' : 'Subscriptions: ChatGPT, Claude, Kimi Code, SuperGrok and the coding plans of GLM, MiniMax and Qwen.'}</p>
                <div className="s-val"><Button size="row" data-testid="rq-add-sub" onPress={() => open({kind: 'list'})}><Icon name="plus" />{T.addSubscription}</Button></div>
              </div>
            </div>
            <h3 className="s-h3">{T.apiKeys}<span className="s-count">{keys.length}</span></h3>
            <div className="s-card" data-testid="rq-keys">
              {keys.map((c) => <ConnRow key={c.route} c={c} by="way" />)}
              <div className="s-row s-key-add">
                <p className="s-desc">{lang === 'fi' ? 'Avaimella voi käyttää palvelun malleja ilman tilausta; palvelu laskuttaa käytöstä.' : 'A key uses a service\'s models without a subscription; the service bills for use.'}</p>
                <div className="s-val"><Button size="row" data-testid="rq-add-key" onPress={() => open({kind: 'list'})}><Icon name="plus" />{T.addKey}</Button></div>
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="s-h3">{T.services}<span className="s-count">{byService.length}</span></h3>
            <div className="s-card" data-testid="rq-services">
              {byService.map(({s, cs}) => (
                <div key={s.id} className="rq-svc" data-testid={`rq-svcrow-${s.id}`} role="group" aria-label={s.name}>
                  <div className="s-row s-marked rq-svc-head">
                    <SvcMark s={s} />
                    <div className="s-lbl"><strong>{s.name}</strong>
                      <span className="s-desc">{ROUTES.filter((r) => r.service === s.id && !connOf(r.id)).map((r) => r.name).join(', ') ? `${lang === 'fi' ? 'Myös' : 'Also'}: ${ROUTES.filter((r) => r.service === s.id && !connOf(r.id)).map((r) => r.name).join(', ')}` : ''}</span>
                    </div>
                    <div className="s-val"><Button size="row" variant="quiet" data-testid={`rq-manage-${s.id}`} onPress={() => open({kind: 'service', id: s.id})}>{T.manage}</Button></div>
                  </div>
                  {cs.map((c) => <ConnRow key={c.route} c={c} by="service" />)}
                </div>
              ))}
              <div className="s-row s-key-add">
                <p className="s-desc">{lang === 'fi' ? `${SERVICES.length} palvelua tarjolla tällä palvelimella.` : `${SERVICES.length} services offered on this server.`}</p>
                <div className="s-val"><Button size="row" data-testid="rq-add-service" onPress={() => open({kind: 'list'})}><Icon name="plus" />{T.addService}</Button></div>
              </div>
            </div>
          </>
        )}
      </div>
      {/* Unmounted when closed, so a search does not survive into the next opening. */}
      {step ? <AddDialog direction={direction} step={step} setStep={setStep} onClose={() => setStep(null)} /> : null}
    </Shell>
  );
}

// ---------- Model picker ----------
const THINK = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
function Thinking({model, value, onChange}: {model?: ModelChoice; value: string; onChange: (v: string) => void}) {
  return (
    <div className="md-think">
      <span>{T.thinking}</span>
      <Segmented label={T.thinking} className="md-seg" value={value} onChange={onChange}
        options={THINK.map((l) => ({id: l, label: l, isDisabled: !model?.thinking_levels?.includes(l)}))} />
      <p className="md-note md-think-about">{T.thinkingShort}</p>
    </div>
  );
}

function PickerBody({direction, fresh, close}: {direction: number; fresh: boolean; close: () => void}) {
  const [r, setR] = useState<RouteId>(DEFAULT.route);
  const [sel, setSel] = useState<{route: RouteId; id: string}>({route: DEFAULT.route, id: DEFAULT.model});
  const [thinking, setThinking] = useState(DEFAULT.thinking);
  const [also, setAlso] = useState(false);
  const selected = MODELS[sel.route].find((x) => x.id === sel.id);
  const subs = CONNECTED.filter((c) => route(c.route).way !== 'key');
  const keys = CONNECTED.filter((c) => route(c.route).way === 'key');
  const footer = (
    <>
      {!fresh ? <p className="md-note">{T.notChanged}</p> : null}
      <label className="md-also"><input type="checkbox" checked={also} onChange={(e) => setAlso(e.target.checked)} /> {T.alsoDefault}</label>
      <div className="md-picker-actions rq-picker-actions">
        <a href="#asetukset" className="md-note" data-testid="rq-more-services">{T.moreServices}</a>
        <Button size="row" variant="primary" data-testid="rq-choose" onPress={close}>{T.choose}</Button>
      </div>
    </>
  );
  if (direction === 0) {
    return (
      <div className="ah-pi-model-selector rq-picker" data-testid="rq-picker" data-direction="0">
        <label className="rq-route-field">
          <span>{T.route}</span>
          <select className="rq-select" data-testid="rq-route" value={r} onChange={(e) => setR(e.target.value as RouteId)}>
            <optgroup label={T.subscriptions}>{subs.map((c) => <option key={c.route} value={c.route}>{routeLabel(c)}</option>)}</optgroup>
            <optgroup label={T.apiKeys}>{keys.map((c) => <option key={c.route} value={c.route}>{routeLabel(c)}</option>)}</optgroup>
          </select>
        </label>
        <ModelPicker key={r} models={MODELS[r]} selected={sel.route === r ? sel.id : undefined} thinking={sel.route === r ? thinking : undefined}
          onSelect={(id) => setSel({route: r, id})} onThinking={setThinking} />
        {footer}
      </div>
    );
  }
  return (
    <div className="ah-pi-model-selector rq-picker" data-testid="rq-picker" data-direction="1">
      <div className="rq-pick-groups" data-testid="rq-pick-groups">
        {CONNECTED.map((c) => {
          const rr = route(c.route);
          return (
            <section key={c.route} className="rq-pick-group" data-testid={`rq-pick-${c.route}`} aria-label={svc(rr.service).name}>
              <h4 className="md-others-h rq-pick-h"><Mark r={rr} small /><span>{svc(rr.service).name}</span><span className="md-note">{T.ways[rr.way]}{regional(rr) ? ` · ${regionName(rr, c.region)}` : ''}</span></h4>
              <ModelPicker models={MODELS[c.route]} selected={sel.route === c.route ? sel.id : undefined} onSelect={(id) => setSel({route: c.route, id})} />
            </section>
          );
        })}
      </div>
      <Thinking model={selected} value={thinking} onChange={setThinking} />
      {footer}
    </div>
  );
}

function Conversation({direction, fresh}: {direction: number; fresh: boolean}) {
  const chip = useRef<HTMLDetailsElement>(null);
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLDetailsElement>(fresh ? '.md-empty-picker' : '.rq-conv-picker');
    if (el) el.open = true;
  }, [fresh]);
  const model = qualified(DEFAULT.route, DEFAULT.model);
  const closeChip = () => { if (chip.current) chip.current.open = false; };
  return (
    <div className="rq-conv" data-testid="rq-page">
      <header className="rq-conv-head">
        <strong>{fresh ? T.newConversation : T.convTitle}</strong>
        <span className="md-note">open-habitat-docs</span>
        {!fresh ? <ModelChip compact model={model} thinking={DEFAULT.thinking} models={ALL_MODELS} /> : null}
      </header>
      <div className="rq-conv-stream">
        {fresh ? <p className="rq-empty">{T.firstMessage}</p> : (
          <>
            <div className="rq-bubble rq-user">{T.convUser}</div>
            <div className="rq-bubble rq-agent">{T.convAgent}</div>
          </>
        )}
      </div>
      <div className="rq-composer">
        <div className="rq-field-box">{T.draft}</div>
        <div className="rq-composer-foot">
          {fresh ? (
            <ComposerModelPicker model={model} thinking={DEFAULT.thinking} models={ALL_MODELS}>
              {(close) => <PickerBody direction={direction} fresh close={close} />}
            </ComposerModelPicker>
          ) : (
            <details className="md-empty-picker rq-conv-picker" ref={chip}>
              <ModelChip as="summary" data-testid="composer-model-picker" model={model} thinking={DEFAULT.thinking} models={ALL_MODELS} className="md-pill" aria-label={T.conversationOwn} />
              <div className="md-pop md-pop-up" data-testid="composer-model-menu">
                <p className="rq-pop-h">{T.conversationOwn}</p>
                <PickerBody direction={direction} fresh={false} close={closeChip} />
              </div>
            </details>
          )}
          <Button size="row" variant="primary" onPress={noop}>{T.send}</Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Onboarding ----------
type Opt = {id: string; mark: ReactNode; name: string; how: string; route?: Route; service?: Service};
function Onboarding({direction, china}: {direction: number; china: boolean}) {
  const [choice, setChoice] = useState<string>(china ? 'glm-plan' : '');
  const [others, setOthers] = useState(false);
  const routeOpt = (r: Route): Opt => ({id: r.id, mark: r.mark, name: r.name, how: [T.ways[r.way], regional(r) ? T.globalAndChina : null].filter(Boolean).join(' · '), route: r});
  const svcOpt = (s: Service): Opt => ({id: s.id, mark: s.mark, name: s.name, how: [...new Set(ROUTES.filter((r) => r.service === s.id).map((r) => T.ways[r.way]))].join(' · '), service: s});
  const body = (o: Opt) => {
    if (o.route) return <Flow r={o.route} region={china ? 'cn' : 'global'} onDone={noop} />;
    const rs = ROUTES.filter((r) => r.service === o.service!.id);
    return <ServiceBody rs={rs} china={china} />;
  };
  const row = (o: Opt, suggested = false) => {
    const open = choice === o.id;
    return (
      <li key={o.id} className="ah-ai-option" data-testid={`ai-option-${o.id}`} data-open={open}>
        <button type="button" className="ah-ai-option-head" aria-expanded={open} data-testid={`ai-option-${o.id}-choose`} onClick={() => setChoice(open ? '' : o.id)}>
          <span className="ah-ai-mark" aria-hidden="true">{o.mark}</span>
          <span className="ah-ai-option-text"><strong>{o.name}</strong><small>{o.how}</small></span>
          {suggested ? <span className="ah-ai-badge" data-testid="ai-suggestion">{T.obSuggestion}</span> : <span className="ah-ai-radio" aria-hidden="true" />}
        </button>
        {open ? <div className="ah-ai-option-body">{body(o)}</div> : null}
      </li>
    );
  };
  const list = (opts: Opt[], suggested?: string) => <ul className="ah-ai-options">{opts.map((o) => row(o, o.id === suggested))}</ul>;
  let content: ReactNode;
  if (direction === 0) {
    const avail = (r: Route) => !china || svc(r.service).china;
    const groups = (filter: (r: Route) => boolean, skip?: string) => WAYS.map((w) => {
      const rs = ROUTES.filter((r) => r.way === w && filter(r) && r.id !== skip);
      return rs.length ? <div key={w}><p className="ah-ai-group">{T.groupHeads[w]}</p>{list(rs.map(routeOpt))}</div> : null;
    });
    const out = ROUTES.filter((r) => !avail(r));
    content = china ? (
      <>
        {list([routeOpt(route('glm-plan'))], 'glm-plan')}
        {groups(avail, 'glm-plan')}
        <button type="button" className="ah-ai-more" data-testid="ai-others-toggle" aria-expanded={others} onClick={() => setOthers(!others)}><span aria-hidden="true">›</span> {T.obOthersCn(out.length)}</button>
        {others ? <div className="ah-ai-groups rq-unavail">{list(out.map(routeOpt))}</div> : null}
      </>
    ) : groups(() => true);
  } else {
    const avail = SERVICES.filter((s) => !china || s.china);
    const out = SERVICES.filter((s) => china && !s.china);
    content = china ? (
      <>
        <p className="ah-ai-group">{T.worksInChina}</p>
        {list(avail.map(svcOpt), 'zai')}
        <button type="button" className="ah-ai-more" data-testid="ai-others-toggle" aria-expanded={others} onClick={() => setOthers(!others)}><span aria-hidden="true">›</span> {T.obOthersCn(out.length)}</button>
        {others ? <div className="ah-ai-groups rq-unavail">{list(out.map(svcOpt))}</div> : null}
      </>
    ) : (
      <>
        <p className="ah-ai-group">{T.intl}</p>{list(SERVICES.filter((s) => !s.china).map(svcOpt))}
        <p className="ah-ai-group">{T.chinese}</p>{list(SERVICES.filter((s) => s.china).map(svcOpt))}
      </>
    );
  }
  useEffect(() => { if (china && direction === 1) setChoice('zai'); }, [china, direction]);
  return (
    <div className="rq-onboarding" data-testid="rq-page">
      <div className="rq-ob-card">
        <p className="rq-eyebrow">{T.obEyebrow}</p>
        <h2>{T.obTitle}</h2>
        <p className="s-intro">{china ? T.obLeadCn : T.obLead}</p>
        <div className="ah-ai-groups" data-testid="ai-options">{content}</div>
        <div className="rq-ob-actions"><Button size="row" variant="quiet" onPress={() => toastSink(T.notInRound)}>{T.skip}</Button></div>
      </div>
    </div>
  );
}

function ServiceBody({rs, china}: {rs: Route[]; china: boolean}) {
  const [chosen, setChosen] = useState<RouteId>(rs.find((r) => r.way === 'plan')?.id ?? rs[0].id);
  return (
    <div className="rq-svc-body">
      {rs.length > 1 ? (
        <Segmented data-testid="rq-ob-way" label={T.how} size="row" value={chosen} onChange={setChosen}
          options={rs.map((r) => ({id: r.id, label: T.ways[r.way]}))} />
      ) : null}
      <Flow key={chosen} r={route(chosen)} region={china ? 'cn' : 'global'} onDone={noop} />
    </div>
  );
}

// ---------- Administration ----------
function Admin({direction}: {direction: number}) {
  const [region, setRegion] = useState<Region>('global');
  const [offered, setOffered] = useState<Set<RouteId>>(new Set(ROUTES.map((r) => r.id).filter((id) => id !== 'claude')));
  const [editing, setEditing] = useState(false);
  const [siteRoute, setSiteRoute] = useState<RouteId>('glm-plan');
  const [siteService, setSiteService] = useState<ServiceId>('zai');
  const [siteRegion, setSiteRegion] = useState<Region>('global');
  const toggle = (id: RouteId) => setOffered((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const order = (ss: Service[]) => (region === 'cn' ? [...ss.filter((s) => s.china), ...ss.filter((s) => !s.china)] : ss);
  const keyRoutes = ROUTES.filter((r) => r.way !== 'signin');
  const sr = direction === 0 ? route(siteRoute) : (keyRoutes.find((r) => r.service === siteService && r.way === 'plan') ?? keyRoutes.find((r) => r.service === siteService)!);
  const routeCheck = (r: Route) => (
    <label key={r.id} className="rq-check" data-testid={`rq-offer-${r.id}`}>
      <input type="checkbox" checked={offered.has(r.id)} onChange={() => toggle(r.id)} />
      <Mark r={r} small /><span>{r.name}</span>
      {region === 'cn' && !svc(r.service).china ? <span className="md-note">{T.noChina}</span> : null}
    </label>
  );
  return (
    <Shell admin>
      <h2>{T.adminTitle}</h2>
      <div className="s-stack">
        <p className="s-intro">{T.adminIntro}</p>
        <div className="s-card">
          <div className="s-row">
            <div className="s-lbl"><strong>{T.serverRegion}</strong><span className="s-desc">{T.serverRegionDesc}</span></div>
            <div className="s-val"><Segmented data-testid="rq-server-region" label={T.serverRegion} size="row" value={region} onChange={setRegion}
              options={[{id: 'global', label: T.regions.global}, {id: 'cn', label: T.regions.cn}]} /></div>
          </div>
        </div>
        <h3 className="s-h3">{T.offered}<span className="s-count">{offered.size}</span></h3>
        <div className="s-card" data-testid="rq-offered">
          {direction === 0 ? WAYS.map((w) => (
            <div key={w} className="s-row rq-offer-row" role="group" aria-label={T.groupHeads[w]}>
              <div className="s-lbl"><strong>{T.groupHeads[w]}</strong><span className="s-desc">{T.offeredCount(ROUTES.filter((r) => r.way === w && offered.has(r.id)).length, ROUTES.filter((r) => r.way === w).length)}</span></div>
              <div className="rq-checks">{ROUTES.filter((r) => r.way === w).sort((a, b) => (region === 'cn' ? Number(svc(b.service).china) - Number(svc(a.service).china) : 0)).map(routeCheck)}</div>
            </div>
          )) : order(SERVICES).map((s) => (
            <div key={s.id} className="s-row s-marked rq-offer-row" role="group" aria-label={s.name} data-testid={`rq-offer-svc-${s.id}`}>
              <SvcMark s={s} />
              <div className="s-lbl"><strong>{s.name}</strong><span className="s-desc">{region === 'cn' && !s.china ? T.noChina : regional(ROUTES.find((r) => r.service === s.id)!) || ROUTES.some((r) => r.service === s.id && regional(r)) ? T.globalAndChina : s.china ? T.worksInChina : ''}</span></div>
              <div className="rq-checks">{ROUTES.filter((r) => r.service === s.id).map((r) => (
                <label key={r.id} className="rq-check" data-testid={`rq-offer-${r.id}`}><input type="checkbox" checked={offered.has(r.id)} onChange={() => toggle(r.id)} /><span>{T.ways[r.way]}</span></label>
              ))}</div>
            </div>
          ))}
        </div>
        <h3 className="s-h3">{T.siteKey}</h3>
        <div className="s-card" data-testid="rq-sitekey">
          <div className="s-row s-marked">
            <Mark r={route('deepseek')} />
            <div className="s-lbl"><strong>{T.siteKeySet('DeepSeek API', T.regions.global, '77d0')}</strong><span className="s-desc">{T.siteKeyDesc}</span></div>
            <div className="s-val"><Button size="row" data-testid="rq-site-replace" onPress={() => setEditing(true)}>{T.replace}</Button></div>
          </div>
          {editing ? (
            <div className="s-row rq-site-form" data-testid="rq-site-form">
              {direction === 0 ? (
                <label className="rq-route-field"><span>{T.provider}</span>
                  <select className="rq-select" data-testid="rq-site-route" value={siteRoute} onChange={(e) => setSiteRoute(e.target.value as RouteId)}>
                    {(['plan', 'key'] as Way[]).map((w) => <optgroup key={w} label={T.groupHeads[w]}>{keyRoutes.filter((r) => r.way === w).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>)}
                  </select>
                </label>
              ) : (
                <label className="rq-route-field"><span>{T.provider}</span>
                  <select className="rq-select" data-testid="rq-site-service" value={siteService} onChange={(e) => setSiteService(e.target.value as ServiceId)}>
                    {order(SERVICES).filter((s) => keyRoutes.some((r) => r.service === s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              )}
              {regional(sr) ? <Segmented data-testid="rq-site-region" label={T.region} size="row" value={siteRegion} onChange={setSiteRegion} options={(['global', 'cn'] as Region[]).map((g) => ({id: g, label: regionName(sr, g)}))} /> : null}
              <label className="ah-key-embedded-field"><strong>{T.keyLabel(sr.name)}</strong>
                <span className="ah-inline-field"><input type="password" data-testid="rq-site-input" placeholder={sr.prefix ? `${sr.prefix}…` : '…'} />
                  <Button size="row" variant="primary" onPress={() => { setEditing(false); toastSink(T.saved); }}>{T.useKey}</Button>
                  <Button size="row" variant="quiet" onPress={() => setEditing(false)}>{T.cancel}</Button></span>
              </label>
              <p className="s-desc">{T.siteSentOnce}</p>
            </div>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

// ---------- Review chrome ----------
const current = {s: (SCENARIOS as readonly string[]).includes(params.get('s') ?? '') ? (params.get('s') as Scenario) : 'asetukset'};

function Stage({direction, s}: {direction: number; s: Scenario}) {
  switch (s) {
    case 'asetukset': return <SettingsPage direction={direction} initial={null} />;
    case 'lisaa': return <SettingsPage direction={direction} initial={{kind: 'list'}} />;
    case 'tilaus': return <SettingsPage direction={direction} initial={direction === 0 ? {kind: 'route', id: 'kimi-code'} : {kind: 'service', id: 'kimi', route: 'kimi-code'}} />;
    case 'avain': return <SettingsPage direction={direction} initial={direction === 0 ? {kind: 'route', id: 'glm-plan', region: 'cn'} : {kind: 'service', id: 'zai', route: 'glm-plan', region: 'cn'}} />;
    case 'valitsin': return <Conversation direction={direction} fresh={false} />;
    case 'uusi': return <Conversation direction={direction} fresh />;
    case 'kayttoonotto': return <Onboarding direction={direction} china={false} />;
    case 'kayttoonotto-cn': return <Onboarding direction={direction} china />;
    case 'yllapito': return <Admin direction={direction} />;
  }
}

function App({direction}: {direction: number}) {
  const [s, setS] = useState<Scenario>(current.s);
  const [generation, setGeneration] = useState(0);
  const [message, setMessage] = useState('');
  const bar = useRef<HTMLElement>(null);
  toastSink = setMessage;
  useEffect(() => { current.s = s; }, [s]);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.lang = lang; }, []);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.closest('.proto-picker')) return;
      e.preventDefault();
      if (a.getAttribute('href') === '#asetukset') { setS('asetukset'); setGeneration((g) => g + 1); return; }
      setMessage(`${T.wouldOpen} ${a.href}`);
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);
  useEffect(() => { if (!message) return; const id = setTimeout(() => setMessage(''), 4000); return () => clearTimeout(id); }, [message]);
  const relaunch = (key: string, value: string) => {
    const p = new URLSearchParams(location.search);
    p.set(key, value); p.set('v', String(direction + 1)); p.set('s', s); p.set('theme', document.documentElement.dataset.theme ?? theme);
    location.search = p.toString();
  };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong className="rq-title">{T.title}</strong>
        <label>{T.show} <select data-testid="rq-scenario" value={s} onChange={(e) => { setS(e.target.value as Scenario); setGeneration((g) => g + 1); }}>
          {SCENARIOS.map((id) => <option key={id} value={id}>{T.scenarios[id]}</option>)}
        </select></label>
        <label>{T.language} <select data-testid="rq-lang" value={lang} onChange={(e) => relaunch('lang', e.target.value)}>
          <option value="fi">suomi</option><option value="en">English</option></select></label>
        <label>{T.theme} <select data-testid="rq-theme" defaultValue={theme} onChange={(e) => relaunch('theme', e.target.value)}>
          <option value="light">{T.themes.light}</option><option value="dark">{T.themes.dark}</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => setGeneration((g) => g + 1)}>{T.reset}</button>
        <p className="rq-line" data-testid="direction-line">{T.lines[direction]}</p>
      </header>
      <div className="rq-stage"><Stage key={`${generation}-${s}`} direction={direction} s={s} /></div>
      {message ? <p className="rq-toast" role="status" data-testid="rq-toast">{message}</p> : null}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
const stageSink = {set innerHTML(view: ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
const startAt = Math.max(0, Math.min(NAMES.length - 1, Number(params.get('v') ?? 1) - 1));
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n;
  if (i === startAt) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
