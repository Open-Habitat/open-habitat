import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/PiOnboarding.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton, ExternalLink} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {LetterMark} from '../../../../web/src/components/Integrations';
import {Badge, StatusMark} from '../../../../web/src/components/Status';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {type Backend, backendName, type Lang, TEXT} from './text';
import './round.css';

// proto-web-search-key, round 1: how a person sees and adds a web search
// key in Settings › Tekoäly. Jari 10.11.: ChatGPT and Claude (and OpenAI
// and Anthropic keys) search natively with no setup; a key, Brave by
// default and Staan as the EU option, serves models without their own
// search; an administrator may give a site key copied into the person's
// native config (ADR 0030, like the speech key), and a personal key wins.
// Axis: where the search capability sits on the AI page and in which
// existing pattern. 0 is production unchanged. A adds its own section with
// the speech key's inline form, B makes the key one more row among the API
// keys with the AI key's dialog, C is one status-first row in the top card.
// The page around them is production's AccountSettings over a fetch
// stand-in; the search rows are composed of production primitives and
// classes and portalled into the real page. Everything is synthetic.

const NAMES = ['0 Nyt', 'A Oma osio', 'B Avainten joukossa', 'C Yksi rivi'];
const NOW = 0, A = 1, B = 2, C = 3;
let lang: Lang = 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];

// ---- The person's host, as the round imagines the daemon reads it ----
type Key = {backend: Backend; suffix: string; source: 'own' | 'site'; refused?: boolean};
type Site = {backend: Backend; suffix: string};
type Host = {
  /** ChatGPT subscription (openai-codex) signed in. */
  chatgpt: boolean;
  /** Claude subscription (claude-bridge) signed in. */
  claude: boolean;
  /** A DeepSeek API key: a provider without its own web search. */
  deepseek: boolean;
  /** The search key in the person's native config, with its source marker. */
  key: Key | null;
  /** The administrator's site search key, if the site holds one. */
  site: Site | null;
};
const SITE: Site = {backend: 'brave', suffix: 'k7q2'};
const SCENARIOS: Record<string, () => Host> = {
  natiivi: () => ({chatgpt: true, claude: true, deepseek: false, key: null, site: null}),
  'ei-avainta': () => ({chatgpt: false, claude: false, deepseek: true, key: null, site: null}),
  oma: () => ({chatgpt: true, claude: false, deepseek: true, key: {backend: 'brave', suffix: 'a1b2', source: 'own'}, site: null}),
  yllapitaja: () => ({chatgpt: false, claude: true, deepseek: true, key: {...SITE, source: 'site'}, site: SITE}),
  molemmat: () => ({chatgpt: true, claude: false, deepseek: true, key: {backend: 'staan', suffix: 'e5f8', source: 'own'}, site: SITE}),
  torjuttu: () => ({chatgpt: false, claude: false, deepseek: true, key: {backend: 'brave', suffix: 'a1b2', source: 'own', refused: true}, site: null}),
};
const SCENARIO_IDS = Object.keys(SCENARIOS);
const SITE_DAY = {fi: '3.11.', en: '3 November'};
const REFUSED_DAY = {fi: '9.11.', en: '9 November'};

let scenario = new URLSearchParams(location.search).get('s') ?? 'natiivi';
if (!SCENARIOS[scenario]) scenario = 'natiivi';
let host: Host = SCENARIOS[scenario]();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
/** Which of the person's sign-ins search on their own, and which need the key. */
const nativeNames = (h: Host) => [h.chatgpt && 'ChatGPT', h.claude && 'Claude'].filter(Boolean) as string[];
const keyNeeders = (h: Host) => [h.deepseek && 'DeepSeek'].filter(Boolean) as string[];
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const keyShape = /^[A-Za-z0-9_-]{20,128}$/;

/** Save: the daemon tries the key with one search before it writes it.
 * In the round a key starting "huono" or "bad" is refused there. */
async function saveKey(backend: Backend, key: string): Promise<'ok' | 'rejected'> {
  await later(600);
  if (/^(huono|bad)/i.test(key)) return 'rejected';
  host = {...host, key: {backend, suffix: key.slice(-4), source: 'own'}};
  notify();
  return 'ok';
}
/** Remove: an own key with a site key behind it gives way to the site's copy. */
async function removeKey() {
  await later(250);
  host = {...host, key: host.key?.source === 'own' && host.site ? {...host.site, source: 'site'} : null};
  notify();
}
async function takeSiteKey() {
  await later(250);
  if (host.site) host = {...host, key: {...host.site, source: 'site'}};
  notify();
}

// ---- The fetch stand-in behind production's rows ----
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
function models() {
  const seen = new Date(Date.now() - 60000).toISOString();
  const list = [
    ...(host.claude ? [{id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'claude-bridge', outcome: 'answered', observed_at: seen}, {id: 'claude-opus-5-5', name: 'Claude Opus 5.5', provider: 'claude-bridge'}] : []),
    ...(host.chatgpt ? [{id: 'gpt-6-astra', name: 'GPT-6 Astra', provider: 'openai-codex', outcome: 'answered', observed_at: seen}] : []),
    ...(host.deepseek ? [{id: 'deepseek-v4', name: 'DeepSeek V4', provider: 'deepseek', outcome: 'answered', observed_at: seen}, {id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek'}] : []),
  ];
  const first = list[0];
  return {schema_version: 1, default_provider: first?.provider, default_model: first?.id, default_thinking: 'medium', catalog_status: 'native_cached', models: list};
}
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(60);
  if (path === '/api/v1/pi/models') return json(models());
  if (path.startsWith('/api/v1/pi/credentials')) return json({
    schema_version: 1, openai: {present: false, suffix: null}, anthropic: {present: false, suffix: null},
    deepseek: host.deepseek ? {present: true, suffix: 'd3e4'} : {present: false, suffix: null}, subscription: {present: host.chatgpt},
  });
  if (path === '/api/v1/pi/claude-login') return json({schema_version: 1, state: host.claude ? 'completed' : 'missing'});
  return new Response('', {status: 404});
};

// ---- Placing the round's rows on production's page ----
/** A display:contents element kept at the spot `find` names; portals render
 * into it. Production's rows arrive after their reads, so it waits for them. */
function useSlot(find: () => {parent: Element; before: Node | null} | null, id: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const slot = document.createElement('div');
    slot.className = 'rq-slot';
    slot.dataset.slot = id;
    const place = () => {
      const at = find();
      if (!at) { if (slot.isConnected) slot.remove(); return; }
      // Placed right after its anchor, the slot is the anchor's next sibling.
      if (at.before === slot) return;
      if (slot.parentElement !== at.parent || slot.nextSibling !== at.before) at.parent.insertBefore(slot, at.before);
    };
    place();
    const o = new MutationObserver(place);
    o.observe(document.body, {childList: true, subtree: true});
    setEl(slot);
    return () => { o.disconnect(); slot.remove(); };
  }, [id]);
  return el;
}
/** Production's own element, never one of the round's rows inside a slot. */
const q = (s: string) => [...document.querySelectorAll(s)].find((el) => !el.closest('.rq-slot')) ?? null;
const aiStack = () => q('[data-settings-row="agent-work"]')?.closest('.s-stack') ?? null;

// ---- Shared pieces: the key form, its dialog and the removal question ----
function BackendChoice({value, onChange}: {value: Backend; onChange: (b: Backend) => void}) {
  const x = t();
  return (
    <fieldset className="s-prov-opts" data-testid="search-backends">
      <legend className="ah-visually-hidden">{x.service}</legend>
      {(['brave', 'staan'] as Backend[]).map((b) => (
        <button type="button" key={b} className="s-prov-opt" data-testid={`search-backend-${b}`} aria-pressed={value === b} onClick={() => onChange(b)}>
          <LetterMark mark={b === 'brave' ? 'Br' : 'St'} tone={b === 'brave' ? 3 : 1} />
          <span className="s-lbl">
            <strong className="s-key-name">{backendName[b]} <Badge label={b === 'brave' ? x.defaultTag : x.euTag} /></strong>
            <span className="s-desc">{b === 'brave' ? x.braveDesc : x.staanDesc}</span>
          </span>
        </button>
      ))}
    </fieldset>
  );
}

const keyLink: Record<Backend, string> = {brave: 'https://brave.com/search/api/', staan: 'https://staan.ai/'};

/** Choose the service, paste the key, save. Saving tries it once. */
function KeyForm({onDone, onCancel, inline}: {onDone: (message: string) => void; onCancel?: () => void; inline?: boolean}) {
  const x = t();
  const h = useHost();
  const [backend, setBackend] = useState<Backend>(h.key?.source === 'own' ? h.key.backend : 'brave');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(false);
  const wrong = key.length > 0 && !keyShape.test(key.trim());
  const name = backendName[backend];
  const replacing = h.key ? (h.key.source === 'site' ? x.ownReplacesSite : x.replaceNote(`${backendName[h.key.backend]} …${h.key.suffix}`)) : '';
  const submit = async () => {
    if (!keyShape.test(key.trim()) || busy) return;
    setBusy(true);
    setRejected(false);
    const outcome = await saveKey(backend, key.trim());
    setBusy(false);
    if (outcome === 'ok') { setKey(''); onDone(x.saved(name)); } else setRejected(true);
  };
  return (
    <form className={`s-editor rq-key-form${inline ? ' rq-inline' : ''}`} data-testid="search-key-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <BackendChoice value={backend} onChange={(b) => { setBackend(b); setRejected(false); }} />
      <label className="s-field">
        {x.apiKey(name)}
        <input data-testid="search-key-input" type="password" autoComplete="off" spellCheck={false} maxLength={128} value={key}
          aria-invalid={wrong || rejected || undefined} onChange={(e) => { setKey(e.target.value); setRejected(false); }} />
      </label>
      <p className={`s-desc${wrong || rejected ? ' s-bad' : ''}`} data-testid="search-key-note">
        {wrong ? <span role="alert">{x.notKey}</span>
          : rejected ? <span role="alert" data-testid="search-key-rejected">{x.rejected(name)}</span>
          : busy ? <span role="status">{x.checking(name)}</span>
          : <>{replacing ? `${replacing} ` : ''}{x.saveNote} <ExternalLink href={keyLink[backend]} target="_blank" rel="noopener noreferrer">{x.getKey(name)}</ExternalLink></>}
      </p>
      <div className={inline ? 's-actions' : 'ah-dialog-actions'}>
        {onCancel ? <ControlButton data-testid="search-key-cancel" size="row" variant={inline ? 'quiet' : undefined} onPress={onCancel}>{x.cancel}</ControlButton> : null}
        <ControlButton data-testid="search-key-save" size="row" variant="primary" type="submit" isDisabled={busy || !keyShape.test(key.trim())}>
          {inline ? x.save : x.saveKey}
        </ControlButton>
      </div>
    </form>
  );
}

function RemoveDialog({open, onClose, onRemoved}: {open: boolean; onClose: () => void; onRemoved: (m: string) => void}) {
  const x = t();
  const h = useHost();
  const k = h.key;
  const effect = !k ? '' : k.source === 'site'
    ? x.removeSiteCopy + (keyNeeders(h).length ? x.removeThenMissing(keyNeeders(h)) : '')
    : x.removeOwn(backendName[k.backend]) + (h.site ? x.removeThenSite(backendName[h.site.backend])
      : (keyNeeders(h).length ? x.removeThenMissing(keyNeeders(h)) : '') + (nativeNames(h).length ? x.removeThenNative(nativeNames(h)) : ''));
  return (
    <ModalOverlay className="ah-overlay" isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }} isDismissable>
      <Modal className="ah-modal">
        <Dialog className="ah-dialog" aria-label={x.removeQ} data-testid="search-remove-dialog">
          <Heading slot="title">{x.removeQ}</Heading>
          <p>{effect}</p>
          <div className="ah-dialog-actions">
            <ControlButton data-testid="cancel" size="row" onPress={onClose}>{x.cancel}</ControlButton>
            <ControlButton data-testid="search-remove-confirm" size="row" variant="danger-subtle"
              onPress={() => { onClose(); void removeKey().then(() => onRemoved(host.key ? x.siteTaken(backendName[host.key.backend]) : x.removed)); }}>
              {x.removeKey}
            </ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The key's own words: whose, who pays, who uses it, and a refusal first. */
function keyDesc(h: Host, users = true) {
  const x = t();
  const k = h.key;
  if (!k) return keyNeeders(h).length ? x.keyNoneMissing(keyNeeders(h)) : h.site ? x.siteOffered(backendName[h.site.backend]) : x.keyNoneCovered;
  const name = backendName[k.backend];
  return (k.refused ? x.keyRefused(name, REFUSED_DAY[lang]) : '')
    + (k.source === 'site' ? x.keySite(SITE_DAY[lang]) : x.keyOwn(name))
    + (users ? x.keyUsers(keyNeeders(h)) : '')
    + (k.source === 'own' && h.site ? ` ${x.keyBoth(backendName[h.site.backend])}` : '');
}
function KeyName({k}: {k: Key}) {
  const x = t();
  return (
    <>
      {backendName[k.backend]} <code data-testid="search-key-suffix">…{k.suffix}</code>{' '}
      {k.source === 'site'
        ? <StatusMark data-testid="search-key-site" kind="pill" tone="info" label={x.fromAdmin} />
        : <Badge label={x.own} />}
    </>
  );
}
/** The buttons a key row carries, in production's key-row order. */
function KeyActions({h, onChange, onRemove, onUseSite}: {h: Host; onChange: () => void; onRemove: () => void; onUseSite: () => void}) {
  const x = t();
  const k = h.key;
  if (!k) return (
    <>
      {h.site ? <ControlButton data-testid="search-use-site" size="row" variant={keyNeeders(h).length ? 'primary' : 'secondary'} onPress={onUseSite}>{x.useSite}</ControlButton> : null}
      <ControlButton data-testid="search-key-add" size="row" variant={keyNeeders(h).length && !h.site ? 'primary' : 'secondary'} onPress={onChange}>
        <Icon name="plus" />{h.site ? x.addOwn : x.add}
      </ControlButton>
    </>
  );
  return (
    <>
      {k.refused ? <StatusMark tone="danger" kind="error" label={x.notAnswering} /> : null}
      <ControlButton data-testid="search-key-change" size="row" variant={k.refused ? 'primary' : 'secondary'} onPress={onChange}>
        {k.source === 'site' ? x.changeToOwn : x.change}
      </ControlButton>
      <ControlButton data-testid="search-key-remove" size="row" variant="quiet" onPress={onRemove}>{x.remove}</ControlButton>
    </>
  );
}
function Said({message}: {message: string}) {
  return message ? <p className="s-editor s-desc" role="status" data-testid="search-said">{message}</p> : null;
}

/** B and C add and change the key in a window, as Settings does for AI keys. */
function KeyDialog({open, onClose, onDone, onRemove}: {open: boolean; onClose: () => void; onDone: (m: string) => void; onRemove?: () => void}) {
  const x = t();
  const h = useHost();
  return (
    <ModalOverlay className="ah-overlay" isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }} isDismissable>
      <Modal className="ah-modal s-key-dialog">
        <Dialog className="ah-dialog" data-testid="search-key-dialog" aria-label={h.key ? x.changeTitle : x.addTitle}>
          <Heading slot="title">{h.key ? x.changeTitle : x.addTitle}</Heading>
          <p className="s-desc">{x.dialogIntro}</p>
          {onRemove && h.key ? (
            <div className="s-card">
              <div className="s-row s-marked" data-testid="search-key-current">
                <LetterMark mark={h.key.backend === 'brave' ? 'Br' : 'St'} tone={h.key.backend === 'brave' ? 3 : 1} />
                <div className="s-lbl">
                  <strong className="s-key-name"><KeyName k={h.key} /></strong>
                  <span className={`s-desc${h.key.refused ? ' s-bad' : ''}`}>{keyDesc(h)}</span>
                </div>
                <div className="s-val">
                  <ControlButton data-testid="search-key-remove" size="row" variant="quiet" onPress={() => { onClose(); onRemove(); }}>{x.remove}</ControlButton>
                </div>
              </div>
            </div>
          ) : null}
          <KeyForm onCancel={onClose} onDone={(m) => { onClose(); onDone(m); }} />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The state that every direction drives the same way. */
function useKeyFlow() {
  const [said, setSaid] = useState('');
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const x = t();
  return {
    said, editing, removing,
    edit: () => { setSaid(''); setEditing(true); },
    stop: () => setEditing(false),
    done: (m: string) => { setEditing(false); setSaid(m); },
    remove: () => { setSaid(''); setRemoving(true); },
    closeRemove: () => setRemoving(false),
    useSite: () => { setSaid(''); void takeSiteKey().then(() => setSaid(x.siteTaken(backendName[host.key!.backend]))); },
  };
}

// ---- A: a section of its own, the speech key's inline form ----
function DirectionA() {
  const slot = useSlot(() => { const s = aiStack(); return s && q('.s-keys') ? {parent: s, before: null} : null; }, 'a');
  const h = useHost();
  const f = useKeyFlow();
  const x = t();
  const native = nativeNames(h);
  if (!slot) return null;
  return createPortal(
    <section className="s-keys rq-search" data-testid="search-section" data-settings-row="web-search" tabIndex={-1} aria-labelledby="rq-search-h">
      <h3 className="s-h3" id="rq-search-h">{x.webSearch}</h3>
      <div className="s-card">
        <div className="s-row s-marked" data-testid="search-native">
          <Icon name="globe" />
          <div className="s-lbl">
            <strong>{x.nativeTitle}</strong>
            <span className="s-desc">{native.length ? x.nativeOn(native) : x.nativeNone(keyNeeders(h))}</span>
          </div>
          <div className="s-val">
            {native.length ? <StatusMark kind="success" tone="success" label={x.inUse} /> : <StatusMark tone="neutral" label={x.unavailable} />}
          </div>
        </div>
        <div className="s-row s-marked" data-testid="search-key" data-settings-row="search-key" tabIndex={-1} data-source={h.key?.source ?? 'none'}>
          <Icon name="search" />
          <div className="s-lbl">
            <strong className="s-key-name">{x.keyTitle}{h.key ? <>{' '}<KeyName k={h.key} /></> : null}</strong>
            <span className={`s-desc${h.key?.refused ? ' s-bad' : ''}`} data-testid="search-key-desc">{keyDesc(h)}</span>
          </div>
          <div className="s-val">
            {!h.key && keyNeeders(h).length && !h.site ? <StatusMark tone="warning" kind="error" label={x.noSearch} /> : null}
            {f.editing ? null : <KeyActions h={h} onChange={f.edit} onRemove={f.remove} onUseSite={f.useSite} />}
          </div>
          {f.editing ? <KeyForm inline onCancel={f.stop} onDone={f.done} /> : null}
          <Said message={f.said} />
        </div>
      </div>
      <RemoveDialog open={f.removing} onClose={f.closeRemove} onRemoved={f.done} />
    </section>,
    slot,
  );
}

// ---- B: one more row among the API keys, the AI key's dialog ----
function Chip({row, text, none}: {row: string; text: string; none?: boolean}) {
  const slot = useSlot(() => { const r = q(row); return r ? {parent: r, before: null} : null; }, `chip-${row}`);
  const x = t();
  if (!slot) return null;
  return createPortal(
    <div className="s-key-models" data-testid="search-chip">
      <span className="s-desc">{x.chipLabel}</span>
      <ul className="s-model-chips"><li data-refused={none || undefined} className={none ? 'rq-chip-none' : undefined}>{text}</li></ul>
    </div>,
    slot,
  );
}
function DirectionB() {
  const slot = useSlot(() => { const add = q('.s-keys .s-key-add'); return add?.parentElement ? {parent: add.parentElement, before: add} : null; }, 'b');
  const h = useHost();
  const f = useKeyFlow();
  const x = t();
  const k = h.key;
  const keyChip = k ? (k.refused ? x.cRefused(backendName[k.backend]) : x.chipKey(backendName[k.backend])) : x.chipNone;
  return (
    <>
      {h.chatgpt ? <Chip row='[data-settings-row="chatgpt"]' text={x.chipNative} /> : null}
      {h.claude ? <Chip row='[data-settings-row="claude"]' text={x.chipNative} /> : null}
      {h.deepseek ? <Chip row='[data-testid="api-key-row-deepseek"]' text={keyChip} none={!k || k.refused} /> : null}
      {slot ? createPortal(
        <>
          {k ? (
            <div className="s-row s-marked rq-b-row" data-testid="search-key" data-settings-row="search-key" tabIndex={-1} data-source={k.source}>
              <LetterMark mark={k.backend === 'brave' ? 'Br' : 'St'} tone={k.backend === 'brave' ? 3 : 1} />
              <div className="s-lbl">
                <strong className="s-key-name"><KeyName k={k} /></strong>
                <span className={`s-desc${k.refused ? ' s-bad' : ''}`} data-testid="search-key-desc">{keyDesc(h)}</span>
              </div>
              <div className="s-val"><KeyActions h={h} onChange={f.edit} onRemove={f.remove} onUseSite={f.useSite} /></div>
              <div className="s-key-models">
                <span className="s-desc">{x.opens}</span>
                <ul className="s-model-chips"><li>{x.webSearch}</li></ul>
              </div>
              <Said message={f.said} />
            </div>
          ) : (
            <div className="s-row s-key-add rq-b-row" data-testid="search-key" data-settings-row="search-key" tabIndex={-1} data-source="none">
              <p className={`s-desc${keyNeeders(h).length && !h.site ? ' s-bad' : ''}`} data-testid="search-key-desc">
                {keyDesc(h)}{f.said ? ` ${f.said}` : ''}
              </p>
              <div className="s-val"><KeyActions h={h} onChange={f.edit} onRemove={f.remove} onUseSite={f.useSite} /></div>
            </div>
          )}
          <KeyDialog open={f.editing} onClose={f.stop} onDone={f.done} />
          <RemoveDialog open={f.removing} onClose={f.closeRemove} onRemoved={f.done} />
        </>,
        slot,
      ) : null}
    </>
  );
}

// ---- C: one status-first row in the top card ----
function DirectionC() {
  const slot = useSlot(() => { const r = q('[data-settings-row="agent-work"]'); return r?.parentElement ? {parent: r.parentElement, before: r.nextSibling} : null; }, 'c');
  const h = useHost();
  const f = useKeyFlow();
  const x = t();
  const k = h.key;
  const native = nativeNames(h);
  const needers = keyNeeders(h);
  const missing = needers.length > 0 && (!k || !!k.refused);
  const summary = missing ? x.cPartly(needers) : x.cWorksAll;
  if (!slot) return null;
  return createPortal(
    <div className="s-row rq-c-row" data-testid="search-row" data-settings-row="web-search" tabIndex={-1} data-source={k?.source ?? 'none'}>
      <div className="s-lbl">
        <strong>{x.webSearch}</strong>
        <span className={`s-desc${missing ? ' s-bad' : ''}`} data-testid="search-summary">{summary}</span>
        <ul className="s-model-chips rq-c-chips" data-testid="search-sources">
          {native.map((n) => <li key={n}>{n} · {x.cNative}</li>)}
          {needers.map((n) => (
            <li key={n} data-refused={missing || undefined} className={missing ? 'rq-chip-none' : undefined}>
              {n} · {!k ? x.cNone : k.refused ? x.cRefused(backendName[k.backend]) : x.cKey(backendName[k.backend], k.suffix, k.source === 'site')}
            </li>
          ))}
        </ul>
        {k && !needers.length ? <span className="s-desc" data-testid="search-key-desc">{x.cKeyLine(backendName[k.backend], k.suffix)} · {keyDesc(h)}</span>
          : k ? <span className="s-desc" data-testid="search-key-desc">{keyDesc(h, false)}</span>
          : h.site ? <span className="s-desc" data-testid="search-key-desc">{x.siteOffered(backendName[h.site.backend])}</span> : null}
      </div>
      <div className="s-val">
        {missing ? <StatusMark tone={k?.refused ? 'danger' : 'warning'} kind="error" label={k?.refused ? x.notAnswering : x.noSearch} /> : null}
        {k ? <ControlButton data-testid="search-key-change" size="row" variant={k.refused ? 'primary' : 'secondary'} onPress={f.edit}>{x.manage}</ControlButton>
          : <KeyActions h={h} onChange={f.edit} onRemove={f.remove} onUseSite={f.useSite} />}
      </div>
      <Said message={f.said} />
      <KeyDialog open={f.editing} onClose={f.stop} onDone={f.done} onRemove={f.remove} />
      <RemoveDialog open={f.removing} onClose={f.closeRemove} onRemoved={f.done} />
    </div>,
    slot,
  );
}

// ---- The page ----
/** Each direction opens on its difference, as a link to a settings row
 * lands there in production; today lands on the API keys. */
const LANDING = ['api-keys', 'web-search', 'search-key', 'web-search'];
function Page({direction}: {direction: number}) {
  const rail = (
    <WorkspaceRail>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  const main = (
    <div className="ah-settings-layer">
      <div className="ah-state">
        <AccountSettings routeSection="tekoaly" routeRow={LANDING[direction]} onNavigate={() => {}} profile={{name: 'Jari Mustonen', email: '', avatar_url: ''}} csrf="prototype"
          onPiSignIn={() => {}} modelSelector={<button type="button" className="md-pill">{models().models[0]?.name ?? '—'} · medium</button>}
          onClose={() => {}} />
      </div>
      {direction === A ? <DirectionA /> : direction === B ? <DirectionB /> : direction === C ? <DirectionC /> : null}
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={lang === 'fi' ? 'Asetukset' : 'Settings'} rail={rail} main={main} />
    </StatusBellProvider>
  );
}

let reviewTheme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
let reviewMotion = 'system';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [motion, setMotion] = useState(reviewMotion);
  const [language, setLanguage] = useState(lang);
  const [s, setS] = useState(scenario);
  const [generation, setGeneration] = useState(0);
  const [toast, setToast] = useState('');
  const bar = useRef<HTMLElement>(null);
  const x = TEXT[language];
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    if (motion === 'reduce') document.documentElement.dataset.motion = 'reduce';
    else delete document.documentElement.dataset.motion;
  }, [motion]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  // A service's page opens in a new tab in production; here it is named.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="https://"]') as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      setToast(`${language === 'fi' ? 'Avautuisi uuteen välilehteen:' : 'Would open in a new tab:'} ${a.href}`);
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, [language]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 5000); return () => clearTimeout(id); }, [toast]);
  const restart = (next = s) => { scenario = next; host = SCENARIOS[next](); setS(next); setToast(''); setGeneration((g) => g + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => restart(e.target.value)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.motion} <select id="motion" value={motion} onChange={(e) => { reviewMotion = e.target.value; setMotion(reviewMotion); }}>
          <option value="system">{x.motionSystem}</option><option value="reduce">{x.motionReduce}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); setGeneration((g) => g + 1);
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => restart()}>{x.reset}</button>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${generation}-${s}-${language}`} enabled>
          <MemoryRouter key={`${generation}-${s}-${language}`} initialEntries={['/settings/ai']}>
            <Page direction={direction} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {toast ? <p className="rq-toast" role="status" data-testid="rq-toast">{toast}</p> : null}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { host = SCENARIOS[scenario](); flushSync(() => root.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
void NOW;
