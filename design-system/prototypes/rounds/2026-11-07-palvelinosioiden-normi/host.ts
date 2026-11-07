import integrationsExample from '../../../../contracts/v1/examples/integrations.json';
import serverIntegrationsExample from '../../../../contracts/v1/examples/server-integrations.json';
import onboardingExample from '../../../../contracts/v1/examples/server-onboarding-site-key.json';
import copiesExample from '../../../../contracts/v1/examples/server-onboarding-site-key-copies.json';
import viewAddressesExample from '../../../../contracts/v1/examples/view-addresses.json';
import publicationsExample from '../../../../contracts/v1/examples/server-view-publications.json';
import speechKeyExample from '../../../../contracts/v1/examples/server-speech-key.json';

// The host stand-in: Contoso in its first week, six people, a 500 GiB home
// disk and 32 GiB of memory. Both today's production sections and the
// directions read the same state through the same routes, and the writes
// change it, so a stepper or a limit field behaves as on the server.
export const GiB = 1024 ** 3;
export type Person = {id: string; username: string; hint: string; admin: boolean; source: string; state: string; usage: number; disk: number | null; live: number | null};
const PEOPLE0: Person[] = [
  {id: '1000', username: 'aino', hint: 'aino-contoso', admin: true, source: 'operator', state: 'joined', usage: 14.2, disk: 40, live: 6},
  {id: '1001', username: 'maintainer', hint: 'maintainer', admin: true, source: 'site_admin', state: 'joined', usage: 6.8, disk: null, live: null},
  {id: '1002', username: 'anna', hint: 'anna-contoso', admin: false, source: 'site_admin', state: 'joined', usage: 18.4, disk: null, live: null},
  {id: '1003', username: 'mikko', hint: 'mikkok', admin: false, source: 'site_admin', state: 'joined', usage: 1.4, disk: null, live: 2},
  {id: '1004', username: 'sanna', hint: 'sanna-l', admin: false, source: 'site_admin', state: 'joined', usage: 0.6, disk: null, live: null},
  {id: '1005', username: '', hint: 'liisa-contoso', admin: false, source: 'site_admin', state: 'allowed', usage: 0, disk: null, live: null},
];
const fresh = () => ({
  people: PEOPLE0.map((p) => ({...p})),
  name: 'Contoso',
  language: 'fi' as string,
  defaultDisk: 20,
  defaultLive: 4 as number | null,
});
export const HOST = {
  limits: 'enforced' as 'enforced' | 'not_in_use',
  diskGiB: 500,
  freeGiB: 420,
  memoryGiB: 32,
  availableGiB: 21,
  childBytes: 600 * 1024 ** 2,
  hostDefaultLive: 4,
  maxLive: 128,
  ...fresh(),
  reset() { Object.assign(HOST, fresh()); },
};
export const joined = () => HOST.people.filter((p) => p.username);
export const diskLimit = (p: Person) => p.disk ?? HOST.defaultDisk;
export const liveLimit = (p: Person) => p.live ?? HOST.defaultLive ?? HOST.hostDefaultLive;

const at = '2026-11-06T09:30:00Z';
const access = () => ({
  schema_version: 1, mode: 'allowlist', runtime_admission: true, teams: [],
  entries: HOST.people.map((p) => ({
    id: p.id, source: p.source, state: p.state, ...(p.username ? {username: p.username} : {}), login_hint: p.hint,
    ...(p.source === 'site_admin' ? {actor: '1000', at} : {}), ...(p.state === 'joined' ? {last_seen: at} : {}),
    administrator: p.admin, denied: false,
    ...(p.admin ? {administrator_role: {source: p.source === 'operator' ? 'operator' : 'site_admin', state: 'granted', ...(p.source === 'operator' ? {} : {actor: '1000', at})}} : {}),
  })),
});
// Google set in the browser, Dropbox by the operator, Microsoft 365 not yet.
const providers = integrationsExample.providers.map((p) =>
  p.id === 'google' ? {id: p.id, available: true, login: p.login, services: p.services}
  : p.id === 'microsoft' ? {id: p.id, available: false, unavailable_reason: 'app_credentials_required', login: p.login, services: p.services}
  : p);
export const storage = () => {
  const users = joined().map((p) => ({id: p.id, username: p.username, administrator: p.admin, usage_bytes: Math.round(p.usage * GiB), limit_bytes: diskLimit(p) * GiB, unavailable: false}));
  const sum = users.reduce((s, u) => s + u.limit_bytes, 0);
  return {
    schema_version: 1, limits: HOST.limits,
    overcommitted: HOST.limits === 'not_in_use' ? null : sum > HOST.diskGiB * GiB,
    users: HOST.limits === 'not_in_use' ? [] : users,
    filesystem: {capacity_bytes: HOST.diskGiB * GiB, free_bytes: HOST.freeGiB * GiB},
  };
};
export const conversations = () => ({
  schema_version: 1, default_limit: HOST.defaultLive, host_default: HOST.hostDefaultLive, max_limit: HOST.maxLive,
  child_bytes: HOST.childBytes, memory: {total_bytes: HOST.memoryGiB * GiB, available_bytes: HOST.availableGiB * GiB},
  people: joined().filter((p) => p.live !== null).map((p) => ({id: p.id, limit: p.live!})),
});
const copies = () => ({...copiesExample, people: joined().map((p, i) => ({
  id: p.id, login_hint: p.hint, username: p.username,
  ...(i < 4 ? {copy: {provider: 'anthropic', suffix: 'Xa1b', at: '2026-11-04T09:05:00Z', current: true}} : {}),
})), waiting: 1});

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function installHost() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, 'http://prototype.test/').pathname;
    if (!path.startsWith('/api/')) return realFetch(input, init);
    await later(40);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (method === 'PUT' && path === '/api/v1/server/conversations') {
      if (body.subject) { const p = HOST.people.find((q) => q.id === body.subject); if (p) p.live = body.limit; }
      else HOST.defaultLive = body.limit;
      return json(conversations());
    }
    if (method === 'PUT' && path === '/api/v1/server/storage') {
      const p = HOST.people.find((q) => q.id === body.subject); if (p) p.disk = body.limit_bytes / GiB;
      return json({schema_version: 1});
    }
    if (method === 'PUT' && path === '/api/v1/server/administration') {
      if ('name' in body) HOST.name = body.name;
      if ('default_limit_bytes' in body) HOST.defaultDisk = body.default_limit_bytes / GiB;
      if ('default_language' in body) HOST.language = body.default_language;
      return json({schema_version: 1});
    }
    if (path === '/api/v1/server') return json({schema_version: 1, name: HOST.name, administrator: true, version: '0.44.0', commit: '1def125b6d0c4e2f9a8b7c6d5e4f3a2b1c0d9e8f'});
    if (path === '/api/v1/server/administration')
      return json({schema_version: 1, name: HOST.name, default_language: HOST.language, default_limit_bytes: HOST.defaultDisk * GiB,
        users: joined().map(({id, username, admin}) => ({id, username, administrator: admin}))});
    if (path === '/api/v1/server/storage') return json(storage());
    if (path === '/api/v1/server/conversations') return json(conversations());
    if (path === '/api/v1/server/access') return json(access());
    if (path === '/api/v1/server/view-publications') return json({...publicationsExample, publications: publicationsExample.publications.map((p) => ({...p, username: 'anna', title: 'Tarjouslaskuri'}))});
    if (path === '/api/v1/server/integrations') return json({...serverIntegrationsExample});
    if (path === '/api/v1/integrations') return json({...integrationsExample, providers, accounts: []});
    if (path === '/api/v1/server/onboarding') return json({...onboardingExample, repositories: {mode: 'preselected', defaults: ['contoso/tarjoukset', 'contoso/ohjeet']}, integrations: [{provider: 'google', required: false}]});
    if (path === '/api/v1/server/onboarding/ai-key/copies') return json(copies());
    if (path === '/api/v1/server/speech-key') return json(speechKeyExample);
    if (path === '/api/v1/view-addresses') return json(viewAddressesExample);
    if (path === '/api/v1/account/git-identity')
      return json({schema_version: 1, name: 'Jari Mustonen', email: 'jari@example.test', source: '~/.gitconfig', suggested_name: 'Jari Mustonen', suggested_email: 'jari@example.test', emails: ['jari@example.test']});
    return new Response('', {status: 404});
  };
}
