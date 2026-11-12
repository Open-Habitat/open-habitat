// Gives the agent its provider's own web search, so a person searches with the
// subscription or key they already use and no search credential or service is
// added (Jari, 2026-11-10). Pi has no search tool of its own; this appends the
// provider's server-side tool to each model request through Pi's payload hook.
// The provider runs the search inside the same request and Pi keeps the
// answer's text; it skips the search items themselves, which none of these
// providers needs back, and the citations, so the sources the answer cites
// are added to it here when its text does not already link them.
//
// Covered: the ChatGPT subscription (`openai-codex`) and OpenAI keys through
// the Responses `web_search` tool, and Anthropic keys through the server-side
// `web_search` and `web_fetch` tools. The Claude subscription goes through
// pi-claude-bridge, whose Claude Code runs its own WebSearch and WebFetch; the
// core runtime build enables those there. Other providers get nothing here.
//
// The tool shapes follow pi-web-search (ttttmr, MIT) and pi-web-access
// (Nico Bailon, MIT); no code is copied from either. Nothing is read from or
// written to the person's settings.

const anthropicTools = [
	// The basic versions: later ones default to calling search from code
	// execution, which not every model supports and which is not ZDR-eligible.
	// Together they stay under the server-side iteration limit after which
	// Anthropic pauses a turn (`pause_turn`, ten when last documented); Pi
	// cannot resume a paused turn.
	{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 },
	{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 4 },
];

// A tool of the person's own (a search extension, an MCP server) already
// offers search, and an Anthropic request refuses two tools with one name.
function offersSearch(tool) {
	const name = String(tool?.name ?? '').toLowerCase().replace(/[^a-z]/g, '');
	return String(tool?.type ?? '').startsWith('web_search') || String(tool?.type ?? '').startsWith('web_fetch') ||
		name === 'websearch' || name === 'webfetch';
}

// The tools a request declares. Pi 1.5 declares a Responses conversation's
// tools in `additional_tools` input items (or a synthetic tool search's
// output) where the model supports them, leaving no top-level `tools`; it
// returns undefined for a request that declares no tools, such as a summary.
function declaredTools(payload) {
	const items = Array.isArray(payload.input)
		? payload.input.filter(i => i?.type === 'additional_tools' || i?.type === 'tool_search_output')
		: [];
	if (!Array.isArray(payload.tools) && items.length === 0) return undefined;
	return [...(Array.isArray(payload.tools) ? payload.tools : []), ...items.flatMap(i => Array.isArray(i.tools) ? i.tools : [])];
}

export function nativeSearchTools(model, payload) {
	if (!model || !payload || typeof payload !== 'object') return [];
	const declared = declaredTools(payload);
	// Only the conversation's own request, not a helper call with another model.
	if (!declared || payload.model !== model.id || declared.some(offersSearch)) return [];
	if (model.api === 'openai-codex-responses' || (model.api === 'openai-responses' && model.provider === 'openai')) {
		// OpenAI refuses web_search at minimal reasoning effort.
		if (payload.reasoning?.effort === 'minimal') return [];
		return [{ type: 'web_search' }];
	}
	if (model.api === 'anthropic-messages' && model.provider === 'anthropic') return anthropicTools;
	return [];
}

// The URL-bearing citations in one raw provider stream event: OpenAI's
// `url_citation` annotations on a finished message, Anthropic's search result
// locations on a text block.
export function citations(data) {
	const found = [];
	const add = c => {
		if (typeof c?.url === 'string' && /^https?:\/\//.test(c.url)) found.push({ url: c.url, title: typeof c.title === 'string' ? c.title : '' });
	};
	if (data?.type === 'response.output_item.done' && data.item?.type === 'message') {
		for (const part of data.item.content ?? []) for (const a of part?.annotations ?? []) if (a?.type === 'url_citation') add(a);
	}
	if (data?.type === 'content_block_delta' && data.delta?.type === 'citations_delta') add(data.delta.citation);
	if (data?.type === 'content_block_start' && data.content_block?.type === 'text') for (const c of data.content_block.citations ?? []) add(c);
	return found;
}

// The answer with a list of the cited sources its text does not link yet, or
// undefined when there is nothing to add.
export function withSources(message, cited) {
	const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
	const missing = [...cited].filter(([url]) => !text.includes(url));
	if (missing.length === 0) return undefined;
	const label = (url, title) => {
		const clean = title.replace(/[[\]\n]/g, ' ').trim();
		if (clean) return clean;
		try { return new URL(url).host; } catch { return url; }
	};
	// Parentheses and spaces would end a Markdown link target early.
	const target = url => url.replace(/[()\s]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
	const lines = missing.map(([url, title]) => `- [${label(url, title)}](${target(url)})`);
	return { ...message, content: [...message.content, { type: 'text', text: `Sources:\n${lines.join('\n')}` }] };
}

export default function (pi) {
	// A provider that refuses the tool (an organisation that has turned web
	// search off, a model without it) fails the whole request. Pi shows that
	// error; this process then stops offering search so the next one works.
	let refused = false;
	pi.on('before_provider_request', (event, ctx) => {
		if (refused) return undefined;
		const tools = nativeSearchTools(ctx.model, event.payload);
		if (tools.length === 0) return undefined;
		// A top-level tool sits beside `additional_tools` items, which cannot
		// replace or remove it.
		return { ...event.payload, tools: [...(Array.isArray(event.payload.tools) ? event.payload.tools : []), ...tools] };
	});
	// Citations collected over the requests of one prompt, added to its final
	// answer rather than to a message that goes on to call a tool.
	let cited = new Map();
	pi.on('agent_start', () => { cited = new Map(); });
	pi.on('provider_stream_event', (event) => {
		for (const c of citations(event.data)) if (!cited.has(c.url)) cited.set(c.url, c.title);
	});
	pi.on('message_end', (event) => {
		const m = event.message;
		if (m?.role !== 'assistant') return undefined;
		if (m.stopReason === 'error' && /web[ _-]?(search|fetch)/i.test(String(m.errorMessage ?? ''))) {
			refused = true;
		}
		if ((m.stopReason !== 'stop' && m.stopReason !== 'length') || !Array.isArray(m.content)) return undefined;
		let answer = withSources(m, cited);
		cited = new Map();
		// Anthropic pauses a long search turn and expects the paused message back
		// as it was; Pi keeps neither the search blocks nor the pause, and ends the
		// turn. Say so rather than pass a partial answer off as complete.
		if (m.rawStopReason === 'pause_turn') {
			const base = answer ?? m;
			answer = { ...base, content: [...base.content, { type: 'text', text: 'The search was paused before the answer was complete. Ask to continue.' }] };
		}
		return answer ? { message: answer } : undefined;
	});
}
