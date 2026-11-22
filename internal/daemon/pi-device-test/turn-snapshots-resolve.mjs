// Module hooks for turn-snapshots.test.mjs: the recorder's sources live in
// ../turn-snapshots, outside this package, and import the Pi SDK as the
// extension loader provides it. Resolve that one package from here.
export async function resolve(specifier, context, next) {
  if (specifier === '@earendil-works/pi-coding-agent' || specifier.startsWith('@earendil-works/pi-coding-agent/'))
    return next(specifier, { ...context, parentURL: import.meta.url });
  return next(specifier, context);
}
