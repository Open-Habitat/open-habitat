import {type ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {initialTheme} from '../../lib/view-theme.js';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import {AccountLogoutDialog, AccountSettings, AccountShelf} from '../../../../web/src/components/Account';
import {AgentTurn, type TurnStep} from '../../../../web/src/components/AgentTurn';
import {Composer, ConversationTimeline, ToolRow, UserMessage} from '../../../../web/src/components/Conversation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {type GitHubRepoChoice, GitHubRepoChooser} from '../../../../web/src/components/GitHubRepoChooser';
import {Markdown} from '../../../../web/src/components/Markdown';
import {type AgentNavModel, AgentHeader, AppShell, NowSections, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {connectionStatus} from '../../../../web/src/app/WorkspaceRailView';
import {type Language, setPersonalLanguage, useLanguage, useText} from '../../../../web/src/i18n';
import {agentResourcesText} from '../../../../web/src/text/agentResources';
import {conversationEventsText} from '../../../../web/src/text/conversationEvents';
import {navigationText} from '../../../../web/src/text/navigation';
import {sharesText} from '../../../../web/src/text/shares';
import {switcherText} from '../../../../web/src/text/switcher';
import './round.css';

// chinese-interface, round 1 (Jari 28.11.2026: prototype it, then plan the
// code). Production screens in Simplified Chinese: the rail, a conversation
// with its composer, Settings › Ulkoasu with the language choice, the first
// onboarding step a person meets after signing in (repositories) and the
// sign-out dialog. Production components unchanged; their text comes from
// production catalogs with a zh-CN entry attached by build.mjs from zh/*.ts.
// The picker's axis is where the Chinese glyphs come from:
//   A · Nyt             production's stack as is ("Instrument Sans",
//                       system-ui, sans-serif): the browser's own fallback.
//   B · Pino            named CJK system fonts per variant, plus zh rules.
//   C · Fontti          self-hosted Noto Sans SC slices, plus zh rules.
// B and C share the zh typesetting rules of round.css (line height, label
// size floor, no italic, CJK–Latin spacing, strict line breaking).
// No network: /api answers are synthetic, nothing is fetched.

const NAMES = ['A · Nyt', 'B · Pino', 'C · Fontti'];
const CJK = ['a', 'b', 'c'] as const;
const LINES = [
  'A · Nyt: tuotannon fonttipino sellaisenaan. Kiinan merkit tulevat siitä, mitä selain sattuu valitsemaan: macOS PingFang, Windows Microsoft YaHei, Linux mitä on asennettu (tässä tarkistuksessa WenQuanYi Zen Hei, yksi paino). Ei kiinan omia sääntöjä.',
  'B · Pino: --ah-font saa kielikohtaisen jatkon (zh-CN: PingFang SC, Microsoft YaHei UI, Noto Sans CJK SC, Source Han Sans SC; zh-TW: PingFang TC, Microsoft JhengHei UI, Noto Sans CJK TC) ja kiinan säännöt: rivikorkeus, pienin koko 12 px, ei kursiivia, väli kiinan ja latinan välissä, tiukka rivitys. Ei latausta; ilman CJK-fonttia oleva kone näyttää edelleen sen, mitä on.',
  'C · Fontti: B:n säännöt ja oma Noto Sans SC (OFL) paloina unicode-rangen mukaan, painot 400/500/600. Sama ilme joka koneella ja oikeat lihavoinnit; hinta on lataus (koko fontti n. 3,7 Mt/paino, sivu lataa vain käyttämänsä palat).',
];
const RECOMMEND = 'Suositus: B. Kiinankieliset koneet (macOS, Windows, Android, iOS) tuovat hyvän CJK-fontin mukanaan, ja nimetty pino valitsee sen eikä satunnaista; Linux-palvelin, jolla selain ajaa, ei ole lukijan kone. C kannattaa vasta, jos testaajat näkevät rikkinäisiä lihavointeja.';

// ---------- Review state ----------

type Lang = 'zh-CN' | 'zh-TW' | 'fi' | 'en-US';
type SId = 'keskustelu' | 'kieli' | 'aloitus' | 'ikkuna' | 'tili';
const SITUATIONS: Record<SId, string> = {
  keskustelu: 'Sivupalkki ja keskustelu kenttineen',
  kieli: 'Asetukset › Ulkoasu, kielivalinta',
  tili: 'Asetukset › Tili (pitkät rivit)',
  aloitus: 'Käyttöönotto: repojen valinta',
  ikkuna: 'Ikkuna: uloskirjautuminen',
};
const SIDS = Object.keys(SITUATIONS) as SId[];
const param = new URLSearchParams(location.search);
const pLang = param.get('lang');
type Review = {theme: 'light' | 'dark' | 'contrast'; lang: Lang; sid: SId};
let review: Review = {
  theme: initialTheme() as Review['theme'],
  lang: pLang === 'fi' || pLang === 'en-US' || pLang === 'zh-TW' ? pLang : 'zh-CN',
  sid: (param.get('s') as SId) in SITUATIONS ? (param.get('s') as SId) : 'keskustelu',
};
const listeners = new Set<() => void>();
const setReview = (r: Partial<Review>) => {
  review = {...review, ...r};
  const url = new URL(location.href);
  url.searchParams.set('s', review.sid); url.searchParams.set('lang', review.lang);
  history.replaceState(null, '', url);
  listeners.forEach((l) => l());
};
const useReview = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => review);
document.documentElement.dataset.choice = review.lang;
setPersonalLanguage(review.lang as Language);
const noop = () => {};

// "Now" is Saturday 28 Nov 2026 10:12 in Shanghai (UTC+8). The page fixes
// the device zone so times read the same on every checking machine.
const ZONE = 'Asia/Shanghai';
const NativeFormat = Intl.DateTimeFormat;
const DeviceFormat = function (locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
  return new NativeFormat(locales, {timeZone: ZONE, ...options});
} as unknown as typeof Intl.DateTimeFormat;
Object.assign(DeviceFormat, {supportedLocalesOf: NativeFormat.supportedLocalesOf});
DeviceFormat.prototype = NativeFormat.prototype;
Intl.DateTimeFormat = DeviceFormat;
const at = (s: string) => Date.parse(`2026-11-${s}+08:00`);
const NOW = at('28T10:12:00');

// ---------- Synthetic content, as a Chinese-speaking person would write it ----------

type Content = {
  titles: [string, string, string, string];
  waiting: string; working: string; idle: string;
  user: string; reply: string; tools: [string, string];
  draft: string; name: string; email: string;
  repoDesc: [string, string, string];
};
const CONTENT: Record<'zh' | 'fi' | 'en', Content> = {
  zh: {
    titles: ['修复夜间构建中失败的测试', '检查发布说明', '为笔记搜索添加全文索引并比较三种中文分词方案的速度和准确率', '更新依赖'],
    waiting: '等待你的回复', working: '正在工作', idle: '空闲',
    user: '夜间构建在 `npm test` 阶段失败了（3 个测试未通过，日志在 `logs/nightly-1128.txt`）。请找出原因并提出修复方案，但先不要提交。',
    reply: '我看了日志。三个失败的测试都在 `src/cache.test.ts` 里，原因是缓存键包含了当前时间戳，所以每次运行都会变化。\n\n**建议的修复：**\n\n1. 从缓存键中去掉时间戳，改用文件内容的哈希值。\n2. 把 `cache.ts` 第 42 行的 `Date.now()` 换成 `hash(content)`。\n3. 重新运行 `npm test`，确认全部通过。\n\n我还没有提交任何更改。*注意*：这次修改会让现有缓存失效一次。要我现在应用这个修复吗？',
    tools: ['logs/nightly-1128.txt', 'npm test -- cache'],
    draft: '好的，请应用修复，然后运行全部测试。',
    name: '李小明', email: 'xiaoming@example.cn',
    repoDesc: ['个人网站的源代码和部署脚本', '读书笔记与全文搜索实验', 'Shared tooling for the lab'],
  },
  fi: {
    titles: ['Korjaa yöajon epäonnistuneet testit', 'Tarkista julkaisutiedote', 'Lisää muistiinpanojen hakuun kokotekstihakemisto ja vertaa kolmen kiinan sanastimen nopeutta ja tarkkuutta', 'Päivitä riippuvuudet'],
    waiting: 'Odottaa vastaustasi', working: 'Työskentelee', idle: 'Vapaa',
    user: 'Yöajo epäonnistui vaiheessa `npm test` (3 testiä punaisena, loki `logs/nightly-1128.txt`). Selvitä syy ja ehdota korjaus, mutta älä vielä commitoi.',
    reply: 'Katsoin lokin. Kaikki kolme epäonnistunutta testiä ovat tiedostossa `src/cache.test.ts`: välimuistin avaimessa on nykyhetken aikaleima, joten se vaihtuu joka ajossa.\n\n**Ehdotettu korjaus:**\n\n1. Poista aikaleima avaimesta ja käytä tiedoston sisällön tiivistettä.\n2. Vaihda `cache.ts`:n rivillä 42 `Date.now()` muotoon `hash(content)`.\n3. Aja `npm test` uudelleen ja varmista, että kaikki menevät läpi.\n\nEn ole commitoinut mitään. *Huom*: muutos mitätöi nykyisen välimuistin kerran. Teenkö korjauksen nyt?',
    tools: ['logs/nightly-1128.txt', 'npm test -- cache'],
    draft: 'Hyvä, tee korjaus ja aja sitten kaikki testit.',
    name: 'Li Xiaoming', email: 'xiaoming@example.cn',
    repoDesc: ['Kotisivun lähdekoodi ja julkaisuskriptit', 'Lukumuistiinpanot ja kokotekstihaun kokeilu', 'Shared tooling for the lab'],
  },
  en: {
    titles: ['Fix the failing nightly tests', 'Check the release notes', 'Add a full-text index to note search and compare the speed and accuracy of three Chinese tokenisers', 'Update dependencies'],
    waiting: 'Waiting for your reply', working: 'Working', idle: 'Idle',
    user: 'The nightly build failed at `npm test` (3 tests red, log in `logs/nightly-1128.txt`). Find the cause and propose a fix, but do not commit yet.',
    reply: 'I read the log. All three failing tests are in `src/cache.test.ts`: the cache key contains the current timestamp, so it changes on every run.\n\n**Proposed fix:**\n\n1. Drop the timestamp from the key and use a hash of the file content.\n2. Replace `Date.now()` with `hash(content)` on line 42 of `cache.ts`.\n3. Run `npm test` again and confirm everything passes.\n\nI have not committed anything. *Note*: the change invalidates the existing cache once. Shall I apply the fix now?',
    tools: ['logs/nightly-1128.txt', 'npm test -- cache'],
    draft: 'Good, apply the fix and then run all the tests.',
    name: 'Li Xiaoming', email: 'xiaoming@example.cn',
    repoDesc: ['Source and deploy scripts for the personal site', 'Reading notes and a full-text search experiment', 'Shared tooling for the lab'],
  },
};
const contentOf = (l: Lang) => CONTENT[l.startsWith('zh') ? 'zh' : l === 'fi' ? 'fi' : 'en'];
// Workspace names are identifiers (folder names under ~/src); a Chinese
// speaker may name a folder in Chinese, and it is shown as is.
const WS = ['homepage', '读书笔记', 'lab-tools'] as const;

// ---------- The rail ----------

function useRows(c: Content): {yours: AgentNavModel[]; running: AgentNavModel[]} {
  const base = (id: string, title: string, ws: string, over: Partial<AgentNavModel>): AgentNavModel => ({
    agentId: id, href: `/c/${id}`, title, activity: 'idle', activityLabel: c.idle, controlLabel: '',
    workspaceId: `ws_${ws}`, workspaceName: ws, detail: ws, ...over,
  } as AgentNavModel);
  return {
    yours: [base('p1', c.titles[0], 'homepage', {activity: 'waiting', activityLabel: c.waiting, attentionLabel: c.waiting, changedAt: at('28T10:09:00'), selected: true})],
    running: [
      base('p3', c.titles[2], '读书笔记', {activity: 'working', activityLabel: c.working, changedAt: at('28T10:11:00')}),
      base('p2', c.titles[1], 'homepage', {activity: 'working', activityLabel: c.working, changedAt: at('28T09:40:00')}),
    ],
  };
}

function Rail({c, onSettings, onLogout}: {c: Content; onSettings: () => void; onLogout: () => void}) {
  const nav = useText(navigationText);
  const shares = useText(sharesText);
  const resources = useText(agentResourcesText);
  const search = useText(switcherText);
  const rows = useRows(c);
  const status = connectionStatus('live' as never, 'confirmed');
  return (
    <WorkspaceRail collapsed={false} serverLabel="habitat" connectionLabel={status.label} connectionTone={status.tone}
      sessionActions={<AccountShelf profile={{name: c.name, email: c.email, avatar_url: ''}} onSettings={onSettings} onLogout={onLogout} />}
      adaptive={{
        places: [
          {id: 'home', testId: 'home-link', label: nav.home, href: '/workspaces'},
          {id: 'shares', testId: 'rail-shares', label: shares.title, href: '/shares', count: '2'},
          {id: 'resources', testId: 'rail-resources', label: resources.railLabel, href: '/resources'},
        ],
        search: {label: search.door, keyHint: 'Ctrl K', onOpen: noop},
        filter: false,
      }}
      now={<NowSections yours={rows.yours} running={rows.running} />}
      onCreateWorkspace={noop} onToggle={noop} onFilter={noop} onRefresh={noop}
      // biome-ignore lint/suspicious/noExplicitAny: the round passes what the rail draws here.
      {...({} as any)}>
      {WS.map((w) => <WorkspaceNavRow key={w} name={w} href={`/workspaces/ws_${w}`} selected={w === 'homepage'} />)}
    </WorkspaceRail>
  );
}

// ---------- The conversation ----------

function Conversation({c}: {c: Content}) {
  const states = useText(conversationEventsText).toolStates as Record<string, string>;
  const [draft, setDraft] = useState(c.draft);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => setDraft(c.draft), [c]);
  const steps: TurnStep[] = [
    {kind: 'tool', key: 't1', at: at('28T10:06:10'), node: <div className="ah-ordered-blocks"><div><ToolRow name="read" targetText={c.tools[0]} statusLabel={states.succeeded} state="succeeded" expanded={false} onToggle={noop} /></div></div>},
    {kind: 'tool', key: 't2', at: at('28T10:07:40'), node: <div className="ah-ordered-blocks"><div><ToolRow name="bash" targetText={c.tools[1]} statusLabel={states.failed} state="failed" expanded={false} onToggle={noop} /></div></div>},
    {kind: 'text', key: 'r', at: at('28T10:09:00'), text: c.reply, node: <Markdown text={c.reply} />},
  ];
  const items = [
    {id: 'u', kind: 'user', content: <UserMessage sourceText={c.user} time="10:05" onCopy={noop}><Markdown text={c.user} /></UserMessage>},
    {id: 't', kind: 'assistant', content: <AgentTurn steps={steps} startedAt={at('28T10:05:00')} />},
  ];
  useLayoutEffect(() => {
    let el: HTMLElement | null = frame.current?.querySelector('[data-testid="conversation-timeline"]') ?? null;
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    el?.scrollTo({top: 1e6});
  });
  return (
    <div className="kz-frame" ref={frame} data-testid="conversation-view">
      <ConversationFrame>
        <AgentHeader title={c.titles[0]} workspaceLabel="homepage" workspaceHref="/workspaces/ws_homepage"
          activityLabel={c.waiting} controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
        <ConversationStream>
          <ConversationTimeline state="ready" items={items} onJumpToLatest={noop} emptyLabel={null} />
        </ConversationStream>
        <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="follow_up" onModeChange={noop}
          onSendNow={noop} onSteer={noop} onFollowUp={noop} onInterrupt={noop} csrf="prototype"
          modelPicker={<button type="button" className="md-pill">claude-sonnet · medium</button>} />
      </ConversationFrame>
    </div>
  );
}

// ---------- Onboarding: the repository step ----------

function Onboarding({c}: {c: Content}) {
  const repos: GitHubRepoChoice[] = [
    {full_name: 'xiaoming/homepage', private: false, pushed_at: '2026-11-27T12:00:00Z', description: c.repoDesc[0]},
    {full_name: 'xiaoming/reading-notes', private: true, pushed_at: '2026-11-20T08:00:00Z', description: c.repoDesc[1]},
    {full_name: 'sample-lab/lab-tools', private: true, pushed_at: null, description: c.repoDesc[2]},
  ];
  const [sel, setSel] = useState<string[]>([repos[0].full_name]);
  return (
    <div className="kz-onboarding" data-testid="onboarding">
      <GitHubRepoChooser view={{phase: 'catalog', repositories: repos}} selectedNames={sel}
        onToggle={(n, on) => setSel((s) => on ? [...s, n] : s.filter((x) => x !== n))} onProceed={noop} />
    </div>
  );
}

// ---------- The page ----------

function Page({sid}: {sid: SId}) {
  const language = useLanguage() as Lang;
  const c = contentOf(language);
  const [section, setSection] = useState<string>(sid === 'tili' ? 'tili' : 'ulkoasu');
  const [settings, setSettings] = useState(sid === 'kieli' || sid === 'tili');
  const [logout, setLogout] = useState(sid === 'ikkuna');
  if (sid === 'aloitus') return <Onboarding c={c} />;
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={settings ? '' : c.titles[0]}
        rail={<Rail c={c} onSettings={() => { setSection('ulkoasu'); setSettings(true); }} onLogout={() => setLogout(true)} />}
        main={<>
          {settings ? (
            <div className="ah-settings-layer" data-testid="settings-layer">
              <div className="ah-state">
                <AccountSettings profile={{name: c.name, email: c.email, avatar_url: ''}} name={c.name} csrf="prototype"
                  routeSection={section} onNavigate={(p) => setSection(p.split('/').filter(Boolean)[1] ?? 'tili')}
                  onClose={() => setSettings(false)} onLogout={() => setLogout(true)} />
              </div>
            </div>
          ) : null}
          <div className="kz-under" inert={settings || undefined} data-under-settings={settings || undefined}>
            <Conversation c={c} />
          </div>
        </>} />
      <AccountLogoutDialog open={logout} onClose={() => setLogout(false)} onConfirm={() => setLogout(false)} />
    </StatusBellProvider>
  );
}

// ---------- Review chrome ----------

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path === '/api/v1/pi/models') return json({schema_version: 1, catalog_status: 'native_cached', models: []});
  return new Response('', {status: 404});
};

declare const __CJK_SLICES__: number;
const missingNow = () => [...((window as unknown as {__zhMissing?: Map<string, string>}).__zhMissing?.keys() ?? [])];

function App({direction}: {direction: number}) {
  const r = useReview();
  const [gen, setGen] = useState(0);
  const [missing, setMissing] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = r.theme;
    root.style.colorScheme = r.theme === 'light' ? 'light' : 'dark';
    root.dataset.cjk = CJK[direction];
  }, [r.theme, direction]);
  useEffect(() => {
    const id = setInterval(() => setMissing(missingNow().filter((k) => !k.startsWith('kz')).length), 500);
    return () => clearInterval(id);
  }, []);
  const setLang = (lang: Lang) => {
    document.documentElement.dataset.choice = lang;
    setPersonalLanguage(lang as Language);
    setReview({lang});
    setGen((g) => g + 1);
  };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={r.sid} data-lang={r.lang}>
      <header className="rq-bar" ref={bar} lang="fi">
        <strong>Kiinankielinen käyttöliittymä 1</strong>
        <label>Tilanne <select id="scenario" value={r.sid} onChange={(e) => { setReview({sid: e.target.value as SId}); setGen((g) => g + 1); }}>
          {SIDS.map((id) => <option key={id} value={id}>{SITUATIONS[id]}</option>)}</select></label>
        <label>Kieli <select id="lang" value={r.lang} onChange={(e) => setLang(e.target.value as Lang)}>
          <option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文 (zh-CN-tekstit)</option>
          <option value="fi">Suomi</option><option value="en-US">English (US)</option></select></label>
        <label>Teema <select id="theme" value={r.theme} onChange={(e) => setReview({theme: e.target.value as Review['theme']})}>
          <option value="light">Päivä</option><option value="dark">Yö</option><option value="contrast">Korkea kontrasti</option></select></label>
        <span className="rq-state" data-testid="rq-missing" data-count={missing}>
          {r.lang.startsWith('zh') ? (missing ? `Vedoksen luettelosta puuttuu ${missing} näytettyä tekstiä (englanniksi)` : 'Kaikki näytetyt tekstit käännetty') : ''}
          {direction === 2 ? ` · Noto Sans SC: ${__CJK_SLICES__} palaa` : ''}
        </span>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{RECOMMEND}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${gen}-${r.sid}`} enabled={false}>
          <MemoryRouter key={`${gen}-${r.sid}`} initialEntries={['/']}>
            <Page sid={r.sid} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
    </div>
  );
}

const reactRoot = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { flushSync(() => reactRoot.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
// The review chrome is Finnish; under lang=zh the middle dot is a CJK break opportunity.
picker.lang = 'fi';
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
