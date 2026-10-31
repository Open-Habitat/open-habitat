// Open Habitat's service worker, for phone notifications only
// (experimental push-when-your-turn). It caches nothing and handles no
// fetch: the page works exactly as without it.
//
// The person's daemon sends the message, encrypted to this device; the
// payload (contracts/v1/push-notifications.schema.json#/$defs/payload) has
// no message text, only what kind of turn it is, the names and where a tap
// leads. The words are here because the worker runs without the app.
const words = {
  fi: {
    turn: "odottaa sinua",
    question: "kysyy sinulta",
    test: "Testi-ilmoitus",
    testBody: "Ilmoitukset toimivat tällä laitteella.",
    conversation: "Keskustelu",
  },
  en: {
    turn: "is waiting for you",
    question: "has a question for you",
    test: "Test notification",
    testBody: "Notifications work on this device.",
    conversation: "Conversation",
  },
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

function text(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

// Every push shows a notification, also while a window is open: Safari
// revokes a subscription whose push showed nothing, silently. The daemon
// already left out turns the person was in front of.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const w = words[data.lang === "en" ? "en" : "fi"];
  const url =
    typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/";
  let title;
  let body;
  if (data.kind === "test") {
    title = w.test;
    body = w.testBody;
  } else {
    const name = text(data.title, 160) || w.conversation;
    title = text(data.workspace, 80) || "Open Habitat";
    body = `${name} ${data.kind === "question" ? w.question : w.turn}`;
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: text(data.tag, 64) || "open-habitat",
      icon: "/apple-touch-icon.png",
      badge: "/apple-touch-icon.png",
      data: { url },
    }),
  );
});

function routed(client, url) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), 1500);
    channel.port1.onmessage = () => {
      clearTimeout(timer);
      resolve(true);
    };
    client.postMessage({ type: "open-habitat.open", url }, [channel.port2]);
  });
}

// A tap opens the conversation in a window already open when there is one,
// and only otherwise a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url;
  const target = new URL(
    typeof path === "string" && path.startsWith("/") ? path : "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const own = windows.find(
        (c) => new URL(c.url).origin === self.location.origin,
      );
      if (own) {
        await own.focus();
        // The page routes it itself (push.ts), without reloading the app;
        // a page that does not answer is navigated instead.
        if (await routed(own, target)) return;
        try {
          if (await own.navigate(target)) return;
        } catch {
          // Not controlled by this worker: it cannot be navigated from here.
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
