import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Button, Dialog, DialogTrigger, Heading, Popover} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/WorkspacePage.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {SoundEmblem} from '../../../../web/src/components/SoundEmblem';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {WorkspaceIcon} from '../../../../web/src/components/WorkspaceIcon';
import {WorkspaceIconPicker} from '../../../../web/src/components/WorkspaceIconPicker';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {type SoundId, soundIds} from '../../../../web/src/app/soundSynth';
import {iconPicker, workspaceIcons} from '../../../../web/src/app/workspaceIcons';
import type {Workspace} from '../../../../web/src/app/snapshot';
import {attentionSoundText} from '../../../../web/src/text/attentionSound';
import {workspaceActionsText} from '../../../../web/src/text/workspaceActions';
import {workspacePageText} from '../../../../web/src/text/workspacePage';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// Workspace page header round (issue workspace-page-header-round, Jari
// 22.11.2026): the whole top of a workspace's front page as one area: the
// title and path, the actions (copy, GitHub, archive, delete, new worktree,
// new conversation) and the Kuvake / Nimi / Ääni boxes of the strip rounds.
// Today the icon and the name show twice (heading and strip) and the strip's
// three 128 px boxes push the page down. The axis is where the workspace's
// identity is shown and changed:
//   A Otsikko          the heading is the editor: its icon opens Kuvake, its
//                      name edits in place, Ääni is a chip on the path line;
//                      the boxes go.
//   B Asetusrivi       the heading stays a picture; one low row of three
//                      labelled chips (Kuvake, Nimi, Ääni) replaces the boxes.
//   C Laatat           the boxes are the heading: Nimi's box carries the h1
//                      and the path, and the actions become a labelled row
//                      under them.
// Production pieces: AppShell, rail, WorkspaceIcon, WorkspaceIconPicker,
// SoundEmblem, ControlButton, Icon and the production texts. The sound
// pop-up here is a short list; the real one stays production's.

setPersonalLanguage('fi');
const page = liveText(workspacePageText);
const act = liveText(workspaceActionsText);
const snd = liveText(attentionSoundText);
const NAMES = ['A Otsikko', 'B Asetusrivi', 'C Laatat'];
const LINES = [
  'A Otsikko: kuvake ja nimi muuttuvat otsikosta, Ääni on siru polun rivillä, laatat poistuvat.',
  'B Asetusrivi: otsikko pysyy kuvana, sen alla yksi matala rivi kolmea nimettyä sirua (Kuvake, Nimi, Ääni).',
  'C Laatat: Kuvake–Nimi–Ääni ovat itse otsikko, Nimen laatassa h1 ja polku, toiminnot nimettynä rivinä alla.',
];
const RECOMMEND = 'Suositus: C. Se pitää 21.11. valitut laatat ja paikallaan muokattavan nimen, poistaa kahdesti näkyvän nimen ja kuvakkeen ja antaa Uudelle keskustelulle sanan.';

// ---- State ----
const REPOS = ['aurinkokello', 'kotisivu', 'muistiinpanot'] as const;
type Repo = typeof REPOS[number];
type Choice = SoundId | 'default';
type Host = {sound: SoundId; repos: Record<Repo, Choice>; names: Record<Repo, string | undefined>; icons: Record<Repo, string | undefined>; hidden: Record<Repo, boolean>};
type Open = 'icon' | 'name' | 'sound' | null;
const base = (): Host => ({
  sound: 'kalimba',
  repos: {aurinkokello: 'default', kotisivu: 'pisara', muistiinpanot: 'default'},
  names: {aurinkokello: undefined, kotisivu: undefined, muistiinpanot: undefined},
  icons: {aurinkokello: undefined, kotisivu: '🌻', muistiinpanot: 'MP'},
  hidden: {aurinkokello: false, kotisivu: false, muistiinpanot: false},
});
const SCENARIO_IDS = ['oletus', 'oma', 'pitka', 'arkistoitu', 'kuvake', 'nimi', 'aani'] as const;
type Scenario = typeof SCENARIO_IDS[number];
const SCENARIO_NAMES: Record<Scenario, string> = {
  oletus: 'Oletukset (aurinkokello)', oma: 'Omat valinnat (kotisivu)', pitka: 'Pitkä näyttönimi', arkistoitu: 'Arkistoitu',
  kuvake: 'Kuvake auki', nimi: 'Nimi muokattavana', aani: 'Ääni auki',
};
const SCENARIOS: Record<Scenario, {host: () => Host; repo: Repo; open: Open}> = {
  oletus: {host: base, repo: 'aurinkokello', open: null},
  oma: {host: base, repo: 'kotisivu', open: null},
  pitka: {host: () => ({...base(), names: {...base().names, kotisivu: 'asiakkaan-verkkokauppa-uudistus-2027'}}), repo: 'kotisivu', open: null},
  arkistoitu: {host: () => ({...base(), hidden: {...base().hidden, aurinkokello: true}}), repo: 'aurinkokello', open: null},
  kuvake: {host: base, repo: 'kotisivu', open: 'icon'},
  nimi: {host: base, repo: 'kotisivu', open: 'name'},
  aani: {host: base, repo: 'kotisivu', open: 'sound'},
};
let scenario: Scenario = (new URLSearchParams(location.search).get('s') as Scenario) ?? 'oletus';
if (!SCENARIOS[scenario]) scenario = 'oletus';
let host: Host = SCENARIOS[scenario].host();
let open: Open = null;
let toast: (s: string) => void = () => {};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const set = (next: Partial<Host>) => { host = {...host, ...next}; notify(); };
const setOpen = (next: Open) => { open = next; notify(); };
function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const fn = () => tick((x) => x + 1); listeners.add(fn); return () => { listeners.delete(fn); }; }, []);
  return host;
}
const repoSound = (r: Repo, h = host): SoundId => h.repos[r] === 'default' ? h.sound : h.repos[r] as SoundId;
const own = (r: Repo, h = host) => h.repos[r] !== 'default';
const display = (r: Repo, h = host) => h.names[r] ?? r;
const soundName = (id: SoundId) => snd.sounds[id][0];
const LETTERS = /^[A-Z0-9ÅÄÖ]{1,3}$/;

/** A synthetic snapshot workspace, as much as production's icon chain reads. */
function workspaceOf(r: Repo, h = host): Workspace {
  const v = h.icons[r];
  const icon = v === undefined || v === 'auto' ? undefined
    : LETTERS.test(v) ? {kind: 'letters', value: v, source: 'config'} : {kind: 'emoji', value: v, source: 'config'};
  return {workspace_id: `ws_${r}`, name: r, display_name: h.names[r], path: `/home/aino/src/${r}`, kind: 'git_main_worktree',
    visibility: h.hidden[r] ? 'hidden' : 'visible', git_summary: {github_repo: `aino/${r}`},
    icon, icon_auto: v === 'auto' || undefined} as unknown as Workspace;
}
const iconFromWord = (r: Repo, h = host) => {
  const v = h.icons[r];
  return v === undefined || v === 'auto' ? 'Nimestä' : LETTERS.test(v) ? 'Kirjaimet' : 'Emoji';
};
const iconModel = (r: Repo, h = host) => workspaceIcons(REPOS.map((x) => workspaceOf(x, h))).get(`ws_${r}`)!;

// ---- Kuvake: production's icon picker, its trigger restyled per direction ----
function IconControl({repo}: {repo: Repo}) {
  const h = useStore();
  const w = workspaceOf(repo, h);
  return (
    <WorkspaceIconPicker key={`${repo}-${h.icons[repo]}`} model={iconPicker(iconModel(repo, h), w)}
      onChoose={(value) => { set({icons: {...host.icons, [repo]: value}}); toast(`Kuvake tallennettu: ${value === 'auto' ? 'Automaattinen' : value}`); }}
      footer={(close) => (
        <ControlButton data-testid="workspace-icon-ask-model" size="row" variant="quiet" onPress={() => { close(); toast('Ehdotukset eivät ole tässä vedoksessa.'); }}>
          <Icon name="spark" /> {page.askModel}
        </ControlButton>
      )} />
  );
}

// ---- Nimi: in place (B Paikallaan, Jari 21.11.) in every direction ----
function saveName(repo: Repo, value: string) {
  const v = value.trim();
  set({names: {...host.names, [repo]: v && v !== repo ? v : undefined}});
  toast(v && v !== repo ? `Näyttönimi: ${v}` : `Näyttönimi palautettu kansion nimeksi ${repo}`);
}
/** The field that replaces the name while it is edited. Enter and a click
 * elsewhere save, Esc cancels; an empty name brings back the folder's. */
function NameField({repo, className}: {repo: Repo; className: string}) {
  const [draft, setDraft] = useState(display(repo));
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => { input.current?.select(); }, []);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save && draft.trim() !== display(repo)) saveName(repo, draft);
    setOpen(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="name-edit"]')?.focus());
  };
  return (
    <form className={`ph-name-form ${className}`} data-testid="name-form"
      onSubmit={(e) => { e.preventDefault(); finish(true); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) finish(true); }}>
      <input ref={input} className="ph-name-input" data-testid="name-input" aria-label={page.displayName}
        aria-describedby="ph-name-hint" value={draft} spellCheck={false} autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } }} />
      <span className="ph-name-actions">
        <button type="button" className="ph-mini" data-testid="name-cancel" aria-label="Peru" title="Peru (Esc)"
          onMouseDown={(e) => e.preventDefault()} onClick={() => finish(false)}><Icon name="cross" /></button>
        <button type="submit" className="ph-mini" data-testid="name-save" aria-label={page.save} title={`${page.save} (Enter)`}
          onMouseDown={(e) => e.preventDefault()}><Icon name="check" /></button>
      </span>
      <span id="ph-name-hint" className="ph-name-hint">Kansio <code>~/src/{repo}</code> ei muutu. Tyhjä nimi palauttaa kansion nimen.</span>
    </form>
  );
}

// ---- Ääni: a pop-up anchored to whatever opens it ----
function SoundPopover({repo}: {repo: Repo}) {
  const h = useStore();
  const value = h.repos[repo];
  const choose = (c: Choice) => {
    set({repos: {...host.repos, [repo]: c}});
    toast(c === 'default' ? `Ääni: oletus (${soundName(host.sound)})` : `Ääni: ${soundName(c)}`);
  };
  const row = (c: Choice) => {
    const id = c === 'default' ? h.sound : c;
    return (
      // biome-ignore lint/a11y/useSemanticElements: a card radio, as in production's sound picker
      <button key={c} type="button" role="radio" aria-checked={value === c} className="ph-sound-row" data-testid={`sound-${c}`}
        data-checked={value === c || undefined} onClick={() => choose(c)}>
        <SoundEmblem id={id} size="small" />
        <span><b>{c === 'default' ? snd.pickerDefault : soundName(id)}</b>
          {c === 'default' ? <small>{snd.pickerDefaultDetail(soundName(h.sound))}</small> : null}</span>
        {value === c ? <Icon name="check" /> : null}
      </button>
    );
  };
  return (
    <Popover placement="bottom end" offset={6} className="ah-popover ph-popover">
      <Dialog className="ph-dialog" aria-label={snd.pickerTitle} data-testid="sound-dialog">
        {({close}) => (
          <div className="ph-sound">
            <header><Heading slot="title" level={2}><Icon name="music" />{snd.pickerTitle}</Heading>
              <ControlButton size="inline" variant="quiet" aria-label="Sulje" onPress={close}><Icon name="cross" /></ControlButton></header>
            <p>Tuotannon valitsin (kortit, ▶) pysyy ennallaan; tässä lyhyt lista.</p>
            <div role="radiogroup" aria-label={snd.pickerTitle} className="ph-sound-list">
              {(['default', ...soundIds] as Choice[]).map(row)}
            </div>
          </div>
        )}
      </Dialog>
    </Popover>
  );
}
function SoundTrigger({repo, className, children}: {repo: Repo; className: string; children: ReactNode}) {
  const h = useStore();
  const s = repoSound(repo, h);
  return (
    <DialogTrigger isOpen={open === 'sound'} onOpenChange={(v) => setOpen(v ? 'sound' : null)}>
      <Button className={className} data-testid="sound-open" data-own={own(repo, h) || undefined}
        aria-label={`Ääni: ${soundName(s)}${own(repo, h) ? '' : ', oletus'}. Vaihda`}>{children}</Button>
      <SoundPopover repo={repo} />
    </DialogTrigger>
  );
}
const soundValue = (repo: Repo, h: Host) => (
  <span className="ph-value"><span>{soundName(repoSound(repo, h))}</span>{own(repo, h) ? null : <span className="ph-suffix"> · {snd.defaultWord}</span>}</span>
);

// ---- Actions ----
const notHere = (what: string) => () => toast(`${what}: ei tässä vedoksessa.`);
function IconAction({id, icon, label, variant = 'quiet', onPress, pressed}: {id: string; icon: Parameters<typeof Icon>[0]['name']; label: string; variant?: 'quiet' | 'danger-subtle' | 'primary'; onPress: () => void; pressed?: boolean}) {
  return (
    <ControlButton data-testid={id} size="row" variant={variant} presentation="icon" aria-label={label} title={label}
      aria-pressed={pressed} onPress={onPress} className={variant === 'primary' ? 'ah-workspace-plus' : undefined}>
      <Icon name={icon} />
    </ControlButton>
  );
}
const copyPath = () => toast(act.pathCopied);
function Housekeeping({repo, copy = true}: {repo: Repo; copy?: boolean}) {
  const h = useStore();
  const hidden = h.hidden[repo];
  return (
    <>
      {copy ? <IconAction id="copy-path" icon="copy" label={act.copyPath} onPress={copyPath} /> : null}
      <IconAction id="open-github" icon="github" label={act.openGitHubRepo(`aino/${repo}`)} onPress={notHere('GitHub')} />
      <IconAction id={hidden ? 'workspace-restore' : 'workspace-archive'} icon={hidden ? 'eye' : 'eyeOff'} pressed={hidden}
        label={hidden ? act.restore : act.archive} onPress={() => set({hidden: {...host.hidden, [repo]: !hidden}})} />
      <IconAction id="delete-workspace" icon="trash" variant="danger-subtle" label={act.delete} onPress={notHere('Poisto')} />
    </>
  );
}
function Archived({repo}: {repo: Repo}) {
  const h = useStore();
  if (!h.hidden[repo]) return null;
  return (
    <span className="ah-workspace-hidden" data-testid="archived">{page.archived}{' '}
      <ControlButton variant="quiet" size="inline" onPress={() => set({hidden: {...host.hidden, [repo]: false}})}>{page.restore}</ControlButton>
    </span>
  );
}

// ---- A Otsikko itse ----
function HeadA({repo}: {repo: Repo}) {
  const h = useStore();
  return (
    <header className="ph-a" data-testid="page-head">
      <span className="ph-a-icon" data-testid="head-icon"><IconControl repo={repo} /></span>
      <div className="ph-a-title">
        {open === 'name' ? <NameField repo={repo} className="ph-a-field" /> : (
          <h1 data-testid="workspace-title">
            <button type="button" className="ph-a-name" data-testid="name-edit" aria-label={`${act.rename} Nyt: ${display(repo, h)}`}
              onClick={() => setOpen('name')}>
              <span>{display(repo, h)}</span><Icon name="pencil" />
            </button>
          </h1>
        )}
        <p className="ph-a-meta">
          <span className="ph-path"><code title={`/home/aino/src/${repo}`}>~/src/{repo}</code>
            <button type="button" className="ph-mini" data-testid="copy-path" aria-label={act.copyPath} title={act.copyPath} onClick={copyPath}><Icon name="copy" /></button>
          </span>
          <SoundTrigger repo={repo} className="ph-a-sound">
            <SoundEmblem id={repoSound(repo, h)} size="small" />{soundValue(repo, h)}
          </SoundTrigger>
        </p>
        <Archived repo={repo} />
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: action group, as in production */}
      <div className="ah-workspace-icon-row" role="group" aria-label={act.group} data-testid="workspace-actions">
        <Housekeeping repo={repo} copy={false} />
        <span className="ah-workspace-action-divider" aria-hidden="true" />
        <IconAction id="new-worktree" icon="worktreeNew" label={act.newWorktreeHint} onPress={notHere('Uusi worktree')} />
        <IconAction id="conversation-start" icon="plus" variant="primary" label={act.startConversation} onPress={notHere('Uusi keskustelu')} />
      </div>
    </header>
  );
}

// ---- B Asetusrivi ----
function HeadB({repo}: {repo: Repo}) {
  const h = useStore();
  return (
    <>
      <header className="ah-workspace-page-head ph-b" data-testid="page-head">
        <span className="ah-workspace-head-icon" data-testid="head-icon"><WorkspaceIcon icon={iconModel(repo, h)} size="l" /></span>
        <div className="ah-workspace-page-title">
          {open === 'name' ? <NameField repo={repo} className="ph-b-field" /> : <h1 data-testid="workspace-title" tabIndex={-1}>{display(repo, h)}</h1>}
          <p><code title={`/home/aino/src/${repo}`}>~/src/{repo}</code></p>
          <Archived repo={repo} />
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: action group, as in production */}
        <div className="ah-workspace-icon-row" role="group" aria-label={act.group} data-testid="workspace-actions">
          <Housekeeping repo={repo} />
          <span className="ah-workspace-action-divider" aria-hidden="true" />
          <IconAction id="new-worktree" icon="worktreeNew" label={act.newWorktreeHint} onPress={notHere('Uusi worktree')} />
          <IconAction id="conversation-start" icon="plus" variant="primary" label={act.startConversation} onPress={notHere('Uusi keskustelu')} />
        </div>
      </header>
      <section className="ph-b-row" aria-label="Työtilan asetukset" data-testid="settings">
        <div className="ph-chip ph-b-icon" data-testid="strip-icon">
          <span className="ph-chip-label"><Icon name="image" />Kuvake</span>
          <IconControl repo={repo} />
          <span className="ph-value">{iconFromWord(repo, h)}</span>
        </div>
        <button type="button" className="ph-chip" data-testid="name-edit" aria-pressed={open === 'name'} onClick={() => setOpen(open === 'name' ? null : 'name')}>
          <span className="ph-chip-label"><Icon name="pencil" />Nimi</span>
          <span className="ph-value">{h.names[repo] ? 'Oma' : 'Kansion nimi'}</span>
        </button>
        <SoundTrigger repo={repo} className="ph-chip">
          <span className="ph-chip-label"><Icon name="music" />Ääni</span>
          <SoundEmblem id={repoSound(repo, h)} size="small" />{soundValue(repo, h)}
        </SoundTrigger>
      </section>
    </>
  );
}

// ---- C Laatat otsikkona ----
function HeadC({repo}: {repo: Repo}) {
  const h = useStore();
  return (
    <>
      <header className="ph-c" data-testid="page-head">
        <div className="ph-tile ph-c-icon" data-testid="strip-icon">
          <span className="ph-chip-label"><Icon name="image" />Kuvake</span>
          <span className="ph-tile-box"><IconControl repo={repo} /></span>
          <span className="ph-value">{iconFromWord(repo, h)}</span>
        </div>
        <div className="ph-tile ph-c-name" data-editing={open === 'name' || undefined} data-testid="strip-name">
          <span className="ph-chip-label"><Icon name="pencil" />Nimi</span>
          {open === 'name' ? <NameField repo={repo} className="ph-c-field" /> : (
            <h1 data-testid="workspace-title">
              <button type="button" className="ph-c-namebtn" data-testid="name-edit" aria-label={`${act.rename} Nyt: ${display(repo, h)}`}
                onClick={() => setOpen('name')}><span title={display(repo, h)}>{display(repo, h)}</span></button>
            </h1>
          )}
          <span className="ph-path"><code title={`/home/aino/src/${repo}`}>~/src/{repo}</code>
            <button type="button" className="ph-mini" data-testid="copy-path" aria-label={act.copyPath} title={act.copyPath} onClick={copyPath}><Icon name="copy" /></button>
          </span>
        </div>
        <SoundTrigger repo={repo} className="ph-tile ph-c-sound">
          <span className="ph-chip-label"><Icon name="music" />Ääni</span>
          <span className="ph-tile-box"><SoundEmblem id={repoSound(repo, h)} size="strip" /></span>
          {soundValue(repo, h)}
        </SoundTrigger>
      </header>
      {/* biome-ignore lint/a11y/useSemanticElements: action group, as in production */}
      <div className="ph-c-actions" role="group" aria-label={act.group} data-testid="workspace-actions">
        <ControlButton data-testid="conversation-start" size="row" variant="primary" onPress={notHere('Uusi keskustelu')}><Icon name="plus" />{act.newConversation}</ControlButton>
        <ControlButton data-testid="new-worktree" size="row" variant="secondary" title={act.newWorktreeHint} aria-label={act.newWorktreeHint} onPress={notHere('Uusi worktree')}><Icon name="worktreeNew" /><span className="ph-c-label">Uusi worktree</span></ControlButton>
        <Archived repo={repo} />
        <span className="ph-c-spacer" />
        <span className="ah-workspace-icon-row"><Housekeeping repo={repo} copy={false} /></span>
      </div>
    </>
  );
}

/** What follows the header, unchanged across directions: a muted stand-in
 * for the intro, the goal cards and the Git line, so the header's weight
 * shows against the page. */
function Rest({repo}: {repo: Repo}) {
  return (
    <div className="ph-rest" aria-hidden="true">
      <section><h3>{repo === 'aurinkokello' ? 'Aurinkopolku' : 'Kotisivu'}</h3>
        <p>Pieni <b>retkireittien suunnittelija</b>. Tässä repossa ovat sovellus, testit ja käyttöohjeet.</p></section>
      <p className="ph-rest-q">Mitä haluat tehdä?</p>
      <div className="ph-rest-grid">
        {[['Korjaa havaittu ongelma', 'Kun löydät toistettavan virheen.'], ['Tutustu repoon', 'Kun aloitat tässä repossa ensimmäistä kertaa.'],
          ['Valmistele seuraava julkaisu', 'Kun haluat tarkistaa julkaisuvalmiuden.'], ['Päivitä ohje', 'Kun käytäntö on muuttunut.']]
          .map(([a, b]) => <div key={a}><b>{a}</b><span>{b}</span></div>)}
      </div>
      <p className="ph-rest-git"><code>main · puhdas</code></p>
    </div>
  );
}

const HEADS = [HeadA, HeadB, HeadC];
function Page({direction, repo}: {direction: number; repo: Repo}) {
  const h = useStore();
  const icons = workspaceIcons(REPOS.map((r) => workspaceOf(r, h)));
  const Head = HEADS[direction];
  const rail = (
    <WorkspaceRail>
      {REPOS.map((r) => <WorkspaceNavRow key={r} name={display(r, h)} icon={icons.get(`ws_${r}`)} href={`/workspaces/ws_${r}`} selected={r === repo} />)}
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={display(repo, h)} rail={rail} main={
        <div className={`ah-workspace-page ph-page ph-v${direction}`} data-testid="workspace-page">
          <Head repo={repo} />
          <Rest repo={repo} />
        </div>
      } />
    </StatusBellProvider>
  );
}

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path === '/api/v1/pi/models') return json({schema_version: 1, catalog_status: 'native_cached', models: []});
  return new Response('', {status: 404});
};

const themeParam = new URLSearchParams(location.search).get('theme');
let reviewTheme = themeParam === 'dark' || themeParam === 'contrast' ? themeParam : 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [s, setS] = useState(scenario);
  const [generation, setGeneration] = useState(0);
  const [note, setNote] = useState('');
  const bar = useRef<HTMLElement>(null);
  const repo = SCENARIOS[s].repo;
  toast = setNote;
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
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  }, [theme]);
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(''), 2600); return () => clearTimeout(id); }, [note]);
  const openFor = (next: Scenario) => {
    open = null;
    const o = SCENARIOS[next].open;
    if (!o) return;
    setTimeout(() => {
      if (o === 'icon') document.querySelector<HTMLElement>('[data-testid="workspace-icon-picker"]')?.click();
      else setOpen(o);
    }, 80);
  };
  useEffect(() => { openFor(s); }, []);
  const reset = (next = s) => {
    scenario = next; host = SCENARIOS[next].host(); open = null;
    setS(next); setNote(''); setGeneration((n) => n + 1); openFor(next);
  };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong>Työtilan sivun yläosa</strong>
        <label>Tilanne <select id="scenario" value={s} onChange={(e) => reset(e.target.value as Scenario)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{SCENARIO_NAMES[id]}</option>)}</select></label>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
          <option value="light">Päivä</option><option value="dark">Yö</option><option value="contrast">Korkea kontrasti</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => reset()}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{RECOMMEND}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${generation}-${s}`} enabled={false}>
          <MemoryRouter key={`${generation}-${s}`} initialEntries={[`/workspaces/ws_${repo}`]}>
            <Page direction={direction} repo={repo} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {note ? <p className="rq-toast" role="status" data-testid="rq-toast">{note}</p> : null}
    </div>
  );
}

const reactRoot = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { host = SCENARIOS[scenario].host(); open = null; flushSync(() => reactRoot.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
