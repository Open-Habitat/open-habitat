import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/WorkspacePage.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {ControlButton, LinkRow} from '../../../../web/src/components/ControlElements';
import {Button, TextField} from '../../../../web/src/components/Primitives';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {WorkerMark, type WorkerMarkKind} from '../../../../web/src/components/WorkerMark';
import {HelperArchiveRows, HelperBranchDialog} from '../../../../web/src/components/HelperArchive';
import type {Spinoff} from '../../../../web/src/app/spinoffs';
import type {TimelineItem} from '../../../../web/src/components/types';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-conversation-archive, round 1. Jari 8.11.2026, pilot.657: the
// workspace page's Arkisto is a pile of underlined titles, each with a large
// Palauta näkyviin, archived helpers' status blocks mixed in between, no
// dates, no order, no way to find anything. Every direction orders by when
// the conversation was archived, dates each row, says in a few words what a
// conversation left behind (a helper, a worker's result) instead of a status
// block, opens a conversation read-only and restores with one quiet action.
// The axis is where the archive lives and how one finds a conversation in it:
// 1 Lista: still on the workspace page, a dated, grouped, filterable list;
// 2 Oma näkymä: its own page reached from one line on the workspace page,
//   with search over titles and recaps and a preview of the chosen one;
// 3 Sivupalkki: in the rail under the workspace, like the running ones; the
//   main column shows the chosen conversation read-only.
const directions = ['Nyt', '1 Lista', '2 Oma näkymä', '3 Sivupalkki'];
const LINES = [
  'Nyt: tuotanto tänään. Työtilan sivun Arkisto: alleviivatut otsikot ja Palauta näkyviin -painikkeet, avustajien tilalohkot välissä, ei päiviä eikä järjestystä.',
  '1 Lista: arkisto pysyy työtilan sivulla, mutta päivän mukaan ryhmiteltynä ja suodatettavana; rivillä otsikko, päivä, mitä jäi jälkeen ja hiljainen palautus.',
  '2 Oma näkymä: työtilan sivulla on yksi rivi, joka vie arkiston omalle sivulle; haku otsikoista ja yhteenvedoista, valitun esikatselu yhteenvetoineen ja avustajineen.',
  '3 Sivupalkki: arkisto on sivupalkissa työtilan alla kuten käynnissä olevat; valittu keskustelu aukeaa pääpalstaan luettavaksi, ja palautus on sen alalaidassa.',
];

// ---- The story: Jari's thirteen archived conversations of pilot.657 ----
const WS = 'open-habitat';
const WSID = 'ws_openhabitat01';
// A fixed evening keeps the dates and groups the same in every screenshot.
const NOW = new Date(2026, 10, 8, 19, 30).getTime();
const at = (day: number, h: number, m: number) => new Date(2026, 10, day, h, m);
const octo = (day: number, h: number, m: number) => new Date(2026, 9, day, h, m);
const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAY = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const dayDiff = (d: Date) => Math.round((new Date(NOW).setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
/** Short date: klo 18.40 today, eilen 21.40, pe 6.11. this week, 28.10. before. */
function when(d: Date) {
  const n = dayDiff(d);
  if (n === 0) return `klo ${d.getHours()}.${pad(d.getMinutes())}`;
  if (n === 1) return `eilen ${d.getHours()}.${pad(d.getMinutes())}`;
  if (n < 7) return `${WEEKDAY[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}
const full = (d: Date) => `${WEEKDAY[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}. klo ${d.getHours()}.${pad(d.getMinutes())}`;
function group(d: Date) {
  const n = dayDiff(d);
  return n === 0 ? 'Tänään' : n === 1 ? 'Eilen' : n < 7 ? 'Aiemmin tällä viikolla' : 'Vanhemmat';
}

const run = (id: string, title: string, state: Spinoff['state'], branch: string, resident?: Spinoff['resident']): Spinoff => ({
  run_id: id, title, created_at: at(8, 12, 0).toISOString(), state, preserved: false, branch,
  worktree: `/home/maintainer/src/${WS}__worktrees/${branch.replace('wt/', 'wt-')}`, source_branch: 'main', summary: '',
  harness: 'claude', profile: 'prototype-opus', resident,
});
// Both helpers wait between rounds with a landing nobody confirmed, as on Jari's page.
const TESTAAJA = run('01m6xq1testaaja00000000000', 'Testaaja', 'waiting_parent', 'wt/d0qmfx5v37-testaaja',
  {name: 'testaaja', round_state: 'waiting', rounds: 2, landed_round: 1, report: 'Kierros 2 valmis: kirjautumisen testit ajettu, 2 korjausta haarassa.', reported_at: at(8, 17, 40).toISOString()});
const TESTIAVUSTAJA = run('01m6xq1testiavustaja000000', 'Testi: avustaja', 'waiting_parent', 'wt/d0qmb2k1q9-testiavustaja',
  {name: 'testiavustaja', round_state: 'waiting', rounds: 1, landed_round: 0, report: 'Kierros 1 valmis: tervehdys lisätty README:hen.', reported_at: at(8, 15, 55).toISOString()});
const MERGED = run('01m6w9merged0000000000000a', 'Korjaa kirjautumissivun paluuosoite', 'merged', 'wt/kirjautuminen-paluu');
const UNMERGED = run('01m6w2unmerged00000000000a', 'Päivitä KOKEILTAVAA-lista', 'unmerged', 'wt/kokeiltavaa-paivitys');

type Msg = [who: 'u' | 'a', text: string, time: string];
type Conv = {
  id: string; title: string; started: Date; changed: Date; archived: Date;
  recap?: {recap: string; next: string}; latest: string;
  helpers?: Spinoff[]; workers?: Spinoff[]; messages: Msg[];
};
const CONVS: Conv[] = [
  {id: 'pieni', title: 'Pieni testiagentin testi', started: at(8, 18, 20), changed: at(8, 18, 34), archived: at(8, 18, 40),
    recap: {recap: 'Testattiin, että agentti vastaa ja osaa lukea työtilan tiedostot. Molemmat toimivat.', next: 'Ei jatkoa; testi oli kertaluonteinen.'},
    latest: 'Luin AGENTS.md:n ja TESTING.md:n; molemmat löytyivät.',
    messages: [['u', 'Pieni testi: lue AGENTS.md ja kerro sen ensimmäinen otsikko.', '18.20'], ['a', 'Ensimmäinen otsikko on **open-habitat**. Luin myös TESTING.md:n; molemmat löytyivät.', '18.34']]},
  {id: 'tarkoitus', title: 'Testiavustajan tarkoitus', started: at(8, 16, 45), changed: at(8, 17, 48), archived: at(8, 17, 55), helpers: [TESTAAJA],
    recap: {recap: 'Selvitettiin, mihin avustajaa käytetään, ja tehtiin avustaja testaaja, joka ajoi kirjautumisen testit kahdessa kierroksessa.', next: 'Kierroksen 2 korjaukset ovat avustajan haarassa; yhdistämistä ei ole vahvistettu.'},
    latest: 'Testaaja raportoi kierroksen 2: kaksi korjausta haarassa.',
    messages: [['u', 'Mihin testiavustajaa oikeastaan tarvitaan? Tee sellainen ja anna sille kirjautumisen testit.', '16.45'], ['a', 'Tein avustajan **testaaja**. Kierros 1 on yhdistetty main-haaraan.', '17.10'], ['a', 'Testaaja raportoi kierroksen 2: kaksi korjausta haarassa `wt/d0qmfx5v37-testaaja`.', '17.48']]},
  {id: 'testi', title: 'testi', started: at(8, 17, 20), changed: at(8, 17, 21), archived: at(8, 17, 30),
    latest: 'Hei! Miten voin auttaa?', messages: [['u', 'testi', '17.20'], ['a', 'Hei! Miten voin auttaa?', '17.21']]},
  {id: 'kokeile', title: 'Kokeile testikoneella', started: at(8, 15, 10), changed: at(8, 16, 2), archived: at(8, 16, 10), helpers: [TESTIAVUSTAJA],
    recap: {recap: 'Kokeiltiin testikoneen uutta julkaisua ja tehtiin testiavustaja, joka lisäsi README:hen tervehdyksen.', next: 'Avustajan kierros 1 on sen haarassa; yhdistämistä ei ole vahvistettu.'},
    latest: 'Testiavustaja raportoi kierroksen 1.',
    messages: [['u', 'Kokeile testikoneella, toimiiko uusi julkaisu. Tee testiavustaja, joka lisää README:hen tervehdyksen.', '15.10'], ['a', 'Julkaisu pilot.657 vastaa ja kirjautuminen toimii. Tein avustajan **testiavustaja**.', '15.24'], ['a', 'Testiavustaja raportoi kierroksen 1: tervehdys lisätty README:hen omassa haarassaan.', '16.02']]},
  {id: 'kestaa', title: 'Testi. Tee jotakin joka kestää 30s', started: at(8, 14, 50), changed: at(8, 14, 52), archived: at(8, 15, 2),
    recap: {recap: 'Ajettiin 30 sekunnin komento, jotta nähtiin työn tila ja Stop.', next: 'Ei jatkoa.'},
    latest: 'Valmis: sleep 30 päättyi normaalisti.',
    messages: [['u', 'Testi. Tee jotakin joka kestää 30s', '14.50'], ['a', 'Ajoin `sleep 30 && echo valmis`. Valmis: komento päättyi normaalisti.', '14.52']]},
  {id: 'lapikaynti', title: 'Testikoneen muutosten läpikäynti', started: at(7, 19, 5), changed: at(7, 21, 31), archived: at(7, 21, 40), workers: [MERGED],
    recap: {recap: 'Käytiin läpi testikoneen viimeisimmät muutokset. Worker korjasi kirjautumissivun paluuosoitteen, ja korjaus yhdistettiin.', next: 'Tarkista uloskirjautuminen puhelimella seuraavassa julkaisussa.'},
    latest: 'Korjaus on yhdistetty main-haaraan.',
    messages: [['u', 'Käydään läpi, mitä testikoneelle on tullut tänään.', '19.05'], ['a', 'Kolme muutosta. Kirjautumissivun paluuosoite oli väärä; käynnistin workerin korjaamaan sen.', '19.20'], ['a', 'Korjaus on yhdistetty main-haaraan.', '21.31']]},
  {id: 'kokonaisuudet', title: 'Kokeilukokonaisuuksien testaus', started: at(7, 16, 30), changed: at(7, 19, 2), archived: at(7, 19, 15),
    recap: {recap: 'Testattiin KOKEILTAVAA-listan kolme kokonaisuutta: liitteet, avustajat ja jaetut näkymät. Liitteiden torjunta näytti väärän tekstin.', next: 'Liitteiden teksti on oma issuensa.'},
    latest: 'Kirjasin liitteiden tekstin omaksi issueksi.',
    messages: [['u', 'Testataan kokeilukokonaisuudet yksi kerrallaan.', '16.30'], ['a', 'Liitteet, avustajat ja jaetut näkymät käyty. Liitteiden torjunta näytti väärän tekstin; kirjasin sen issueksi.', '19.02']]},
  {id: 'lista', title: 'Testattavien toimintojen lista', started: at(7, 13, 40), changed: at(7, 14, 22), archived: at(7, 14, 30), workers: [UNMERGED],
    recap: {recap: 'Koottiin lista testattavista toiminnoista. Worker päivitti KOKEILTAVAA-listan, mutta sitä ei yhdistetty.', next: 'Workerin muutos odottaa haarassa wt/kokeiltavaa-paivitys.'},
    latest: 'Worker päättyi; muutosta ei yhdistetty.',
    messages: [['u', 'Tee lista asioista, joita voin testata tänään.', '13.40'], ['a', 'Lista on alla. Käynnistin workerin päivittämään KOKEILTAVAA-listan.', '13.52'], ['a', 'Worker päättyi; muutosta ei yhdistetty, se on haarassa.', '14.22']]},
  {id: 'pullongelma', title: 'Git pull ongelmien selvitys', started: at(6, 10, 15), changed: at(6, 11, 40), archived: at(6, 11, 52),
    recap: {recap: 'git pull hylkäsi muutokset, koska paikallinen haara oli erkaantunut. Ratkaistiin rebasella.', next: 'Ei jatkoa.'},
    latest: 'Rebase onnistui, ja haara on taas ajan tasalla.',
    messages: [['u', 'git pull ei mene läpi, mitä teen?', '10.15'], ['a', 'Paikallinen haara on erkaantunut. Tein `git pull --rebase`; rebase onnistui ja haara on ajan tasalla.', '11.40']]},
  {id: 'esittely', title: 'Projektin esittelypyyntö suomeksi', started: at(5, 20, 0), changed: at(5, 20, 12), archived: at(5, 20, 30),
    recap: {recap: 'Agentti esitteli projektin suomeksi: mitä Open Habitat on ja miten se on rakennettu.', next: 'Ei jatkoa.'},
    latest: 'Open Habitat on monen käyttäjän verkkokoti natiiveille agenteille.',
    messages: [['u', 'Esittele tämä projekti suomeksi.', '20.00'], ['a', 'Open Habitat on monen käyttäjän verkkokoti natiiveille agenteille. Ihminen kirjautuu selaimella omaan Linux-käyttäjäänsä…', '20.12']]},
  {id: 'pullaloitus', title: 'Git pullin aloittaminen', started: at(5, 9, 30), changed: at(5, 9, 33), archived: at(5, 9, 40),
    latest: 'Haettu 4 uutta committia; ei ristiriitoja.', messages: [['u', 'Tee git pull.', '9.30'], ['a', 'Haettu 4 uutta committia; ei ristiriitoja.', '9.33']]},
  {id: 'ping', title: 'ping', started: at(3, 8, 1), changed: at(3, 8, 1), archived: at(3, 8, 5),
    latest: 'pong', messages: [['u', 'ping', '8.01'], ['a', 'pong', '8.01']]},
  {id: 'salutation', title: 'Salutation en français', started: octo(28, 21, 10), changed: octo(28, 21, 11), archived: octo(28, 21, 15),
    latest: 'Bonjour ! Comment puis-je vous aider ?', messages: [['u', 'Dis bonjour en français.', '21.10'], ['a', 'Bonjour ! Comment puis-je vous aider ?', '21.11']]},
];
// Production lists them in the snapshot's order, as on Jari's page.
const NYT_ORDER = ['salutation', 'ping', 'pullaloitus', 'esittely', 'pullongelma', 'lista', 'kokonaisuudet', 'lapikaynti', 'kestaa', 'kokeile', 'testi', 'tarkoitus', 'pieni'];
const OPEN = [{id: 'arkisto', title: 'Keskustelujen arkisto uusiksi', label: 'Työskentelee'}, {id: 'jaot', title: 'Jaetut näkymät omalle paikalleen', label: 'Odottaa viestiä'}];

// ---- What a conversation left behind, in a few words ----
type Trace = {mark: WorkerMarkKind; text: string; short: string; attention: boolean};
function traces(c: Conv): Trace[] {
  const out: Trace[] = [];
  for (const h of c.helpers ?? []) {
    const r = h.resident!;
    const open = r.unlanded || r.rounds > (r.landed_round ?? 0);
    out.push({mark: 'waiting_parent', short: `avustaja ${r.name}`, attention: open,
      text: open ? `Avustaja ${r.name} odottaa · työtä haarassa, yhdistämistä ei vahvistettu` : `Avustaja ${r.name} odottaa · kaikki yhdistetty`});
  }
  for (const w of c.workers ?? []) {
    const merged = w.state === 'merged';
    out.push({mark: merged ? 'merged' : 'unmerged', short: merged ? 'työ yhdistetty' : 'työ haarassa', attention: !merged,
      text: merged ? `Worker: ${w.title} · yhdistetty` : `Worker: ${w.title} · ei yhdistetty, haarassa`});
  }
  return out;
}
function TraceChips({c}: {c: Conv}) {
  const t = traces(c);
  if (!t.length) return null;
  return (
    <span className="ka-traces" data-testid="ka-traces">
      {t.map((x) => <span key={x.text} className="ka-trace" data-attention={x.attention || undefined} title={x.text}><WorkerMark kind={x.mark} /><span>{x.short}</span></span>)}
    </span>
  );
}
function TraceRows({c}: {c: Conv}) {
  const [branch, setBranch] = useState<Spinoff>();
  const workers = c.workers ?? [];
  return (
    <>
      {c.helpers?.length ? <HelperArchiveRows runs={c.helpers} branchView={(r, close) => <HelperBranchDialog branch={r} loading={false} onClose={close} />} /> : null}
      {workers.length ? (
        <ul className="ka-workers">
          {workers.map((w) => (
            <li key={w.run_id} data-testid="ka-worker-row">
              <WorkerMark kind={w.state === 'merged' ? 'merged' : 'unmerged'} />
              <div>
                <strong>Worker</strong> · {w.title}
                <p><Icon name={w.state === 'merged' ? 'merge' : 'branch'} /> {w.state === 'merged' ? 'Yhdistetty main-haaraan' : 'Ei yhdistetty · työ haarassa'}
                  {w.state !== 'merged' ? <>{' '}<ControlButton size="inline" variant="quiet" onPress={() => setBranch(w)}>Avaa haara</ControlButton></> : null}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {branch ? <HelperBranchDialog branch={branch} loading={false} onClose={() => setBranch(undefined)} /> : null}
    </>
  );
}

// ---- The conversation opened read-only, the same in every direction ----
const noop = () => {};
const item = ([who, text, time]: Msg, i: number): TimelineItem & {kind: string} => who === 'u'
  ? {id: `u${i}`, kind: 'user', content: <UserMessage sourceText={text} onCopy={noop} time={time}><Markdown text={text} /></UserMessage>}
  : {id: `a${i}`, kind: 'assistant', content: <AssistantMessage streamState="complete" time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage>};
function ReadOnly({c, onRestore, onBack, backLabel}: {c: Conv; onRestore: () => void; onBack?: () => void; backLabel?: string}) {
  return (
    <div className="ah-state ka-main" data-testid="ka-readonly">
      <ConversationFrame>
        <AgentHeader title={c.title} workspaceLabel={WS} workspaceHref={`/workspaces/${WSID}`} activityLabel="Arkistoitu"
          controlLabel="" detailsExpanded={false} onToggleDetails={noop}
          archive={{state: 'archived', eligible: true, busy: false, onArchive: noop, onRestore}} />
        <ConversationStream>
          {onBack ? <p className="ka-back"><ControlButton size="inline" variant="quiet" data-testid="ka-back" onPress={onBack}><Icon name="back" /> {backLabel}</ControlButton></p> : null}
          <ConversationTimeline state="ready" items={c.messages.map(item)} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
        </ConversationStream>
        <footer className="ka-readonly-foot" data-testid="ka-readonly-foot">
          <p><Icon name="archive" /> <span>Arkistoitu {full(c.archived)}. Luettavissa; palauta jatkaaksesi.</span></p>
          {traces(c).length ? <div className="ka-foot-traces"><TraceRows c={c} /></div> : null}
          <Button data-testid="ka-restore" size="row" variant="primary" label="Palauta" onPress={onRestore} />
        </footer>
      </ConversationFrame>
    </div>
  );
}

// ---- Nyt: production's section as it renders today ----
function Today({list}: {list: Conv[]}) {
  const byId = new Map(list.map((c) => [c.id, c]));
  const rows = NYT_ORDER.map((id) => byId.get(id)).filter(Boolean) as Conv[];
  return (
    <details className="ah-workspace-archive" open>
      <summary>Arkisto · {rows.length}</summary>
      <section data-testid="workspace-archive-panel" aria-label="Työtilan arkisto">
        <h2 data-testid="archive-title">Arkisto</h2>
        {rows.map((c) => (
          <div key={c.id}>
            <LinkRow href={`/agents/${c.id}`} kind="inline">{c.title}</LinkRow>{' '}
            <Button data-testid="restore-conversation" size="row" label="Palauta näkyviin" variant="quiet" onPress={noop} />
            {c.helpers?.length ? (
              <aside data-testid="archived-helpers">
                <HelperArchiveRows runs={c.helpers} branchView={(r, close) => <HelperBranchDialog branch={r} loading={false} onClose={close} />} />
              </aside>
            ) : null}
          </div>
        ))}
      </section>
    </details>
  );
}

// ---- 1 Lista: on the workspace page, grouped by day, filterable ----
function Grouped({list, open, restore}: {list: Conv[]; open: (c: Conv) => void; restore: (c: Conv) => void}) {
  const [q, setQ] = useState('');
  const shown = list.filter((c) => c.title.toLocaleLowerCase('fi').includes(q.trim().toLocaleLowerCase('fi')));
  const groups: [string, Conv[]][] = [];
  for (const c of shown) {
    const g = group(c.archived);
    const last = groups[groups.length - 1];
    if (last && last[0] === g) last[1].push(c); else groups.push([g, [c]]);
  }
  return (
    <section className="ka-section" aria-labelledby="ka-archive-h" data-testid="ka-list">
      <div className="ka-section-head">
        <h2 id="ka-archive-h">Arkisto <span>{list.length}</span></h2>
        <div className="ka-filter"><TextField data-testid="ka-filter" label="Etsi otsikosta" value={q} onChange={setQ} autoComplete="off" /></div>
      </div>
      {!shown.length ? <p className="ka-empty">Otsikkoa ”{q}” ei löydy arkistosta.</p> : null}
      {groups.map(([g, cs]) => (
        <div key={g} className="ka-group">
          <h3>{g}</h3>
          <ul className="ka-rows">
            {cs.map((c) => (
              <li key={c.id} className="ka-row" data-testid="ka-row">
                <button type="button" className="ka-row-open" data-testid="ka-row-open" onClick={() => open(c)}>
                  <span className="ka-row-title">{c.title}</span>
                  <TraceChips c={c} />
                </button>
                <time className="ka-row-date" dateTime={c.archived.toISOString()}>{when(c.archived)}</time>
                <ControlButton size="inline" variant="quiet" presentation="icon" className="ka-row-restore" data-testid="ka-row-restore"
                  aria-label={`Palauta ${c.title}`} onPress={() => restore(c)}><Icon name="restore" /></ControlButton>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

// ---- 2 Oma näkymä: its own page with search and a preview ----
function ArchivePage({list, open, restore, back, phone}: {list: Conv[]; open: (c: Conv) => void; restore: (c: Conv) => void; back: () => void; phone: boolean}) {
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(false);
  const [sel, setSel] = useState<string | undefined>(phone ? undefined : 'tarkoitus');
  const needle = q.trim().toLocaleLowerCase('fi');
  const hit = (c: Conv) => !needle || [c.title, c.recap?.recap ?? '', c.latest].some((s) => s.toLocaleLowerCase('fi').includes(needle));
  const shown = list.filter((c) => hit(c) && (!only || traces(c).length));
  const left = list.filter((c) => traces(c).length).length;
  const chosen = list.find((c) => c.id === sel);
  const listView = (
    <div className="ka-page-list">
      <div className="ka-search"><TextField data-testid="ka-search" label="Hae otsikoista ja yhteenvedoista" value={q} onChange={setQ} autoComplete="off" /></div>
      <div className="ka-chips" role="group" aria-label="Rajaa">
        <ControlButton size="inline" variant={only ? 'quiet' : 'secondary'} aria-pressed={!only} onPress={() => setOnly(false)}>Kaikki {list.length}</ControlButton>
        <ControlButton size="inline" variant={only ? 'secondary' : 'quiet'} aria-pressed={only} data-testid="ka-only-left" onPress={() => setOnly(true)}>Jätti jotain {left}</ControlButton>
      </div>
      <p className="ka-count" role="status">{needle || only ? `${shown.length} / ${list.length}` : 'Uusin arkistoitu ensin'}</p>
      <ul className="ka-cards">
        {shown.map((c) => (
          <li key={c.id}>
            <button type="button" className="ka-card" data-testid="ka-card" aria-current={c.id === sel ? 'true' : undefined} onClick={() => setSel(c.id)}>
              <span className="ka-card-top"><span className="ka-row-title">{c.title}</span><time>{when(c.archived)}</time></span>
              <span className="ka-card-recap">{c.recap?.recap ?? c.latest}</span>
              <TraceChips c={c} />
            </button>
          </li>
        ))}
      </ul>
      {!shown.length ? <p className="ka-empty">Mikään otsikko tai yhteenveto ei vastaa hakua.</p> : null}
    </div>
  );
  const preview = chosen ? (
    <article className="ka-preview" data-testid="ka-preview" aria-label={chosen.title}>
      {phone ? <p className="ka-back"><ControlButton size="inline" variant="quiet" data-testid="ka-preview-back" onPress={() => setSel(undefined)}><Icon name="back" /> Arkisto</ControlButton></p> : null}
      <h2>{chosen.title}</h2>
      <dl className="ka-facts">
        <dt>Aloitettu</dt><dd>{full(chosen.started)}</dd>
        <dt>Viimeisin viesti</dt><dd>{full(chosen.changed)}</dd>
        <dt>Arkistoitu</dt><dd>{full(chosen.archived)}</dd>
      </dl>
      {chosen.recap ? (
        <section className="ka-recap"><h3><Icon name="recap" /> Yhteenveto</h3><p>{chosen.recap.recap}</p><p className="ka-next"><b>Seuraavaksi</b> {chosen.recap.next}</p></section>
      ) : (
        <section className="ka-recap"><h3><Icon name="message" /> Viimeisin viesti</h3><p>{chosen.latest}</p></section>
      )}
      {traces(chosen).length ? <section className="ka-left"><h3>Avustajat ja työt</h3><TraceRows c={chosen} /></section> : null}
      <div className="ka-preview-actions">
        <Button data-testid="ka-preview-open" size="row" variant="secondary" label="Avaa luettavaksi" onPress={() => open(chosen)} />
        <Button data-testid="ka-preview-restore" size="row" variant="primary" label="Palauta" onPress={() => { restore(chosen); setSel(undefined); }} />
      </div>
    </article>
  ) : phone ? null : <div className="ka-preview ka-preview-empty"><p>Valitse keskustelu nähdäksesi sen yhteenvedon.</p></div>;
  return (
    <div className="ka-page ka-own" data-testid="ka-own">
      {phone && chosen ? null : <header className="ka-own-head">
        <ControlButton size="inline" variant="quiet" data-testid="ka-own-back" onPress={back}><Icon name="back" /> {WS}</ControlButton>
        <h1>Arkisto <span>{list.length}</span></h1>
      </header>}
      <div className="ka-split" data-preview={chosen ? 'open' : undefined}>
        {phone && chosen ? null : listView}
        {preview}
      </div>
    </div>
  );
}

// ---- The page ----
type View = {kind: 'workspace'} | {kind: 'own'} | {kind: 'read'; id: string; from: 'workspace' | 'own' | 'rail'};
function Main({direction}: {direction: number}) {
  const phone = useMemo(() => window.matchMedia('(max-width: 800px)').matches, []);
  const [archived, setArchived] = useState(() => [...CONVS].sort((a, b) => +b.archived - +a.archived));
  const [restored, setRestored] = useState<Conv[]>([]);
  const [status, setStatus] = useState('');
  const [filter, setFilter] = useState('');
  const first: View = direction === 2 ? {kind: 'own'} : direction === 3 ? {kind: 'read', id: 'kokeile', from: 'rail'} : {kind: 'workspace'};
  const [view, setView] = useState<View>(first);
  const restore = (c: Conv) => {
    setArchived((l) => l.filter((x) => x.id !== c.id));
    setRestored((l) => [c, ...l]);
    setStatus(`Palautettu: ${c.title}. Se on taas Käynnissä-listalla${c.helpers?.length ? ', ja avustajat palasivat sen mukana käynnistämättä' : ''}.`);
    if (view.kind === 'read') setView(view.from === 'own' ? {kind: 'own'} : {kind: 'workspace'});
  };
  const open = (from: 'workspace' | 'own' | 'rail') => (c: Conv) => { setStatus(''); setView({kind: 'read', id: c.id, from}); };
  const reading = view.kind === 'read' ? archived.find((c) => c.id === view.id) : undefined;

  const statusLine = status ? <p role="status" className="ka-status" data-testid="ka-status"><Icon name="restore" /> {status}</p> : null;
  const workspace = (
    <div className="ah-state ka-page" data-testid="ka-workspace">
      <div className="ah-workspace-page">
        <header className="ah-workspace-page-head">
          <div className="ah-workspace-page-title"><h1 data-testid="workspace-title">{WS}</h1><p><code>~/src/{WS}</code></p></div>
        </header>
        {statusLine}
        <section aria-label="Avoimet keskustelut">
          <h2>Avoimet <span>{OPEN.length + restored.length}</span></h2>
          <ul className="ka-open">
            {[...restored.map((c) => ({id: c.id, title: c.title, label: 'Odottaa viestiä'})), ...OPEN].map((o) => <li key={o.id}><LinkRow href={`/workspaces/${WSID}`}>{o.title}</LinkRow><span>{o.label}</span></li>)}
          </ul>
        </section>
        <div className="ah-workspace-git"><span className="ah-workspace-summary">main · ajan tasalla</span></div>
        {direction === 1 ? <Grouped list={archived} open={open('workspace')} restore={restore} /> : null}
        {direction === 2 ? (
          <button type="button" className="ka-entry" data-testid="ka-entry" onClick={() => { setStatus(''); setView({kind: 'own'}); }}>
            <Icon name="archive" /><span><b>Arkisto</b> · {archived.length} keskustelua · viimeksi {when(archived[0].archived)}</span><Icon name="forward" />
          </button>
        ) : null}
      </div>
      {direction === 0 ? <Today list={archived} /> : null}
    </div>
  );

  let page: React.ReactNode;
  if (view.kind === 'read' && reading)
    page = <ReadOnly c={reading} onRestore={() => restore(reading)}
      onBack={view.from === 'rail' ? undefined : () => setView(view.from === 'own' ? {kind: 'own'} : {kind: 'workspace'})}
      backLabel={view.from === 'own' ? 'Arkisto' : WS} />;
  else if (view.kind === 'own') page = <ArchivePage list={archived} open={open('own')} restore={restore} back={() => setView({kind: 'workspace'})} phone={phone} />;
  else page = workspace;

  const model = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/${WSID}?conversation=${m.agentId}`, workspaceId: WSID, workspaceName: WS, activity: 'waiting',
    activityLabel: 'Odottaa viestiä', controlLabel: '', changedAt: NOW - 5 * 60000, detail: `${WS} · Odottaa viestiä`, ...m,
  });
  const running = [
    model({agentId: 'arkisto', title: OPEN[0].title, activity: 'working', activityLabel: 'Työskentelee', detail: `${WS} · Työskentelee`}),
    ...restored.map((c) => model({agentId: c.id, title: c.title})),
    model({agentId: 'jaot', title: OPEN[1].title, changedAt: NOW - 40 * 60000}),
  ];
  const railMatches = archived.filter((c) => c.title.toLocaleLowerCase('fi').includes(filter.trim().toLocaleLowerCase('fi')));
  const railArchive = direction === 3 ? (
    <section className="ka-rail-archive" data-testid="ka-rail-archive" aria-labelledby="ka-rail-archive-h">
      <h2 className="ah-rail-section-head" id="ka-rail-archive-h">Arkisto · {WS}<span className="ah-rail-count">{railMatches.length}</span></h2>
      <ul>
        {railMatches.map((c, i) => (
          <React.Fragment key={c.id}>
            {i === 0 || group(railMatches[i - 1].archived) !== group(c.archived) ? <li className="ka-rail-group" aria-hidden="true">{group(c.archived)}</li> : null}
            <li>
              <button type="button" className="ka-rail-row" data-testid="ka-rail-row" aria-current={reading?.id === c.id ? 'page' : undefined}
                onClick={() => { setStatus(''); setView({kind: 'read', id: c.id, from: 'rail'}); }}>
                <span className="ka-rail-title">{c.title}</span>
                <span className="ka-rail-meta">{traces(c).map((t) => <WorkerMark key={t.text} kind={t.mark} />)}<time>{when(c.archived)}</time></span>
              </button>
            </li>
          </React.Fragment>
        ))}
      </ul>
      {!railMatches.length ? <p className="ka-empty">Ei arkistoitua keskustelua tällä nimellä.</p> : null}
    </section>
  ) : null;
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Birch" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue={direction === 3 ? filter : ''} resultSummary={direction === 3 && filter ? `${railMatches.length} arkistossa` : '3 työtilaa'} listState="ready"
      onToggle={noop} onFilter={direction === 3 ? setFilter : noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <section className="ah-now" data-testid="rail-running" aria-labelledby="ka-running">
          <h2 className="ah-rail-section-head" id="ka-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
          <ul>{running.map((m) => <AgentNavItem key={m.agentId} {...m} now={NOW} />)}</ul>
        </section>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_fleetrepo01" />
      <WorkspaceNavRow name={WS} href={`/workspaces/${WSID}`} selected={view.kind !== 'read' || direction !== 3} />
      {railArchive}
      <WorkspaceNavRow name="taskfleet" href="/workspaces/ws_taskfleet01" />
    </WorkspaceRail>
  );
  const main = (
    <div className="ka-stage" data-view={view.kind}>
      {page}
      {view.kind !== 'workspace' && status ? <div className="ka-float">{statusLine}</div> : null}
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={reading ? reading.title : view.kind === 'own' ? 'Arkisto' : WS} navigationBadge={0} rail={rail} main={main} />
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [reset, setReset] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Keskustelujen arkisto · kierros 1</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" className="rq-reset" data-testid="rq-reset" onClick={() => setReset((n) => n + 1)}>↺ Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter initialEntries={[`/workspaces/${WSID}`]}>
          <Main key={reset} direction={direction} />
        </MemoryRouter>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(v: React.ReactNode) { flushSync(() => root.render(v === '' ? null : v)); }};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const pickerNav = document.createElement('nav');
pickerNav.className = 'proto-picker'; pickerNav.setAttribute('aria-label', 'Prototype variants');
pickerNav.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  pickerNav.append(button);
});
document.body.append(pickerNav);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
