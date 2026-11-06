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
  if (language === "en") language = "en-GB";
  if (!["fi", "en-US", "en-GB"].includes(language)) {
    const first = navigator.languages?.[0] || navigator.language || "";
    language = /^fi(-|$)/i.test(first)
      ? "fi"
      : /^en-GB(-|$)/i.test(first)
        ? "en-GB"
        : "en-US";
  }
  const text = {
    fi: {
      connecting: "Yhdistetään palvelimeen…",
      slow: "Yhdistäminen kestää tavallista pidempään. Odotetaan yhä; voit jättää sivun auki.",
    },
    en: {
      connecting: "Connecting to the server…",
      slow: "Connecting is taking longer than usual. Still waiting; you can leave the page open.",
    },
  }[language === "fi" ? "fi" : "en"];
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
