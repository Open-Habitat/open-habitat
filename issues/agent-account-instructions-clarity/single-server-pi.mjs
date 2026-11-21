// Model-free Pi SDK conversation: real MCP registration and codemode discovery.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = `${process.env.PI_RUNTIME}/node_modules/@earendil-works/pi-coding-agent`;
const {createAgentSession, createCodemodeExtension, createMcpExtension,
    DefaultResourceLoader, SessionManager, SettingsManager} = await import(`${base}/dist/index.js`);
const config = JSON.parse(fs.readFileSync(process.env.LAB_CONFIG));
const {createMcpToolName} = await import(`${process.env.PI_RUNTIME}/node_modules/@earendil-works/pi-mcp/dist/naming.js`);
const agentDir = `${process.env.HOME}/.pi/agent`;
fs.mkdirSync(agentDir, {recursive: true});
const entries = {};
for (const [area, names] of Object.entries(config.areas)) {
    entries[`ms-${area}`] = {
        ...(process.env.LAB_HTTP ? {url: process.env.LAB_HTTP, headers: {Authorization: 'Bearer synthetic-not-a-graph-token'}} : {
            command: '/usr/bin/python3', args: [process.env.LAB_RELAY, `${process.env.LAB_HOME}/${area}.sock`],
        }),
        description: `Synthetic Microsoft account: ${area}`,
        exposure: 'hidden', toolExposure: Object.fromEntries(names.map(n => [n, 'codemode'])),
    };
}
fs.writeFileSync(`${agentDir}/mcp.json`, JSON.stringify({mcpServers: entries}));
const settingsManager = SettingsManager.inMemory({defaultTools: ['+codemode']});
const resourceLoader = new DefaultResourceLoader({cwd: process.env.HOME, agentDir, settingsManager,
    noSkills: true, noPromptTemplates: true, noThemes: true,
    extensionFactories: [createCodemodeExtension({mode: 'on', models: false}), createMcpExtension()]});
await resourceLoader.reload();
const {session} = await createAgentSession({cwd: process.env.HOME, agentDir, resourceLoader,
    settingsManager, sessionManager: SessionManager.inMemory()});
try {
    await session.bindExtensions({});
    // Wait for codemode, whose reach declaration then waits for the named servers.
    let codeTool;
    for (let i = 0; i < 450; i++) {
        codeTool = session.agent.state.tools.find(t => t.name === 'codemode');
        if (codeTool && Object.keys(config.areas).every(a => session.getAllTools().some(t => t.name.startsWith('mcp__ms_' + a.replaceAll('-', '_') + '__')))) break;
        codeTool = undefined;
        await new Promise(r => setTimeout(r, 100));
    }
    assert(codeTool, 'codemode never activated');
    const result = await codeTool.execute('lab-discovery', {code: `
        const areas = ${JSON.stringify(Object.keys(config.areas))};
        const namespaces = await Promise.all(areas.map(a => describeNamespace('ms-' + a)));
        const hits = await searchTools('SharePoint folder delete mail folder', {namespace: 'ms-files'});
        text(JSON.stringify({namespaces: namespaces.map(n => n && ({name: n.name, tools: n.tools})), hits: hits.map(h => h.name)}));
    `});
    assert(!result.isError, JSON.stringify(result));
    const text = result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    fs.writeFileSync(`${process.env.HOME}/discovery.json`, text);
    const discovery = JSON.parse(text.slice(text.indexOf('{')));
    assert.equal(discovery.namespaces.length, 5);
    for (const [i, [area, names]] of Object.entries(config.areas).entries()) {
        const expected = names.filter(n => !process.env.LAB_HTTP || n !== 'download-bytes-to-file')
            .map(n => createMcpToolName('ms-' + area, n)).sort();
        assert.deepEqual([...discovery.namespaces[i].tools].sort(), expected);
    }
    const files = discovery.namespaces[Object.keys(config.areas).indexOf('files')];
    assert(!JSON.stringify(files).includes('delete_mail_folder'));
    assert(!JSON.stringify(discovery.hits).includes('delete_mail_folder'));
    assert(!JSON.stringify(discovery.namespaces).includes('__logout'));
    assert(JSON.stringify(files).includes('list_folder_files'));
    console.log(JSON.stringify({ready: true, pid: process.pid, discovery}));
    await new Promise(resolve => process.on('SIGTERM', resolve));
} finally {
    session.dispose();
}
process.exit(0);
