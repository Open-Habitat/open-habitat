// Live ADR 0035 end-to-end check against the disposable test server through
// its real ingress (Cloudflare tunnel → Alder → guest gateway). One-off
// evidence script for issue view-address-end-to-end; removed with the issue.
//
// Inputs (never committed): OH_E2E_SESSIONS = JSON file with the synthetic
// accounts' cookie/csrf/subject, OH_E2E_VIEWS = JSON {alice:[v1,v2], bob:[..]},
// OH_E2E_GUEST = executable running one root command on the guest.
// Output: a JSON matrix on stdout with every secret replaced by a label.
//
// Run from web/ (for the playwright package):
//   timeout 900 node ../issues/view-address-end-to-end/live-e2e.mjs > out.json
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.cwd()}/package.json`)("@playwright/test");

const APP = "https://open-habitat-test.example.test";
const HOST = new URL(APP).host;
const sessions = JSON.parse(readFileSync(process.env.OH_E2E_SESSIONS, "utf8"));
const views = JSON.parse(readFileSync(process.env.OH_E2E_VIEWS, "utf8"));
const guestCmd = process.env.OH_E2E_GUEST;
const results = [];
const secrets = new Map();
const hide = (s) => {
  let out = String(s);
  for (const [v, label] of secrets) out = out.split(v).join(label);
  return out;
};
const remember = (value, label) => {
  if (value && !secrets.has(value)) secrets.set(value, label);
};
function check(scenario, what, pass, observed) {
  results.push({ scenario, check: what, pass: !!pass, observed: hide(JSON.stringify(observed ?? null)) });
  process.stderr.write(`${pass ? "PASS" : "FAIL"} [${scenario}] ${what} ${hide(JSON.stringify(observed ?? ""))}\n`);
}
const guest = (cmd) => execFileSync(guestCmd, [cmd], { encoding: "utf8", timeout: 180_000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(user, method, path, body) {
  const s = sessions[user];
  const headers = { Cookie: `__Host-agent-host=${s.cookie}` };
  if (method !== "GET") {
    headers.Origin = APP;
    headers["X-Agent-Host-CSRF"] = s.csrf;
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(APP + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}
// A raw anonymous request through the ingress, redirects not followed.
async function anon(url, init = {}) {
  const res = await fetch(url, { redirect: "manual", ...init });
  const text = await res.text();
  const h = Object.fromEntries(res.headers);
  return { status: res.status, h, text };
}
const secretHeaders = (h) => ({
  cache: h["cache-control"],
  referrer: h["referrer-policy"],
  robots: h["x-robots-tag"],
  cf: h["cf-cache-status"],
  cookie: h["set-cookie"] ?? null,
});
const headersOK = (h) =>
  /no-store/.test(h["cache-control"] ?? "") && h["referrer-policy"] === "no-referrer" && /noindex/.test(h["x-robots-tag"] ?? "") && !h["set-cookie"] && h["cf-cache-status"] !== "HIT";

async function ensure(user, viewId) {
  const r = await api(user, "POST", "/api/v1/view-addresses", { view_id: viewId });
  const a = r.json?.address;
  if (a) {
    remember(new URL(a.url).pathname.slice(3), `<entry:${user}:${viewId.slice(0, 6)}>`);
    if (a.content_url) remember(new URL(a.content_url).pathname.split("/")[1], `<token:${user}:${viewId.slice(0, 6)}>`);
  }
  return { ...r, a };
}
const list = async (user) => (await api(user, "GET", "/api/v1/view-addresses")).json?.addresses ?? [];
const publish = (user, id, days = 30) => api(user, "POST", "/api/v1/view-addresses/publish", { address_id: id, days });

// Recipient browser checks of the multi-file export at the content host.
async function readsExport(page, scenario, label, url, user, n) {
  const res = await page.goto(url, { waitUntil: "load" });
  const final = new URL(page.url());
  check(scenario, `${label}: lands on the content host`, final.host !== HOST && final.host.startsWith("oh-view-") && res?.status() === 200, { host: final.host === HOST ? "app" : "view-host", status: res?.status() });
  const h1 = await page.locator("#h").textContent().catch(() => null);
  const js = await page.locator("#js").textContent().catch(() => null);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor).catch(() => null);
  const img = await page.evaluate(() => document.getElementById("pic")?.naturalWidth ?? 0).catch(() => 0);
  check(scenario, `${label}: entry, CSS, script and image of the export render`, h1 === `E2E ${user} report ${n}` && js === "js-ran" && bg === "rgb(1, 2, 3)" && img > 0, { h1, js, bg, img });
  await page.locator("#sub").click();
  await page.waitForLoadState("load");
  const subImg = await page.evaluate(() => document.querySelector("img")?.naturalWidth ?? 0).catch(() => 0);
  check(scenario, `${label}: relative subdirectory page and its ../ asset load`, new URL(page.url()).pathname.endsWith("/sub/page.html") && subImg > 0, { path: hide(new URL(page.url()).pathname), subImg });
}

async function main() {
  const browser = await chromium.launch({ args: ["--test-third-party-cookie-phaseout"] });
  const ctx = async (user) => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    if (user) await c.addCookies([{ name: "__Host-agent-host", value: sessions[user].cookie, url: `${APP}/`, secure: true, httpOnly: true, sameSite: "Lax" }]);
    return c;
  };
  const [A, B] = Object.keys(sessions);
  const [subA, subB] = [sessions[A].subject, sessions[B].subject];
  const alice = await ctx(A);
  const bob = await ctx(B);
  const stranger = await ctx();
  // A recipient whose browser sends and keeps no cookies at all.
  const noCookies = await ctx();
  await noCookies.route("**/*", async (route) => {
    const headers = { ...route.request().headers() };
    delete headers.cookie;
    const res = await route.fetch({ headers, maxRedirects: 0 });
    const out = { ...res.headers() };
    delete out["set-cookie"];
    await route.fulfill({ response: res, headers: out });
  });
  const [a1, a2] = views.alice;
  const [b1] = views.bob;

  // 1. Private reservation: one stable address, private, owner-only.
  let r = await ensure(A, a1);
  const addr = r.a;
  check("private", "owner ensure creates one private reservation", r.status === 200 && addr && !addr.public_until && /^https:\/\/[^/]+\/n\/[A-Za-z0-9_-]{43}$/.test(addr.url), { status: r.status, public_until: addr?.public_until ?? null });
  const again = await ensure(A, a1);
  check("private", "repeated ensure returns the same address", again.a?.url === addr.url && again.a?.address_id === addr.address_id, { same: again.a?.url === addr.url });
  const entry = addr.url;
  const contentURL = addr.content_url;
  r = await anon(entry);
  check("private", "anonymous GET of a private entry: app page, no redirect, secrecy headers", r.status === 200 && !r.h.location && headersOK(r.h), { status: r.status, ...secretHeaders(r.h) });
  check("private", "anonymous private entry page reveals neither title nor owner", !r.text.includes(`E2E ${A}`) && !r.text.includes(A), { titleLeak: r.text.includes(`E2E ${A}`) });
  const unknown = await anon(`${APP}/n/${"A".repeat(43)}`);
  check("private", "private and unknown entries are byte-identical to an anonymous browser", unknown.status === r.status && unknown.text === r.text, { unknown: unknown.status });
  if (contentURL) {
    r = await anon(contentURL);
    check("private", "anonymous content URL of a private address is refused", r.status === 404 || r.status === 401, { status: r.status, ...secretHeaders(r.h) });
  } else check("private", "private reply carries no content URL", true, { content_url: null });
  const wrong = await api(B, "POST", "/api/v1/view-addresses/open", { entry: new URL(entry).pathname.slice(3) });
  const none = await api(B, "POST", "/api/v1/view-addresses/open", { entry: "B".repeat(43) });
  check("private", "another signed-in person cannot resolve the private entry (same answer as unknown)", wrong.status === 404 && wrong.text === none.text, { wrong: wrong.status, unknown: none.status });
  const bobsList = await list(B);
  check("private", "the other person's list does not contain it", !bobsList.some((x) => x.address_id === addr.address_id), { bobAddresses: bobsList.length });
  // Owner's private open in the browser: product frame on the app origin.
  let page = await alice.newPage();
  await page.goto(entry);
  await page.getByTestId("view-open-page").waitFor();
  const frame = page.frameLocator("iframe");
  const h1 = await frame.locator("#h").textContent({ timeout: 30_000 }).catch(() => null);
  const js = await frame.locator("#js").textContent().catch(() => null);
  check("private", "owner opens the private entry: framed view with its multi-file export", new URL(page.url()).host === HOST && h1 === `E2E ${A} report 1` && js === "js-ran", { onApp: new URL(page.url()).host === HOST, h1, js });
  await page.close();
  page = await bob.newPage();
  await page.goto(entry);
  await page.getByTestId("view-open-page").waitFor();
  await sleep(3000);
  check("private", "the other person's browser sees no frame for it", (await page.locator("iframe").count()) === 0, { frames: await page.locator("iframe").count() });
  await page.close();
  // Sign-in from a private entry: provider URL and Referer carry no secret.
  page = await stranger.newPage();
  const seen = [];
  page.on("request", (req) => {
    if (!req.url().startsWith(APP)) seen.push({ url: req.url(), referer: req.headers().referer ?? "" });
  });
  await page.route("https://github.com/**", (route) => route.fulfill({ status: 200, body: "stub" }));
  await page.goto(entry);
  await page.getByTestId("view-sign-in").click();
  await page.waitForURL(/github\.com/, { timeout: 30_000 }).catch(() => {});
  const ent = new URL(entry).pathname.slice(3);
  const gh = seen.filter((s) => s.url.includes("github.com"));
  check("login", "sign-in from a private entry reaches the provider without the entry secret in URL or Referer", gh.length > 0 && gh.every((s) => !s.url.includes(ent) && !s.referer.includes(ent)), { providerRequests: gh.length, leaked: gh.filter((s) => s.url.includes(ent) || s.referer.includes(ent)).length });
  await page.close();

  // 2. Publish: anonymous recipients read through both URL forms.
  r = await publish(A, addr.address_id, 30);
  const pub = r.json?.address;
  if (pub?.content_url) remember(new URL(pub.content_url).pathname.split("/")[1], "<token:A:v1>");
  check("publish", "publish keeps the entry address", r.status === 200 && pub?.url === entry && !!pub?.public_until, { status: r.status, same: pub?.url === entry });
  r = await anon(entry);
  check("publish", "anonymous entry GET: 302 to the content host with secrecy headers", r.status === 302 && r.h.location === pub?.content_url && headersOK(r.h), { status: r.status, location: r.h.location, ...secretHeaders(r.h) });
  const r2 = await anon(entry);
  check("publish", "repeat entry GET is not served from the edge cache", r2.status === 302 && r2.h["cf-cache-status"] !== "HIT", { cf: r2.h["cf-cache-status"] ?? null });
  r = await anon(pub.content_url);
  check("publish", "content root redirects to the export's entry file, uncached", r.status === 302 && r.h.location?.endsWith("/index.html") && /no-store/.test(r.h["cache-control"] ?? "") && !r.h["set-cookie"], { status: r.status, location: r.h.location, ...secretHeaders(r.h) });
  r = await anon(`${pub.content_url}index.html`);
  check("publish", "content entry document: no-store, noindex, no cookie, sandbox CSP", r.status === 200 && /no-store/.test(r.h["cache-control"] ?? "") && /noindex/.test(r.h["x-robots-tag"] ?? "") && !r.h["set-cookie"] && /sandbox/.test(r.h["content-security-policy"] ?? "") && r.h["cf-cache-status"] !== "HIT", { status: r.status, ...secretHeaders(r.h), csp: /sandbox/.test(r.h["content-security-policy"] ?? "") });
  r = await anon(`${pub.content_url}assets/style.css`);
  check("publish", "a subresource is not edge-cached and sets no cookie", r.status === 200 && !r.h["set-cookie"] && r.h["cf-cache-status"] !== "HIT" && /no-store/.test(r.h["cache-control"] ?? ""), { status: r.status, ...secretHeaders(r.h) });
  r = await anon(entry, { method: "HEAD" });
  check("publish", "HEAD of the public entry redirects too", r.status === 302, { status: r.status });
  r = await anon(`${entry}?utm_source=x`);
  check("publish", "a decorated entry (query) redirects to the bare content URL", r.status === 302 && r.h.location === pub.content_url, { location: r.h.location });
  page = await stranger.newPage();
  await readsExport(page, "publish", "anonymous browser via entry URL", entry, A, 1);
  await page.close();
  page = await stranger.newPage();
  await readsExport(page, "publish", "anonymous browser via direct content URL", pub.content_url, A, 1);
  await page.close();
  page = await noCookies.newPage();
  await readsExport(page, "cookies", "recipient with cookies blocked", entry, A, 1);
  await page.close();
  page = await bob.newPage();
  await readsExport(page, "publish", "other signed-in person (public)", entry, A, 1);
  await page.close();
  page = await alice.newPage();
  await readsExport(page, "publish", "owner's own open of a public address", entry, A, 1);
  await page.close();
  // A second export of the same person is a separate, still private view.
  const second = await ensure(A, a2);
  r = await anon(second.a.url);
  check("publish", "a second export keeps its own private address", second.a.url !== entry && r.status === 200 && !r.h.location, { distinct: second.a.url !== entry, status: r.status });
  // Bob's own public view is served as his, beside Alice's.
  const bobAddr = (await ensure(B, b1)).a;
  const bp = (await publish(B, bobAddr.address_id, 1)).json?.address;
  if (bp?.content_url) remember(new URL(bp.content_url).pathname.split("/")[1], "<token:B:v1>");
  page = await stranger.newPage();
  await readsExport(page, "publish", "anonymous reads the second person's public view", bobAddr.url, B, 1);
  await page.close();
  // Duration changes without changing the address.
  r = await api(A, "POST", "/api/v1/view-addresses/duration", { address_id: addr.address_id, days: 7 });
  check("publish", "duration change keeps both URLs", r.status === 200 && r.json?.address?.url === entry && r.json?.address?.content_url === pub.content_url, { status: r.status });

  // 3. Restart: reservations and publications survive.
  guest("systemctl restart open-habitat-gateway && sleep 3 && systemctl is-active open-habitat-gateway");
  r = await anon(entry);
  const afterPriv = await anon(second.a.url);
  const mine = await list(A);
  check("restart", "after gateway restart the public entry still redirects and the private one stays private", r.status === 302 && r.h.location === pub.content_url && afterPriv.status === 200 && !afterPriv.h.location, { pub: r.status, priv: afterPriv.status });
  check("restart", "owner's list survives restart unchanged", mine.some((x) => x.address_id === addr.address_id && x.url === entry) && mine.some((x) => x.address_id === second.a.address_id), { count: mine.length });

  // 4. Owner makes private: both URL forms end, entry stays the owner's.
  r = await api(A, "POST", "/api/v1/view-addresses/private", { address_id: addr.address_id });
  const e1 = await anon(entry);
  const c1 = await anon(pub.content_url);
  check("owner-private", "after making private the entry no longer redirects and the content URL is refused", r.status === 200 && e1.status === 200 && !e1.h.location && (c1.status === 404 || c1.status === 401), { entry: e1.status, content: c1.status });
  page = await alice.newPage();
  await page.goto(entry);
  const ownH1 = await page.frameLocator("iframe").locator("#h").textContent({ timeout: 30_000 }).catch(() => null);
  check("owner-private", "owner still opens it privately through the same entry", ownH1 === `E2E ${A} report 1`, { h1: ownH1 });
  await page.close();
  // 5. Republish revives the earlier copies.
  r = await publish(A, addr.address_id, 30);
  const e2 = await anon(entry);
  const c2 = await anon(pub.content_url);
  check("republish", "republishing revives both earlier URLs unchanged", r.json?.address?.url === entry && r.json?.address?.content_url === pub.content_url && e2.status === 302 && c2.status === 302, { entry: e2.status, content: c2.status });

  // 6. Expiry: move the stored public-until into the past (gateway stopped).
  guest(`systemctl stop open-habitat-gateway && python3 - <<'EOF'
import json, os, datetime
p = "/var/lib/open-habitat-gateway/view-links.json"
st = os.stat(p); d = json.load(open(p))
for a in d["addresses"]:
    if a["id"] == "${addr.address_id}":
        c = datetime.datetime.fromisoformat(a["created"].replace("Z", "+00:00"))
        a["public_until"] = (c + datetime.timedelta(seconds=1)).isoformat().replace("+00:00", "Z")
t = p + ".e2e"; open(t, "w").write(json.dumps(d)); os.chown(t, st.st_uid, st.st_gid); os.chmod(t, 0o600); os.rename(t, p)
EOF
systemctl start open-habitat-gateway && sleep 3`);
  const e3 = await anon(entry);
  const c3 = await anon(pub.content_url);
  const expired = (await list(A)).find((x) => x.address_id === addr.address_id);
  check("expiry", "an expired publication: entry is the app page, content refused, reservation kept", e3.status === 200 && !e3.h.location && (c3.status === 404 || c3.status === 401) && expired?.url === entry, { entry: e3.status, content: c3.status, kept: expired?.url === entry, public_until: expired?.public_until ?? null });
  r = await publish(A, addr.address_id, 30);
  const e4 = await anon(entry);
  check("expiry", "republishing after expiry revives the same entry for 30 days", e4.status === 302 && e4.h.location === pub.content_url && r.json?.address?.public_until, { entry: e4.status });

  // 7. Site toggle: sharing off pauses publication, private opens still work.
  const confHash = guest("sha256sum /etc/open-habitat/gateway.json").split(" ")[0];
  guest(`cp -p /etc/open-habitat/gateway.json /root/gateway.json.before-e2e && python3 - <<'EOF'
import json, os
p = "/etc/open-habitat/gateway.json"; st = os.stat(p); d = json.load(open(p))
d["oauth"]["view_link_max_days"] = 0
t = p + ".e2e"; open(t, "w").write(json.dumps(d, indent=2) + "\\n"); os.chown(t, st.st_uid, st.st_gid); os.chmod(t, st.st_mode & 0o7777); os.rename(t, p)
EOF
systemctl restart open-habitat-gateway && sleep 3`);
  const e5 = await anon(entry);
  const c5 = await anon(pub.content_url);
  const offList = await api(A, "GET", "/api/v1/view-addresses");
  const offPub = await publish(A, second.a.address_id, 1);
  check("site-toggle", "sharing off: entry is the app page and content refused", e5.status === 200 && !e5.h.location && (c5.status === 404 || c5.status === 401), { entry: e5.status, content: c5.status });
  check("site-toggle", "sharing off: owner still lists addresses and cannot publish", offList.status === 200 && offPub.status === 409, { list: offList.status, publish: offPub.status, code: offPub.json?.error?.code });
  page = await alice.newPage();
  await page.goto(second.a.url);
  const offH1 = await page.frameLocator("iframe").locator("#h").textContent({ timeout: 30_000 }).catch(() => null);
  check("site-toggle", "sharing off: owner opens a private address", offH1 === `E2E ${A} report 2`, { h1: offH1 });
  await page.close();
  guest("cp -p /root/gateway.json.before-e2e /etc/open-habitat/gateway.json && systemctl restart open-habitat-gateway && sleep 3");
  const restored = guest("sha256sum /etc/open-habitat/gateway.json").split(" ")[0];
  const e6 = await anon(entry);
  check("site-toggle", "sharing back on: the unexpired publication works again; config bytes restored", e6.status === 302 && restored === confHash, { entry: e6.status, configRestored: restored === confHash });

  // 8. Owner deletion: permanent; a later reservation is fresh and private.
  const delTarget = second.a;
  await publish(A, delTarget.address_id, 1);
  const before = (await list(A)).find((x) => x.address_id === delTarget.address_id);
  if (before?.content_url) remember(new URL(before.content_url).pathname.split("/")[1], "<token:A:v2>");
  r = await api(A, "POST", "/api/v1/view-addresses/delete", { address_id: delTarget.address_id });
  const e7 = await anon(delTarget.url);
  const c7 = before?.content_url ? await anon(before.content_url) : { status: 404 };
  check("delete", "owner deletion ends both URLs", r.status === 204 && e7.status === 200 && !e7.h.location && c7.status === 404, { delete: r.status, entry: e7.status, content: c7.status });
  const ownDeleted = await api(A, "POST", "/api/v1/view-addresses/open", { entry: new URL(delTarget.url).pathname.slice(3) });
  check("delete", "the deleted entry no longer resolves even for its owner", ownDeleted.status === 404, { status: ownDeleted.status });
  const fresh = await ensure(A, a2);
  check("delete", "a new reservation for the same view gets a fresh private address", fresh.a?.url !== delTarget.url && !fresh.a?.public_until, { fresh: fresh.a?.url !== delTarget.url });

  // 9. Administrator revocation: Bob is made administrator by root.
  guest(`/opt/open-habitat/current/open-habitat admin role update ${subB} --administrator true --json >/dev/null`);
  const adm = await api(B, "GET", "/api/v1/server/view-publications");
  const rows = adm.json?.publications ?? adm.json?.items ?? [];
  const rowText = adm.text;
  check("admin", "administrator list shows publication metadata without secrets or private reservations", adm.status === 200 && !rowText.includes(new URL(entry).pathname.slice(3)) && !rowText.includes(pub.content_url.split("/")[3]) && !rowText.includes(fresh.a.address_id), { status: adm.status, rows: rows.length });
  r = await api(B, "POST", "/api/v1/server/view-publications/delete", { address_id: addr.address_id });
  const e8 = await anon(entry);
  const c8 = await anon(pub.content_url);
  const gone = !(await list(A)).some((x) => x.address_id === addr.address_id);
  check("admin", "administrator deletion ends both URLs and removes the owner's reservation", r.status === 204 && e8.status === 200 && !e8.h.location && c8.status === 404 && gone, { delete: r.status, entry: e8.status, content: c8.status, gone });
  const re = await ensure(A, a1);
  check("admin", "the owner's next reservation of that view is fresh and private (old URL stays dead)", re.a?.url !== entry && !re.a?.public_until && (await anon(entry)).status === 200, { fresh: re.a?.url !== entry });
  guest(`/opt/open-habitat/current/open-habitat admin role update ${subB} --administrator false --json >/dev/null`);

  // 10. Root subject revocation of Alice: sessions and every address go.
  await publish(A, re.a.address_id, 1);
  const pubRe = (await list(A)).find((x) => x.address_id === re.a.address_id);
  if (pubRe?.content_url) remember(new URL(pubRe.content_url).pathname.split("/")[1], "<token:A:v1-new>");
  guest(`/opt/open-habitat/current/open-habitat revoke subject ${subA} --json >/dev/null`);
  const e9 = await anon(re.a.url);
  const c9 = pubRe?.content_url ? await anon(pubRe.content_url) : { status: 404 };
  const sess = await api(A, "GET", "/api/v1/view-addresses");
  const store = guest(`python3 -c "import json;d=json.load(open('/var/lib/open-habitat-gateway/view-links.json'));print(sum(a['owner']['subject']=='${subA}' for a in d['addresses']))"`).trim();
  check("revocation", "root subject revocation ends sessions and deletes every address of the subject", e9.status === 200 && !e9.h.location && c9.status === 404 && sess.status === 401 && store === "0", { entry: e9.status, content: c9.status, session: sess.status, remaining: store });

  // 11. Withdrawal of Bob (runtime-admitted): addresses deleted.
  const bobPub = await anon(bobAddr.url);
  check("withdrawal", "before withdrawal Bob's public entry redirects", bobPub.status === 302, { status: bobPub.status });
  guest(`/opt/open-habitat/current/open-habitat admin access remove --github-id ${subB} --json >/dev/null`);
  const e10 = await anon(bobAddr.url);
  const c10 = bp?.content_url ? await anon(bp.content_url) : { status: 404 };
  const bobSess = await api(B, "GET", "/api/v1/view-addresses");
  const bobStore = guest(`python3 -c "import json;d=json.load(open('/var/lib/open-habitat-gateway/view-links.json'));print(sum(a['owner']['subject']=='${subB}' for a in d['addresses']))"`).trim();
  check("withdrawal", "withdrawal ends Bob's sessions and deletes his addresses", e10.status === 200 && !e10.h.location && c10.status === 404 && bobSess.status === 401 && bobStore === "0", { entry: e10.status, content: c10.status, session: bobSess.status, remaining: bobStore });

  await browser.close();
  // 12. Logs: no entry or content secret in the gateway journal, nor in
  // Alder's tunnel/forward journals for the run.
  const all = [...secrets.keys()];
  const pattern = all.join("|");
  const gw = guest(`journalctl -u open-habitat-gateway --since "-2h" --no-pager -o cat | grep -cE '${pattern}' || true`).trim();
  check("logs", "gateway journal holds no entry or content secret", gw === "0", { matches: gw, secretsChecked: all.length });
  const loginLog = guest(`journalctl -u open-habitat-gateway --since "-2h" --no-pager -o cat | grep -c 'return_to' || true`).trim();
  check("logs", "gateway journal holds no login return_to query", loginLog === "0", { matches: loginLog });
  console.log(JSON.stringify({ when: new Date().toISOString(), app: APP, secretsChecked: all.length, results }, null, 1));
  // The secrets, for grepping other hosts' logs, go only to a private file.
  if (process.env.OH_E2E_PATTERN_FILE) (await import("node:fs")).writeFileSync(process.env.OH_E2E_PATTERN_FILE, pattern, { mode: 0o600 });
}
main().catch((e) => {
  process.stderr.write(hide(e.stack ?? String(e)) + "\n");
  console.log(JSON.stringify({ error: hide(String(e)), results }, null, 1));
  process.exit(1);
});
