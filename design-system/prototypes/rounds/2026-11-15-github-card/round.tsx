import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/Settings.css';
import {CodeHostSettings, type NativeState} from '../../../../web/src/app/CodeHostSettings';
import {ControlButton, ExternalLink} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {LetterMark} from '../../../../web/src/components/Integrations';
import {Menu} from '../../../../web/src/components/Overlays';
import {Button} from '../../../../web/src/components/Primitives';
import {StatusMark} from '../../../../web/src/components/Status';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {type Lang, LOGIN, SCENES, type SceneId, TEXT} from './text';
import './round.css';

// proto-github-card-clarity, round 1. Jari 15.11.2026: Settings › Code
// hosts' GitHub card is confusing; part of its text is unnecessary and
// "Tarkista katkaisu" says nothing about what it does (it is the first step
// of disconnecting, NOTES.md). One view, the card with its workflows row, in
// seven states. Nyt is production's CodeHostSettings unchanged against a
// stand-in daemon. The directions keep every action's behaviour and differ
// on one axis: where the rare actions (sign in again while working,
// disconnect) and the technical detail (scopes, where the token lives) sit.
// 1 behind a Details toggle, 2 always visible, 3 in a ⋯ menu. Everything is
// synthetic.

const directions = ['Nyt', '1 Lisätiedot', '2 Näkyvissä', '3 Valikko'];
const params = new URLSearchParams(location.search);
const BASE = ['gist', 'read:org', 'repo'];
const ALL = [...BASE, 'workflow'];
const SIGN_IN_MS = 900;

// ---------- The directions' stand-in host ----------

type Native = 'connected' | 'expired' | 'disconnected';
type DialogKind = 'verify' | 'back' | 'confirm';
type G = {
  native: Native;
  scopes: string[];
  /** The person's remembered opt-in (github_workflow). */
  wanted: boolean;
  /** Allow was pressed and GitHub never came back. */
  pending: boolean;
  /** A GitHub sign-in under way: where it was started. */
  going: '' | 'card' | 'wf' | 'verify';
  /** The session's GitHub sign-in is under five minutes old. */
  fresh: boolean;
  dialog: DialogKind | null;
  notice: boolean;
  scopesOpen: boolean;
};
const initial = (s: SceneId): G => ({
  native: s === 'expired' ? 'expired' : s === 'none' ? 'disconnected' : 'connected',
  scopes: s === 'on' ? ALL : s === 'expired' || s === 'none' ? [] : BASE,
  wanted: s === 'on' || s === 'missing',
  pending: s === 'pending',
  going: '',
  fresh: false,
  dialog: null,
  notice: false,
  scopesOpen: false,
});
type Wf = 'off' | 'on' | 'missing' | 'pending';
const wfOf = (g: G): Wf => (g.pending ? 'pending' : g.scopes.includes('workflow') ? 'on' : g.wanted ? 'missing' : 'off');

function useG(scene: SceneId) {
  const [g, setG] = useState(() => initial(scene));
  const set = (p: Partial<G>) => setG((x) => ({...x, ...p}));
  /** Production's gateway sign-in: the reconnect keeps the opt-in unless
   * told; every GitHub sign-in makes the session's sign-in fresh. */
  const signIn = (from: G['going'], workflow?: boolean) => {
    set({going: from});
    setTimeout(() => setG((x) => {
      const wanted = workflow ?? x.wanted;
      return {...x, going: '', native: 'connected', pending: false, fresh: true, notice: false,
        wanted: workflow === true ? true : x.wanted,
        scopes: wanted ? ALL : BASE};
    }), SIGN_IN_MS);
  };
  const act = {
    signIn: () => signIn('card'),
    allow: () => signIn('wf', true),
    remove: () => { set({wanted: false}); signIn('wf', false); },
    keepOff: () => set({wanted: false}),
    cancel: () => set({pending: false}),
    // The disconnect GET: refused without a fresh sign-in, else a token.
    openDisconnect: () => setG((x) => ({...x, dialog: x.fresh ? 'confirm' : 'verify'})),
    verify: () => {
      set({going: 'verify'});
      setTimeout(() => setG((x) => ({...x, going: '', fresh: true, dialog: 'back'})), SIGN_IN_MS);
    },
    close: () => set({dialog: null}),
    confirm: () => setG((x) => ({...x, dialog: null, native: 'disconnected', scopes: [], notice: true, fresh: false})),
    toggleScopes: () => setG((x) => ({...x, scopesOpen: !x.scopesOpen})),
  };
  return [g, act] as const;
}
type Act = ReturnType<typeof useG>[1];
type T = (typeof TEXT)['fi'];

// ---------- The directions' card ----------

function IdentityRow({d, g, act, t}: {d: number; g: G; act: Act; t: T}) {
  const ok = g.native === 'connected';
  return (
    <div className="s-row s-marked gc-identity" data-testid="gc-identity" data-native={g.native}>
      <LetterMark mark="GH" tone={0} />
      <div className="s-lbl">
        <strong>GitHub</strong>
        <span className={`s-desc${g.native === 'expired' ? ' s-bad' : ''}`} data-testid="gc-who">
          {ok ? <>{t.as('')}<code className="gc-login">{LOGIN}</code></> : g.native === 'expired' ? t.expiredDesc : t.noneDesc}
        </span>
      </div>
      <div className="s-val">
        {g.going === 'card' ? (
          <StatusMark kind="working" tone="info" label={t.going} data-testid="gc-going" />
        ) : (
          <StatusMark
            data-testid="gc-state"
            label={ok ? t.works : g.native === 'expired' ? t.expired : t.none}
            kind={ok ? 'success' : g.native === 'expired' ? 'error' : 'unknown'}
            tone={ok ? 'success' : g.native === 'expired' ? 'danger' : 'warning'}
          />
        )}
        {!ok && (
          <Button size="row" variant="primary" data-testid="gc-signin" isDisabled={!!g.going}
            label={g.native === 'expired' ? t.signInAgain : t.connect} onPress={act.signIn} />
        )}
        {ok && d === 3 && (
          <Menu
            label={t.more}
            trigger={<Icon name="more" />}
            triggerPresentation="icon"
            triggerTestId="gc-menu"
            placement="bottom end"
            items={[
              {id: 'signin', label: t.signInAgain, description: t.signInAgainDesc},
              {id: 'scopes', label: t.showScopes},
              {id: 'disconnect', label: t.disconnect, description: t.disconnectDesc, danger: true},
            ]}
            onAction={(id) => (id === 'signin' ? act.signIn() : id === 'scopes' ? act.toggleScopes() : act.openDisconnect())}
          />
        )}
      </div>
      {ok && d === 3 && g.scopesOpen && (
        <div className="s-editor" data-testid="gc-scopes-open"><Facts g={g} t={t} /></div>
      )}
      {g.notice && <p className="s-editor s-desc" role="status" data-testid="gc-notice">{t.doneNotice}</p>}
    </div>
  );
}

function Facts({g, t}: {g: G; t: T}) {
  return (
    <div className="gc-facts">
      <p><span className="gc-facts-h">{t.scopesTitle}:</span>{' '}
        {g.scopes.map((s, i) => (
          <React.Fragment key={s}>{i ? ', ' : ''}{t.scopes[s]} <code>{s}</code></React.Fragment>
        ))}
      </p>
      <p>{t.kept}</p>
    </div>
  );
}

function WorkflowRow({g, act, t}: {g: G; act: Act; t: T}) {
  const s = wfOf(g);
  const busy = !!g.going;
  return (
    <div className="s-row s-marked s-wf-row" data-testid="gc-wf" data-wf={s}>
      <span className="s-wf-icon" aria-hidden="true"><Icon name="shield" /></span>
      <div className="s-lbl">
        <strong>{t.wfTitle}</strong>
        <span className={`s-desc${s === 'missing' ? ' s-bad' : ''}`}>
          {s === 'on' ? t.wfOnDesc : s === 'missing' ? t.wfMissingDesc : s === 'pending' ? t.wfPendingDesc : t.wfOffDesc}
        </span>
      </div>
      <div className="s-val">
        {g.going === 'wf' ? (
          <StatusMark kind="working" tone="info" label={t.going} />
        ) : s === 'on' ? (
          <StatusMark kind="success" tone="success" label={t.wfOn} />
        ) : s === 'missing' ? (
          <StatusMark kind="error" tone="warning" label={t.wfMissing} />
        ) : s === 'pending' ? (
          <StatusMark kind="unknown" tone="neutral" label={t.wfPending} />
        ) : (
          <StatusMark tone="neutral" label={t.wfOff} />
        )}
        {s === 'on' ? (
          <ControlButton size="row" variant="secondary" isDisabled={busy} data-testid="gc-wf-remove" onPress={act.remove}>{t.remove}</ControlButton>
        ) : s === 'missing' ? (
          <>
            <ControlButton size="row" variant="quiet" isDisabled={busy} data-testid="gc-wf-keep-off" onPress={act.keepOff}>{t.keepOff}</ControlButton>
            <ControlButton size="row" variant="primary" isDisabled={busy} data-testid="gc-wf-allow" onPress={act.allow}>{t.allowAgain}</ControlButton>
          </>
        ) : s === 'pending' ? (
          <>
            <ControlButton size="row" variant="quiet" isDisabled={busy} data-testid="gc-wf-cancel" onPress={act.cancel}>{t.cancel}</ControlButton>
            <ControlButton size="row" variant="secondary" isDisabled={busy} data-testid="gc-wf-allow" onPress={act.allow}>{t.retry}</ControlButton>
          </>
        ) : (
          <ControlButton size="row" variant="secondary" isDisabled={busy} data-testid="gc-wf-allow" onPress={act.allow}>{t.allow}</ControlButton>
        )}
      </div>
    </div>
  );
}

/** 1: everything a person needs now and then, under one named toggle. */
function DetailsRow({g, act, t}: {g: G; act: Act; t: T}) {
  return (
    <div className="s-row gc-details-row">
      <details className="s-more gc-details" data-testid="gc-details">
        <summary>{t.detailsAndDisconnect}</summary>
        <Facts g={g} t={t} />
        <div className="gc-acts">
          <div className="gc-act">
            <ControlButton size="row" variant="secondary" isDisabled={!!g.going} data-testid="gc-again" onPress={act.signIn}>{t.signInAgain}</ControlButton>
            <span>{t.signInAgainDesc}</span>
          </div>
          <div className="gc-act">
            <ControlButton size="row" variant="danger-subtle" data-testid="gc-disconnect" onPress={act.openDisconnect}>{t.disconnect}</ControlButton>
            <span>{t.disconnectDesc}</span>
          </div>
        </div>
      </details>
    </div>
  );
}

/** 2: the same two actions always in sight, with the scopes in one line. */
function FooterRow({g, act, t}: {g: G; act: Act; t: T}) {
  return (
    <div className="s-row gc-footer" data-testid="gc-footer">
      <span className="s-desc">{t.scopesShort}{g.scopes.includes('workflow') ? `, ${t.scopes.workflow}` : ''}</span>
      <div className="s-val">
        <ControlButton size="row" variant="quiet" isDisabled={!!g.going} data-testid="gc-again" onPress={act.signIn}>{t.signInAgainShort}</ControlButton>
        <ControlButton size="row" variant="danger-subtle" data-testid="gc-disconnect" onPress={act.openDisconnect}>{t.disconnect}</ControlButton>
      </div>
    </div>
  );
}

function DisconnectBody({kind, g, act, t}: {kind: DialogKind; g: G; act: Act; t: T}) {
  return (
    <>
      <Heading slot="title">{t.dlgTitle}</Heading>
      <p>{t.dlgBody}</p>
      <p className="s-desc">
        {t.dlgGrant}{' '}
        <ExternalLink href="https://github.com/settings/applications" target="_blank" rel="noreferrer">{t.dlgGrantLink}</ExternalLink>
      </p>
      {kind === 'verify' && <p className="gc-dlg-step" data-testid="gc-dlg-verify">{t.dlgVerify}</p>}
      {kind === 'back' && (
        <p className="gc-dlg-step" data-testid="gc-dlg-back"><StatusMark kind="success" tone="success" label={t.dlgBack} /></p>
      )}
      <div className="ah-dialog-actions">
        <ControlButton size="page" data-testid="gc-dlg-cancel" onPress={act.close}>{t.dlgCancel}</ControlButton>
        {kind === 'verify' ? (
          <ControlButton size="page" variant="primary" isDisabled={g.going === 'verify'} data-testid="gc-dlg-verify-btn" onPress={act.verify}>
            {g.going === 'verify' ? t.going : t.dlgVerifyBtn}
          </ControlButton>
        ) : (
          <ControlButton size="page" variant="danger" data-testid="gc-dlg-confirm" onPress={act.confirm}>{t.dlgConfirm}</ControlButton>
        )}
      </div>
    </>
  );
}

function DirectionCard({d, scene, t}: {d: number; scene: SceneId; t: T}) {
  const [g, act] = useG(scene);
  const ok = g.native === 'connected';
  return (
    <>
      <div className="s-card" data-testid="gc-card">
        <IdentityRow d={d} g={g} act={act} t={t} />
        {ok && <WorkflowRow g={g} act={act} t={t} />}
        {ok && d === 1 && <DetailsRow g={g} act={act} t={t} />}
        {ok && d === 2 && <FooterRow g={g} act={act} t={t} />}
      </div>
      <ModalOverlay className="ah-overlay" isOpen={!!g.dialog} onOpenChange={(o) => { if (!o) act.close(); }} isDismissable>
        <Modal className="ah-modal">
          <Dialog className="ah-dialog gc-dialog" data-testid="gc-dialog" aria-label={t.dlgTitle}>
            {g.dialog && <DisconnectBody kind={g.dialog} g={g} act={act} t={t} />}
          </Dialog>
        </Modal>
      </ModalOverlay>
      {scene === 'confirm' && (
        <div className="gc-static-dialogs" data-testid="gc-static-dialogs">
          {(['verify', 'confirm'] as const).map((k) => (
            <div key={k} className="ah-dialog gc-dialog gc-static" data-kind={k} role="group" aria-label={t.dlgTitle}>
              <DisconnectBody kind={k} g={g} act={act} t={t} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Nyt: production against the stand-in daemon ----------

/** Who the next preferences read is for: Nyt's scenes mount one at a time,
 * so the read each starts on mount is answered for its own scene. */
const prefs = new Map<string, {identity: string; wanted: boolean}>();
let reading: {identity: string; wanted: boolean} | null = null;

function ProdScene({scene, index, onReady}: {scene: SceneId; index: number; onReady: () => void}) {
  const [mounted, setMounted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const identity = `wid_example-${scene}`;
  const csrf = `csrf-${scene}`;
  useEffect(() => {
    const p = {identity, wanted: scene === 'on' || scene === 'missing'};
    prefs.set(csrf, p);
    const timer = setTimeout(() => { reading = p; flushSync(() => setMounted(true)); }, index * 120);
    return () => clearTimeout(timer);
  }, [scene, index, identity, csrf]);
  useEffect(() => {
    if (!mounted) return;
    let stop = false;
    const step = async () => {
      // Production's Allow and Check are pressed once, as a person would.
      const target = scene === 'pending' ? '[data-testid="github-workflow-allow"]' : scene === 'confirm' ? '[data-testid="github-disconnect-inspect"]' : '';
      if (target) {
        for (let i = 0; i < 50 && !stop; i++) {
          const b = box.current?.querySelector<HTMLButtonElement>(target);
          if (b && !b.disabled) { b.click(); break; }
          await new Promise((r) => setTimeout(r, 50));
        }
        await new Promise((r) => setTimeout(r, 300));
      } else await new Promise((r) => setTimeout(r, 300));
      if (!stop) onReady();
    };
    void step();
    return () => { stop = true; };
  }, [mounted, scene, onReady]);
  const native: NativeState = scene === 'expired' ? 'expired' : scene === 'none' ? 'disconnected' : 'connected';
  return (
    <div ref={box} className="gc-prod">
      {mounted && (
        <CodeHostSettings
          identity={identity}
          csrf={csrf}
          nativeState={native}
          nativeLogin={native === 'connected' ? LOGIN : undefined}
          nativeScopes={native === 'connected' ? (scene === 'on' ? ALL : BASE) : undefined}
          onReconnect={() => {}}
          workspaces={[]}
        />
      )}
    </div>
  );
}

// ---------- The page ----------

let reviewTheme = (params.get('theme') as 'light' | 'dark' | 'contrast') || 'light';
let reviewLang: Lang = params.get('lang') === 'en' ? 'en' : 'fi';

function Scene({d, id, index, lang, onReady}: {d: number; id: SceneId; index: number; lang: Lang; onReady: () => void}) {
  const t = TEXT[lang];
  useEffect(() => { if (d > 0) onReady(); }, [d, onReady]);
  return (
    <section className="gc-scene" data-testid={`scene-${id}`} aria-label={t.scenes[id]}>
      <h2>{t.scenes[id]}</h2>
      {id === 'confirm' && <p className="gc-caption">{d === 0 ? t.captions.confirmNow : t.captions.confirmDir}</p>}
      {d === 0 ? <ProdScene scene={id} index={index} onReady={onReady} /> : <DirectionCard d={d} scene={id} t={t} />}
    </section>
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [lang, setLang] = useState<Lang>(reviewLang);
  const [ready, setReady] = useState(0);
  const onReady = useRef(() => setReady((n) => n + 1)).current;
  const t = TEXT[lang];
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useLayoutEffect(() => { setPersonalLanguage(lang); document.documentElement.lang = lang; }, [lang]);
  return (
    <div className="gc-review" data-direction={direction} data-ready={ready >= SCENES.length ? '' : undefined}>
      <header className="gc-head">
        <div className="gc-controls">
          <strong>{t.title}</strong>
          <label>{t.theme}{' '}
            <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
              {(['light', 'dark', 'contrast'] as const).map((k) => <option key={k} value={k}>{t.themes[k]}</option>)}
            </select>
          </label>
          <label>{t.language}{' '}
            <select id="lang" value={lang} onChange={(e) => { reviewLang = e.target.value as Lang; setPersonalLanguage(reviewLang); setReady(0); setLang(reviewLang); }}>
              <option value="fi">Suomi</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <ol className="gc-lines" data-testid="direction-lines">
          {t.lines.map((l, i) => <li key={l} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="gc-recommend" data-testid="recommendation">{t.recommend}</p>
      </header>
      <div className="ah-account-settings s-page detail gc-page">
        <main className="s-main">
          <h2 className="gc-h">{lang === 'fi' ? 'Koodipalvelut' : 'Code hosts'}</h2>
          {direction > 0 && <p className="s-intro gc-intro">{t.intro}</p>}
          <div className="gc-scenes">
            {SCENES.map((s, i) => <Scene key={`${direction}-${lang}-${s}`} d={direction} id={s} index={i} lang={lang} onReady={onReady} />)}
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------- Stand-in daemon for Nyt ----------

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const reply = (p: {identity: string; wanted: boolean}) => ({
  schema_version: 1, web_identity_id: p.identity, engine: 'codemirror6', language: 'system',
  quiet_sort: 'newest', quiet_workspace: null, github_workflow: p.wanted, experimental: {},
});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path === '/api/v1/account/preferences') {
    if ((init?.method ?? 'GET') === 'GET') return reading ? json(reply(reading)) : new Response('', {status: 503});
    const csrf = new Headers(init?.headers).get('X-Agent-Host-CSRF') ?? '';
    const p = prefs.get(csrf);
    if (!p) return new Response('', {status: 403});
    p.wanted = !!JSON.parse(String(init?.body ?? '{}')).github_workflow;
    return json(reply(p));
  }
  // The gateway's five-minute rule, as a person meets it most of the time.
  if (path === '/api/v1/account/github/disconnect') return json({schema_version: 1, error: {code: 'reauthentication_required'}}, 403);
  return new Response('', {status: 404});
};

setPersonalLanguage(reviewLang);
const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {
  set innerHTML(view: ReactNode) {
    flushSync(() => root.render(view === '' ? null : view));
  },
};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker';
picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item';
  button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);

export type {React};
