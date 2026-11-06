const puppeteer = require('puppeteer-core'); const WebSocket = require('ws');
class T { constructor(ws){this.ws=ws; ws.on('message',m=>this.onmessage&&this.onmessage(m.toString())); ws.on('close',()=>this.onclose&&this.onclose());}
  send(m){this.ws.send(m)} close(){this.ws.close()} }
(async () => { const ws = new WebSocket('ws+unix://' + process.argv[2] + ':/devtools/browser/pipe');
  await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});
  const b = await puppeteer.connect({ transport: new T(ws) });
  const [p] = await b.pages(); console.log('pp connected; title:', await p.title());
  await p.screenshot({ path: 'shot.png' }); console.log('screenshot bytes', require('fs').statSync('shot.png').size);
  await b.disconnect(); })().catch(e => { console.error('PP FAIL', e.message); process.exit(1); });
