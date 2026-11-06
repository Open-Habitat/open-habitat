const { chromium } = require('playwright-core');
(async () => {
  const ep = 'ws+unix://' + process.argv[2] + ':/devtools/browser/pipe';
  const b = await chromium.connectOverCDP(ep);
  const ctx = b.contexts()[0]; const pages = ctx.pages();
  console.log('pw connected; pages:', pages.map(p => p.url()));
  if (process.argv[3]) { const p = pages[0] || await ctx.newPage();
    await p.setContent('<h1>hello</h1><script>document.cookie="sid=abc; max-age=3600"</script>');
    await p.goto('data:text/html,<title>kept</title>persisted'); }
  console.log('cookies:', (await ctx.cookies()).length, 'title:', await ctx.pages()[0].title());
  await b.close(); // for connectOverCDP this disconnects, browser stays
})().catch(e => { console.error('PW FAIL', e.message.split('\n')[0]); process.exit(1); });
