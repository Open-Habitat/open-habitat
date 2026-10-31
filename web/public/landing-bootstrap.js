// Names the server on the static loading landing before the bundle runs; no
// inline script or CSP exception needed. It is a classic script right after
// the landing's markup, not deferred, so it never waits behind the bundle.
// A bundle still loading after 8 s gets the same slow line as the app's
// landing. components/Landing.tsx takes over once the bundle runs.
// The landing speaks the language of the last load (src/i18n remembers it
// as nah:language), else the browser's: Finnish for fi*, else English. The
// texts match text/landing.ts.
(() => {
  let language;
  try {
    language = localStorage.getItem("nah:language");
  } catch {
    /* Storage may be disabled. */
  }
  if (language !== "fi" && language !== "en")
    language = /^fi(-|$)/i.test(
      navigator.languages?.[0] || navigator.language || "",
    )
      ? "fi"
      : "en";
  const text = {
    fi: {
      connecting: "Yhdistetään palvelimeen…",
      slow: "Palvelin vastaa tavallista hitaammin. Odotetaan yhä; voit jättää sivun auki.",
    },
    en: {
      connecting: "Connecting to the server…",
      slow: "The server is answering more slowly than usual. Still waiting; you can leave the page open.",
    },
  }[language];
  document.documentElement.lang = language;
  const say = document.querySelector(
    '.ah-landing[data-landing="static"] .ah-landing-say',
  );
  if (say) say.textContent = text.connecting;
  const server = document.getElementById("ah-landing-server");
  if (server) server.textContent = location.hostname;
  setTimeout(
    () => {
      const more = document.querySelector(
        '.ah-landing[data-landing="static"] .ah-landing-more',
      );
      if (!more?.isConnected || more.childElementCount) return;
      const line = document.createElement("p");
      line.textContent = text.slow;
      more.append(line);
    },
    Math.max(0, 8000 - performance.now()),
  );
})();
