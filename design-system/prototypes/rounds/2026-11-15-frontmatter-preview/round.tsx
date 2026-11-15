import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import "../../../../web/src/components/BrowserEditor.css";
import { AppShell, AgentHeader, NowSections, WorkspaceNavRow, WorkspaceRail } from "../../../../web/src/components/Navigation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { AssistantMessage, ConversationTimeline, UserMessage } from "../../../../web/src/components/Conversation";
import { Composer, type ComposerSources } from "../../../../web/src/components/composer/Composer";
import { Markdown } from "../../../../web/src/components/Markdown";
import { EditorSplit } from "../../../../web/src/components/EditorSplit";
import { EditorHeaderActions } from "../../../../web/src/components/EditorHeader";
import { EditorFileTree } from "../../../../web/src/components/EditorFileTree";
import { ControlButton, controlStyles } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { browserEditorText } from "../../../../web/src/text/browserEditor";
import { AsStartPage, docText, Nested, TextContext, Tree } from "./fm";
import { broken, type Doc, type FileId, files, type Lang, TEXT } from "./text";
import "./round.css";

// proto-frontmatter-preview, round 1. The editor's preview of a Markdown
// file whose YAML front matter nests (a start page's goals) and of a plain
// YAML file. The shell, the conversation, the composer, the editor split and
// header actions, the file tree, the CodeMirror text view, the Markdown body
// and the start page (WorkspaceIntro) are production components; the
// editor's toolbar is production's markup and classes redrawn here, because
// production's BrowserEditor has its renderer and its YAML exclusion built
// in. The front matter renderers are this round's (fm.tsx). Everything is
// synthetic; nothing is read or saved.

const CodeMirror = lazy(() => import("../../../../web/src/components/CodeMirrorEditor"));
const NOW = 0, NESTED = 1, TREE = 2, PAGE = 3;
const params = new URLSearchParams(location.search);
const review = {
  theme: (params.get("theme") as "light" | "dark" | "contrast") || "light",
  lang: (params.get("lang") as Lang) || "fi",
  file: (params.get("file") as FileId) || "start",
  broken: params.get("broken") === "1",
};
setPersonalLanguage(review.lang);
const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({ answered_by: "running", commands: [] }),
  files: async () => ({ files: [], truncated: false }),
  workspaceName: "pyoraseura",
};
const pathOf: Record<string, FileId> = {};

function Preview({ doc, direction }: { doc: Doc; direction: number }) {
  const t = TEXT[review.lang];
  const yaml = doc.body === undefined;
  if (direction === NOW) return <Markdown text={docText(doc)} document />;
  if (direction === PAGE && doc.path === ".agents/start-page.md") return <AsStartPage doc={doc} />;
  const block = direction === TREE ? <Tree data={doc.data} /> : <Nested v={doc.data} />;
  return (
    <div className="ah-markdown">
      <section className="fmx" data-yaml={yaml || undefined} aria-label={yaml ? t.yamlDoc : t.frontmatter} data-testid="frontmatter-preview">
        {block}
      </section>
      {yaml ? null : <Markdown text={doc.body ?? ""} document />}
    </div>
  );
}

/** Production's editor frame (BrowserEditor.tsx) with the round's preview. */
function Editor({ doc, direction, onOpen, toolbarActions }: { doc: Doc; direction: number; onOpen: (path: string) => void; toolbarActions: React.ReactNode }) {
  const t = useText(browserEditorText);
  // Today a YAML file has no preview; every direction gives it one.
  const previewable = !(direction === NOW && doc.body === undefined);
  const [preview, setPreview] = useState(true);
  const [picker, setPicker] = useState(false);
  const shown = previewable && preview;
  const content = docText(doc);
  return (
    <div className="ah-browser-editor" data-testid="browser-editor">
      <header className="ah-browser-toolbar" data-testid="editor-header">
        <ControlButton data-testid="editor-picker" size="row" onPress={() => setPicker(!picker)} aria-expanded={picker} aria-label={t.files} title={t.files}>
          <Icon name="folder" />
        </ControlButton>
        <code className="ah-browser-filename" title={doc.path}>{doc.path}</code>
        <span className="ah-browser-state" data-testid="editor-changes"><span role="status" data-testid="editor-dirty" /></span>
        {previewable ? (
          <fieldset aria-label={t.view} className={`${controlStyles.segmented} ah-browser-views`} data-testid="editor-view">
            <ControlButton data-testid="editor-text-toggle" size="row" variant="quiet" presentation="segment" aria-label={t.text} aria-pressed={!shown} onPress={() => setPreview(false)}>
              <Icon name="pencil" />
            </ControlButton>
            <ControlButton data-testid="editor-preview-toggle" size="row" variant="quiet" presentation="segment" aria-label={t.views.markdown} aria-pressed={shown} onPress={() => setPreview(true)}>
              <Icon name="eye" />
            </ControlButton>
          </fieldset>
        ) : null}
        <ControlButton data-testid="editor-save" size="row" variant="secondary" isDisabled aria-label={t.save} title={t.save} onPress={noop}>
          <Icon name="save" />
        </ControlButton>
        {toolbarActions}
      </header>
      <div className="ah-browser-body">
        <EditorFileTree
          visible={picker}
          directories={{
            "": { entries: [{ name: ".agents", kind: "directory" }, { name: ".github", kind: "directory" }, { name: "content", kind: "directory" }, { name: "README.md", kind: "file" }] },
            ".agents": { entries: [{ name: "start-page.md", kind: "file" }] },
            ".github": { entries: [{ name: "workflows", kind: "directory" }] },
            ".github/workflows": { entries: [{ name: "tarkistus.yml", kind: "file" }] },
            content: { entries: [{ name: "jutut", kind: "directory" }, { name: "posts", kind: "directory" }] },
            "content/jutut": { entries: [{ name: "syyskauden-paatos.md", kind: "file" }] },
            "content/posts": { entries: [{ name: "season-finale.md", kind: "file" }] },
          }}
          openPath={doc.path}
          dirty={false}
          onLoad={noop}
          onOpen={(path) => { if (pathOf[path]) { onOpen(path); setPicker(false); } }}
          onClose={() => setPicker(false)}
        />
        <div className="ah-browser-document" data-preview={shown ? "only" : "off"}>
          <div className="ah-browser-source">
            <Suspense fallback={<p role="status">{t.loadingEditor}</p>}>
              <CodeMirror key={doc.path} path={doc.path} content={content} onChange={noop} onSave={noop} />
            </Suspense>
          </div>
          {shown ? (
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the region scrolls.
            <section className="ah-browser-preview" data-testid="editor-preview" data-kind="markdown" aria-label={t.views.markdown} tabIndex={0}>
              <Preview doc={doc} direction={direction} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Main({ direction }: { direction: number }) {
  const t = TEXT[review.lang];
  const all = files(review.lang);
  for (const id of Object.keys(all) as FileId[]) pathOf[all[id].path] = id;
  const [file, setFile] = useState<FileId>(review.file);
  const phone = innerWidth <= 800;
  const [collapsed, setCollapsed] = useState(phone);
  const [width, setWidth] = useState(460);
  const doc = file === "start" && review.broken ? broken(all.start) : all[file];
  const title = review.lang === "fi" ? "Aloitussivun päivitys" : "Start page update";
  const fi = review.lang === "fi";
  const ask = fi ? "Päivitä aloitussivu: lisää tavoite tapahtuman lisäämiseen." : "Update the start page: add a goal for adding an event.";
  const items = [
    { id: "u1", content: <UserMessage time="10.02" onCopy={noop} sourceText={ask}><Markdown text={ask} /></UserMessage> },
    { id: "a1", content: <AssistantMessage time="10.05" streamState="complete" onCopy={noop}><Markdown text={fi ? "Lisäsin tavoitteen **Lisää tapahtuma kalenteriin** ja sille oman taidon. Sivulla on nyt kolme tavoitetta; katso `.agents/start-page.md` ennen kuin commitoit." : "I added the goal **Add an event to the calendar** and its own skill. The page now has three goals; look at `.agents/start-page.md` before you commit."} /></AssistantMessage> },
  ];
  const conversation = (
    <div className="ah-state">
      <ConversationFrame>
        <AgentHeader title={title} workspaceLabel="pyoraseura" workspaceHref="/workspaces/ws_p" activityLabel="" activityAnimated={false} activityKind="neutral" controlLabel="" detailsExpanded={false} onToggleDetails={noop} rename={{ onSave: async () => {} }} />
        <ConversationStream>
          <ConversationTimeline state="ready" items={items as never} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
        </ConversationStream>
        <Composer value="" onChange={noop} activity="idle" selectedWorkingMode="steer" onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={<button type="button" className="md-pill">medium</button>} />
      </ConversationFrame>
    </div>
  );
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel={fi ? "Yhdistetty" : "Connected"} connectionTone="success" filterValue="" resultSummary="2" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={<NowSections yours={[]} running={[{ agentId: "pi:sp", title, href: "/workspaces/ws_p?conversation=pi:sp", activityLabel: fi ? "Valmis" : "Done", controlLabel: "", workspaceName: "pyoraseura", detail: "pyoraseura", selected: true }]} />}>
      <WorkspaceNavRow name="pyoraseura" href="/workspaces/ws_p" selected />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
    </WorkspaceRail>
  );
  const main = (
    <EditorSplit open collapsed={collapsed} width={width} min={320} max={880}
      editor={<Editor key={`${file}-${direction}`} doc={doc} direction={direction} onOpen={(p) => setFile(pathOf[p])}
        toolbarActions={<EditorHeaderActions collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} onClose={noop} />} />}
      strip={{ label: title, working: false, unread: false }}
      onResize={(w) => setWidth(Math.min(880, Math.max(320, w)))} onCollapse={setCollapsed}
      onReset={() => { setCollapsed(false); setWidth(460); }} onShowConversation={() => setCollapsed(false)}>
      {conversation}
    </EditorSplit>
  );
  void t;
  return <AppShell mobileTitle={title} rail={rail} main={main} />;
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(review.theme);
  const [lang, setLang] = useState(review.lang);
  const [file, setFile] = useState(review.file);
  const [bad, setBad] = useState(review.broken);
  const t = TEXT[lang];
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <TextContext.Provider value={t}>
      <div className={`fmp-review variant-${direction}`} data-direction={direction}>
        <header className="fmp-bar" ref={bar}>
          <div className="fmp-controls">
            <strong>{t.title}</strong>
            <label>{t.theme} <select id="theme" value={theme} onChange={(e) => { review.theme = e.target.value as never; setTheme(review.theme); }}>
              {(["light", "dark", "contrast"] as const).map((v) => <option key={v} value={v}>{t.themes[v]}</option>)}</select></label>
            <label>{t.language} <select id="language" value={lang} onChange={(e) => { review.lang = e.target.value as Lang; setPersonalLanguage(review.lang); setLang(review.lang); }}>
              <option value="fi">Suomi</option><option value="en">English</option></select></label>
            <label>{t.file} <select id="file" value={file} onChange={(e) => { review.file = e.target.value as FileId; setFile(review.file); }}>
              {(["start", "deep", "yaml"] as const).map((v) => <option key={v} value={v}>{t.fileNames[v]}</option>)}</select></label>
            <label>{t.state} <select id="state" value={bad ? "broken" : "ok"} onChange={(e) => { review.broken = e.target.value === "broken"; setBad(review.broken); }}>
              <option value="ok">{t.states.ok}</option><option value="broken">{t.states.broken}</option></select></label>
          </div>
          <ol className="fmp-lines" data-testid="direction-lines">
            {t.lines.map((l, i) => <li key={i} aria-current={i === direction ? "true" : undefined}>{l}</li>)}
          </ol>
          <p className="fmp-recommend" data-testid="recommendation">{t.recommend}</p>
        </header>
        <div className="fmp-stage">
          <MemoryRouter key={`${lang}-${file}-${bad}`} initialEntries={["/workspaces/ws_p?conversation=pi:sp"]}>
            <Main direction={direction} />
          </MemoryRouter>
        </div>
      </div>
    </TextContext.Provider>
  );
}

const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = { set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === "" ? null : view)); } };
const names = TEXT[review.lang].direction;
const variants = names.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
names.forEach((n, i) => {
  const button = document.createElement("button");
  button.className = "proto-picker-item";
  button.textContent = n.replaceAll(" ", " ");
  if (i === 0) { button.setAttribute("data-active", ""); button.setAttribute("aria-current", "true"); }
  picker.append(button);
});
document.body.append(picker);
new Function("stage", "variants", pickerSource)(stageSink, variants);
