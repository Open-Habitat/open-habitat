//go:build linux

package cli

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/browserhost"
	"github.com/open-habitat/open-habitat/internal/wsframe"
)

func TestBrowserActionValidationBeforeConnection(t *testing.T) {
	id := strings.Repeat("A", 32)
	for _, args := range [][]string{
		{"text"}, {"goto", "--tab", ""}, {"click", "--tab", id, "--selector", " "},
		{"text", "--tab", id, "--tab", id}, {"text", "--tab", id, "--timeout-seconds", "0"},
		{"tabs", "--tab", id}, {"close", "--tab", "bad"}, {"download", "--tab", id, "--name", "../secret"},
		{"screenshot", "--tab", id, "--name", ".."}, {"type", "--tab", id, "--selector", "input"},
	} {
		if _, err := parseBrowserAction(args); err == nil {
			t.Errorf("accepted %v", args)
		}
	}
	for _, args := range [][]string{{"goto", "file:///etc/passwd"}, {"download", "https://user:secret@example.invalid"}, {"eval", " "}} {
		if _, err := agentBrowserAction(args); err == nil {
			t.Errorf("accepted %v", args)
		}
	}
}

func TestBrowserActionsRespectFeatureAndPersonControl(t *testing.T) {
	for _, tc := range []struct {
		st   browserConnectionInfo
		code string
	}{
		{browserConnectionInfo{State: "running", Control: "agent"}, "browser_feature_off"},
		{browserConnectionInfo{Enabled: true, State: "running", Control: "person"}, "browser_person_control"},
	} {
		_, err := executeBrowserAction(browserAction{verb: "tabs"}, tc.st)
		var cli *cliError
		if !errors.As(err, &cli) || cli.code != tc.code {
			t.Fatalf("got %v, want %s before any connection", err, tc.code)
		}
	}
}

func TestBrowserFilesNeverOverwrite(t *testing.T) {
	dir := t.TempDir()
	if _, err := saveBrowserFile(dir, "original.pdf", []byte("original")); err != nil {
		t.Fatal(err)
	}
	if _, err := saveBrowserFile(dir, "original.pdf", []byte("replacement")); err == nil {
		t.Fatal("overwrote existing file")
	}
	if err := os.Symlink("original.pdf", filepath.Join(dir, "link.pdf")); err != nil {
		t.Fatal(err)
	}
	if _, err := saveBrowserFile(dir, "link.pdf", []byte("replacement")); err == nil {
		t.Fatal("followed output symlink")
	}
	b, _ := os.ReadFile(filepath.Join(dir, "original.pdf"))
	if string(b) != "original" {
		t.Fatalf("changed %s", b)
	}
	st, _ := os.Stat(filepath.Join(dir, "original.pdf"))
	if st.Mode().Perm() != 0600 {
		t.Fatal(st.Mode())
	}
}

func TestBrowserSkillPrintInstall(t *testing.T) {
	var raw, stderr bytes.Buffer
	if code := Run([]string{"skill", "print", "browser"}, &raw, &stderr); code != 0 {
		t.Fatal(code, stderr.String())
	}
	target := t.TempDir()
	if code, _, msg := call(t, "skill", "install", "browser", "--target", target, "--json"); code != 0 {
		t.Fatal(code, msg)
	}
	for _, path := range []string{".claude/skills/browser/SKILL.md", ".pi/agent/skills/browser/SKILL.md", ".codex/skills/browser/SKILL.md"} {
		b, err := os.ReadFile(filepath.Join(target, path))
		if err != nil || string(b) != raw.String() {
			t.Fatal(path, err)
		}
	}
}

// Opt-in native evidence: the production browser host/multiplexer and CLI action
// implementations, a synthetic signed-in site, and real sandboxed Chromium.
// The display stand-in is sufficient because Chrome runs headless; this proves
// CDP, load waits and original downloads, not VNC or installed UID isolation.
func TestBrowserActionsNative(t *testing.T) {
	chrome := os.Getenv("OH_BROWSER_ACTION_CHROME")
	if chrome == "" {
		t.Skip("set OH_BROWSER_ACTION_CHROME to a sandboxed Chromium executable")
	}
	root := t.TempDir()
	display := filepath.Join(root, "display")
	if err := os.WriteFile(display, []byte("#!/usr/bin/python3\nimport os,socket,sys,time\ns=socket.socket(socket.AF_UNIX)\ns.bind(sys.argv[sys.argv.index('-rfbunixpath')+1])\ns.listen()\nos.write(3,b'99\\n')\ntime.sleep(120)\n"), 0700); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	dir := filepath.Join(root, "host")
	done := make(chan error, 1)
	go func() {
		done <- browserhost.Run(ctx, browserhost.Config{Dir: dir, Xvnc: display, Xkbcomp: "/usr/bin/true", Chrome: chrome, Profile: filepath.Join(root, "profile"), Cache: filepath.Join(root, "cache"), Idle: time.Hour, Width: 1280, Height: 800, Env: os.Environ(), ChromeArgs: []string{"--headless=new"}, Log: slog.New(slog.NewTextHandler(io.Discard, nil))})
	}()
	defer func() {
		cancel()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Error("browser did not stop")
		}
	}()
	st := browserConnectionInfo{Enabled: true, State: "running", Control: "agent", Socket: filepath.Join(dir, browserhost.CDPSocket), Path: "/devtools/browser", Downloads: filepath.Join(root, "profile", "Downloads")}
	// Readiness polling observes a socket, never substitutes for navigation load.
	for {
		if _, err := os.Stat(st.Socket); err == nil {
			break
		}
		select {
		case err := <-done:
			done <- err
			t.Fatal(err)
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		case <-time.After(20 * time.Millisecond):
		}
	}
	release := make(chan struct{})
	requested := make(chan struct{}, 1)
	clickRelease := make(chan struct{})
	clickRequested := make(chan struct{}, 2)
	pdf := append([]byte("%PDF-1.4\n"), bytes.Repeat([]byte{0, 1, 127, 128, 255, '\n'}, 40000)...)
	pdf = append(pdf, []byte("\n%%EOF\n")...)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			http.SetCookie(w, &http.Cookie{Name: "signed", Value: "yes", Path: "/"})
			io.WriteString(w, `<!doctype html><title>Fixture</title><a id="next" href="/redirect">Next</a><a id="receipt" href="/receipt.pdf">Receipt</a><svg><a href="/receipt.pdf"><text>SVG receipt</text></a></svg><input name="query"><input type="number" value="42"><button id="apply" onclick="document.querySelector('#result').textContent=document.querySelector('input').value;window.activated=navigator.userActivation.isActive">Apply</button><p id="result"></p><img src="/held">`)
		case "/redirect":
			io.WriteString(w, `<!doctype html><script>location.replace('/final')</script><img src="/never">`)
		case "/never":
			<-r.Context().Done()
		case "/final":
			io.WriteString(w, `<!doctype html><title>Redirected</title><p>Final page</p><img src="/click-held">`)
		case "/click-held":
			clickRequested <- struct{}{}
			select {
			case <-clickRelease:
			case <-r.Context().Done():
			}
			w.WriteHeader(204)
		case "/held":
			requested <- struct{}{}
			select {
			case <-release:
			case <-r.Context().Done():
			}
			w.WriteHeader(204)
		case "/receipt.pdf":
			cookie, err := r.Cookie("signed")
			if err != nil || cookie.Value != "yes" {
				w.WriteHeader(401)
				return
			}
			w.Header().Set("Content-Type", "application/pdf")
			w.Write(pdf)
		default:
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	run := func(a browserAction) map[string]any {
		t.Helper()
		a.timeout = 10 * time.Second
		out, err := executeBrowserAction(a, st)
		if err != nil {
			t.Fatal(a.verb, err)
		}
		b, _ := json.Marshal(out)
		var env struct {
			Data struct {
				Result map[string]any `json:"result"`
			}
		}
		if err := json.Unmarshal(b, &env); err != nil {
			t.Fatal(err)
		}
		result := env.Data.Result
		if a.verb != "tabs" {
			if _, ok := result["url"].(string); !ok || result["browser_action"] != a.verb {
				t.Fatalf("missing page metadata: %v", result)
			}
			if _, ok := result["title"].(string); !ok {
				t.Fatalf("missing page title: %v", result)
			}
		}
		return result
	}
	type answer struct {
		out any
		err error
	}
	nav := make(chan answer, 1)
	go func() {
		out, err := executeBrowserAction(browserAction{verb: "goto", value: server.URL, timeout: 10 * time.Second}, st)
		nav <- answer{out, err}
	}()
	select {
	case <-requested:
	case a := <-nav:
		t.Fatalf("returned before held resource: %v (%v)", a.out, a.err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	select {
	case a := <-nav:
		t.Fatalf("returned before load: %+v", a)
	default:
	}
	close(release)
	a := <-nav
	if a.err != nil {
		t.Fatal(a.err)
	}
	b, _ := json.Marshal(a.out)
	var env struct {
		Data struct{ Result struct{ Tab string } }
	}
	json.Unmarshal(b, &env)
	tab := env.Data.Result.Tab
	if tab == "" {
		t.Fatalf("no tab: %s", b)
	}
	text := run(browserAction{verb: "text", tab: tab})
	b, _ = json.Marshal(text)
	if !bytes.Contains(b, []byte("Receipt")) {
		t.Fatalf("missing text %s", b)
	}
	links := run(browserAction{verb: "links", tab: tab})
	b, _ = json.Marshal(links)
	if !bytes.Contains(b, []byte("/receipt.pdf")) {
		t.Fatalf("missing link %s", b)
	}
	run(browserAction{verb: "type", tab: tab, selector: "input[name=query]", value: "synthetic value"})
	run(browserAction{verb: "click", tab: tab, selector: "#apply"})
	v := run(browserAction{verb: "eval", tab: tab, value: "document.querySelector('#result').textContent"})
	if v["value"] != "synthetic value" {
		t.Fatal(v)
	}
	if got := run(browserAction{verb: "eval", tab: tab, value: "window.activated"}); got["value"] != true {
		t.Fatalf("click lacked activation: %v", got)
	}
	for _, refused := range []browserAction{
		{verb: "click", tab: tab, selector: "#missing"},
		{verb: "click", tab: tab, selector: "input"},
		{verb: "type", tab: tab, selector: "input[type=number]", value: "abc"},
	} {
		refused.timeout = 5 * time.Second
		_, err := executeBrowserAction(refused, st)
		var cli *cliError
		if !errors.As(err, &cli) || cli.code != "browser_action_refused" {
			t.Fatalf("expected definite guard refusal: %v", err)
		}
	}
	if got := run(browserAction{verb: "eval", tab: tab, value: "document.querySelector('input[type=number]').value"}); got["value"] != "42" {
		t.Fatalf("rejected value changed input: %v", got)
	}
	shot := run(browserAction{verb: "screenshot", tab: tab, name: "page.png"})
	png, _ := os.ReadFile(shot["path"].(string))
	if !bytes.HasPrefix(png, []byte("\x89PNG\r\n\x1a\n")) {
		t.Fatal("not a PNG")
	}
	download := run(browserAction{verb: "download", tab: tab, value: server.URL + "/receipt.pdf", name: "receipt.pdf"})
	if download["file_name"] != "receipt.pdf" || download["target_folder"] != st.Downloads || download["url"] != server.URL+"/" || download["title"] != "Fixture" {
		t.Fatalf("incorrect download metadata: %v", download)
	}
	saved, _ := os.ReadFile(download["path"].(string))
	if !bytes.Equal(saved, pdf) {
		t.Fatalf("not original bytes: %q", saved)
	}
	tabs := run(browserAction{verb: "tabs"})
	b, _ = json.Marshal(tabs)
	if bytes.Contains(b, []byte(`"url"`)) {
		t.Fatalf("all-tabs listing leaked full URLs: %s", b)
	}
	// Host window marking survives each short CLI connection.
	resp, err := browserhost.ControlClient(dir).Get("http://browser" + browserhost.StatusPath)
	if err != nil {
		t.Fatal(err)
	}
	var status browserhost.Status
	json.NewDecoder(resp.Body).Decode(&status)
	resp.Body.Close()
	marked := false
	for _, w := range status.Windows {
		if w.ID == tab && w.Agent {
			marked = true
		}
	}
	if !marked {
		t.Fatalf("agent tab not marked: %+v", status)
	}
	go func() {
		out, err := executeBrowserAction(browserAction{verb: "click", tab: tab, selector: "#next", timeout: 10 * time.Second}, st)
		nav <- answer{out, err}
	}()
	select {
	case <-clickRequested:
	case a := <-nav:
		t.Fatalf("click returned before redirected load: %v (%v)", a.out, a.err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	select {
	case a := <-nav:
		t.Fatalf("click returned before held load: %+v", a)
	default:
	}
	close(clickRelease)
	clicked := <-nav
	if clicked.err != nil {
		t.Fatal(clicked.err)
	}
	b, _ = json.Marshal(clicked.out)
	var clickEnv struct {
		Data struct {
			Result struct{ URL, Title, Selector string }
		}
	}
	json.Unmarshal(b, &clickEnv)
	if clickEnv.Data.Result.URL != server.URL+"/final" || clickEnv.Data.Result.Title != "Redirected" || clickEnv.Data.Result.Selector != "#next" {
		t.Fatalf("click metadata not settled: %s", b)
	}
	if got := run(browserAction{verb: "goto", tab: tab, value: server.URL + "/redirect"}); got["url"] != server.URL+"/final" || got["title"] != "Redirected" {
		t.Fatalf("goto metadata not settled: %v", got)
	}
	if got := run(browserAction{verb: "eval", tab: tab, value: "document.title"}); got["value"] != "Redirected" {
		t.Fatalf("did not follow redirect: %v", got)
	}
	// A feature popup is a page target too: existing agent commands must
	// list and close it without closing or severing its opener.
	run(browserAction{verb: "eval", tab: tab, value: "window.popup = window.open('about:blank', 'flow', 'popup,width=400,height=300'); popup.document.title = 'Popup fixture'; 'opened'"})
	popupID := ""
	for _, raw := range run(browserAction{verb: "tabs"})["tabs"].([]any) {
		page := raw.(map[string]any)
		if page["title"] == "Popup fixture" {
			popupID = page["id"].(string)
		}
	}
	if popupID == "" || popupID == tab {
		t.Fatal("popup absent from agent tabs")
	}
	run(browserAction{verb: "close", tab: popupID})
	if got := run(browserAction{verb: "eval", tab: tab, value: "popup.closed && document.title === 'Redirected'"}); got["value"] != true {
		t.Fatalf("opener after popup close: %v", got)
	}
	// Closing must remain a recovery path when the renderer cannot evaluate
	// metadata (for example a modal dialog left by a page action).
	if _, err := executeBrowserAction(browserAction{verb: "eval", tab: tab, value: "alert('synthetic dialog')", timeout: time.Second}, st); err == nil {
		t.Fatal("dialog unexpectedly allowed eval to complete")
	}
	run(browserAction{verb: "close", tab: tab})
	last := run(browserAction{verb: "tabs"})["tabs"].([]any)
	for len(last) > 1 {
		run(browserAction{verb: "close", tab: last[0].(map[string]any)["id"].(string)})
		last = run(browserAction{verb: "tabs"})["tabs"].([]any)
	}
	if len(last) != 1 {
		t.Fatalf("expected final tab: %v", last)
	}
	_, err = executeBrowserAction(browserAction{verb: "close", tab: last[0].(map[string]any)["id"].(string), timeout: 5 * time.Second}, st)
	var cli *cliError
	if !errors.As(err, &cli) || cli.code != "browser_action_refused" {
		t.Fatalf("last tab not protected: %v", err)
	}
	if len(run(browserAction{verb: "tabs"})["tabs"].([]any)) != 1 {
		t.Fatal("last tab disappeared")
	}
	t.Log("native browser actions: held load and redirect, cookie-authenticated multichunk PDF bytes, SVG links, form activation, definite guard refusals, screenshot, tabs, marker, close and last-tab protection passed")
}

// A command the host held while the person drove comes back as its own
// error, not as a generic refusal, so the agent knows the page may have
// changed under it.
func TestHeldCommandFailsAsPersonTookControl(t *testing.T) {
	server, client := net.Pipe()
	defer server.Close()
	defer client.Close()
	go func() {
		r := bufio.NewReader(server)
		f, err := wsframe.ReadFrame(r, 1<<20, true)
		if err != nil {
			return
		}
		var m struct {
			ID int `json:"id"`
		}
		_ = json.Unmarshal(f.Payload, &m)
		b, _ := json.Marshal(map[string]any{"id": m.ID, "error": map[string]any{"code": -32000, "message": browserhost.PersonTookControl}})
		_, _ = server.Write(wsframe.AppendFrame(nil, wsframe.OpText, b, false))
	}()
	c := &browserCDP{conn: client, reader: bufio.NewReader(client), loads: map[string]bool{}}
	err := c.call("Input.dispatchMouseEvent", map[string]any{}, nil)
	var ce *cliError
	if !errors.As(err, &ce) || ce.code != "browser_person_took_control" {
		t.Fatalf("held command error %v", err)
	}
}
