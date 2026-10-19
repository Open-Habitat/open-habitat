//go:build linux

package main

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"
)

// startFakeEditor stands in for code-server in the synthetic host: it serves
// dir/code-server.sock with a workbench page, a WebSocket echo (so the relay's
// upgrade path runs) and an extension socket in dir/open that records which
// file a link opened. It is the host's own child and ends with it.
func startFakeEditor(dir string) error {
	var mu sync.Mutex
	opened := ""
	ln, err := net.Listen("unix", filepath.Join(dir, "code-server.sock"))
	if err != nil {
		return err
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"alive"}`)
	})
	mux.HandleFunc("/fake-opened", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		w.Header().Set("Cache-Control", "no-store")
		fmt.Fprint(w, opened)
	})
	mux.HandleFunc("/fake.js", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/javascript")
		fmt.Fprint(w, `
const ws = new WebSocket("wss://" + location.host + "/ws");
ws.onopen = () => ws.send("ping");
ws.onmessage = (e) => { document.getElementById("socket").textContent = "yhteys: " + e.data; };
setInterval(async () => {
  const r = await fetch("/fake-opened", { cache: "no-store" });
  document.getElementById("opened").textContent = r.ok ? await r.text() : "";
}, 200);`)
	})
	mux.HandleFunc("/ws", fakeEcho)
	openSocket := filepath.Join(dir, "open", "open-"+strconv.Itoa(os.Getpid())+".sock")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		// Each window that loads activates the extension, as code-server's do.
		now := time.Now()
		_ = os.Chtimes(openSocket, now, now)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		folder := r.URL.Query().Get("folder")
		fmt.Fprintf(w, `<!doctype html><html lang="en"><title>Fake VS Code</title><main class="fake-workbench"><h1>Fake VS Code</h1><p id="folder">%s</p><textarea aria-label="Editor text"></textarea><p id="socket"></p><p id="opened"></p></main><script src="/fake.js"></script></html>`, html.EscapeString(filepath.Base(folder)))
	})
	go func() { _ = http.Serve(ln, mux) }()

	open, err := net.Listen("unix", openSocket)
	if err != nil {
		return err
	}
	go func() {
		for {
			c, err := open.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				line, err := bufio.NewReader(io.LimitReader(c, 8192)).ReadBytes('\n')
				if err != nil {
					return
				}
				var req struct {
					Path    string `json:"path"`
					Line    int    `json:"line"`
					EndLine int    `json:"end_line"`
				}
				if json.Unmarshal(line, &req) != nil {
					return
				}
				mu.Lock()
				opened = fmt.Sprintf("%s:%d", filepath.Base(req.Path), req.Line)
				if req.EndLine > req.Line {
					opened += fmt.Sprintf("-%d", req.EndLine)
				}
				mu.Unlock()
				fmt.Fprint(c, `{"opened":true}`+"\n")
			}(c)
		}
	}()
	return nil
}

// fakeEcho answers each short text frame with "pong".
func fakeEcho(w http.ResponseWriter, r *http.Request) {
	key := r.Header.Get("Sec-WebSocket-Key")
	if r.Header.Get("Upgrade") != "websocket" || key == "" {
		http.Error(w, "upgrade required", 426)
		return
	}
	conn, rw, err := http.NewResponseController(w).Hijack()
	if err != nil {
		return
	}
	defer conn.Close()
	sum := sha1.Sum([]byte(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	fmt.Fprintf(rw, "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n", base64.StdEncoding.EncodeToString(sum[:]))
	_ = rw.Flush()
	for {
		head := make([]byte, 2)
		if _, err := io.ReadFull(rw, head); err != nil {
			return
		}
		n := int(head[1] & 0x7f)
		if n == 126 {
			ext := make([]byte, 2)
			if _, err := io.ReadFull(rw, ext); err != nil {
				return
			}
			n = int(binary.BigEndian.Uint16(ext))
		} else if n == 127 {
			return
		}
		mask := make([]byte, 4)
		payload := make([]byte, n)
		if _, err := io.ReadFull(rw, mask); err != nil {
			return
		}
		if _, err := io.ReadFull(rw, payload); err != nil {
			return
		}
		if head[0]&0x0f == 0x8 {
			return
		}
		_, _ = rw.Write([]byte{0x81, 4, 'p', 'o', 'n', 'g'})
		if rw.Flush() != nil {
			return
		}
	}
}
