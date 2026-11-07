import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, AgentHeader, NowSections, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, ToolRow, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {EditorSplit} from '../../../../web/src/components/EditorSplit';
import {EditorHeader, EditorHeaderActions} from '../../../../web/src/components/EditorHeader';
import {BrowserEditor} from '../../../../web/src/components/BrowserEditor';
import {Icon} from '../../../../web/src/components/Icon';
import {Button} from '../../../../web/src/components/Primitives';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {browserDocumentText} from '../../../../web/src/text/browserDocument';
import {workspaceEditorText} from '../../../../web/src/text/workspaceEditor';
import './round.css';

// proto-own-confirm-dialog, round 1. Leaving the browser editor with unsaved
// changes asks through window.confirm ("open-habitat-test.example.test says ·
// Discard unsaved changes? … Cancel / OK"), and so does narrowing a window
// with VS Code open. This round shows Habitat's own answer three ways on the
// same view and the same four situations: a dialog in the middle of the page
// with three named buttons, a non-modal bar inside the editor that leaves the
// editor usable, and no question at all: leaving saves, with an undo. Rail,
// header, messages, EditorSplit, EditorHeader, BrowserEditor, buttons and
// composer are production components, and the dialog wears the production
// overlay classes; the questions, the bar, the toast and the VS Code picture
// are this round's. Synthetic content; nothing is written.
const directions = ['A Ikkuna', 'B Palkki', 'C Ei kysy'];
const LINES = {
  fi: [
    'A Ikkuna: kysymys keskellä sivua, sivu himmenee; kolme nimettyä painiketta: Tallenna ja sulje · Hylkää muutokset · Jatka muokkausta.',
    'B Palkki: rivi editorin alareunassa, muu sivu käytettävissä; lyhyet painikkeet Tallenna · Hylkää · Peru, ja kohde kerrotaan rivillä.',
    'C Ei kysy: ei kysymystä; poistuminen tallentaa ja ilmoitus kertoo sen, Kumoa palauttaa tekstin tallentamattomaksi. Kysyy vain, kun tallennus ei onnistu.',
  ],
  en: [
    'A Dialog: the question in the middle of the page, the page dims; three named buttons: Save and close · Discard changes · Keep editing.',
    'B Bar: a row at the editor\'s bottom edge, the rest stays usable; short buttons Save · Discard · Cancel, the target named on the row.',
    'C No question: leaving saves and a notice says so, Undo brings the text back unsaved. Asks only when saving fails.',
  ],
};
const A = 0, B = 1, C = 2;
type Lang = 'fi' | 'en';
type Case = 'close' | 'file' | 'conversation' | 'phone';

const FILES: Record<string, string> = {
  'docs/asennus.md': '# Asennus\n\nAsennetaan yhdelle palvelimelle.\n\n- Ubuntu 24.04\n- Julkinen DNS-nimi\n- 2 Gt muistia\n',
  'docs/kayttajat.md': '# Käyttäjät\n\nJokainen käyttäjä kirjautuu omalla tunnuksellaan.\n\n- Ylläpitäjä hyväksyy uuden käyttäjän.\n- Käyttäjä saa oman Linux-tunnuksen.\n',
  'docs/varmuuskopio.md': '# Varmuuskopio\n\nKotihakemistot kopioidaan yöllä.\n',
  'README.md': '# Asennusohje\n\nOhjeet ovat hakemistossa docs/.\n',
};
// The person's unsaved text in asennus.md: lines 3 and 7 changed.
const MINE = FILES['docs/asennus.md'].replace('palvelimelle.', 'palvelimelle. Tarvitset sudo-oikeudet.').replace('2 Gt', '4 Gt');
const base = (p: string) => p.split('/').pop()!;

const T = {
  fi: {
    title: (f: string) => `Tallennetaanko muutokset tiedostoon ${f}?`,
    lost: 'Tallentamattomat muutokset menetetään, jos et tallenna niitä.',
    lead: (c: Case, t: string) => c === 'close' ? 'Suljet editorin.' : c === 'file' ? `Avaat tiedoston ${t}.` : `Siirryt keskusteluun ${t} työtilassa kotisivu.`,
    go: (c: Case) => c === 'close' ? 'Tallenna ja sulje' : c === 'file' ? 'Tallenna ja avaa' : 'Tallenna ja siirry',
    discard: 'Hylkää muutokset',
    keep: 'Jatka muokkausta',
    failed: 'Tallennus ei onnistunut: agentti muutti samaa kohtaa. Oma teksti säilyy editorissa.',
    phoneTitle: 'Vaihdetaanko puhelimen editoriin?',
    phoneBody: 'Ikkuna on nyt liian kapea VS Codelle. Habitat ei näe, onko VS Codessa tallentamattomia muutoksia.',
    phoneSave: 'Tallenna ja vaihda',
    phoneSwitch: 'Vaihda tallentamatta',
    phoneStay: 'Pysy VS Codessa',
    barLine: (f: string) => `${f}: tallentamattomia muutoksia`,
    barNext: (c: Case, t: string) => c === 'close' ? 'Editori sulkeutuu, kun valitset.' : c === 'file' ? `${t} avautuu, kun valitset.` : `Keskustelu ${t} avautuu, kun valitset.`,
    barSave: 'Tallenna', barDiscard: 'Hylkää', barCancel: 'Peru',
    barPhone: 'Ikkuna on liian kapea VS Codelle.',
    barPhoneNext: 'Tallenna VS Codessa ensin (Ctrl+S), jos siellä on muutoksia.',
    barPhoneSwitch: 'Vaihda puhelimen editoriin',
    saved: (f: string) => `Tallennettu ${f}`,
    savedNext: (c: Case, t: string) => c === 'file' ? ` · avattu ${t}` : '',
    undo: 'Kumoa',
    undone: (f: string) => `Tallennus kumottu. ${f} on taas auki tallentamattomana.`,
    discarded: (f: string) => `Muutokset hylätty: ${f}`,
    phoneDone: 'VS Coden muutokset tallennettiin, ja editori vaihtui puhelimen editoriin.',
    cantTitle: 'Muutoksia ei voitu tallentaa',
    cantBody: (f: string) => `Agentti muutti samaa kohtaa tiedostossa ${f}. Oma teksti säilyy editorissa, kunnes hylkäät sen.`,
    dismiss: 'Sulje ilmoitus',
    vscode: 'VS Code (kuva, ei oikea editori)',
  },
  en: {
    title: (f: string) => `Save changes to ${f}?`,
    lost: 'Unsaved changes are lost if you don\'t save them.',
    lead: (c: Case, t: string) => c === 'close' ? 'You\'re closing the editor.' : c === 'file' ? `You're opening ${t}.` : `You're going to ${t} in kotisivu.`,
    go: (c: Case) => c === 'close' ? 'Save and close' : c === 'file' ? 'Save and open' : 'Save and go',
    discard: 'Discard changes',
    keep: 'Keep editing',
    failed: 'Saving failed: the agent changed the same place. Your text stays in the editor.',
    phoneTitle: 'Switch to the phone editor?',
    phoneBody: 'The window is now too narrow for VS Code. Habitat can\'t see whether VS Code has unsaved changes.',
    phoneSave: 'Save and switch',
    phoneSwitch: 'Switch without saving',
    phoneStay: 'Stay in VS Code',
    barLine: (f: string) => `${f} has unsaved changes`,
    barNext: (c: Case, t: string) => c === 'close' ? 'The editor closes when you choose.' : c === 'file' ? `${t} opens when you choose.` : `${t} opens when you choose.`,
    barSave: 'Save', barDiscard: 'Discard', barCancel: 'Cancel',
    barPhone: 'The window is too narrow for VS Code.',
    barPhoneNext: 'Save in VS Code first (Ctrl+S) if it has changes.',
    barPhoneSwitch: 'Switch to the phone editor',
    saved: (f: string) => `Saved ${f}`,
    savedNext: (c: Case, t: string) => c === 'file' ? ` · opened ${t}` : '',
    undo: 'Undo',
    undone: (f: string) => `Save undone. ${f} is open again, unsaved.`,
    discarded: (f: string) => `Changes discarded: ${f}`,
    phoneDone: 'VS Code\'s changes were saved and the editor switched to the phone editor.',
    cantTitle: 'Your changes could not be saved',
    cantBody: (f: string) => `The agent changed the same place in ${f}. Your text stays in the editor until you discard it.`,
    dismiss: 'Dismiss',
    vscode: 'VS Code (a picture, not the real editor)',
  },
};

type Item = {id: string; kind: 'user' | 'assistant' | 'tools'; text?: string; time: string; tools?: {name: string; path: string}[]};
const CONVOS: Record<string, {title: string; workspace: string; items: Item[]}> = {
  doc: {title: 'Asennusohjeen päivitys', workspace: 'habitat-docs', items: [
    {id: 'u1', kind: 'user', time: '10.02', text: 'Päivitä asennusohje: Debian 13 käy myös, ja virtuaalikone riittää.'},
    {id: 't1', kind: 'tools', time: '10.03', tools: [{name: 'read', path: 'docs/asennus.md'}, {name: 'edit', path: 'docs/kayttajat.md'}]},
    {id: 'a1', kind: 'assistant', time: '10.04', text: 'Päivitin [docs/kayttajat.md](docs/kayttajat.md). Asennusohjeen muistivaatimus on vielä 2 Gt; muokkaatko sen itse editorissa?'},
    {id: 'u2', kind: 'user', time: '10.06', text: 'Joo, korjaan sen ja lisään sudo-huomautuksen.'},
  ]},
  kuvat: {title: 'Kotisivun kuvat', workspace: 'kotisivu', items: [
    {id: 'k1', kind: 'user', time: '9.40', text: 'Pienennä etusivun kuvat alle 300 kilotavuun.'},
    {id: 'k2', kind: 'assistant', time: '9.42', text: 'Pienensin kuusi kuvaa. Suurin on nyt 280 kt.'},
  ]},
};

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [{path: 'docs/asennus.md', git: 'modified'}], truncated: false}),
  workspaceName: 'habitat-docs',
};
const directories = {
  '': {entries: [{name: 'docs', kind: 'directory' as const}, {name: 'README.md', kind: 'file' as const}]},
  docs: {entries: [{name: 'asennus.md', kind: 'file' as const}, {name: 'kayttajat.md', kind: 'file' as const}, {name: 'varmuuskopio.md', kind: 'file' as const}]},
};

function render(item: Item, lang: Lang) {
  let content: React.ReactNode;
  if (item.kind === 'user') content = <UserMessage sourceText={item.text!} onCopy={noop} time={item.time}><Markdown text={item.text!} breaks /></UserMessage>;
  else if (item.kind === 'tools') content = <div className="dlg-tools">{item.tools!.map((t, i) => <ToolRow key={i} name={t.name} targetText={t.path} statusLabel={lang === 'fi' ? 'Valmis' : 'Done'} state="succeeded" expanded={false} onToggle={noop} />)}</div>;
  else content = <AssistantMessage streamState="complete" time={item.time} onCopy={noop}><Markdown text={item.text!} /></AssistantMessage>;
  return {id: item.id, content};
}

type Ask = {kind: Case; target: string; failed?: boolean};
type Toast = {text: string; undo?: boolean};

/** A: Habitat's dialog in the page's centre, in the production overlay. */
function AskDialog({ask, lang, file, onSave, onDiscard, onKeep, cantSave}: {ask: Ask; lang: Lang; file: string; onSave: () => void; onDiscard: () => void; onKeep: () => void; cantSave?: boolean}) {
  const t = T[lang];
  const phone = ask.kind === 'phone';
  const title = cantSave ? t.cantTitle : phone ? t.phoneTitle : t.title(file);
  return (
    <ModalOverlay className="ah-overlay dlg-overlay" isOpen isDismissable onOpenChange={(o) => { if (!o) onKeep(); }}>
      <Modal className="ah-modal dlg-modal">
        <AriaDialog className="ah-dialog dlg-dialog" role="alertdialog" aria-label={title} data-testid="ask-dialog">
          <Heading slot="title">{title}</Heading>
          {cantSave ? <p>{t.cantBody(file)}</p>
            : phone ? <p>{t.phoneBody}</p>
            : <p>{t.lead(ask.kind, ask.target)} {t.lost}</p>}
          {ask.failed && !cantSave ? <p className="dlg-failed" role="status"><Icon name="warning" />{t.failed}</p> : null}
          <div className="dlg-dialog-actions">
            <Button data-testid="ask-discard" label={phone ? t.phoneSwitch : t.discard} variant="danger-subtle" size="page" onPress={onDiscard} />
            <span className="dlg-dialog-right">
              <Button data-testid="ask-keep" label={phone ? t.phoneStay : t.keep} variant="secondary" size="page" onPress={onKeep} />
              {cantSave || ask.failed ? null : <Button data-testid="ask-save" label={phone ? t.phoneSave : t.go(ask.kind)} variant="primary" size="page" onPress={onSave} />}
            </span>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** B: a non-modal row at the editor's bottom edge; the editor stays usable. */
function AskBar({ask, lang, file, onSave, onDiscard, onKeep}: {ask: Ask; lang: Lang; file: string; onSave: () => void; onDiscard: () => void; onKeep: () => void}) {
  const t = T[lang];
  const phone = ask.kind === 'phone';
  return (
    <section className="dlg-bar" role="region" aria-label={phone ? t.barPhone : t.barLine(file)} data-testid="ask-bar">
      <div className="dlg-bar-text">
        <strong>{phone ? t.barPhone : t.barLine(file)}</strong>
        <span>{ask.failed ? t.failed : phone ? t.barPhoneNext : t.barNext(ask.kind, ask.target)}</span>
      </div>
      <div className="dlg-bar-actions">
        {phone ? <>
          <Button data-testid="ask-keep" label={t.phoneStay} variant="quiet" size="row" onPress={onKeep} />
          <Button data-testid="ask-discard" label={t.barPhoneSwitch} variant="primary" size="row" onPress={onDiscard} />
        </> : <>
          <Button data-testid="ask-keep" label={t.barCancel} variant="quiet" size="row" onPress={onKeep} />
          <Button data-testid="ask-discard" label={t.barDiscard} variant="danger-subtle" size="row" onPress={onDiscard} />
          {ask.failed ? null : <Button data-testid="ask-save" label={t.barSave} variant="primary" size="row" onPress={onSave} />}
        </>}
      </div>
    </section>
  );
}

/** C: what happened, with an undo; a status, not a question. */
function ToastLine({toast, lang, onUndo, onDismiss}: {toast: Toast; lang: Lang; onUndo: () => void; onDismiss: () => void}) {
  const t = T[lang];
  return (
    <div className="dlg-toast" role="status" data-testid="toast">
      <Icon name="check" />
      <span>{toast.text}</span>
      {toast.undo ? <button type="button" className="dlg-link" data-testid="toast-undo" onClick={onUndo}>{t.undo}</button> : null}
      <button type="button" className="dlg-x" aria-label={t.dismiss} onClick={onDismiss}><Icon name="cross" /></button>
    </div>
  );
}

/** VS Code cannot run here: a picture of its frame with one dirty tab. */
function VSCodePicture({lang, onClose}: {lang: Lang; onClose: () => void}) {
  return (
    <div className="dlg-vscode-pane">
      <EditorHeader title="VS Code" collapsed={false} onToggleCollapsed={noop} onClose={onClose} />
      <div className="dlg-vscode" aria-label={T[lang].vscode} role="img">
        <div className="dlg-vscode-tabs"><span className="dlg-vscode-tab">asennus.md <b>●</b></span><span className="dlg-vscode-tab dlg-off">kayttajat.md</span></div>
        <pre>{MINE}</pre>
        <span className="dlg-vscode-caption">{T[lang].vscode}</span>
      </div>
    </div>
  );
}

let reviewTheme = 'light';
let reviewLang: Lang = 'fi';
let reviewCase: Case = 'close';
let reviewStep: 'ask' | 'edit' = 'ask';
let reviewSave: 'ok' | 'fail' = 'ok';

function Main({direction, lang, kase, step, saveFails}: {direction: number; lang: Lang; kase: Case; step: 'ask' | 'edit'; saveFails: boolean}) {
  const t = T[lang];
  const [disk, setDisk] = useState<Record<string, string>>(FILES);
  const [path, setPath] = useState('docs/asennus.md');
  const [content, setContent] = useState(MINE);
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(true);
  const [engine, setEngine] = useState<'cm' | 'vscode'>(kase === 'phone' ? 'vscode' : 'cm');
  const [conv, setConv] = useState('doc');
  const [picker, setPicker] = useState(kase === 'file' || window.innerWidth > 800);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(520);
  const undoTo = useRef<{path: string; text: string; disk: string} | null>(null);
  const dirty = engine === 'cm' && content !== disk[path];
  const state = useRef({dirty, content, path, disk, engine});
  state.current = {dirty, content, path, disk, engine};

  const load = (p: string, text?: string) => { setPath(p); setContent(text ?? disk[p]); setRevision((r) => r + 1); };
  const proceed = (a: Ask) => {
    setAsk(null);
    if (a.kind === 'close') setOpen(false);
    else if (a.kind === 'file') load(a.target, state.current.disk[a.target]);
    else if (a.kind === 'conversation') { setConv('kuvat'); setOpen(false); }
    else { setEngine('cm'); load('docs/asennus.md', FILES['docs/asennus.md']); }
  };
  const target = (a: Ask) => a.kind === 'file' ? base(a.target) : a.kind === 'conversation' ? CONVOS.kuvat.title : '';
  const save = (a: Ask) => {
    if (saveFails && a.kind !== 'phone') { setAsk({...a, failed: true}); return false; }
    const s = state.current;
    if (a.kind !== 'phone') {
      undoTo.current = {path: s.path, text: s.content, disk: s.disk[s.path]};
      setDisk({...s.disk, [s.path]: s.content});
    }
    return true;
  };
  const request = (kind: Case, tgt = '') => {
    const a = {kind, target: tgt};
    setToast(null);
    if (kind !== 'phone' && !state.current.dirty) { proceed(a); return; }
    if (direction !== C) { setAsk(a); return; }
    // C: leaving saves; only a failed save asks.
    if (kind === 'phone') { proceed(a); setToast({text: t.phoneDone}); return; }
    if (!save(a)) return;
    const name = base(state.current.path);
    proceed(a);
    setToast({text: t.saved(name) + t.savedNext(kind, target(a)), undo: true});
  };
  const undo = () => {
    const u = undoTo.current;
    if (!u) return;
    setDisk((d) => ({...d, [u.path]: u.disk}));
    setConv('doc'); setOpen(true); setEngine('cm');
    load(u.path, u.text);
    setToast({text: t.undone(base(u.path))});
    undoTo.current = null;
  };

  // The default view opens each situation's question as if just triggered.
  useEffect(() => {
    if (step !== 'ask') return;
    const tgt = kase === 'file' ? 'docs/kayttajat.md' : kase === 'conversation' ? 'kuvat' : '';
    const id = setTimeout(() => request(kase, tgt), 60);
    return () => clearTimeout(id);
  }, []);
  // A rail click on the other workspace's conversation is the route change
  // the production blocker sees.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[href*="conversation=pi:kuvat"]');
      if (!a || conv === 'kuvat') return;
      e.preventDefault(); e.stopPropagation();
      if (open) request('conversation', 'kuvat'); else setConv('kuvat');
    };
    const back = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[href*="conversation=pi:doc"]');
      if (!a) return;
      e.preventDefault(); e.stopPropagation(); setConv('doc');
    };
    document.addEventListener('click', click, true);
    document.addEventListener('click', back, true);
    return () => { document.removeEventListener('click', click, true); document.removeEventListener('click', back, true); };
  });
  // Closing or reloading the tab stays the browser's own question.
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => { if (!state.current.dirty) return; e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, []);

  const name = base(path);
  const answer = {
    onSave: () => { if (ask && save(ask)) proceed(ask); },
    onDiscard: () => { if (!ask) return; if (ask.kind !== 'phone') setContent(disk[path]); proceed(ask); },
    onKeep: () => setAsk(null),
  };
  const c = CONVOS[conv];
  // The notice appears where the change happened: in the editor while it
  // stays open, otherwise under the conversation's header.
  const toastLine = toast ? <ToastLine toast={toast} lang={lang} onUndo={undo} onDismiss={() => setToast(null)} /> : null;
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel={lang === 'fi' ? 'Synteettinen' : 'Synthetic'} connectionLabel={lang === 'fi' ? 'Yhdistetty' : 'Connected'} connectionTone="success"
      filterValue="" resultSummary={lang === 'fi' ? '2 työtilaa' : '2 workspaces'} listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={<NowSections yours={[]} running={[
        {agentId: 'pi:doc', title: CONVOS.doc.title, href: '/workspaces/ws_d?conversation=pi:doc', activityLabel: lang === 'fi' ? 'Valmis' : 'Done', controlLabel: '', workspaceName: 'habitat-docs', detail: 'habitat-docs', selected: conv === 'doc'},
        {agentId: 'pi:kuvat', title: CONVOS.kuvat.title, href: '/workspaces/ws_k?conversation=pi:kuvat', activityLabel: lang === 'fi' ? 'Valmis' : 'Done', controlLabel: '', workspaceName: 'kotisivu', detail: 'kotisivu', selected: conv === 'kuvat'},
      ]} />}>
      <WorkspaceNavRow name="habitat-docs" href="/workspaces/ws_d" selected={conv === 'doc'} />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" selected={conv === 'kuvat'} />
    </WorkspaceRail>
  );
  const conversation = (
    <div className="ah-state dlg-conv">
      <ConversationFrame>
        <AgentHeader title={c.title} workspaceLabel={c.workspace} workspaceHref="/workspaces/ws_d"
          activityLabel="" activityAnimated={false} activityKind="neutral"
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} rename={{onSave: async () => {}}} />
        <ConversationStream>
          <ConversationTimeline key={conv} state="ready" historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} items={c.items.map((i) => render(i, lang))} />
        </ConversationStream>
        <Composer value="" onChange={noop} activity="idle" selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop}
          onInterrupt={noop} sources={sources} csrf="prototype"
          modelPicker={<button type="button" className="md-pill">{lang === 'fi' ? 'Agentin oletus' : 'Agent default'} · medium</button>} />
      </ConversationFrame>
      {toast && !open ? toastLine : null}
    </div>
  );
  const bar = ask && direction === B ? <AskBar ask={ask} lang={lang} file={name} {...answer} /> : null;
  const editor = open ? (
    <div className="dlg-editor" data-ask={ask ? ask.kind : undefined}>
      {engine === 'vscode' ? <VSCodePicture lang={lang} onClose={() => setOpen(false)} /> : (
        <BrowserEditor
          engine="codemirror6"
          document={{path, content, revision}}
          directories={directories}
          reveal={{path}}
          onLoadDirectory={noop} picker={picker} onPicker={() => setPicker(!picker)}
          onOpen={(p) => { if (p !== path) request('file', p); }}
          dirty={dirty} saving={false} loading={false}
          onChange={(next) => setContent(next)}
          onSave={() => { const s = state.current; setDisk({...s.disk, [s.path]: s.content}); }}
          onReload={noop} onImportNow={noop} onUndoImport={noop} onReimport={noop}
          toolbarActions={<EditorHeaderActions collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} onClose={() => request('close')} />}
        />
      )}
      {bar}
      {toastLine}
    </div>
  ) : null;
  const main = (
    <EditorSplit open={open} collapsed={collapsed} width={width} min={320} max={880}
      editor={editor} strip={{label: c.title, working: false, unread: false}}
      onResize={(w) => setWidth(Math.min(880, Math.max(320, w)))} onCollapse={setCollapsed}
      onReset={() => { setCollapsed(false); setWidth(520); }} onShowConversation={() => setCollapsed(false)}>
      {conversation}
    </EditorSplit>
  );
  return (
    <>
      <AppShell mobileTitle={c.title} rail={rail} main={main} />
      {ask && (direction === A || (direction === C && ask.failed)) ? (
        <AskDialog ask={ask} lang={lang} file={name} cantSave={direction === C} {...answer} />
      ) : null}
    </>
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [lang, setLang] = useState<Lang>(reviewLang);
  const [kase, setCase] = useState<Case>(reviewCase);
  const [step, setStep] = useState(reviewStep);
  const [save, setSave] = useState(reviewSave);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { setPersonalLanguage(lang); document.documentElement.lang = lang; }, [lang]);
  const reset = () => setGeneration((g) => g + 1);
  // Today's question, asked exactly as production asks it.
  const nativeConfirm = () => {
    const q = kase === 'phone' ? workspaceEditorText[lang].switchToPhoneEditor : browserDocumentText[lang].discardQuestion;
    window.confirm(q);
  };
  return (
    <div className={`dlg-review variant-${direction}`} data-direction={direction}>
      {/* Review controls stay usable while the modal question is open. */}
      <header className="dlg-bar-review" ref={bar} data-react-aria-top-layer="true">
        <strong>Oma vahvistus · kierros 1</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Kieli <select id="lang" value={lang} onChange={(e) => { reviewLang = e.target.value as Lang; setLang(reviewLang); reset(); }}>
          <option value="fi">Suomi</option><option value="en">English</option></select></label>
        <label>Tilanne <select id="case" value={kase} onChange={(e) => { reviewCase = e.target.value as Case; setCase(reviewCase); reset(); }}>
          <option value="close">Sulje editori</option><option value="file">Vaihda tiedosto</option>
          <option value="conversation">Vaihda keskustelu</option><option value="phone">VS Code → puhelimen editori</option></select></label>
        <label>Alku <select id="step" value={step} onChange={(e) => { reviewStep = e.target.value as 'ask' | 'edit'; setStep(reviewStep); reset(); }}>
          <option value="ask">Kysymys auki</option><option value="edit">Muokkaus kesken</option></select></label>
        <label>Tallennus <select id="save" value={save} onChange={(e) => { reviewSave = e.target.value as 'ok' | 'fail'; setSave(reviewSave); reset(); }}>
          <option value="ok">Onnistuu</option><option value="fail">Ei onnistu</option></select></label>
        <button type="button" data-testid="dlg-reset" onClick={reset}>Alusta</button>
        <button type="button" data-testid="native-confirm" onClick={nativeConfirm}>Nykyinen: selaimen kysymys</button>
        <ol className="dlg-lines" data-testid="direction-lines">
          {LINES[lang].map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="dlg-stage">
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_d?conversation=pi:doc']}>
          <Main key={`${direction}-${generation}-${lang}`} direction={direction} lang={lang} kase={kase} step={step} saveFails={save === 'fail'} />
        </MemoryRouter>
      </div>
    </div>
  );
}

setPersonalLanguage(reviewLang);
const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.setAttribute('data-react-aria-top-layer', 'true');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
