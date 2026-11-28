// Attaches "zh-CN" (and, in this round, "zh-TW" as the same catalog) to a
// production catalog: the zh file's messages over US English. Reading a
// message the zh file lacks records it in window.__zhMissing, so the check
// can list what the screens showed in English. Production would refuse such
// a catalog at build time (design.md, "Täydellinen tai build kaatuu").

type Tree = Record<string, unknown>;
const missing = new Map<string, string>();
const read = new Set<string>();
(window as unknown as {__zhMissing: Map<string, string>}).__zhMissing = missing;
(window as unknown as {__zhRead: Set<string>}).__zhRead = read;

function merge(en: unknown, zh: unknown, path: string): unknown {
  if (!en || typeof en !== 'object' || Array.isArray(en)) return zh ?? en;
  const layer = (zh && typeof zh === 'object' ? zh : {}) as Tree;
  const base = en as Tree;
  const out: Tree = {};
  for (const key of Object.keys(base)) out[key] = merge(base[key], layer[key], `${path}.${key}`);
  // Map-like catalogs (`as Record<string, string>`) may carry extra keys.
  for (const key of Object.keys(layer)) if (!(key in out)) out[key] = layer[key];
  return new Proxy(out, {
    get(target, key, receiver) {
      if (typeof key === 'string' && key in target) {
        const full = `${path}.${key}`;
        read.add(full);
        const v = target[key];
        if ((typeof v === 'string' || typeof v === 'function') && !(key in layer)) missing.set(full, String(v));
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

export function attachZh(module: string, catalogs: Record<string, unknown>, zh: Tree) {
  for (const [name, c] of Object.entries(catalogs)) {
    if (!c || typeof c !== 'object' || !('en-US' in c)) continue;
    const cat = c as Tree;
    const value = merge(cat['en-US'], zh[name], `${module}#${name}`);
    cat['zh-CN'] = value;
    cat['zh-TW'] = value;
  }
}
