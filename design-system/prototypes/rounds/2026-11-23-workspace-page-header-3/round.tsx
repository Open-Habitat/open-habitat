import {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
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

// Workspace page header, round 3 (issue workspace-page-header-round, Jari
// 23.11.2026: riff on C2 "Toiminnot sivulla"; the three other functions
// become buttons too, small and without text; try the other side; show how
// such small buttons are treated in general). The tiles are C2's in every
// direction. What varies is where the action group stands and how the
// primary action and the small buttons are grouped:
//   C2a Oikealla      right of the tiles, two labelled buttons, the small
//                     ones under them.
//   C2b Vasemmalla    the same group left of the tiles (phone: mirrored,
//                     the primary at the right end).
//   C2c Yksi ryhmä    the primary alone in words, every other action
//                     (Uusi worktree too) a small button in one row under it.
// The rules panel ("Pienet painikkeet") shows the proposed treatment of a
// small button: size and hit area, label and tooltip, states, grouping.
// Production pieces: AppShell, rail, WorkspaceIcon, WorkspaceIconPicker,
// SoundEmblem, ControlButton (with its QuickTooltip), Icon and the texts.
// The page is a Habitat view: no iframe, no navigation, no network.

setPersonalLanguage('fi');
const page = liveText(workspacePageText);
const act = liveText(workspaceActionsText);
const snd = liveText(attentionSoundText);
const NAMES = ['C2a Oikealla', 'C2b Vasemmalla', 'C2c Yksi ryhmä'];
const LAYOUTS = ['a', 'b', 'c'] as const;
const LINES = [
  'C2a Oikealla: toiminnot laattojen oikealla kuten C2; Uusi keskustelu ja Uusi worktree sanoin, GitHub, Arkistoi ja Poista pieninä painikkeina niiden alla.',
  'C2b Vasemmalla: sama ryhmä laattojen vasemmalla puolella, ennen Kuvaketta; puhelimessa peilattuna, Uusi keskustelu oikeassa reunassa.',
  'C2c Yksi ryhmä: vain Uusi keskustelu sanoin, ja kaikki muut (myös Uusi worktree) pieninä painikkeina yhtenä rivinä sen alla.',
];
const RECOMMEND = 'Suositus: C2a. Otsikko luetaan ensin ja toiminnot sen jälkeen, Uusi worktree pitää sanansa ja poisto on kauimpana päätoiminnosta. Pienten painikkeiden säännöt: Pienet painikkeet -painike yllä.';

// ---- State ----
const REPOS = ['aurinkokello', 'kotisivu', 'muistiinpanot'] as const;
type Repo = typeof REPOS[number];
type Choice = SoundId | 'default';
type Host = {sound: SoundId; repos: Record<Repo, Choice>; names: Record<Repo, string | undefined>; icons: Record<Repo, string | undefined>; hidden: Record<Repo, boolean>; origin: Record<Repo, boolean>; locked: boolean};
type Open = 'icon' | 'name' | 'sound' | null;
const base = (): Host => ({
  sound: 'kalimba',
  repos: {aurinkokello: 'default', kotisivu: 'pisara', muistiinpanot: 'default'},
  names: {aurinkokello: undefined, kotisivu: undefined, muistiinpanot: undefined},
  icons: {aurinkokello: undefined, kotisivu: '🌻', muistiinpanot: 'MP'},
  hidden: {aurinkokello: false, kotisivu: false, muistiinpanot: false},
  origin: {aurinkokello: true, kotisivu: true, muistiinpanot: true},
  locked: false,
});
const SCENARIO_IDS = ['oletus', 'oma', 'pitka', 'arkistoitu', 'eiorigin', 'lukittu', 'kuvake', 'nimi', 'aani'] as const;
type Scenario = typeof SCENARIO_IDS[number];
const SCENARIO_NAMES: Record<Scenario, string> = {
  oletus: 'Oletukset (aurinkokello)', oma: 'Omat valinnat (kotisivu)', pitka: 'Pitkä näyttönimi', arkistoitu: 'Arkistoitu', eiorigin: 'Ei GitHub-originia', lukittu: 'Muutokset estetty',
  kuvake: 'Kuvake auki', nimi: 'Nimi muokattavana', aani: 'Ääni auki',
};
const SCENARIOS: Record<Scenario, {host: () => Host; repo: Repo; open: Open}> = {
  oletus: {host: base, repo: 'aurinkokello', open: null},
  oma: {host: base, repo: 'kotisivu', open: null},
  pitka: {host: () => ({...base(), names: {...base().names, kotisivu: 'asiakkaan-verkkokauppa-uudistus-2027'}}), repo: 'kotisivu', open: null},
  arkistoitu: {host: () => ({...base(), hidden: {...base().hidden, aurinkokello: true}}), repo: 'aurinkokello', open: null},
  eiorigin: {host: () => ({...base(), origin: {...base().origin, aurinkokello: false}}), repo: 'aurinkokello', open: null},
  lukittu: {host: () => ({...base(), locked: true}), repo: 'aurinkokello', open: null},
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
    visibility: h.hidden[r] ? 'hidden' : 'visible', git_summary: h.origin[r] ? {github_repo: `aino/${r}`} : {},
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

const notHere = (what: string) => () => toast(`${what}: ei tässä vedoksessa.`);
// ---- Small buttons (round 3's proposal, shown in the rules panel too) ----
type IconName = Parameters<typeof Icon>[0]['name'];
type ShownState = 'default' | 'hover' | 'focus' | 'pressed' | 'disabled';
/** An icon-only action beside labelled ones: production's ControlButton at
 * the row size with the secondary surface, so it reads as a button and not
 * as a loose icon. The aria-label names the action and its object; the
 * tooltip (production's QuickTooltip, from `title`) says the same, one line
 * more when the consequence does not show, or why the button is disabled. */
function SmallButton({id, icon, label, hint, danger, isDisabled, onPress, shown}: {
  id: string; icon: IconName; label: string; hint?: string; danger?: boolean; isDisabled?: boolean; onPress?: () => void; shown?: ShownState;
}) {
  const state = shown === 'hover' || shown === 'focus' || shown === 'pressed' ? shown : undefined;
  return (
    <ControlButton data-testid={id} size="row" variant="secondary" presentation="icon" aria-label={label} title={hint ?? label}
      isDisabled={isDisabled || shown === 'disabled'} onPress={onPress} data-ah-state={state}
      className={`ph-ib${danger ? ' ph-ib-danger' : ''}`}>
      <Icon name={icon} />
    </ControlButton>
  );
}
const copyPath = () => toast(act.pathCopied);
/** The small buttons in order away from the primary action: create, open
 * elsewhere, hide, then delete after a wider gap. `reverse` mirrors the
 * row when the primary action stands at its right end. */
function SmallActions({repo, worktree, reverse}: {repo: Repo; worktree?: boolean; reverse?: boolean}) {
  const h = useStore();
  const hidden = h.hidden[repo];
  const noOrigin = !h.origin[repo];
  const items = [
    worktree ? <SmallButton key="wt" id="new-worktree" icon="worktreeNew" label="Uusi worktree" hint={act.newWorktreeHint} onPress={notHere('Uusi worktree')} /> : null,
    <SmallButton key="gh" id="open-github" icon="github" label={noOrigin ? act.openGitHub : act.openGitHubRepo(`aino/${repo}`)}
      hint={noOrigin ? act.noOrigin : undefined} isDisabled={noOrigin} onPress={notHere('GitHub')} />,
    // A toggle whose name and icon change, so no aria-pressed: a reader
    // would otherwise announce "Palauta työtila, painettu".
    <SmallButton key="ar" id={hidden ? 'workspace-restore' : 'workspace-archive'} icon={hidden ? 'eye' : 'eyeOff'}
      label={hidden ? act.restore : act.archive} hint={h.locked ? act.deleteUnavailable : hidden ? act.restoreHint : act.archiveHint}
      isDisabled={h.locked} onPress={() => { set({hidden: {...host.hidden, [repo]: !hidden}}); toast(hidden ? 'Työtila palautettu' : 'Työtila arkistoitu'); }} />,
    <span key="sep" className="ph-icons-sep" aria-hidden="true" />,
    <SmallButton key="rm" id="delete-workspace" icon="trash" danger label={act.delete} hint={h.locked ? act.deleteUnavailable : undefined}
      isDisabled={h.locked} onPress={notHere('Poisto')} />,
  ];
  return <span className="ph-icons" data-testid="small-actions">{reverse ? items.reverse() : items}</span>;
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
/** Phone layout, the same breakpoint as AppShell's. */
function usePhone() {
  const q = '(max-width: 800px)';
  const [phone, setPhone] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const fn = () => setPhone(m.matches); m.addEventListener('change', fn); return () => m.removeEventListener('change', fn); }, []);
  return phone;
}
// ---- The three tiles, as in C2, shared by every direction ----
function KuvakeTile({repo}: {repo: Repo}) {
  const h = useStore();
  return (
    <div className="ph-tile ph-side ph-kuvake" data-testid="strip-icon">
      <span className="ph-chip-label"><Icon name="image" />Kuvake</span>
      <span className="ph-tile-box"><IconControl repo={repo} /></span>
      <span className="ph-value">{iconFromWord(repo, h)}</span>
    </div>
  );
}
function NimiTile({repo}: {repo: Repo}) {
  const h = useStore();
  return (
    <div className="ph-tile ph-name" data-editing={open === 'name' || undefined} data-testid="strip-name">
      <span className="ph-chip-label"><Icon name="pencil" />Nimi</span>
      {open === 'name' ? <NameField repo={repo} className="ph-name-tile-field" /> : (
        <h1 data-testid="workspace-title">
          <button type="button" className="ph-namebtn" data-testid="name-edit" aria-label={`${act.rename} Nyt: ${display(repo, h)}`}
            onClick={() => setOpen('name')}><span title={display(repo, h)}>{display(repo, h)}</span></button>
        </h1>
      )}
      <span className="ph-path"><code title={`/home/aino/src/${repo}`}>~/src/{repo}</code>
        <button type="button" className="ph-mini" data-testid="copy-path" aria-label={act.copyPath} title={act.copyPath} onClick={copyPath}><Icon name="copy" /></button>
      </span>
    </div>
  );
}
function AaniTile({repo}: {repo: Repo}) {
  const h = useStore();
  return (
    <SoundTrigger repo={repo} className="ph-tile ph-side ph-aani">
      <span className="ph-chip-label"><Icon name="music" />Ääni</span>
      <span className="ph-tile-box"><SoundEmblem id={repoSound(repo, h)} size="strip" /></span>
      {soundValue(repo, h)}
    </SoundTrigger>
  );
}
type Layout = 'a' | 'b' | 'c';
/** One group: the primary action, then the small buttons.
 *   a  right of the tiles: Uusi keskustelu and Uusi worktree in words, the
 *      three small ones under them; phone: primary left, small ones right.
 *   b  the same column left of the tiles; phone: mirrored, the primary at
 *      the right end and the small ones reading away from it.
 *   c  the primary alone in words, every other action (Uusi worktree too)
 *      a small button in one row under it; phone: the primary stretches. */
function Actions({repo, layout, phone}: {repo: Repo; layout: Layout; phone: boolean}) {
  const h = useStore();
  const iconWorktree = layout === 'c' || phone;
  const primary = (
    <ControlButton key="p" data-testid="conversation-start" size="row" variant="primary" className="ph-primary"
      onPress={notHere('Uusi keskustelu')}><Icon name="plus" />{act.newConversation}</ControlButton>
  );
  const worktree = iconWorktree ? null : (
    <ControlButton key="w" data-testid="new-worktree" size="row" variant="secondary" title={act.newWorktreeHint}
      onPress={notHere('Uusi worktree')}><Icon name="worktreeNew" />Uusi worktree</ControlButton>
  );
  const mirrored = layout === 'b' && phone;
  const small = <SmallActions key="s" repo={repo} worktree={iconWorktree} reverse={mirrored} />;
  const items = mirrored ? [small, <span key="sp" className="ph-spacer" />, primary]
    : phone && layout === 'a' ? [primary, <span key="sp" className="ph-spacer" />, small] : [primary, worktree, small];
  return (
    // biome-ignore lint/a11y/useSemanticElements: action group, as in production
    <div className={`ph-actions ph-actions-col ph-actions-${layout}`} role="group" aria-label={act.group}
      data-testid="workspace-actions" data-locked={h.locked || undefined}>{items}</div>
  );
}
function Head({repo, layout}: {repo: Repo; layout: Layout}) {
  const phone = usePhone();
  const actions = <Actions repo={repo} layout={layout} phone={phone} />;
  // Visual order is reading order: in b the actions come before the heading.
  const before = layout === 'b' && !phone;
  return (
    <>
      <header className={`ph-c ph-c2 ph-l${layout}`} data-testid="page-head">
        {before ? actions : null}
        <KuvakeTile repo={repo} /><NimiTile repo={repo} /><AaniTile repo={repo} />
        {before ? null : actions}
      </header>
      <Archived repo={repo} />
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

// ---- The rules panel: the proposed treatment of a small button ----
const STATES: [ShownState, string][] = [['default', 'Lepo'], ['hover', 'Hover'], ['focus', 'Fokus'], ['pressed', 'Painettu'], ['disabled', 'Ei käytössä']];
const RULE_ROWS: {id: string; name: string; render: (s: ShownState, key: string) => ReactNode}[] = [
  {id: 'small', name: 'Pieni painike', render: (s, key) => <SmallButton id={`rule-small-${s}-${key}`} icon="github" label={act.openGitHubRepo('aino/aurinkokello')} shown={s} />},
  {id: 'danger', name: 'Poisto', render: (s, key) => <SmallButton id={`rule-danger-${s}-${key}`} icon="trash" danger label={act.delete} shown={s} />},
  {id: 'primary', name: 'Päätoiminto', render: (s, key) => (
    <ControlButton data-testid={`rule-primary-${s}-${key}`} size="row" variant="primary" isDisabled={s === 'disabled'}
      data-ah-state={s === 'hover' || s === 'focus' || s === 'pressed' ? s : undefined}><Icon name="plus" />Uusi</ControlButton>
  )},
];
function StateGrid({theme}: {theme: 'light' | 'dark'}) {
  return (
    <div className="pr-theme" data-theme={theme} data-testid={`rules-${theme}`}>
      <b className="pr-theme-name">{theme === 'light' ? 'Päivä' : 'Yö'}</b>
      <table className="pr-states">
        <thead><tr><th scope="col"><span className="pr-sr">Painike</span></th>{STATES.map(([, n]) => <th scope="col" key={n}>{n}</th>)}</tr></thead>
        <tbody>
          {RULE_ROWS.map((r) => (
            <tr key={r.id}><th scope="row">{r.name}</th>{STATES.map(([s]) => <td key={s}>{r.render(s, theme)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function RulesPanel({onClose}: {onClose: () => void}) {
  const self = useRef<HTMLElement>(null);
  useEffect(() => { self.current?.focus(); }, []);
  return (
    <aside ref={self} tabIndex={-1} className="pr-panel" role="dialog" aria-modal="false" aria-labelledby="pr-title" data-testid="rules-panel"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <header className="pr-head">
        <h2 id="pr-title">Pienet painikkeet: ehdotetut säännöt</h2>
        <ControlButton data-testid="rules-close" size="row" variant="quiet" aria-label="Sulje säännöt" onPress={onClose}><Icon name="cross" /></ControlButton>
      </header>
      <ol className="pr-rules">
        <li><b>Koko tulee roolista.</b> Pieni painike on rivin painike (<code>row</code>): työpöydällä 32 × 32 px ja ikoni 16 px,
          puhelimessa 40 × 40 px (token kasvaa jo nyt). Puhelimessa osuma-alue jatkuu näkymättömänä 44 × 44 px:iin, ja kahden
          painikkeen väli on <code>--ah-control-gap</code> (6 px), joten osuma-alueet ja fokusrenkaat eivät mene päällekkäin.
          <div className="pr-sizes">
            <figure><SmallButton id="rule-size-desk" icon="github" label="Työpöytä 32 px" /><figcaption>Työpöytä 32</figcaption></figure>
            <figure className="pr-phone"><span className="pr-pair"><SmallButton id="rule-size-phone" icon="github" label="Puhelin 40 px" /><SmallButton id="rule-size-phone-2" icon="eyeOff" label="Puhelin 40 px" /></span>
              <figcaption>Puhelin 40, osuma 44 (katkoviiva), väli 6</figcaption></figure>
          </div>
        </li>
        <li><b>Näyttää painikkeelta.</b> Sanoin nimettyjen painikkeiden vieressä pienellä painikkeella on toissijaisen painikkeen
          pinta ja reuna. Pelkkä ikoni ilman pintaa jää listarivien ja kenttien sisälle (kuten Kopioi polku polun vieressä).</li>
        <li><b>Nimi ja vihje.</b> <code>aria-label</code> on teko ja kohde (»{act.openGitHubRepo('aino/aurinkokello')}»). Vihje
          avautuu hoveriin viiveen jälkeen ja näppäimistöfokukseen, ja se sanoo saman, tai yhden rivin enemmän, kun seuraus ei näy
          ikonista (Arkistoi). Kosketusnäytöllä vihjettä ei ole, joten puhelimessa ikonin pitää olla tuttu; muuten painike saa sanan.
          <div className="pr-tip-demo"><SmallButton id="rule-tip" icon="eyeOff" label={act.archive} shown="focus" />
            <span className="pr-tip" role="presentation">{act.archiveHint}</span></div>
        </li>
        <li><b>Estetty kertoo syyn.</b> Estetty painike pysyy paikallaan, saa fokuksen, ja sen vihje kertoo syyn
          (»{act.noOrigin}»). Painiketta ei piiloteta, jotta muiden paikka ei vaihdu. Kokeile Tilanne: Ei GitHub-originia tai Muutokset estetty.</li>
        <li><b>Yksi ryhmä, järjestys päätoiminnosta poispäin.</b> Toiminnot ovat yhdessä ryhmässä (<code>role=group</code>,
          »{act.group}»). Ensin päätoiminto, sitten harvemmin tarvitut: luo, avaa muualla, piilota ja viimeisenä poista.
          Poiston ja muiden välissä on vähintään 12 px. Poiston ikoni on punainen toissijaisella pinnalla; täysi punainen
          tulee vasta vahvistukseen.</li>
        <li><b>Vaihtava painike.</b> Arkistoi ja Palauta vaihtavat nimeä ja ikonia, eikä painikkeella ole <code>aria-pressed</code>-tilaa,
          koska ruudunlukija sanoisi silloin »Palauta työtila, painettu».</li>
        <li><b>Tilat ovat tuotannon tiloja.</b> Hover ja painettu ovat pinnan sävyjä, ja fokus on 2 px:n rengas 1 px:n päässä.
          Korkeassa kontrastissa hover ja painettu tekevät myös reunasta mustetta.</li>
      </ol>
      <div className="pr-grids"><StateGrid theme="light" /><StateGrid theme="dark" /></div>
    </aside>
  );
}

function Page({direction, repo}: {direction: number; repo: Repo}) {
  const h = useStore();
  const icons = workspaceIcons(REPOS.map((r) => workspaceOf(r, h)));
  const rail = (
    <WorkspaceRail>
      {REPOS.map((r) => <WorkspaceNavRow key={r} name={display(r, h)} icon={icons.get(`ws_${r}`)} href={`/workspaces/ws_${r}`} selected={r === repo} />)}
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={display(repo, h)} rail={rail} main={
        <div className={`ah-workspace-page ph-page ph-v${direction}`} data-testid="workspace-page">
          <Head repo={repo} layout={LAYOUTS[direction]} />
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
  const [rules, setRules] = useState(new URLSearchParams(location.search).get('rules') === '1');
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
        <strong>Työtilan sivun yläosa 3</strong>
        <label>Tilanne <select id="scenario" value={s} onChange={(e) => reset(e.target.value as Scenario)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{SCENARIO_NAMES[id]}</option>)}</select></label>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
          <option value="light">Päivä</option><option value="dark">Yö</option><option value="contrast">Korkea kontrasti</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => reset()}>Alusta</button>
        <button type="button" data-testid="rules-open" aria-expanded={rules} onClick={() => setRules((v) => !v)}>Pienet painikkeet</button>
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
      {rules ? <RulesPanel onClose={() => { setRules(false); document.querySelector<HTMLElement>('[data-testid="rules-open"]')?.focus(); }} /> : null}
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
