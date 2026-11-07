// The host stand-in for Palvelimen ylläpito › Levytila and Keskustelut:
// Contoso, six joined people, a 500 GiB home disk and 32 GiB of memory.
// Today's production sections read it through their own routes and the
// writes change it, so steppers and Oletukseen behave as on the server.
// maintainer's own 30 GiB disk limit is the row in Jari's screenshot.
export const GiB = 1024 ** 3;
type Person = {id: string; username: string; admin: boolean; usage: number; disk: number | null; live: number | null};
const PEOPLE0: Person[] = [
  {id: '1000', username: 'aino', admin: true, usage: 14.2, disk: 40, live: 6},
  {id: '1001', username: 'maintainer', admin: true, usage: 9.54, disk: 30, live: null},
  {id: '1002', username: 'anna', admin: false, usage: 18.4, disk: null, live: null},
  {id: '1003', username: 'mikko', admin: false, usage: 1.4, disk: null, live: 2},
  {id: '1004', username: 'sanna', admin: false, usage: 0.6, disk: 10, live: null},
  {id: '1005', username: 'liisa', admin: false, usage: 3.1, disk: null, live: 8},
];
const fresh = () => ({people: PEOPLE0.map((p) => ({...p})), defaultDisk: 20, defaultLive: 4 as number | null});
export const HOST = {diskGiB: 500, freeGiB: 420, memoryGiB: 32, availableGiB: 21, childBytes: 600 * 1024 ** 2, hostDefaultLive: 4, maxLive: 128, ...fresh(),
  reset() { Object.assign(HOST, fresh()); }};
const diskLimit = (p: Person) => p.disk ?? HOST.defaultDisk;
const storage = () => {
  const users = HOST.people.map((p) => ({id: p.id, username: p.username, administrator: p.admin, usage_bytes: Math.round(p.usage * GiB), limit_bytes: diskLimit(p) * GiB, unavailable: false}));
  const sum = users.reduce((s, u) => s + u.limit_bytes, 0);
  return {schema_version: 1, limits: 'enforced', overcommitted: sum > HOST.diskGiB * GiB, users,
    filesystem: {capacity_bytes: HOST.diskGiB * GiB, free_bytes: HOST.freeGiB * GiB}};
};
const conversations = () => ({
  schema_version: 1, default_limit: HOST.defaultLive, host_default: HOST.hostDefaultLive, max_limit: HOST.maxLive,
  child_bytes: HOST.childBytes, memory: {total_bytes: HOST.memoryGiB * GiB, available_bytes: HOST.availableGiB * GiB},
  people: HOST.people.filter((p) => p.live !== null).map((p) => ({id: p.id, limit: p.live!})),
});
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
      const p = HOST.people.find((q) => q.id === body.subject); if (p) p.disk = body.limit_bytes / GiB === HOST.defaultDisk ? null : body.limit_bytes / GiB;
      return json({schema_version: 1});
    }
    if (method === 'PUT' && path === '/api/v1/server/administration') {
      if ('default_limit_bytes' in body) HOST.defaultDisk = body.default_limit_bytes / GiB;
      return json({schema_version: 1});
    }
    if (path === '/api/v1/server/administration')
      return json({schema_version: 1, name: 'Contoso', default_language: 'fi', default_limit_bytes: HOST.defaultDisk * GiB,
        users: HOST.people.map(({id, username, admin}) => ({id, username, administrator: admin}))});
    if (path === '/api/v1/server/storage') return json(storage());
    if (path === '/api/v1/server/conversations') return json(conversations());
    return new Response('', {status: 404});
  };
}
