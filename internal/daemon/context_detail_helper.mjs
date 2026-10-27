// Invoked by the mapped-UID daemon with trusted Pi paths; the session file's
// bytes arrive on stdin, already read and checked by the daemon. Everything is
// Pi's own reading of its session: the projection the model sees, its chars/4
// estimate, its usage rule and its compaction cut. Nothing is written.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [entry, manifest] = process.argv.slice(-2);
const text = (value, max) => typeof value === 'string' ? (value.length > max ? value.slice(0, max) : value) : '';
const count = n => Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 1e12) : 0;
try {
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '1.3.0') throw Error('version');
  const pi = pathToFileURL(entry);
  const { SessionManager, SettingsManager, parseSessionEntries, migrateSessionEntries } = await import(pi.href);
  const { estimateTokens, estimateProjectedContextTokens, prepareCompaction, calculateContextTokens } =
    await import(new URL('./core/compaction/index.js', pi).href);
  const { getCurrentSystemMessage } = await import(new URL('../../pi-ai/dist/index.js', pi).href);

  const entries = parseSessionEntries(readFileSync(0, 'utf8'));
  migrateSessionEntries(entries);
  const session = SessionManager.inMemory('/', undefined, entries);
  const branch = session.getBranch();
  const projection = session.buildSessionProjection();
  const model = projection.model;
  // The Claude bridge sends Claude Code's own preset in place of Pi's base
  // prompt and forwards only the portable sections (pi-claude-bridge 0.9.3).
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
  let keptFrom = 1;
  for (const e of branch) {
    if (e.type !== 'compaction') continue;
    const kept = turnOf.get(e.firstKeptEntryId) ?? turnOf.get(e.id) ?? 0;
    const files = list => (Array.isArray(list) ? list : []).filter(f => typeof f === 'string').slice(0, 50).map(f => text(f, 512));
    compactions.push({ at: e.timestamp, after_turn: turnOf.get(e.id) ?? 0, kept_from_turn: kept,
      tokens_before: count(e.tokensBefore), summary: text(e.summary, 24000), summary_truncated: (e.summary?.length ?? 0) > 24000,
      summary_tokens: count(Math.ceil((e.summary?.length ?? 0) / 4)),
      read_files: files(e.details?.readFiles), modified_files: files(e.details?.modifiedFiles) });
    keptFrom = kept || keptFrom;
  }

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
    const first = turnOf.get(prep.firstKeptEntryId) ?? 0;
    const summarized = [...prep.messagesToSummarize, ...prep.turnPrefixMessages].reduce((a, m) => a + est(m), 0);
    next = { from_turn: keptFrom, through_turn: prep.isSplitTurn ? first : first - 1, kept_from_turn: first,
      split_turn: prep.isSplitTurn, summarized_tokens: summarized };
  }

  const result = {
    schema_version: 1, harness,
    ...(model ? { model: text(`${model.provider}/${model.modelId}`, 200) } : {}),
    ...(estimate.lastUsageIndex !== null ? { measured_tokens: count(estimate.usageTokens) } : {}),
    estimated_tokens: count(estimate.tokens), trailing_tokens: count(estimate.trailingTokens),
    ...(compaction ? { settings: { enabled: compaction.enabled === true, reserve_tokens: count(compaction.reserveTokens), keep_recent_tokens: count(compaction.keepRecentTokens) } } : {}),
    parts, instructions: instructions.slice(0, 40), tools: tools.slice(0, 100), conversation,
    largest_outputs: outputs.slice(0, 5), compactions: compactions.slice(-20), next_compaction: next,
    turns: turns.slice(-500).map(t => ({ ...t, cost: Math.round(t.cost * 1e6) / 1e6 })), turns_omitted: Math.max(0, turns.length - 500),
  };
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  // Session text and Pi errors may contain the person's content.
  process.stdout.write(JSON.stringify({ error: 'native_unavailable' }) + '\n');
  process.exitCode = 1;
}
