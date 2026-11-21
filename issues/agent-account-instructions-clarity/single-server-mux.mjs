// Disposable experiment, not a production proxy. Never forwards tools/call.
import net from 'node:net';
import fs from 'node:fs';
const root = process.env.MS_RUNTIME;
const sdk = `${root}/node_modules/@modelcontextprotocol/sdk/dist/esm`;
const {Client} = await import(`${sdk}/client/index.js`);
const {StdioClientTransport} = await import(`${sdk}/client/stdio.js`);
const {Server} = await import(`${sdk}/server/index.js`);
const {ListToolsRequestSchema, CallToolRequestSchema, PingRequestSchema} = await import(`${sdk}/types.js`);
const config = JSON.parse(fs.readFileSync(process.env.LAB_CONFIG));
const client = new Client({name: 'lab-mux', version: '1'});
const upstream = new StdioClientTransport({command: `${root}/bin/ms-365-mcp-server`, args: config.args, env: process.env, stderr: 'inherit'});
await client.connect(upstream);
fs.writeFileSync(`${process.env.LAB_HOME}/full.json`, JSON.stringify({...await client.listTools(), instructions: client.getInstructions()}));
const sockets = [], peers = new Set();
for (const [area, names] of Object.entries(config.areas)) {
    const listener = net.createServer(async socket => {
        peers.add(socket);
        let buffer = '';
        const transport = {
            start: async () => {},
            send: async message => {socket.write(JSON.stringify(message) + '\n');},
            close: async () => {socket.destroy();},
        };
        socket.on('data', bytes => {
            buffer += bytes;
            let end;
            while ((end = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
                try { transport.onmessage?.(JSON.parse(line)); }
                catch (e) {transport.onerror?.(e); socket.destroy();}
            }
        });
        socket.on('error', error => transport.onerror?.(error));
        socket.on('close', () => {peers.delete(socket); transport.onclose?.();});
        const server = new Server({name: `lab-${area}`, version: '1'}, {capabilities: {tools: {}}});
        // Each simultaneous listing crosses the real SDK's one stdio connection.
        server.setRequestHandler(ListToolsRequestSchema, async () => {
            const result = await client.listTools();
            return {...result, tools: result.tools.filter(t => names.includes(t.name))};
        });
        server.setRequestHandler(PingRequestSchema, async () => {await client.ping(); return {};});
        server.setRequestHandler(CallToolRequestSchema, async request => ({
            isError: true,
            content: [{type: 'text', text: names.includes(request.params.name) ? 'LAB_BLOCKED_BEFORE_UPSTREAM' : 'OUTSIDE_AREA'}],
        }));
        await server.connect(transport);
    });
    const path = `${process.env.LAB_HOME}/${area}.sock`;
    await new Promise(resolve => listener.listen(path, resolve));
    fs.chmodSync(path, 0o600);
    sockets.push(listener);
}
console.log(JSON.stringify({ready: true, upstreamPid: upstream.pid, muxPid: process.pid}));
process.on('SIGTERM', async () => {
    for (const peer of peers) peer.destroy();
    for (const server of sockets) server.close();
    await client.close();
    process.exit(0);
});
