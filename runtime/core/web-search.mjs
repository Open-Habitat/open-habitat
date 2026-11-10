// Gives the agent its provider's own web search, so a person searches with the
// subscription or key they already use and no search credential or service is
// added (Jari, 2026-11-10). Pi has no search tool of its own; this appends the
// provider's server-side tool to each model request through Pi's payload hook.
// The provider runs the search inside the same request and Pi keeps the
// answer's text; it skips the search items themselves, which none of these
// providers needs back.
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
	{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 },
	{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 8 },
];

// A tool of the person's own (a search extension, an MCP server) already
// offers search, and an Anthropic request refuses two tools with one name.
function offersSearch(tool) {
	const name = String(tool?.name ?? '').toLowerCase().replace(/[^a-z]/g, '');
	return String(tool?.type ?? '').startsWith('web_search') || String(tool?.type ?? '').startsWith('web_fetch') ||
		name === 'websearch' || name === 'webfetch';
}

export function nativeSearchTools(model, payload) {
	if (!model || !payload || typeof payload !== 'object' || !Array.isArray(payload.tools)) return [];
	// Only the conversation's own request, not a helper call with another model.
	if (payload.model !== model.id || payload.tools.some(offersSearch)) return [];
	if (model.api === 'openai-codex-responses' || (model.api === 'openai-responses' && model.provider === 'openai')) {
		// OpenAI refuses web_search at minimal reasoning effort.
		if (payload.reasoning?.effort === 'minimal') return [];
		return [{ type: 'web_search' }];
	}
	if (model.api === 'anthropic-messages' && model.provider === 'anthropic') return anthropicTools;
	return [];
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
		return { ...event.payload, tools: [...event.payload.tools, ...tools] };
	});
	pi.on('message_end', (event) => {
		const m = event.message;
		if (m?.role === 'assistant' && m.stopReason === 'error' && /web[ _-]?(search|fetch)/i.test(String(m.errorMessage ?? ''))) {
			refused = true;
		}
	});
}
