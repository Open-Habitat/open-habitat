// Names the server on the static loading landing before the bundle runs; no
// inline script or CSP exception needed. It is a classic script right after
// the landing's markup, not deferred, so it never waits behind the bundle.
// components/Landing.tsx takes over once the bundle runs.
(() => {
  const server = document.getElementById("ah-landing-server");
  if (server) server.textContent = location.hostname;
})();
