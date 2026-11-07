import React, {useState} from 'react';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {InlineTextSetting} from '../../../../web/src/components/InlineTextSetting';
import {ServerLanguageRow} from '../../../../web/src/components/LanguageSettings';
import {LetterMark} from '../../../../web/src/components/Integrations';
import {NumberStepper} from '../../../../web/src/components/NumberStepper';
import {StatusMark} from '../../../../web/src/components/Status';
import {ServerVersionRow} from '../../../../web/src/app/ServerVersion';
import {OnboardingAdministration} from '../../../../web/src/app/OnboardingAdministration';
import {bytes} from '../../../../web/src/app/storageQuota';
import '../../../../web/src/app/ServerConversations.css';
import {GiB, HOST, type Person, diskLimit, joined, liveLimit} from './host';

// The three norms as one set of shared section parts. A section is written
// once, out of these parts; the norm decides how each part looks:
//   Lead        what the section is about        A, C: a paragraph above the card; B: the first row's description
//   Row         label, description, value        the same production .s-row in every norm
//   Meter       a measured whole and its parts   A: thick meter + legend; B: figure line + thin bar; C: figure line + thick meter + legend
//   Amount      a bounded number                 A, C: NumberStepper; B: InlineTextSetting with a unit
//   People      one row per person               A: list rows with their own control; B: table with columns and Muuta…; C: list rows under column headers
//   Subhead     a group below the card           A, C: .s-h3 above its own card; B: inside the one card as a table
// Today's sections are not touched; the round draws the directions only.
export type Norm = 'nyt' | 'a' | 'b' | 'c';
type N = Exclude<Norm, 'nyt'>;
const NormCtx = React.createContext<N>('a');
const useNorm = () => React.useContext(NormCtx);
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const gib = (n: number) => bytes(n * GiB);

// ---- Shared parts ----

function Lead({children}: {children: React.ReactNode}) {
  // B carries the lead in the first row's description instead.
  return useNorm() === 'b' ? null : <p className="s-intro" data-part="lead">{children}</p>;
}

function Row({label, desc, children, testid}: {label: string; desc?: React.ReactNode; children?: React.ReactNode; testid?: string}) {
  return (
    <div className="s-row" data-part="row" data-testid={testid}>
      <div className="s-lbl"><strong>{label}</strong>{desc ? <span className="s-desc">{desc}</span> : null}</div>
      {children ? <div className="s-val">{children}</div> : null}
    </div>
  );
}

/** A measured whole: what is in use now and what the limits could take. */
function Meter({label, desc, total, used, worst, usedLabel, worstLabel, worstText, overText, figure, testid}: {
  label: string; desc: string; total: number; used: number; worst: number;
  usedLabel: string; worstLabel: string; worstText: string; overText: string; figure: string; testid: string;
}) {
  const norm = useNorm();
  const share = (n: number) => `${Math.min(100, (100 * n) / total)}%`;
  const over = worst > total;
  if (norm === 'b')
    return (
      <div className="s-row" data-part="meter" data-testid={testid}>
        <div className="s-lbl"><strong>{label}</strong><span className="s-desc">{desc} {over ? overText : `${worstLabel}: ${worstText}.`}</span></div>
        <div className="rq-b-figure">{figure}<div className="s-bar" role="img" aria-label={figure}><span style={{width: share(used)}} /></div></div>
      </div>
    );
  return (
    <div className="s-row ah-live-memory" data-part="meter" data-testid={testid}>
      <div className={norm === 'c' ? 'rq-c-head' : undefined}>
        <div className="s-lbl"><strong>{label}</strong><span className="s-desc">{desc}</span></div>
        {norm === 'c' ? <span className="rq-c-figure">{figure}</span> : null}
      </div>
      <div className="ah-live-meter" role="img" aria-label={`${usedLabel} ${worstLabel}`}>
        <span className="ah-live-meter-worst" data-over={over ? '' : undefined} style={{width: share(worst)}} />
        <span className="ah-live-meter-now" style={{width: share(used)}} />
      </div>
      <dl className="ah-live-legend">
        <div><dt><span className="ah-live-key ah-live-key-now" />{usedLabel}</dt><dd>{gib(used)}</dd></div>
        <div><dt><span className="ah-live-key ah-live-key-worst" data-over={over ? '' : undefined} />{worstLabel}</dt><dd>{worstText}</dd></div>
      </dl>
      {over ? <p className="ah-live-over"><Icon name="warning" />{overText}</p> : null}
    </div>
  );
}

/** A bounded whole number: a stepper, or in B a text field with its unit. */
function Amount({label, desc, value, min, max, step = 1, unit, onChange, testid}: {
  label: string; desc: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (n: number) => void; testid: string;
}) {
  if (useNorm() === 'b')
    return (
      <InlineTextSetting row={testid} data-testid={testid} label={label} description={desc} value={String(value)} unit={unit} inputMode="decimal"
        invalid={(d) => { const n = Number(d.replace(',', '.')); return Number.isInteger(n) && n >= min && n <= max ? undefined : `anna kokonaisluku ${min}–${max}.`; }}
        onSave={async (next) => { await later(120); onChange(Number(next)); }} />
    );
  return (
    <Row label={label} desc={desc}>
      <NumberStepper label={label} testId={testid} value={value} min={min} max={max} step={step} unit={unit} onChange={onChange} />
    </Row>
  );
}

function Subhead({children}: {children: React.ReactNode}) {
  return useNorm() === 'b' ? null : <h3 className="s-h3" data-part="subhead">{children}</h3>;
}

/** The card: in B the people table joins the same card; in A and C the
 * people list is its own card under a subheading. */
function Card({children}: {children: React.ReactNode}) {
  return <div className="s-card ah-administration" data-part="card">{children}</div>;
}

type Col = {key: string; label: string};
/** One row per person. `cells` are the columns between the name and the
 * control; `limit` is the person's own bounded number when there is one. */
type PersonRow = {
  id: string; name: string; mark?: React.ReactNode; note: string; cells?: Record<string, React.ReactNode>;
  limit?: {value: number; own: boolean; min: number; max: number; step?: number; unit: string; onChange: (n: number | null) => void; fallback: number};
  actions?: React.ReactNode; aside?: React.ReactNode;
};
function People({label, cols = [], rows, testid}: {label: string; cols?: Col[]; rows: PersonRow[]; testid: string}) {
  const norm = useNorm();
  const [editing, setEditing] = useState('');
  const [draft, setDraft] = useState('');
  const hasLimit = rows.some((r) => r.limit);
  const acts = rows.some((r) => r.limit || r.actions || r.aside);
  if (norm === 'b')
    return (
      <table className="s-table rq-b-table" data-part="people" data-testid={testid}>
        <thead><tr><th>{label}</th>{cols.map((c) => <th key={c.key}>{c.label}</th>)}{hasLimit ? <th>Raja</th> : null}{acts ? <th>Toiminnot</th> : null}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-testid={`${testid}-${r.name}`}>
              <td><span className="rq-who">{r.mark ? <span className="rq-mark">{r.mark}</span> : null}<span className="rq-person"><strong>{r.name}</strong>{r.note ? <span className="rq-b-note">{r.note}</span> : null}</span></span></td>
              {cols.map((c) => <td key={c.key}>{r.cells?.[c.key]}</td>)}
              {r.limit ? <td className="rq-b-num">{r.limit.value} {r.limit.unit}{r.limit.own ? '' : ' (oletus)'}</td> : hasLimit ? <td /> : null}
              {acts ? <td>
                {r.aside}
                {r.limit ? (
                  editing === r.id ? (
                    <form className="rq-b-edit" onSubmit={(e) => { e.preventDefault(); const n = Number(draft.replace(',', '.')); if (Number.isFinite(n) && n >= r.limit!.min && n <= r.limit!.max) r.limit!.onChange(n === r.limit!.fallback ? null : Math.round(n)); setEditing(''); }}>
                      <span className="s-inline-field"><input inputMode="decimal" aria-label={`${r.name}: raja (${r.limit.unit})`} data-testid={`${testid}-${r.name}-input`} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus /></span>
                      <ControlButton size="row" type="submit">Tallenna</ControlButton>
                      <ControlButton size="row" onPress={() => setEditing('')}>Peruuta</ControlButton>
                    </form>
                  ) : (
                    <ControlButton data-testid={`${testid}-${r.name}-edit`} size="row" onPress={() => { setDraft(String(r.limit!.value)); setEditing(r.id); }}>Muuta…</ControlButton>
                  )
                ) : null}
                {r.actions}
              </td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    );
  // Every row is its own grid, so the columns are fixed widths: the
  // header and the rows line up only when no column is sized by content
  // (in rem: the header's smaller type would shrink em columns).
  const template = norm === 'a'
    ? (hasLimit ? 'minmax(0, 1fr) 9.5rem 7.5rem' : 'minmax(0, 1fr) auto')
    : `minmax(0, 1fr)${cols.map(() => (hasLimit ? ' 10rem' : ' 8rem')).join('')}${hasLimit ? ' 9.5rem 7.5rem' : ' 19.5rem'}`;
  return (
    <div className="s-card ah-administration" data-part="people">
      <ul className={`rq-people rq-people-${norm}`} data-testid={testid} style={{'--rq-cols': template} as React.CSSProperties}>
        {norm === 'c' ? (
          <li className="rq-people-head" aria-hidden="true">
            <span>{label}</span>{cols.map((c) => <span key={c.key}>{c.label}</span>)}{hasLimit ? <><span>Raja</span><span /></> : <span />}
          </li>
        ) : null}
        {rows.map((r) => (
          <li key={r.id} data-testid={`${testid}-${r.name}`} data-own={r.limit?.own ? '' : undefined}>
            <span className="rq-who">{r.mark ? <span className="rq-mark">{r.mark}</span> : null}<span className="rq-person"><strong>{r.name}</strong><span className="s-desc">{norm === 'a' && r.cells ? [r.note, ...cols.map((c) => r.cells![`${c.key}Text`] as string).filter(Boolean)].filter(Boolean).join(' · ') : r.note}</span></span></span>
            {norm === 'c' ? cols.map((c) => <span key={c.key} className="rq-cell">{r.cells?.[c.key]}</span>) : null}
            {r.limit ? (
              <>
                <NumberStepper label={`Raja: ${r.name}`} testId={`${testid}-${r.name}-limit`} value={r.limit.value} min={r.limit.min} max={r.limit.max} step={r.limit.step}
                  onChange={(n) => r.limit!.onChange(n === r.limit!.fallback ? null : n)} />
                {r.limit.own ? <ControlButton data-testid={`${testid}-${r.name}-reset`} size="row" variant="quiet" onPress={() => r.limit!.onChange(null)}>Oletukseen</ControlButton> : <span />}
              </>
            ) : <span className="rq-person-end">{r.aside}{r.actions}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A usage figure with its thin bar, for a column (C) or a table cell (B). */
const Usage = ({used, limit}: {used: number; limit: number}) => (
  <span className="rq-usage"><span className="rq-usage-v">{gib(used)} / {gib(limit)}</span><span className="s-bar"><span style={{width: `${Math.min(100, (100 * used) / limit)}%`}} /></span></span>
);

// ---- The eight server sections written with the parts ----

function Keskustelut() {
  const norm = useNorm();
  const [, tick] = useState(0);
  const redraw = () => tick((n) => n + 1);
  const people = joined();
  const fallback = HOST.defaultLive ?? HOST.hostDefaultLive;
  const worst = people.reduce((s, p) => s + liveLimit(p), 0);
  const child = HOST.childBytes / GiB;
  const used = HOST.memoryGiB - HOST.availableGiB;
  return (
    <>
      <Lead>Raja koskee yhtä aikaa työskenteleviä keskusteluja, ei avoimia. Levossa oleva keskustelu ei vie paikkaa; rajaan törmäävä näkee, mitkä pitävät paikkaa.</Lead>
      <Card>
        <Meter testid="norm-live-memory" label="Muisti" desc={`${norm === 'b' ? 'Raja koskee yhtä aikaa työskenteleviä keskusteluja. ' : ''}Yksi työskentelevä keskustelu vie noin ${bytes(HOST.childBytes)}.`}
          total={HOST.memoryGiB} used={used} worst={worst * child}
          usedLabel="Käytössä nyt" worstLabel="Jos jokainen käyttää koko rajansa" worstText={`${worst} keskustelua · ${gib(worst * child)}`}
          overText="Rajat yhteensä ylittävät palvelimen muistin." figure={`${gib(HOST.memoryGiB)} yhteensä · ${gib(HOST.availableGiB)} vapaana`} />
        <Amount testid="norm-live-default" label="Raja henkilöä kohden" desc="Ellei henkilöllä ole omaa rajaa." value={fallback} min={1} max={HOST.maxLive} unit="keskustelua"
          onChange={(n) => { HOST.defaultLive = n; redraw(); }} />
        {norm === 'b' ? <People testid="norm-live-people" label="Henkilö" rows={rows()} /> : null}
      </Card>
      <Subhead>Henkilöt</Subhead>
      {norm === 'b' ? null : <People testid="norm-live-people" label="Henkilö" rows={rows()} />}
    </>
  );
  function rows(): PersonRow[] {
    return people.map((p) => ({
      id: p.id, name: p.username, note: p.live === null ? 'oletus' : 'oma raja',
      limit: {value: liveLimit(p), own: p.live !== null, min: 1, max: HOST.maxLive, unit: 'keskustelua', fallback, onChange: (n) => { p.live = n; redraw(); }},
    }));
  }
}

function Levytila() {
  const norm = useNorm();
  const [, tick] = useState(0);
  const redraw = () => tick((n) => n + 1);
  const people = joined();
  const enforced = HOST.limits === 'enforced';
  const used = HOST.diskGiB - HOST.freeGiB;
  const worst = people.reduce((s, p) => s + diskLimit(p), 0);
  const cols: Col[] = [{key: 'usage', label: 'Käytössä'}];
  const rows: PersonRow[] = people.map((p) => ({
    id: p.id, name: p.username, note: !enforced ? 'ei rajaa' : p.disk === null ? 'oletus' : 'oma raja',
    cells: {usage: enforced ? <Usage used={p.usage} limit={diskLimit(p)} /> : gib(p.usage), usageText: `${gib(p.usage)} käytössä`},
    ...(enforced ? {limit: {value: diskLimit(p), own: p.disk !== null, min: 1, max: HOST.diskGiB, step: 5, unit: 'GiB', fallback: HOST.defaultDisk, onChange: (n: number | null) => { p.disk = n; redraw(); }}} : {}),
  }));
  return (
    <>
      <Lead>Henkilöiden kotihakemistot jakavat yhden levyn. {enforced ? 'Raja koskee yhden henkilön kotihakemistoa.' : 'Käyttäjäkohtaisia rajoja ei ole käytössä, joten kuka tahansa voi täyttää levyn.'}</Lead>
      <Card>
        <Meter testid="norm-disk" label="Levy" desc={norm === 'b' ? (enforced ? 'Kotihakemistojen levy; raja koskee yhden henkilön kotihakemistoa.' : 'Kotihakemistot jakavat tämän levyn, ja kuka tahansa voi täyttää sen.') : `Palvelimella ${gib(HOST.diskGiB)}.`}
          total={HOST.diskGiB} used={used} worst={enforced ? worst : 0}
          usedLabel="Käytössä nyt" worstLabel={enforced ? 'Jos jokainen täyttää rajansa' : 'Rajoja ei ole'} worstText={enforced ? `${gib(worst)}` : '–'}
          overText="Rajojen summa ylittää levyn koon. Se on sallittua, mutta levy voi täyttyä." figure={`${gib(HOST.diskGiB)} yhteensä · ${gib(HOST.freeGiB)} vapaana`} />
        {enforced ? <Amount testid="norm-disk-default" label="Oletusraja" desc="Uusien käyttäjien raja. Ei muuta nykyisiä." value={HOST.defaultDisk} min={1} max={HOST.diskGiB} step={5} unit="GiB"
          onChange={(n) => { HOST.defaultDisk = n; redraw(); }} /> : null}
        {norm === 'b' ? <People testid="norm-disk-people" label="Henkilö" cols={cols} rows={rows} /> : null}
      </Card>
      <Subhead>Henkilöt</Subhead>
      {norm === 'b' ? null : <People testid="norm-disk-people" label="Henkilö" cols={cols} rows={rows} />}
    </>
  );
}

function Yleiset() {
  const norm = useNorm();
  const [lang, setLang] = useState(HOST.language);
  return (
    <>
      <Lead>Palvelimen nimi ja kieli näkyvät kaikille sen käyttäjille.</Lead>
      <Card>
        <InlineTextSetting row="server-name" label="Palvelimen nimi" description={`${norm === 'b' ? 'Näkyy kaikille sivupalkissa. ' : 'Näkyy sivupalkissa. '}Tallentuu, kun poistut kentästä.`} value={HOST.name} maxLength={80}
          onSave={async (next) => { await later(120); HOST.name = next; }} />
        <ServerLanguageRow choice={lang as 'fi'} disabled={false} error={false} onChange={(l) => { HOST.language = l; setLang(l); }} />
        <ServerVersionRow version="0.44.0" commit="1def125b6d0c4e2f9a8b7c6d5e4f3a2b1c0d9e8f" />
      </Card>
    </>
  );
}

function Kayttajat() {
  const norm = useNorm();
  const [login, setLogin] = useState('');
  const cols: Col[] = [{key: 'role', label: 'Rooli'}];
  const rows: PersonRow[] = HOST.people.map((p) => ({
    id: p.id, name: `@${p.hint}`, note: p.username ? `Unix ${p.username} · viimeksi 6.11.` : 'Sallittu 6.11.',
    cells: {role: <StatusMark label={!p.username ? 'Ei vielä kirjautunut' : p.admin ? 'Ylläpitäjä' : 'Käyttäjä'} tone={p.username ? 'success' : 'neutral'} />, roleText: !p.username ? 'ei vielä kirjautunut' : p.admin ? 'ylläpitäjä' : 'käyttäjä'},
    actions: p.source === 'operator' ? <span className="s-desc">Palvelimen asetuksista</span> : (
      <>
        <ControlButton size="row" variant="quiet">{p.admin ? 'Poista ylläpitäjyys' : 'Tee ylläpitäjäksi'}</ControlButton>
        <ControlButton size="row" variant="quiet"><Icon name="cross" />{p.username ? 'Poista pääsy' : 'Poista'}</ControlButton>
      </>
    ),
  }));
  return (
    <>
      <Lead>Kuka saa kirjautua palvelimelle ja kuka sitä ylläpitää.</Lead>
      <Card>
        <Row label="Salli GitHub-tunnus tai tiimi" desc={`${norm === 'b' ? 'Kuka saa kirjautua palvelimelle. ' : ''}Useita nimiä voi erottaa pilkulla. Tiimi muodossa organisaatio/tiimi.`}>
          <span className="s-inline-field rq-login"><input aria-label="GitHub-tunnus tai tiimi" placeholder="github-tunnus" value={login} onChange={(e) => setLogin(e.target.value)} /></span>
          <ControlButton size="row" variant="secondary">Tarkista</ControlButton>
        </Row>
        <Row label="Jaetut linkit" desc="Henkilöiden jakamat näkymät. Tarjouslaskuri · anna · voimassa 28.11.2026 asti.">
          <ControlButton size="row" variant="secondary">Poista linkki…</ControlButton>
        </Row>
        {norm === 'b' ? <People testid="norm-access-people" label="Henkilö" cols={cols} rows={rows} /> : null}
      </Card>
      <Subhead>Henkilöt · 6</Subhead>
      {norm === 'b' ? null : <People testid="norm-access-people" label="Henkilö" cols={cols} rows={rows} />}
    </>
  );
}

function AiAvain() {
  const norm = useNorm();
  const cols: Col[] = [{key: 'copy', label: 'Avain'}];
  const rows: PersonRow[] = joined().map((p, i) => ({
    id: p.id, name: `@${p.hint}`, note: `Unix ${p.username}`,
    cells: {copy: i < 4 ? 'Annettu 4.11.' : 'Ei annettu', copyText: i < 4 ? 'annettu 4.11.' : 'ei annettu'},
  }));
  return (
    <>
      <Lead>Uusi henkilö saa avaimesta kopion omiin tunnuksiinsa, jos hänellä ei ole omaa. Käyttö laskutetaan avaimen tililtä.</Lead>
      <Card>
        <Row label="Anthropic API-avain" desc={<>{norm === 'b' ? 'Uudet henkilöt saavat kopion omiin tunnuksiinsa. ' : ''}<span className="ah-mono">sk-ant-…Xa1b</span> · asetettu 24.10.</>}>
          <ControlButton size="row" variant="secondary">Vaihda avain…</ControlButton>
          <ControlButton size="row" variant="quiet">Poista avain…</ControlButton>
        </Row>
        <Row label="Jo liittyneet" desc="Henkilöt, jotka liittyivät ennen avainta tai saivat aiemman avaimen.">
          <ControlButton size="row" variant="primary">Anna avain liittyneille…</ControlButton>
        </Row>
        {norm === 'b' ? <People testid="norm-key-people" label="Henkilö" cols={cols} rows={rows} /> : null}
      </Card>
      <Subhead>Henkilöt</Subhead>
      {norm === 'b' ? null : <People testid="norm-key-people" label="Henkilö" cols={cols} rows={rows} />}
    </>
  );
}

function Saneluavain() {
  const norm = useNorm();
  return (
    <>
      <Lead>Kaikki, joilla ei ole omaa avainta, sanelevat tällä. Käyttö laskutetaan sinulta.</Lead>
      <Card>
        <Row label="Yhteinen Soniox-avain" desc={<>{norm === 'b' ? 'Kaikki ilman omaa avainta sanelevat tällä. ' : ''}<span className="ah-mono">…Kq7Z</span> (EU), otettu käyttöön 28.10.2026. 3 sai avaimen, 1 käyttää omaansa, 1 ei tavoitettu.</>}>
          <ControlButton size="row" variant="secondary">Vaihda avain</ControlButton>
          <ControlButton size="row" variant="quiet">Poista</ControlButton>
        </Row>
      </Card>
    </>
  );
}

const PROVIDERS: {mark: string; tone: 0 | 1 | 2 | 3; name: string; state: string; tone2: 'success' | 'neutral'; action?: string}[] = [
  {mark: 'G', tone: 0, name: 'Google', state: 'Tarjolla', tone2: 'success', action: 'Tunnukset'},
  {mark: 'M', tone: 1, name: 'Microsoft 365', state: 'Ei tarjolla', tone2: 'neutral', action: 'Aseta tunnukset…'},
  {mark: 'iC', tone: 2, name: 'Apple (iCloud)', state: 'Tila ei tiedossa', tone2: 'neutral'},
  {mark: '@', tone: 3, name: 'Sähköposti (IMAP)', state: 'Tarjolla', tone2: 'success'},
  {mark: 'C', tone: 2, name: 'Kalenteri (CalDAV)', state: 'Tila ei tiedossa', tone2: 'neutral'},
  {mark: 'D', tone: 0, name: 'Dropbox', state: 'Tarjolla', tone2: 'success', action: 'Tunnukset'},
];
function Integraatiot() {
  const norm = useNorm();
  const cols: Col[] = [{key: 'state', label: 'Tila'}];
  const rows: PersonRow[] = PROVIDERS.map((p) => ({
    id: p.name, name: p.name, mark: <LetterMark mark={p.mark} tone={p.tone} small />, note: '',
    cells: {state: <StatusMark label={p.state} tone={p.tone2} kind={p.tone2 === 'success' ? 'success' : 'neutral'} />, stateText: p.state.toLowerCase()},
    actions: p.action ? <ControlButton size="row" variant="secondary">{p.action}</ControlButton> : null,
  }));
  return (
    <>
      <Lead>Tarjolla olevat palvelut jokainen yhdistää itse kohdassa Asetukset › Tiedot agenteille.</Lead>
      {norm === 'b' ? (
        <Card><Row label="Palvelut" desc="Tarjolla olevat palvelut jokainen yhdistää itse kohdassa Asetukset › Tiedot agenteille." />
          <People testid="norm-integrations" label="Palvelu" cols={cols} rows={rows} /></Card>
      ) : <People testid="norm-integrations" label="Palvelu" cols={cols} rows={rows} />}
    </>
  );
}

function Kayttoonotto() {
  // The route editor is a two-column editor, not a list of settings; the
  // section already has the lead above its card and keeps its own editor.
  return (
    <>
      <div className="rq-onboarding"><OnboardingAdministration csrf="prototype" nativeState="connected" onReconnect={() => {}} /></div>
    </>
  );
}

const SECTIONS: Record<string, () => React.ReactElement> = {
  keskustelut: Keskustelut, levy: Levytila, palvelin: Yleiset, kayttajat: Kayttajat,
  aiavain: AiAvain, saneluavain: Saneluavain, palvelinintegraatiot: Integraatiot, kayttoonotto: Kayttoonotto,
};

export function NormSection({id, title, norm}: {id: string; title: string; norm: Norm}) {
  const Body = SECTIONS[id];
  return (
    <NormCtx.Provider value={norm as N}>
      <div className={`s-main rq-norm rq-norm-${norm}`} data-section={id}>
        <h2 data-testid={`norm-section-${id}`}>{title}</h2>
        <div className="rq-norm-body"><Body /></div>
      </div>
    </NormCtx.Provider>
  );
}
export type {Person};
