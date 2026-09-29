//go:build linux

// Standalone browser-test host. Never imported by cmd/native-agent-host.
package main

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/signal"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/maintainer/native-agent-host/internal/core"
	"github.com/maintainer/native-agent-host/internal/daemon"
	"github.com/maintainer/native-agent-host/internal/gateway"
	"github.com/maintainer/native-agent-host/internal/transport"
)

type provider struct {
	origin     string
	challenges sync.Map
}

func (p *provider) AuthorizationURL(state, challenge string) string {
	p.challenges.Store("state:"+state, challenge)
	p.challenges.Store("challenge:"+challenge, true)
	return p.origin + "/fixture/provider?state=" + url.QueryEscape(state) + "&challenge=" + url.QueryEscape(challenge)
}
func (p *provider) Exchange(_ context.Context, code, verifier string) (string, string, string, error) {
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	if _, found := p.challenges.LoadAndDelete("challenge:" + challenge); !found {
		return "", "", "", errors.New("PKCE mismatch")
	}
	if code != "42" && code != "43" && code != "99" {
		return "", "", "", errors.New("unknown identity")
	}
	login := "alice"
	if code == "43" {
		login = "bob"
	}
	return "synthetic-token", code, login, nil
}

type sink struct{ scenario *atomic.Value }

func (s sink) Deliver(context.Context, gateway.Identity, string, string) error {
	if s.scenario.Load() == "native-error" {
		return errors.New("synthetic native failure")
	}
	return nil
}
func main() {
	if isFakePi(os.Args) {
		runFakePi(os.Args)
		return
	}
	if len(os.Args) != 2 {
		log.Fatal("usage: browser-host <built web/dist>")
	}
	u, e := user.Current()
	if e != nil {
		log.Fatal(e)
	}
	uid, e := strconv.Atoi(u.Uid)
	if e != nil {
		log.Fatal(e)
	}
	tmp, e := os.MkdirTemp("/tmp", "nah-browser-")
	if e != nil {
		log.Fatal(e)
	}
	defer os.RemoveAll(tmp)
	// Lab mode is for exploratory UI work: the real conversation controller
	// runs a fake Pi, discovery scans the synthetic home, and data is richer.
	lab := os.Getenv("BROWSER_HOST_LAB") == "1"
	base := 4174
	if raw, set := os.LookupEnv("NAH_PORT_BASE"); set {
		base, e = strconv.Atoi(raw)
		if e != nil || strings.Trim(raw, "0123456789") != "" || base < 1024 || base > 65525 {
			log.Fatal("NAH_PORT_BASE must be an integer from 1024 to 65525")
		}
	}
	port := base
	if lab {
		port++
	}
	if raw := os.Getenv("BROWSER_HOST_PORT"); raw != "" {
		port, e = strconv.Atoi(raw)
		if !lab || e != nil || port < 1024 || port > 65535 {
			log.Fatal("BROWSER_HOST_PORT must be a lab port from 1024 to 65535")
		}
	}
	listen := net.JoinHostPort("127.0.0.1", strconv.Itoa(port))
	self, e := os.Executable()
	if e != nil {
		log.Fatal(e)
	}
	// The synthetic helper validates HOME as a daemon would; this process uses
	// one UID, so this is not distinct-UID evidence.
	os.Setenv("HOME", tmp)
	if marker := os.Getenv("BROWSER_HOST_MARKER"); marker != "" {
		if e := os.MkdirAll(filepath.Dir(marker), 0700); e != nil {
			log.Fatal(e)
		}
		if e := os.WriteFile(marker, []byte(tmp), 0600); e != nil {
			log.Fatal(e)
		}
		defer os.Remove(marker)
	}
	// Disposable native helper; never uses a real Pi runtime, home or provider.
	fakeNode := filepath.Join(tmp, "fake-node")
	piStateFile := filepath.Join(tmp, "pi-state")
	_ = os.WriteFile(piStateFile, []byte("missing"), 0600)
	fakeScript := `#!/bin/sh
case "$6" in
 status) state=$(cat "` + piStateFile + `"); printf '{"type":"status","state":"%s"}\n' "$state" ;;
 login) printf '%s\n' '{"type":"device_code","verificationUri":"https://auth.openai.com/codex/device","userCode":"ABCD-1234"}'; sleep 2; if [ "$(cat "` + piStateFile + `")" = usable ]; then printf '%s\n' '{"type":"completed"}'; else printf '%s\n' '{"type":"unknown"}'; fi ;;
esac
`
	if e := os.WriteFile(fakeNode, []byte(fakeScript), 0700); e != nil {
		log.Fatal(e)
	}
	identities := []gateway.Identity{{Provider: "github", Subject: "42", UID: 1001, Username: "alice", Socket: "/run/native-agent-host/users/alice/daemon.sock"}, {Provider: "github", Subject: "43", UID: 1002, Username: "bob", Socket: "/run/native-agent-host/users/bob/daemon.sock"}}
	var scenario atomic.Value
	scenario.Store("ready")
	var clock atomic.Int64
	paths := map[string]string{}
	histories := map[string]string{}
	peers := map[string]int{}
	var servers []*http.Server
	var attempts []*atomic.Value
	var devices []*daemon.PiDevice
	var configs []transport.Config
	var trusters []func(*http.Request) bool
	var cloneCalls atomic.Int64
	defer func() {
		for _, srv := range servers {
			_ = srv.Close()
		}
	}()
	gitProgram := filepath.Join(tmp, "synthetic-git")
	gitScript := `#!/bin/sh
if [ "$1" = clone ]; then
  mkdir -p .git || exit 1
  printf '%s\n' "$3" > .git/origin
  exit 0
fi
if [ "$1" = -c ]; then shift 2; fi
case "$1" in
 rev-parse) test -d .git && printf 'true\n' ;;
 remote) cat .git/origin ;;
 config) cat .git/origin ;;
 status) test -d .git ;;
 *) exit 1 ;;
esac
`
	if e := os.WriteFile(gitProgram, []byte(gitScript), 0700); e != nil {
		log.Fatal(e)
	}
	for _, m := range identities {
		home := filepath.Join(tmp, m.Username)
		if e := os.MkdirAll(filepath.Join(home, "src"), 0700); e != nil {
			log.Fatal(e)
		}
		for _, name := range []string{"git-project", "ordinary-dir", "without-metadata"} {
			if e := os.Mkdir(filepath.Join(home, "src", name), 0700); e != nil {
				log.Fatal(e)
			}
		}
		_ = os.Mkdir(filepath.Join(home, "src", "git-project", ".git"), 0700)
		sessionRoot := filepath.Join(home, ".pi", "agent", "sessions")
		if e := os.MkdirAll(sessionRoot, 0700); e != nil {
			log.Fatal(e)
		}
		historyPath := filepath.Join(sessionRoot, "synthetic.jsonl")
		histories[m.Username] = historyPath
		if e := seedBrowserHistory(historyPath, filepath.Join(home, "src", "ordinary-dir")); e != nil {
			log.Fatal(e)
		}
		if lab {
			if e := seedLab(home); e != nil {
				log.Fatal(e)
			}
		}
		path := filepath.Join(tmp, m.Username+".sock")
		ln, e := net.Listen("unix", path)
		if e != nil {
			log.Fatal(e)
		}
		defer ln.Close()
		paths[m.Socket] = path
		peers[path] = m.UID
		cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: m.Subject}
		handler := daemon.SnapshotHandlerWithNativeRoot(cfg, func(r *http.Request) bool { return r.Context().Value("peer") == uid }, func(transport.Config) daemon.Discovery {
			switch scenario.Load().(string) {
			case "empty":
				return daemon.Discovery{State: "empty"}
			case "missing":
				return daemon.Discovery{State: "missing"}
			case "error":
				return daemon.Discovery{State: "error"}
			case "partial":
				return daemon.Discovery{State: "partial", Entries: []daemon.Workspace{{Name: "git-project", Kind: "git_main_worktree", Metadata: "error"}, {Name: "uncertain", Kind: "unknown", Metadata: "error"}}}
			}
			if lab {
				return daemon.DiscoverFixtureRoot(home, uid)
			}
			names := []string{"git-project", "ordinary-dir", "without-metadata"}
			entries := []daemon.Workspace{}
			for _, n := range names {
				if _, e := os.Stat(filepath.Join(home, "src", n)); e == nil {
					k := "directory"
					if n == "git-project" {
						k = "git_main_worktree"
					}
					entries = append(entries, daemon.Workspace{Name: n, Kind: k, Metadata: "absent"})
				}
			}
			return daemon.Discovery{State: "present", Entries: entries}
		}, home)
		ghProgram := filepath.Join(tmp, "synthetic-gh-"+m.Username)
		ghScript := `#!/bin/sh
case "$4" in
 /user) printf '{"id":` + m.Subject + `}\n' ;;
 /user/repos*)
   case "$4" in
    *page=1*)
      printf '['
      printf '{"name":"first","full_name":"fixture/first","private":false,"description":"Synthetic first","pushed_at":"2026-09-28T12:00:00Z","html_url":"https://github.com/fixture/first","owner":{"login":"fixture"}}'
      printf ',{"name":"second","full_name":"fixture/second","private":true,"description":"Synthetic second","pushed_at":null,"html_url":"https://github.com/fixture/second","owner":{"login":"fixture"}}'
      i=1
      while [ "$i" -le 48 ]; do
        printf ',{"name":"repo%03d","full_name":"fixture/repo%03d","private":false,"description":null,"pushed_at":null,"html_url":"https://github.com/fixture/repo%03d","owner":{"login":"fixture"}}' "$i" "$i" "$i"
        i=$((i+1))
      done
      printf ']\n' ;;
    *page=2*) printf '%s\n' '[{"name":"last","full_name":"fixture/last","private":false,"description":null,"pushed_at":"2025-01-01T00:00:00Z","html_url":"https://github.com/fixture/last","owner":{"login":"fixture"}},{"name":"older","full_name":"fixture/older","private":false,"description":null,"pushed_at":null,"html_url":"https://github.com/fixture/older","owner":{"login":"fixture"}}]' ;;
    *) printf '[]\n' ;;
   esac ;;
 /repos/fixture/*) name="${4##*/}"; printf '{"name":"%s","full_name":"fixture/%s","clone_url":"https://github.com/fixture/%s.git","owner":{"login":"fixture"}}\n' "$name" "$name" "$name" ;;
 *) exit 1 ;;
esac
`
		if m.Username == "bob" {
			ghScript = strings.ReplaceAll(ghScript, "first", "bob-only")
		}
		if e := os.WriteFile(ghProgram, []byte(ghScript), 0700); e != nil {
			log.Fatal(e)
		}
		mux := http.NewServeMux()
		trusted := func(r *http.Request) bool { return r.Context().Value("peer") == uid }
		device := &daemon.PiDevice{Home: tmp, Node: fakeNode, Entry: "/synthetic/entry", Manifest: "/synthetic/manifest"}
		status := func(ctx context.Context) string {
			if scenario.Load() == "pi-onboarding" {
				return device.StatusContext(ctx)
			}
			if scenario.Load() == "pi-blocked" {
				return "missing"
			}
			return "usable"
		}
		gate := func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if scenario.Load() == "pi-blocked" || scenario.Load() == "pi-onboarding" {
					daemon.PiGateHandler(cfg, trusted, status, next).ServeHTTP(w, r)
					return
				}
				next.ServeHTTP(w, r)
			})
		}
		mux.Handle(daemon.RepoCatalogPath, daemon.RepoCatalogHandlerWithFixtureGH(cfg, trusted, ghProgram, home))
		cloneHandler := daemon.RepoCloneHandlerWithFixturePrograms(cfg, trusted, home, home, ghProgram, gitProgram)
		mux.Handle(daemon.RepoClonePath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cloneCalls.Add(1)
			cloneHandler.ServeHTTP(w, r)
		}))
		mux.Handle(daemon.RepoObservePath, daemon.RepoObserveHandlerWithFixtureGit(cfg, trusted, home, gitProgram))
		mux.Handle("GET /api/v1/onboarding/pi/status", daemon.PiStatusHandler(cfg, trusted, status))
		attempt := &atomic.Value{}
		attempt.Store(daemon.PiAttemptHandler(cfg, trusted, device))
		attempts = append(attempts, attempt)
		devices = append(devices, device)
		configs = append(configs, cfg)
		trusters = append(trusters, trusted)
		mux.HandleFunc("/api/v1/onboarding/pi/attempt", func(w http.ResponseWriter, r *http.Request) {
			attempt.Load().(http.Handler).ServeHTTP(w, r)
		})
		var conversations http.Handler = fakeConversations(trusted)
		if lab {
			// The real controller launches this binary as its Pi child.
			conversations = daemon.ConversationHandlerWithFixtureRuntime(context.Background(), cfg, trusted, status, home, &core.PiRuntimeConfig{Node: self, Entry: "/synthetic/pi/dist/index.js", Manifest: "/synthetic/pi/package.json"})
		}
		mux.Handle("/api/v1/conversations", conversations)
		mux.Handle("/api/v1/conversations/", conversations)
		mux.Handle("/api/v1/agents/", gate(daemon.HistoryHandlerWithNativeRoot(cfg, trusted, home)))
		mux.Handle("/api/v1/content/", gate(daemon.HistoryHandlerWithNativeRoot(cfg, trusted, home)))
		mux.Handle(daemon.SnapshotPath, gate(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch scenario.Load().(string) {
			case "malformed":
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprint(w, `{"schema_version":1}`)
				return
			case "oversize":
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprint(w, strings.Repeat("x", 65537))
				return
			case "delay":
				time.Sleep(650 * time.Millisecond)
			case "foreign":
				rec := httptest.NewRecorder()
				handler.ServeHTTP(rec, r)
				var body map[string]any
				if json.Unmarshal(rec.Body.Bytes(), &body) != nil {
					http.Error(w, "fixture failure", 503)
					return
				}
				body["auth"].(map[string]any)["provider_account_id"] = "99"
				b, _ := json.Marshal(body)
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Content-Length", strconv.Itoa(len(b)))
				_, _ = w.Write(b)
				return
			}
			handler.ServeHTTP(w, r)
		})))
		srv := &http.Server{Handler: mux, ConnContext: func(ctx context.Context, c net.Conn) context.Context {
			uc, ok := c.(*net.UnixConn)
			if !ok {
				return ctx
			}
			got, e := daemon.PeerUID(uc)
			if e != nil {
				return ctx
			}
			return context.WithValue(ctx, "peer", int(got))
		}}
		servers = append(servers, srv)
		go srv.Serve(ln)
	}
	// TLS is real at the gateway. Browser trusts only this ephemeral local certificate.
	ts := httptest.NewUnstartedServer(nil)
	_ = ts.Listener.Close()
	ts.Listener, e = net.Listen("tcp", listen)
	if e != nil {
		log.Fatal(e)
	}
	origin := "https://" + ts.Listener.Addr().String()
	fixtureProvider := &provider{origin: origin}
	auth, e := gateway.NewAuth(gateway.OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: origin, CallbackURL: origin + "/auth/github/callback"}, gateway.AuthOptions{Provider: fixtureProvider, Sink: sink{&scenario}, Broker: fixtureBroker{identities}, Now: func() time.Time { return time.Now().Add(time.Duration(clock.Load()) * time.Hour) }, SnapshotDial: func(ctx context.Context, p string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", paths[p])
	}, SnapshotPeerUID: func(c *net.UnixConn) int { return peers[c.RemoteAddr().String()] }})
	if e != nil {
		log.Fatal(e)
	}
	product := gateway.NewWithAuth(os.Args[1], auth)
	ts.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/fixture/") {
			switch r.URL.Path {
			case "/fixture/clone-count":
				fmt.Fprint(w, cloneCalls.Load())
				return
			case "/fixture/checkout":
				// An existing native checkout or conflicting directory, never a real home.
				name := r.URL.Query().Get("name")
				mode := r.URL.Query().Get("mode")
				if (name != "first" && name != "second") || (mode != "existing" && mode != "conflict" && mode != "absent") {
					http.Error(w, "invalid fixture", 400)
					return
				}
				destination := filepath.Join(tmp, "alice", "src", name)
				if mode == "absent" {
					if e := os.RemoveAll(destination); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
					w.WriteHeader(204)
					return
				}
				if e := os.RemoveAll(destination); e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				if e := os.MkdirAll(destination, 0700); e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				if mode == "existing" {
					if e := os.MkdirAll(filepath.Join(destination, ".git"), 0700); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
					if e := os.WriteFile(filepath.Join(destination, ".git", "origin"), []byte("https://github.com/fixture/"+name+".git\n"), 0600); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				}
				w.WriteHeader(204)
				return
			case "/fixture/history":
				mode := r.URL.Query().Get("mode")
				path := histories["alice"]
				if mode == "missing" {
					if e := os.Remove(path); e != nil && !os.IsNotExist(e) {
						http.Error(w, "fixture failed", 500)
						return
					}
				} else if mode == "empty" {
					if e := os.WriteFile(path, []byte(`{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","cwd":"`+filepath.Join(tmp, "alice", "src", "ordinary-dir")+`"}`+"\n"), 0600); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				} else if mode == "corrupt" {
					if e := os.WriteFile(path, []byte(`{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","cwd":"`+filepath.Join(tmp, "alice", "src", "ordinary-dir")+`"}`+"\n"+`{"type":"message","id":"a","message":{`+"\n"), 0600); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				} else if mode == "ready" {
					if e := seedBrowserHistory(path, filepath.Join(tmp, "alice", "src", "ordinary-dir")); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				} else {
					http.Error(w, "unknown fixture", 400)
					return
				}
				w.WriteHeader(204)
				return
			case "/fixture/provider":
				state := r.URL.Query().Get("state")
				challenge := r.URL.Query().Get("challenge")
				if stored, ok := fixtureProvider.challenges.Load("state:" + state); !ok || stored != challenge || state == "" || challenge == "" {
					http.Error(w, "bad fixture state", 400)
					return
				}
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				fmt.Fprintf(w, `<!doctype html><html lang="fi"><title>Test OAuth</title><h1>Test OAuth provider</h1><a href="/auth/github/callback?state=%s&amp;code=42">Alice</a> <a href="/auth/github/callback?state=%s&amp;code=43">Bob</a> <a href="/auth/github/callback?state=%s&amp;code=99">Unknown</a>`, html.EscapeString(url.QueryEscape(state)), html.EscapeString(url.QueryEscape(state)), html.EscapeString(url.QueryEscape(state)))
			case "/fixture/scenario":
				name := r.URL.Query().Get("value")
				switch name {
				case "ready", "empty", "missing", "error", "partial", "malformed", "oversize", "delay", "native-error", "foreign", "pi-blocked", "pi-onboarding":
					scenario.Store(name)
					if name == "pi-onboarding" {
						// A new synthetic case has a fresh admission window and daemon lease.
						// Monotonic fixture time also avoids reviving an expired session.
						clock.Add(1)
						for i, attempt := range attempts {
							attempt.Store(daemon.PiAttemptHandler(configs[i], trusters[i], devices[i]))
						}
					}
				default:
					http.Error(w, "unknown scenario", 400)
					return
				}
				w.WriteHeader(204)
			case "/fixture/pi-restart":
				// Replace ephemeral leases as if each synthetic daemon restarted.
				for i, attempt := range attempts {
					attempt.Store(daemon.PiAttemptHandler(configs[i], trusters[i], devices[i]))
				}
				w.WriteHeader(204)
			case "/fixture/pi-state":
				state := r.URL.Query().Get("value")
				if state != "missing" && state != "usable" && state != "unknown" {
					http.Error(w, "unknown state", 400)
					return
				}
				if e := os.WriteFile(piStateFile, []byte(state), 0600); e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				w.WriteHeader(204)
			case "/fixture/expire":
				clock.Add(25)
				w.WriteHeader(204)
			case "/fixture/reset-clock":
				clock.Add(1)
				w.WriteHeader(204)
			default:
				http.NotFound(w, r)
			}
			return
		}
		product.ServeHTTP(w, r)
	})
	ts.TLS = &tls.Config{MinVersion: tls.VersionTLS12}
	ts.StartTLS()
	defer ts.Close()
	fmt.Println("BROWSER_HOST_READY " + ts.URL)
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	signal.Stop(stop)
}

type fixtureBroker struct{ identities []gateway.Identity }

func (b fixtureBroker) Exchange(_ context.Context, r gateway.BrokerRequest) (gateway.BrokerReply, error) {
	for _, m := range b.identities {
		if m.Subject == r.ID {
			return gateway.BrokerReply{Route: &gateway.BrokerRoute{UID: uint32(m.UID), Username: m.Username, Socket: m.Socket}, Epoch: 1, Generation: 1}, nil
		}
	}
	return gateway.BrokerReply{}, errors.New("not allowlisted")
}

func seedBrowserHistory(path, cwd string) error {
	f, e := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	defer f.Close()
	encode := json.NewEncoder(f)
	if e := encode.Encode(map[string]any{"type": "session", "version": 3, "id": "11111111-1111-4111-8111-111111111111", "cwd": cwd}); e != nil {
		return e
	}
	for i := 0; i < 251; i++ {
		content := fmt.Sprintf("Synteettinen viesti %d", i)
		if strings.Contains(cwd, "/bob/") {
			content = fmt.Sprintf("Bobin synteettinen viesti %d", i)
		}
		if i == 248 {
			content = strings.Repeat("ä", 40000) + "<script>alert('bad')</script>"
		}
		row := map[string]any{"type": "message", "id": fmt.Sprintf("native%04d", i), "message": map[string]any{"role": "user", "content": content}}
		if i == 250 {
			row["type"] = "unknown_fixture"
		}
		if e := encode.Encode(row); e != nil {
			return e
		}
	}
	return f.Sync()
}

// Fake controller is only mounted in the synthetic browser host. It exercises
// the real gateway forwarding and lease boundary, not the Pi child lifecycle.
func fakeConversations(trusted func(*http.Request) bool) http.Handler {
	var mu sync.Mutex
	var serial uint64
	type handle struct{ Workspace, State, Command, Ack string }
	items := make(map[string]*handle)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !trusted(r) {
			http.Error(w, "denied", 403)
			return
		}
		mu.Lock()
		defer mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Connection", "close")
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/conversations")
		if path == "" && r.Method == "GET" {
			list := make([]map[string]any, 0, len(items))
			for id, h := range items {
				list = append(list, map[string]any{"agent_id": "pi:" + id, "workspace_id": h.Workspace, "state": h.State})
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "sessions": list})
			return
		}
		if path == "" && r.Method == "POST" {
			var input struct {
				Workspace string `json:"workspace_id"`
			}
			if json.NewDecoder(r.Body).Decode(&input) != nil {
				http.Error(w, "bad", 400)
				return
			}
			serial++
			id := fmt.Sprintf("%08x-1111-4111-8111-%012x", serial, serial)
			items[id] = &handle{Workspace: input.Workspace, State: "idle"}
			_ = json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": input.Workspace, "state": "idle"})
			return
		}
		parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
		if len(parts) != 2 || items[parts[0]] == nil {
			http.NotFound(w, r)
			return
		}
		id, h := parts[0], items[parts[0]]
		switch parts[1] {
		case "send":
			var input struct {
				Command string `json:"command_id"`
			}
			if json.NewDecoder(r.Body).Decode(&input) != nil {
				http.Error(w, "bad", 400)
				return
			}
			h.Command = input.Command
			h.Ack = "accepted"
			h.State = "idle"
			_ = json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "command_id": input.Command, "state": "pending"})
		case "status":
			_ = json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": h.Workspace, "state": h.State, "command_id": h.Command, "ack": h.Ack, "event_cursor": 0, "events": []any{}, "event_loss": false, "native_history": "missing", "native_revision": "", "history_query": "/api/v1/agents/pi:" + id + "/history"})
		case "stop":
			h.State = "uncertain"
			_ = json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "state": "termination_unknown"})
		default:
			http.NotFound(w, r)
		}
	})
}
