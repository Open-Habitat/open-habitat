// The editor origin's frame page. It runs on the editor host inside the app's
// frame and holds code-server's workbench in a frame of its own origin, so it
// can see the keys pressed in the workbench before VS Code does. It talks to
// the app only by postMessage, to the app origin named by the gateway, and
// accepts messages only from that origin and its own parent.
//
// Messages to the app: need-token, starting, ready, failed, toggle.
// Messages from the app: token (a one-time hand-off), focus.
"use strict";

(() => {
  const app = document.querySelector('meta[name="oh-app-origin"]').content;
  const workspace = new URLSearchParams(location.search).get("workspace_id");
  const frame = document.getElementById("editor");
  const post = (message) =>
    parent.postMessage({ source: "open-habitat-editor", ...message }, app);
  let waiting = null;

  window.addEventListener("message", (event) => {
    if (event.origin !== app || event.source !== parent) return;
    const message = event.data;
    if (!message || message.source !== "open-habitat") return;
    if (message.type === "token" && typeof message.token === "string") {
      if (waiting) waiting(message.token);
      waiting = null;
    }
    if (message.type === "focus") {
      frame.focus();
      try {
        frame.contentWindow.focus();
      } catch {}
    }
  });

  const askToken = () =>
    new Promise((resolve) => {
      waiting = resolve;
      post({ type: "need-token" });
      setTimeout(() => {
        if (waiting === resolve) {
          waiting = null;
          resolve("");
        }
      }, 10000);
    });

  // true: a valid editor session; false: none; null: the host did not say.
  const session = async () => {
    try {
      const res = await fetch("/_open-habitat/session", { cache: "no-store" });
      return res.status === 204 ? true : res.status === 401 ? false : null;
    } catch {
      return null;
    }
  };

  const handoff = async () => {
    const token = await askToken();
    if (!token) return false;
    try {
      const res = await fetch("/_open-habitat/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      return res.status === 204;
    } catch {
      return false;
    }
  };

  // Ctrl+Alt+K (⌘⌥K) belongs to the app: it moves between the editor and
  // the conversation. Every other key stays VS Code's.
  const onKey = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.code === "KeyK") {
      event.preventDefault();
      event.stopImmediatePropagation();
      post({ type: "toggle" });
    }
  };
  window.addEventListener("keydown", onKey, true);
  frame.addEventListener("load", () => {
    try {
      frame.contentWindow.addEventListener("keydown", onKey, true);
    } catch {}
    post({ type: "ready" });
  });

  const boot = async () => {
    if (!workspace) return post({ type: "failed", reason: "workspace" });
    if ((await session()) !== true && !(await handoff()))
      return post({ type: "failed", reason: "session" });
    post({ type: "starting" });
    let started = false;
    try {
      const res = await fetch("/_open-habitat/start", { method: "POST" });
      started = res.ok;
    } catch {}
    if (!started) return post({ type: "failed", reason: "start" });
    frame.src = `/_open-habitat/workspace?workspace_id=${encodeURIComponent(workspace)}`;
  };

  // An editor session ends with the app session, a gateway restart or its
  // own lifetime; code-server reconnects by itself once a new one exists.
  setInterval(async () => {
    if ((await session()) === false) await handoff();
  }, 30000);

  void boot();
})();
