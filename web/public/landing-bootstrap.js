// Names the server on the static loading landing before the bundle runs; no
// inline script or CSP exception needed. It is a classic script right after
// the landing's markup, not deferred, so it never waits behind the bundle.
// A bundle still loading after 8 s gets the same slow line as the app's
// landing. components/Landing.tsx takes over once the bundle runs.
(() => {
  const server = document.getElementById("ah-landing-server");
  if (server) server.textContent = location.hostname;
  setTimeout(
    () => {
      const more = document.querySelector(
        '.ah-landing[data-landing="static"] .ah-landing-more',
      );
      if (!more?.isConnected || more.childElementCount) return;
      const line = document.createElement("p");
      line.textContent =
        "Palvelin vastaa tavallista hitaammin. Odotetaan yhä; voit jättää sivun auki.";
      more.append(line);
    },
    Math.max(0, 8000 - performance.now()),
  );
})();
