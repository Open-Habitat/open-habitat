// Replay category prefixes through the installed Pi ranker, not a substitute.
import fs from 'node:fs';
const pi = `${process.env.PI_RUNTIME}/node_modules/@earendil-works`;
if (JSON.parse(fs.readFileSync(`${pi}/pi-coding-agent/package.json`)).version !== '1.5.2') throw new Error('This replay is pinned to Pi 1.5.2');
const {Bm25Ranker, createToolSearchDocument} = await import(`${pi}/pi-coding-agent/dist/extensions/tool-search/tool.js`);
const {createMcpToolName, mcpNamespace} = await import(`${pi}/pi-mcp/dist/naming.js`);
const listing = JSON.parse(fs.readFileSync(process.argv[2]));
const hidden = new Set('login logout verify-login list-accounts select-account remove-account'.split(' '));
const tools = listing.tools.filter(t => !hidden.has(t.name));
const queries = ['find file in SharePoint folder', 'list folder files', 'sharepoint folder employment contract', 'list folder', 'search files'];
const prefixes = ['', 'files: ', 'drive: ', 'onedrive: ', 'sharepoint: ', 'drive onedrive sharepoint: ', 'files drive onedrive sharepoint: '];
const ranker = new Bm25Ranker();
const output = {versions: {pi: '1.5.2', microsoft: '0.170.1'}, rows: [], words: {}};
for (const name of ['habitat-microsoft-aino-virtanen-contoso-test', 'ms']) {
    const ns = {name: mcpNamespace(name), aliases: [name], instructions: listing.instructions};
    const docs = tools.map(t => createToolSearchDocument({name: createMcpToolName(name, t.name), description: t.description ?? '', parameters: t.inputSchema}, ns));
    function rank(query) {
        return ranker.rank(query, docs, 8).map(hit => tools[docs.findIndex(d => d.name === hit.name)].name);
    }
    for (const q of queries) for (const prefix of prefixes) {
        const hits = rank(prefix + q);
        output.rows.push({server: name, query: prefix + q, hits, deleteMailFolder: hits.includes('delete-mail-folder')});
    }
    for (const query of ['mail: delete folder', 'calendar: share', 'contact: list folder']) {
        output.rows.push({server: name, query, hits: rank(query)});
    }
}
for (const word of ['files', 'drive', 'onedrive', 'sharepoint', 'mail', 'calendar', 'contact']) {
    const re = new RegExp(word, 'i');
    output.words[word] = tools.filter(t => re.test(`${t.name} ${t.description}`)).map(t => t.name);
}
if (process.argv[3]) {
    const name = 'ms';
    const ns = {name: mcpNamespace(name), aliases: [name], instructions: listing.instructions};
    const docs = tools.map(t => createToolSearchDocument({name: createMcpToolName(name, t.name), description: t.description ?? '', parameters: t.inputSchema}, ns));
    output.live = [];
    for (const file of fs.readdirSync(process.argv[3]).filter(n => n.endsWith('.jsonl'))) {
        const events = fs.readFileSync(`${process.argv[3]}/${file}`, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
        const searches = [];
        for (const event of events) {
            const code = event.input?.code ?? '';
            for (const match of code.matchAll(/searchTools\(\s*(["'`])([\s\S]*?)\1/g)) {
                const query = match[2];
                const hits = ranker.rank(query, docs, 8).map(hit => tools[docs.findIndex(d => d.name === hit.name)].name);
                searches.push({query, hits, deleteMailFolder: hits.includes('delete-mail-folder')});
            }
        }
        const returnedDelete = events.filter(e => e.result && JSON.stringify(e.result).includes('mcp__ms__delete_mail_folder')).length;
        output.live.push({file, searches, returnedDelete, firstCall: events.find(e => e.tool?.startsWith('mcp__'))?.tool ?? null});
    }
}
console.log(JSON.stringify(output, null, 2));
