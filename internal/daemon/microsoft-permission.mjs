// Habitat's Microsoft permission hook. Before a Microsoft call that deletes,
// sends or shares a calendar or file, the agent's Pi asks the person through the
// typed permission question (process-extension.mjs askPermission, the
// browser's 2 Kenttä): the action in plain words, the account, what follows,
// and the technical call. Names and counts come from a read call made first
// through the same account's area relay; when that read fails, the question
// names the item by its ID. Without a browser the call is blocked.
//
// This guards against mistakes, not against the person: the account's level
// is the boundary, and the person's own shell could reach Graph regardless.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

// Every exposed delete and sharing call asks, as do calls that reach another
// person at once: sending, replying, forwarding and cancelling a meeting.
export const guardedTools = new Set([
  'delete-mail-message', 'delete-mail-attachment', 'send-mail', 'send-draft-message', 'reply-mail-message',
  'reply-all-mail-message', 'forward-mail-message', 'delete-calendar-event', 'delete-specific-calendar-event',
  'cancel-calendar-event', 'forward-calendar-event', 'delete-outlook-contact', 'delete-mail-folder',
  'delete-focused-inbox-override', 'delete-calendar', 'create-my-calendar-permission',
  'update-my-calendar-permission', 'delete-my-calendar-permission', 'delete-contact-folder',
  'delete-onedrive-file', 'share-drive-item', 'create-drive-item-share-link',
]);

// Pi names a tool mcp__<server>__<tool> with every other character turned
// into `_`; the Microsoft tools are lowercase words joined by `-`.
const toolPattern = /^mcp__(ms[0-9]*)_(mail|calendar|contacts|files|admin)__([a-z0-9_]+)$/;

export function parseTool(name) {
  const m = toolPattern.exec(String(name ?? ''));
  if (!m) return null;
  return { server: `${m[1]}-${m[2]}`, prefix: m[1], area: m[2], tool: m[3].replace(/_/g, '-') };
}

// The area entry Habitat wrote for the server: its relay command and the
// account it names. Anything else under that name is not ours.
export function readEntry(server, home = process.env.HOME) {
  try {
    const doc = JSON.parse(readFileSync(join(home, '.pi', 'agent', 'mcp.json'), 'utf8'));
    const e = doc?.mcpServers?.[server];
    const a = e?.args;
    if (typeof e?.command !== 'string' || !e.command.startsWith('/') || !Array.isArray(a) || a.length !== 6) return null;
    if (a[0] !== 'mcp-relay' || a[1] !== 'microsoft' || a[2] !== '--account' || a[4] !== '--area' || typeof a[3] !== 'string') return null;
    return { command: e.command, account: a[3] };
  } catch { return null; }
}

// One read through the account's relay: initialize, then one tools/call.
// The result is the Graph JSON the server returns as text, or null.
export function relayRead(entry, area, tool, args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let done = false, buf = '';
    const child = spawn(entry.command, ['mcp-relay', 'microsoft', '--account', entry.account, '--area', area], { stdio: ['pipe', 'pipe', 'ignore'] });
    const finish = (v) => { if (done) return; done = true; clearTimeout(timer); try { child.kill('SIGTERM'); } catch {} resolve(v); };
    const timer = setTimeout(() => finish(null), timeoutMs);
    child.on('error', () => finish(null));
    child.on('exit', () => finish(null));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      if (buf.length > 4 << 20) return finish(null);
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 1 && msg.result) {
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } }) + '\n');
        } else if (msg.id === 1 || msg.id === 2) {
          const text = msg.result && !msg.result.isError ? msg.result.content?.find?.((c) => c?.type === 'text')?.text : null;
          if (typeof text !== 'string') return finish(null);
          try { finish(JSON.parse(text)); } catch { finish(null); }
        }
      }
    });
    child.stdin.on('error', () => finish(null));
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'open-habitat-permission', version: '1' } } }) + '\n');
  });
}

const q = (s) => `’${s}’`;
const idOf = (v) => (typeof v === 'string' && v ? v : 'puuttuu');
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] != null) return o[k]; return undefined; };
const items = (r) => (Array.isArray(r?.value) ? r.value : Array.isArray(r) ? r : []);

function people(list) {
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    const e = pick(r, 'emailAddress', 'EmailAddress') ?? r;
    const name = str(pick(e, 'name', 'Name')) ?? str(pick(e, 'address', 'Address'));
    if (name) out.push(name);
  }
  return out;
}
function recipients(names) {
  if (names.length === 0) return 'vastaanottajille';
  const shown = names.slice(0, 5).join(', ') + (names.length > 5 ? ` ja ${names.length - 5} muuta` : '');
  return `${names.length === 1 ? '1 vastaanottajalle' : `${names.length} vastaanottajalle`}: ${shown}`;
}
function when(event) {
  const dt = str(event?.start?.dateTime);
  if (!dt) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(dt);
  return m ? ` (${Number(m[3])}.${Number(m[2])}.${m[1]} klo ${m[4]}.${m[5]})` : '';
}
const roles = { freeBusyRead: 'näkee, milloin olet varattu', limitedRead: 'näkee varatut ajat, aiheet ja paikat', read: 'näkee kalenterisi tapahtumat', write: 'voi lukea ja muokata kalenteriasi', delegateWithoutPrivateEventAccess: 'voi toimia puolestasi kalenterissasi', delegateWithPrivateEventAccess: 'voi toimia puolestasi kalenterissasi, myös yksityisissä tapahtumissa' };
const role = (r) => roles[r] ?? (str(r) ? `saa oikeuden ${r}` : 'saa pääsyn kalenteriisi');

async function find(read, area, tool, args, id) {
  const r = await read(area, tool, args);
  return items(r).find((x) => x?.id === id) ?? null;
}

// describe turns one guarded call into the question's action and
// consequence. read(area, tool, args) is one lookup; it may return null.
export async function describe(tool, input, read) {
  const a = input && typeof input === 'object' ? input : {};
  const body = a.body && typeof a.body === 'object' ? a.body : {};
  const message = pick(body, 'Message', 'message') ?? {};
  switch (tool) {
    case 'delete-onedrive-file':
    case 'share-drive-item':
    case 'create-drive-item-share-link': {
      const f = await read('files', 'get-drive-item', { driveId: a.driveId, driveItemId: a.driveItemId, select: 'name,folder' });
      const name = str(f?.name) ? q(f.name) : `(asema ${idOf(a.driveId)}, tunniste ${idOf(a.driveItemId)})`;
      if (tool === 'delete-onedrive-file') {
        return { action: `Poista ${name}`, consequence: f && !f.folder ? 'Tiedosto poistetaan OneDrivesta tai SharePointista.' : 'Kohde poistetaan OneDrivesta tai SharePointista. Jos se on kansio, myös sen sisältö poistetaan.' };
      }
      if (tool === 'share-drive-item') {
        const who = (Array.isArray(body.recipients) ? body.recipients : []).map((r) => str(r?.email) ?? str(r?.alias) ?? str(r?.objectId)).filter(Boolean);
        const rights = (Array.isArray(body.roles) ? body.roles : []).join(', ') || 'kutsun mukaiset oikeudet';
        return { action: `Jaa ${name}`, consequence: `Pääsy annetaan heti ${recipients(who)}. Oikeudet: ${rights}.${body.sendInvitation ? ' Myös kutsu lähetetään.' : ''}` };
      }
      const scope = { anonymous: 'kuka tahansa linkin saanut', organization: 'organisaation jäsenet, joilla on linkki', users: 'erikseen nimetyt henkilöt' }[body.scope] ?? 'palvelun oletusasetuksen mukainen joukko';
      const rights = body.type === 'edit' ? 'muokata' : body.type === 'view' ? 'lukea' : `käyttää linkkiä (${idOf(body.type)})`;
      return { action: `Luo jakolinkki kohteelle ${name}`, consequence: `Linkin kautta ${scope} voi ${rights} kohdetta. Linkin luominen voi antaa pääsyn heti, vaikka sitä ei lähetetä kenellekään.` };
    }
    case 'delete-mail-folder': {
      const f = await find(read, 'admin', 'list-mail-folders', { top: 250 }, a.mailFolderId);
      const name = str(f?.displayName);
      const n = Number.isInteger(f?.totalItemCount) ? f.totalItemCount : null;
      const sub = Number.isInteger(f?.childFolderCount) && f.childFolderCount > 0 ? ` ja ${f.childFolderCount} alikansiota` : '';
      return { action: name ? `Poista postikansio ${q(name)}` : `Poista postikansio (tunniste ${idOf(a.mailFolderId)})`, consequence: n != null ? `Kansio, sen ${n} viestiä${sub} poistetaan postilaatikosta.` : 'Kansio ja kaikki sen viestit ja alikansiot poistetaan postilaatikosta.' };
    }
    case 'delete-mail-message': {
      const m = await read('mail', 'get-mail-message', { messageId: a.messageId, select: 'subject,from' });
      const subject = str(m?.subject), from = people([m?.from])[0];
      return { action: subject ? `Poista viesti ${q(subject)}` : `Poista viesti (tunniste ${idOf(a.messageId)})`, consequence: `Viesti${from ? ` lähettäjältä ${from}` : ''} poistetaan postilaatikosta.` };
    }
    case 'delete-mail-attachment': {
      const att = await find(read, 'mail', 'list-mail-attachments', { messageId: a.messageId }, a.attachmentId);
      const name = str(att?.name);
      return { action: name ? `Poista liite ${q(name)}` : `Poista viestin liite (tunniste ${idOf(a.attachmentId)})`, consequence: 'Liite poistetaan viestistä pysyvästi.' };
    }
    case 'send-mail': {
      const subject = str(pick(message, 'subject', 'Subject'));
      const to = people([...(pick(message, 'toRecipients', 'ToRecipients') ?? []), ...(pick(message, 'ccRecipients', 'CcRecipients') ?? []), ...(pick(message, 'bccRecipients', 'BccRecipients') ?? [])]);
      return { action: subject ? `Lähetä sähköposti ${q(subject)}` : 'Lähetä sähköposti', consequence: `Viesti lähtee heti ${recipients(to)}.` };
    }
    case 'send-draft-message': {
      const m = await read('mail', 'get-mail-message', { messageId: a.messageId, select: 'subject,toRecipients,ccRecipients,bccRecipients' });
      const subject = str(m?.subject);
      const to = people([...(m?.toRecipients ?? []), ...(m?.ccRecipients ?? []), ...(m?.bccRecipients ?? [])]);
      return { action: subject ? `Lähetä luonnos ${q(subject)}` : `Lähetä luonnos (tunniste ${idOf(a.messageId)})`, consequence: m ? `Viesti lähtee heti ${recipients(to)}.` : 'Luonnos lähtee heti sen vastaanottajille.' };
    }
    case 'reply-mail-message':
    case 'reply-all-mail-message': {
      const m = await read('mail', 'get-mail-message', { messageId: a.messageId, select: 'subject,from,toRecipients,ccRecipients' });
      const subject = str(m?.subject), from = people([m?.from])[0];
      const all = tool === 'reply-all-mail-message';
      const others = people([...(m?.toRecipients ?? []), ...(m?.ccRecipients ?? [])]).length;
      const action = `${all ? 'Vastaa kaikille viestiin' : 'Vastaa viestiin'} ${subject ? q(subject) : `(tunniste ${idOf(a.messageId)})`}`;
      const to = from ? `lähettäjälle ${from}` : 'viestin lähettäjälle';
      return { action, consequence: all ? `Vastaus lähtee heti ${to}${m ? ` ja muille vastaanottajille (${others})` : ' ja kaikille muille vastaanottajille'}.` : `Vastaus lähtee heti ${to}.` };
    }
    case 'forward-mail-message': {
      const m = await read('mail', 'get-mail-message', { messageId: a.messageId, select: 'subject' });
      const subject = str(m?.subject);
      const to = people(pick(body, 'ToRecipients', 'toRecipients') ?? []);
      return { action: subject ? `Välitä viesti ${q(subject)}` : `Välitä viesti (tunniste ${idOf(a.messageId)})`, consequence: `Viesti lähtee heti ${recipients(to)}.` };
    }
    case 'delete-calendar-event':
    case 'delete-specific-calendar-event':
    case 'cancel-calendar-event':
    case 'forward-calendar-event': {
      const args = { eventId: a.eventId, select: 'subject,start,attendees,isOrganizer' };
      const e = tool === 'delete-specific-calendar-event'
        ? await read('calendar', 'get-specific-calendar-event', { ...args, calendarId: a.calendarId })
        : await read('calendar', 'get-calendar-event', args);
      const name = str(e?.subject) ? `${q(e.subject)}${when(e)}` : `(tunniste ${idOf(a.eventId)})`;
      const attendees = Array.isArray(e?.attendees) ? e.attendees.length : null;
      if (tool === 'forward-calendar-event') {
        return { action: `Välitä kutsu ${name}`, consequence: `Kutsu lähtee heti ${recipients(people(pick(body, 'ToRecipients', 'toRecipients') ?? []))}.` };
      }
      if (tool === 'cancel-calendar-event') {
        return { action: `Peru tapahtuma ${name}`, consequence: `Peruutus lähtee heti ${attendees != null ? `${attendees} osallistujalle` : 'kaikille osallistujille'}, ja tapahtuma poistuu kalenterista.` };
      }
      const notice = e?.isOrganizer && attendees ? ` Järjestät sen itse, joten ${attendees} osallistujaa saa peruutuksen.` : '';
      return { action: `Poista tapahtuma ${name}`, consequence: `Tapahtuma poistuu kalenterista.${notice}` };
    }
    case 'delete-outlook-contact': {
      const c = await read('contacts', 'get-outlook-contact', { contactId: a.contactId, select: 'displayName' });
      const name = str(c?.displayName);
      return { action: name ? `Poista yhteystieto ${q(name)}` : `Poista yhteystieto (tunniste ${idOf(a.contactId)})`, consequence: 'Yhteystieto poistetaan Outlookista.' };
    }
    case 'delete-contact-folder': {
      const f = await find(read, 'admin', 'list-contact-folders', { top: 250 }, a.contactFolderId);
      const name = str(f?.displayName);
      return { action: name ? `Poista yhteystietokansio ${q(name)}` : `Poista yhteystietokansio (tunniste ${idOf(a.contactFolderId)})`, consequence: 'Kansio ja kaikki sen yhteystiedot poistetaan.' };
    }
    case 'delete-calendar': {
      const c = await find(read, 'admin', 'list-calendars', { top: 250 }, a.calendarId);
      const name = str(c?.name);
      return { action: name ? `Poista kalenteri ${q(name)}` : `Poista kalenteri (tunniste ${idOf(a.calendarId)})`, consequence: 'Kalenteri ja kaikki sen tapahtumat poistetaan.' };
    }
    case 'delete-focused-inbox-override': {
      const o = await find(read, 'admin', 'list-focused-inbox-overrides', {}, a.inferenceClassificationOverrideId);
      const who = people([o?.senderEmailAddress])[0];
      return { action: who ? `Poista Kohdistetut-sääntö lähettäjälle ${who}` : `Poista Kohdistetut-sääntö (tunniste ${idOf(a.inferenceClassificationOverrideId)})`, consequence: 'Lähettäjän viestit lajitellaan taas Outlookin oman arvion mukaan.' };
    }
    case 'create-my-calendar-permission': {
      const who = people([pick(body, 'emailAddress', 'EmailAddress')])[0];
      return { action: who ? `Jaa kalenterisi henkilölle ${who}` : 'Jaa kalenterisi', consequence: `${who ?? 'Vastaanottaja'} ${role(pick(body, 'role', 'Role'))} heti.` };
    }
    case 'update-my-calendar-permission':
    case 'delete-my-calendar-permission': {
      const p = await find(read, 'admin', 'list-my-calendar-permissions', {}, a.calendarPermissionId);
      const who = people([p?.emailAddress])[0];
      if (tool === 'delete-my-calendar-permission') {
        return { action: who ? `Lopeta kalenterin jako henkilölle ${who}` : `Lopeta kalenterin jako (tunniste ${idOf(a.calendarPermissionId)})`, consequence: `${who ?? 'Henkilö'} ei enää näe kalenteriasi.` };
      }
      return { action: who ? `Muuta kalenterin jakoa henkilölle ${who}` : `Muuta kalenterin jakoa (tunniste ${idOf(a.calendarPermissionId)})`, consequence: `Muutos tulee voimaan heti: ${who ?? 'henkilö'} ${role(pick(body, 'role', 'Role'))}.` };
    }
  }
  return { action: `Microsoft-kutsu ${tool}`, consequence: 'Kutsu muuttaa tiliä tai lähettää jotain heti.' };
}

export const noApiReason = 'This Microsoft call needs the person\'s permission, and Habitat\'s permission question is not loaded in this Pi, so it was not made.';

export default function (pi) {
  pi.on('tool_call', async (event, ctx) => {
    const t = parseTool(event?.toolName);
    if (!t || !guardedTools.has(t.tool)) return undefined;
    const habitat = globalThis[Symbol.for('open-habitat.permission')];
    if (!habitat) return { block: true, reason: noApiReason };
    const entry = readEntry(t.server);
    const input = event.input ?? {};
    const call = { area: t.server, tool: t.tool, arguments: input };
    const account = entry ? { provider: 'Microsoft', address: entry.account } : undefined;
    // Without a browser there is no one to ask; the companion blocks with
    // its reason, and no lookup is made.
    if (!ctx?.hasUI) return habitat.block(ctx, { action: `Microsoft-kutsu ${t.tool}`, consequence: 'Ei kysyttävissä.', account, call });
    let described;
    try {
      described = await describe(t.tool, input, (area, tool, args) => entry ? relayRead(entry, area, tool, args) : Promise.resolve(null));
    } catch {
      described = await describe(t.tool, input, () => Promise.resolve(null));
    }
    return habitat.block(ctx, { ...described, account, call });
  });
}
