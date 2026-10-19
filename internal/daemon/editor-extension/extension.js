// Open Habitat's built-in code-server extension. A file link in a
// conversation reaches the person's daemon, which has already resolved it
// inside a workspace; the daemon then asks this extension, over a Unix socket
// in its own 0700 runtime directory, to show the file at a line in the running
// window. The extension host runs as the person, so the socket carries no
// authority the person does not already have. It never reads the file or
// reports anything back except whether the editor showed it.
//
// Each extension host (one per open window) listens on its own socket, named
// by its process ID, and touches it when its window gains focus; the daemon
// tries the most recently touched first.
"use strict";

const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const vscode = require("vscode");

const MAX_REQUEST = 8192;

function activate(context) {
  const dir = process.env.OPEN_HABITAT_EDITOR_OPEN_DIR;
  if (!dir || !path.isAbsolute(dir)) return;
  const socket = path.join(dir, `open-${process.pid}.sock`);
  try {
    fs.unlinkSync(socket);
  } catch {}
  const server = net.createServer((conn) => {
    let buffer = "";
    conn.setEncoding("utf8");
    conn.setTimeout(5000, () => conn.destroy());
    conn.on("error", () => conn.destroy());
    conn.on("data", (chunk) => {
      buffer += chunk;
      if (buffer.length > MAX_REQUEST) return conn.destroy();
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      conn.pause();
      show(buffer.slice(0, end)).then(
        (opened) => conn.end(`${JSON.stringify({ opened })}\n`),
        () => conn.end('{"opened":false}\n'),
      );
    });
  });
  server.on("error", () => {});
  server.listen(socket, () => {
    try {
      fs.chmodSync(socket, 0o600);
    } catch {}
  });
  const touch = () => {
    const now = new Date();
    try {
      fs.utimesSync(socket, now, now);
    } catch {}
  };
  if (vscode.window.state.focused) touch();
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) touch();
    }),
    {
      dispose() {
        server.close();
        try {
          fs.unlinkSync(socket);
        } catch {}
      },
    },
  );
}

async function show(line) {
  const request = JSON.parse(line);
  if (
    typeof request.path !== "string" ||
    !path.isAbsolute(request.path) ||
    path.normalize(request.path) !== request.path
  )
    return false;
  const first = positive(request.line);
  const last = Math.max(first, positive(request.end_line));
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(request.path),
  );
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
  });
  if (first > 0) {
    const from = Math.min(first, document.lineCount) - 1;
    const to = Math.min(last, document.lineCount) - 1;
    const range = new vscode.Range(
      from,
      0,
      to,
      document.lineAt(to).range.end.character,
    );
    editor.selection = new vscode.Selection(range.start, range.start);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    if (to > from) editor.selection = new vscode.Selection(range.start, range.end);
  }
  return true;
}

function positive(value) {
  return Number.isInteger(value) && value > 0 && value < 10_000_000 ? value : 0;
}

function deactivate() {}

module.exports = { activate, deactivate };
