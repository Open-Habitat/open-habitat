// Invoked by the mapped-UID daemon with trusted Pi paths; the session file's
// bytes arrive on stdin, already read and checked by the daemon. Everything is
// Pi's own reading of its session: the projection the model sees, its chars/4
// estimate, its usage rule and its compaction cut. Nothing is written.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { isAbsolute, join, normalize, relative, resolve } from 'node:path';

const [entry, manifest] = process.argv.slice(-2);
const text = (value, max) => typeof value === 'string' ? (value.length > max ? value.slice(0, max) : value) : '';
const count = n => Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 1e12) : 0;
try {
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '1.5.2') throw Error('version');
  const pi = pathToFileURL(entry);
  const { SessionManager, SettingsManager, parseSessionEntries, migrateSessionEntries } = await import(pi.href);
  const { estimateTokens, estimateProjectedContextTokens, prepareCompaction, calculateContextTokens, extractFileOpsFromMessage } =
    await import(new URL('./core/compaction/index.js', pi).href);
  const { getCurrentSystemMessage } = await import(new URL('../../pi-ai/dist/index.js', pi).href);

  // A synchronous read of a pipe can fail with EAGAIN on a large session.
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const entries = parseSessionEntries(Buffer.concat(chunks).toString('utf8'));
  migrateSessionEntries(entries);
  const session = SessionManager.inMemory('/', undefined, entries);
  const branch = session.getBranch();
  const projection = session.buildSessionProjection();
  const model = projection.model;
  // The Claude bridge sends Claude Code's own preset in place of Pi's base
  // prompt and forwards only the portable sections (pi-claude-bridge 0.9.3 through 0.12.0).
  const harness = model?.provider === 'claude-bridge' ? 'claude_code' : 'pi';
  const replaced = new Set(harness === 'claude_code' ? ['preamble', 'tools', 'rules', 'docs', 'cwd'] : []);

  // Turns: each user message on the active path starts one; what precedes
  // the first is setup (turn 0).
  const turnOf = new Map();
  const turns = [];
  let turn = 0;
  for (const e of branch) {
    if (e.type === 'message' && e.message?.role === 'user') {
      turn++;
      const content = e.message.content;
      const ask = typeof content === 'string' ? content
        : Array.isArray(content) ? content.filter(b => b?.type === 'text').map(b => b.text).join(' ') : '';
      turns.push({ n: turn, at: e.timestamp, request: text(ask.replace(/\s+/g, ' ').trim(), 160),
        replies: 0, input: 0, output: 0, cache_read: 0, cache_write: 0, cost: 0 });
    }
    turnOf.set(e.id, turn);
    if (turn > 0 && e.type === 'message' && e.message?.role === 'assistant' && e.message.usage) {
      const t = turns[turn - 1], u = e.message.usage;
      t.replies++;
      t.input += count(u.input); t.output += count(u.output);
      t.cache_read += count(u.cacheRead); t.cache_write += count(u.cacheWrite);
      t.cost += Number.isFinite(u.cost?.total) && u.cost.total > 0 ? u.cost.total : 0;
      // Pi's own rule for a usable measurement (getLastAssistantUsage).
      if (e.message.stopReason !== 'aborted' && e.message.stopReason !== 'error') {
        const size = calculateContextTokens(u);
        if (size > 0) t.context_tokens = count(size);
      }
    }
  }

  // Composition of what the model sees now, by Pi's estimate.
  const est = m => count(estimateTokens(m));
  const without = (m, keep) => est({ ...m, content: Array.isArray(m.content) ? m.content.filter(keep) : m.content });
  const instructions = [], tools = [];
  const parts = { instructions: 0, tools: 0, summary: 0, conversation: 0, tool_output: 0, attachments: 0 };
  const conversation = { user: 0, assistant: 0, thinking: 0, tool_calls: 0, other: 0 };
  const outputs = [];
  const calls = new Map();
  // What the model sees of each entry's output now, and of each entry at all.
  const seenOutput = new Map(), seenEntry = new Map();
  const system = getCurrentSystemMessage(projection.messages);
  if (system) {
    const content = est({ role: 'system', content: system.content });
    if (content) instructions.push({ name: 'prompt', tokens: content });
    for (const [name, value] of Object.entries(system.sections ?? {})) {
      if (typeof value !== 'string' || !value) continue;
      instructions.push({ name: text(name, 64), tokens: count(Math.ceil(value.length / 4)), ...(replaced.has(name) ? { replaced: true } : {}) });
    }
    for (const tool of system.toolsAdded ?? []) tools.push({ name: text(tool.name, 64), tokens: count(Math.ceil(JSON.stringify(tool).length / 4)) });
  }
  parts.instructions = instructions.reduce((a, s) => a + (s.replaced ? 0 : s.tokens), 0);
  parts.tools = tools.reduce((a, s) => a + s.tokens, 0);
  for (const projected of projection.entries) {
    const n = turnOf.get(projected.sourceEntry.id) ?? 0;
    for (const m of projected.messages) {
      if (m.role !== 'system') seenEntry.set(projected.sourceEntry.id, (seenEntry.get(projected.sourceEntry.id) ?? 0) + est(m));
      switch (m.role) {
        case 'system': break;
        case 'compactionSummary': case 'branchSummary': parts.summary += est(m); break;
        case 'user': {
          const all = est(m), words = without(m, b => b?.type !== 'image');
          conversation.user += words; parts.conversation += words; parts.attachments += all - words;
          break;
        }
        case 'assistant': {
          const only = type => without(m, b => b?.type === type);
          const t = only('text'), th = only('thinking'), tc = only('toolCall');
          conversation.assistant += t; conversation.thinking += th; conversation.tool_calls += tc;
          parts.conversation += t + th + tc;
          for (const b of m.content ?? []) if (b?.type === 'toolCall') calls.set(b.id, b);
          break;
        }
        case 'toolResult': case 'bashExecution': {
          const all = est(m), words = m.role === 'toolResult' ? without(m, b => b?.type !== 'image') : all;
          parts.tool_output += words; parts.attachments += all - words;
          const call = m.role === 'toolResult' ? calls.get(m.toolCallId) : undefined;
          const args = call?.arguments ?? {};
          const label = m.role === 'bashExecution' ? `! ${m.command}` : `${m.toolName ?? call?.name ?? ''} ${args.command ?? args.path ?? args.file_path ?? ''}`;
          if (words > 0) outputs.push({ name: text(label.replace(/\s+/g, ' ').trim(), 120), turn: n, tokens: words });
          seenOutput.set(projected.sourceEntry.id, (seenOutput.get(projected.sourceEntry.id) ?? 0) + words);
          break;
        }
        default: { const t = est(m); conversation.other += t; parts.conversation += t; }
      }
    }
  }
  outputs.sort((a, b) => b.tokens - a.tokens);
  const estimate = estimateProjectedContextTokens(projection, branch);

  // Compactions on the active path, newest last.
  const compactions = [];
  let keptFrom = 1, lastKept;
  for (const [i, e] of branch.entries()) {
    if (e.type !== 'compaction') continue;
    // Pi's first valid measurement after this compaction.
    const after = branch.slice(i + 1).find(x => x.type === 'message' && x.message?.role === 'assistant' && x.message.usage
      && x.message.stopReason !== 'aborted' && x.message.stopReason !== 'error' && calculateContextTokens(x.message.usage) > 0);
    const kept = turnOf.get(e.firstKeptEntryId) ?? turnOf.get(e.id) ?? 0;
    const files = list => (Array.isArray(list) ? list : []).filter(f => typeof f === 'string').slice(0, 50).map(f => text(f, 512));
    compactions.push({ at: e.timestamp, after_turn: turnOf.get(e.id) ?? 0, kept_from_turn: kept,
      tokens_before: count(e.tokensBefore), summary: text(e.summary, 24000), summary_truncated: (e.summary?.length ?? 0) > 24000,
      summary_tokens: count(Math.ceil((e.summary?.length ?? 0) / 4)),
      read_files: files(e.details?.readFiles), modified_files: files(e.details?.modifiedFiles),
      ...(after ? { tokens_after: count(calculateContextTokens(after.message.usage)) } : {}) });
    keptFrom = kept || keptFrom;
    lastKept = e.firstKeptEntryId;
  }
  // Where what the model sees word for word begins.
  const startEntry = lastKept ? branch.find(e => e.id === lastKept) : branch.find(e => e.type === 'message' && e.message?.role === 'user');

  // What Pi's own cut rule would summarize next, with the person's settings.
  // An invalid setting is Pi's to report; the page then shows no forecast.
  let compaction;
  try {
    const settings = SettingsManager.create(process.env.HOME, join(process.env.HOME, '.pi', 'agent'), { projectTrusted: false });
    if (!settings.drainErrors().length) compaction = settings.getCompactionSettings(model ? { provider: model.provider, id: model.modelId } : undefined);
  } catch { compaction = undefined; }
  let next = null;
  const prep = compaction && prepareCompaction(branch, compaction);
  if (prep) {
    // Pi cuts at its own turn starts (also shell commands and extension
    // messages); the page numbers turns by the person's messages, so the cut
    // is placed by entry order and may fall inside a displayed turn.
    const at = branch.findIndex(e => e.id === prep.firstKeptEntryId);
    const first = turnOf.get(prep.firstKeptEntryId) ?? 0;
    const before = at > 0 ? turnOf.get(branch[at - 1].id) ?? 0 : 0;
    const summarized = [...prep.messagesToSummarize, ...prep.turnPrefixMessages].reduce((a, m) => a + est(m), 0);
    // The same cut in clock times, which the person remembers better than
    // turn numbers, and Pi's estimate of what stays: the prompt, the earlier
    // summary as a stand-in for the new one, and every entry from the cut on.
    const start = Math.max(0, branch.findIndex(e => e.id === lastKept));
    const said = branch.slice(start, Math.max(at, 0)).filter(e => e.type === 'message' && e.message?.role !== 'system');
    // The earlier compaction itself can follow the cut; its summary is
    // already the stand-in.
    const kept = branch.slice(Math.max(at, 0)).filter(e => e.type !== 'compaction').reduce((a, e) => a + (seenEntry.get(e.id) ?? 0), 0);
    next = { from_turn: keptFrom, through_turn: before, kept_from_turn: first,
      split_turn: prep.isSplitTurn || (first > 0 && before === first), summarized_tokens: summarized,
      ...(said.length ? { from_at: text(said[0].timestamp, 64), through_at: text(said.at(-1).timestamp, 64) } : {}),
      ...(at >= 0 ? { kept_from_at: text(branch[at].timestamp, 64) } : {}),
      estimated_tokens_after: count(parts.instructions + parts.tools + parts.summary + kept) };
  }

  // Everything the agent read, changed, ran or looked up on the active path,
  // one row per file, command or tool target, and how much of it the model
  // still sees word for word. Files follow Pi's own file rule (read, write
  // and edit paths, also from codemode scripts) and a few known readers of
  // documents Pi cannot read itself.
  const cut = prep ? branch.findIndex(e => e.id === prep.firstKeptEntryId) : -1;
  const cwd = typeof entries[0]?.cwd === 'string' && isAbsolute(entries[0].cwd) ? entries[0].cwd : undefined;
  const home = process.env.HOME;
  const inside = (root, p) => { const r = relative(root, p); return r && !r.startsWith('..') && !isAbsolute(r) ? r : undefined; };
  // As the conversation shows paths: relative to its folder, ~/ for the rest
  // of the home, absolute elsewhere.
  const shown = path => {
    const full = home && path.startsWith('~/') ? join(home, path.slice(2))
      : isAbsolute(path) ? normalize(path) : cwd ? resolve(cwd, path) : normalize(path);
    if (!isAbsolute(full)) return full;
    const r = cwd && inside(cwd, full);
    if (r) return r;
    const h = home && inside(home, full);
    return h ? `~/${h}` : full;
  };
  const reader = /^\s*(?:docx2txt|pdftotext|xlsx2csv)\s+(?:-\S+\s+)*(?:"([^"]+)"|'([^']+)'|([^\s|;&<>]+))/;
  const lines = value => typeof value === 'string' && value ? value.split('\n').length - (value.endsWith('\n') ? 1 : 0) : 0;
  const changes = patch => {
    let added = 0, removed = 0;
    for (const l of typeof patch === 'string' ? patch.split('\n') : []) {
      if (l.startsWith('+') && !l.startsWith('+++')) added++;
      else if (l.startsWith('-') && !l.startsWith('---')) removed++;
    }
    return { added, removed };
  };
  const items = new Map();
  const note = (kind, name, entry, index, op, tokens) => {
    const key = `${kind}\u0000${name}`;
    const item = items.get(key) ?? { kind, name: text(name, 512), tokens: 0, in_context: false, ...(prep ? { kept_tokens: 0 } : {}), ops: [], ops_omitted: 0, last: '' };
    items.set(key, item);
    if (tokens !== undefined) {
      item.in_context = true;
      item.tokens += tokens;
      if (prep && cut >= 0 && index >= cut) item.kept_tokens += tokens;
    }
    item.last = text(entry.timestamp, 64);
    if (item.ops.length < 10) item.ops.push({ ...op, at: text(entry.timestamp, 64) });
    else item.ops_omitted++;
  };
  const fileOps = (name, args) => {
    const found = { read: new Set(), written: new Set(), edited: new Set() };
    extractFileOpsFromMessage({ role: 'assistant', content: [{ type: 'toolCall', name, arguments: args }] }, found);
    return [...[...found.read].map(p => ['read', p]), ...[...found.written].map(p => ['wrote', p]), ...[...found.edited].map(p => ['edited', p])];
  };
  const command = (entry, index, cmd, tokens) => {
    const m = reader.exec(cmd);
    const path = m && (m[1] ?? m[2] ?? m[3]);
    if (path) note('file', shown(path), entry, index, { verb: 'read' }, tokens);
    else note('command', cmd.replace(/\s+/g, ' ').trim(), entry, index, { verb: 'ran' }, tokens);
  };
  const called = new Map();
  for (const [index, e] of branch.entries()) {
    if (e.type !== 'message') continue;
    const m = e.message;
    if (m?.role === 'assistant' && Array.isArray(m.content)) for (const b of m.content) if (b?.type === 'toolCall') called.set(b.id, b);
    if (m?.role === 'bashExecution' && typeof m.command === 'string' && m.command.trim()) command(e, index, m.command, seenOutput.get(e.id));
    if (m?.role !== 'toolResult') continue;
    const call = called.get(m.toolCallId);
    const name = m.toolName ?? call?.name ?? '';
    const args = call?.arguments && typeof call.arguments === 'object' ? call.arguments : {};
    const tokens = seenOutput.get(e.id) ?? (seenEntry.has(e.id) ? 0 : undefined);
    const ops = fileOps(name, args);
    if (ops.length) {
      for (const [verb, path] of ops) {
        const extra = verb === 'wrote' ? { added: count(lines(args.content)) } : verb === 'edited' ? changes(m.details?.patch) : {};
        note('file', shown(path), e, index, { verb, ...extra }, tokens);
      }
    } else if (name === 'bash' && typeof args.command === 'string' && args.command.trim()) {
      command(e, index, args.command, tokens);
    } else if (name) {
      const target = args.query ?? args.url ?? args.path ?? args.file_path ?? args.command ?? '';
      note('tool', `${name} ${typeof target === 'string' ? target : ''}`.replace(/\s+/g, ' ').trim(), e, index, { verb: 'used' }, tokens);
    }
    // A codemode script's own file calls: the script's output is its row.
    for (const nested of Array.isArray(m.nestedCalls?.calls) ? m.nestedCalls.calls : [])
      for (const [verb, path] of fileOps(nested?.name, nested?.arguments)) note('file', shown(path), e, index, { verb }, seenEntry.has(e.id) ? 0 : undefined);
  }
  const all = [...items.values()];
  const seenItems = all.filter(i => i.in_context).sort((a, b) => b.tokens - a.tokens);
  const goneItems = all.filter(i => !i.in_context).sort((a, b) => (a.last < b.last ? 1 : -1));
  const listed = [...seenItems.slice(0, 200), ...goneItems.slice(0, 100)].map(({ last, ...i }) => i);

  const result = {
    schema_version: 1, harness,
    ...(model ? { model: text(`${model.provider}/${model.modelId}`, 200) } : {}),
    ...(estimate.lastUsageIndex !== null ? { measured_tokens: count(estimate.usageTokens) } : {}),
    estimated_tokens: count(estimate.tokens), trailing_tokens: count(estimate.trailingTokens),
    ...(compaction ? { settings: { enabled: compaction.enabled === true, reserve_tokens: count(compaction.reserveTokens), keep_recent_tokens: count(compaction.keepRecentTokens) } } : {}),
    parts, instructions: instructions.slice(0, 40), tools: tools.slice(0, 100), conversation,
    largest_outputs: outputs.slice(0, 5), compactions: compactions.slice(-20), next_compaction: next,
    just_compacted: branch.at(-1)?.type === 'compaction',
    ...(startEntry ? { context_from_at: text(startEntry.timestamp, 64) } : {}),
    items: listed, items_omitted: all.length - listed.length,
    turns: turns.slice(-500).map(t => ({ ...t, cost: Math.round(t.cost * 1e6) / 1e6 })), turns_omitted: Math.max(0, turns.length - 500),
  };
  // Every list is bounded, but not their sum: drop the oldest summaries'
  // text, then their file lists, until the reading fits the daemon's limit.
  const size = () => Buffer.byteLength(JSON.stringify(result));
  for (const c of result.compactions) {
    if (size() <= 900000) break;
    c.summary = ''; c.summary_truncated = true;
  }
  for (const c of result.compactions) {
    if (size() <= 900000) break;
    c.read_files = []; c.modified_files = [];
  }
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  // Session text and Pi errors may contain the person's content.
  process.stdout.write(JSON.stringify({ error: 'native_unavailable' }) + '\n');
  process.exitCode = 1;
}
