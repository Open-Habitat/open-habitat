//go:build linux

// Standalone browser-test host. Never imported by cmd/open-habitat.
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
	"os/exec"
	"os/signal"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/core"
	"github.com/Open-Habitat/open-habitat/internal/daemon"
	"github.com/Open-Habitat/open-habitat/internal/gateway"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

type provider struct {
	origin       string
	challenges   sync.Map
	missingEmail atomic.Bool // one-shot synthetic fixture for onboarding
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

func (p *provider) ExchangeProfile(ctx context.Context, code, verifier string) (string, string, string, gateway.AccountProfile, error) {
	token, id, login, err := p.Exchange(ctx, code, verifier)
	if err != nil {
		return "", "", "", gateway.AccountProfile{}, err
	}
	name := "Alice Example"
	if code == "43" {
		name = "Bob Example"
	}
	email := login + "@example.invalid"
	if p.missingEmail.Swap(false) {
		email = ""
	}
	return token, id, login, gateway.AccountProfile{Name: name, Email: email}, nil
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
	tmp, e := os.MkdirTemp("/tmp", "oh-browser-")
	if e != nil {
		log.Fatal(e)
	}
	defer os.RemoveAll(tmp)
	// Lab mode adds richer synthetic history and workspaces; both modes run
	// the real conversation controller against the fake Pi child.
	lab := os.Getenv("BROWSER_HOST_LAB") == "1"
	base := 4174
	if raw, set := os.LookupEnv("OH_PORT_BASE"); set {
		base, e = strconv.Atoi(raw)
		if e != nil || strings.Trim(raw, "0123456789") != "" || base < 1024 || base > 65525 {
			log.Fatal("OH_PORT_BASE must be an integer from 1024 to 65525")
		}
	}
	port := base
	if lab {
		port++
	}
	if raw := os.Getenv("BROWSER_HOST_PORT"); raw != "" {
		port, e = strconv.Atoi(raw)
		if e != nil || port < 1024 || port > 65535 {
			log.Fatal("BROWSER_HOST_PORT must be a port from 1024 to 65535")
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
	identities := []gateway.Identity{{Provider: "github", Subject: "42", UID: 1001, Username: "alice", Socket: "/run/open-habitat/users/alice/daemon.sock"}, {Provider: "github", Subject: "43", UID: 1002, Username: "bob", Socket: "/run/open-habitat/users/bob/daemon.sock"}}
	var scenario atomic.Value
	scenario.Store("ready")
	fakePiScenario := filepath.Join(tmp, "fakepi-scenario")
	var clock atomic.Int64
	paths := map[string]string{}
	histories := map[string]string{}
	peers := map[string]int{}
	var servers []*http.Server
	var attempts []*atomic.Value
	var clearAuth []func()
	var devices []*daemon.PiDevice
	var configs []transport.Config
	var trusters []func(*http.Request) bool
	var conversationHandlers []*atomic.Value
	var conversationFactories []func() (http.Handler, context.CancelFunc)
	var conversationCancels []context.CancelFunc
	defer func() {
		for _, cancel := range conversationCancels {
			cancel()
		}
	}()
	var cloneCalls atomic.Int64
	defer func() {
		for _, srv := range servers {
			_ = srv.Close()
		}
	}()
	gitProgram := filepath.Join(tmp, "synthetic-git")
	gitScript := `#!/bin/sh
if [ "$1" = clone ]; then
  if [ "$2" = --progress ]; then
    shift
    printf 'remote: https://host:secret@invalid.example/private\rReceiving objects: 22%% (1/4), 1.25 MiB\r' >&2
    sleep 0.2
    printf 'Updating files: 100%% (4/4)\n' >&2
  fi
  /usr/bin/git init -q . || exit 1
  /usr/bin/git remote add origin "$3" || exit 1
  printf '%s\n' "$3" > .git/origin
  exit 0
fi
if [ "$1" = -c ]; then shift 2; fi
case "$1" in
 rev-parse) test -d .git || exit 1; if [ "$2" = --verify ]; then printf '0123456789abcdef0123456789abcdef01234567\n'; else printf 'true\n'; fi ;;
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
		bin := filepath.Join(home, ".local", "bin")
		if e := os.MkdirAll(bin, 0700); e != nil {
			log.Fatal(e)
		}
		if e := os.WriteFile(filepath.Join(bin, "agent-probe"), []byte("#!/bin/sh\nprintf '%s\\n' '"+m.Username+"'\n"), 0700); e != nil {
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
		if e := seedBrowserHistory(historyPath, filepath.Join(home, "src", "ordinary-dir"), 251); e != nil {
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
		cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: m.Subject}
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
 /user) printf '{"id":` + m.Subject + `,"login":"fixture","name":"Fixture Person"}\n' ;;
 /user/emails*) exit 1 ;;
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
		mux.Handle(daemon.RepoCatalogPath, daemon.RepoCatalogHandlerWithFixtureGH(cfg, trusted, ghProgram, home))
		mux.Handle(daemon.GitIdentityPath, daemon.GitIdentityHandlerWithFixturePrograms(cfg, trusted, home, ghProgram, "/usr/bin/git"))
		cloneHandler := daemon.RepoCloneHandlerWithFixturePrograms(cfg, trusted, home, home, ghProgram, gitProgram)
		mux.Handle(daemon.RepoClonePath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cloneCalls.Add(1)
			cloneHandler.ServeHTTP(w, r)
		}))
		mux.Handle(daemon.RepoCloneStreamPath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cloneCalls.Add(1)
			daemon.RepoCloneStreamHandlerWithFixturePrograms(cfg, trusted, home, ghProgram, gitProgram).ServeHTTP(w, r)
		}))
		mux.Handle(daemon.RepoObservePath, daemon.RepoObserveHandlerWithFixtureGit(cfg, trusted, home, gitProgram))
		mux.Handle("GET /api/v1/onboarding/pi/status", daemon.PiStatusHandler(cfg, trusted, status))
		mux.Handle("/api/v1/pi/models", piModelsFixture(home, trusted))
		nativePkg, _ := filepath.Abs(filepath.Join(os.Args[1], "../..", "internal/daemon/pi-device-test/node_modules/@earendil-works/pi-coding-agent"))
		nativeNode, _ := exec.LookPath("node")
		credentialDevice := &daemon.PiDevice{Home: home, Node: nativeNode, Entry: filepath.Join(nativePkg, "dist/index.js"), Manifest: filepath.Join(nativePkg, "package.json"), FixtureHome: true}
		credentialHandler := daemon.PiCredentialsHandler(cfg, trusted, credentialDevice)
		mux.Handle("/api/v1/pi/credentials", credentialHandler)
		mux.Handle("/api/v1/pi/credentials/openai", credentialHandler)

		attempt := &atomic.Value{}
		current := &atomic.Value{}
		clear := func() { current.Load().(*daemon.ConversationController).ClearPiAuthFailures() }
		attempt.Store(daemon.PiAttemptHandler(cfg, trusted, device, clear))
		clearAuth = append(clearAuth, clear)
		attempts = append(attempts, attempt)
		devices = append(devices, device)
		configs = append(configs, cfg)
		trusters = append(trusters, trusted)
		mux.HandleFunc("/api/v1/onboarding/pi/attempt", func(w http.ResponseWriter, r *http.Request) {
			attempt.Load().(http.Handler).ServeHTTP(w, r)
		})
		// The fixture can replace the daemon incarnation between browser cases;
		// each incarnation still runs the real controller and fake Pi child.
		newConversations := func() (http.Handler, context.CancelFunc) {
			ctx, cancel := context.WithCancel(context.Background())
			return daemon.ConversationHandlerWithFixtureRuntime(ctx, cfg, trusted, status, home, &core.PiRuntimeConfig{Node: self, Entry: "/synthetic/pi/dist/index.js", Manifest: "/synthetic/pi/package.json"}), cancel
		}
		conversations, cancel := newConversations()
		current.Store(conversations)
		conversationHandlers = append(conversationHandlers, current)
		conversationCancels = append(conversationCancels, cancel)
		conversationFactories = append(conversationFactories, newConversations)
		serveConversation := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			current.Load().(http.Handler).ServeHTTP(w, r)
		})
		fixtureWorkspaceCfg := cfg
		fixtureWorkspaceCfg.Home = home // All workspace writes in the browser host stay in its disposable home.
		mux.Handle(daemon.WorkspacePath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			daemon.WorkspaceHandlerWithArchive(fixtureWorkspaceCfg, trusted, current.Load().(*daemon.ConversationController)).ServeHTTP(w, r)
		}))
		mux.Handle("/api/v1/conversations", serveConversation)
		mux.Handle("/api/v1/conversations/", serveConversation)
		mux.Handle("/api/v1/events", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if scenario.Load() != "ready" && scenario.Load() != "pi-deltas" && scenario.Load() != "pi-typed" && scenario.Load() != "pi-visual-hold" && scenario.Load() != "pi-auth-failure" && scenario.Load() != "pi-model-unsupported" && scenario.Load() != "pi-recap" && scenario.Load() != "pi-recap-unsupported" {
				http.NotFound(w, r) // Fault scenarios exercise the HTTP fallback.
				return
			}
			current.Load().(*daemon.ConversationController).FixtureEvents().ServeHTTP(w, r)
		}))
		mux.Handle("/api/v1/agents/", daemon.HistoryHandlerWithNativeRoot(cfg, trusted, home))
		mux.Handle("/api/v1/content/", daemon.HistoryHandlerWithNativeRoot(cfg, trusted, home))
		mux.Handle(daemon.SnapshotPath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
			case "ready", "pi-deltas", "pi-typed", "pi-visual-hold", "pi-auth-failure", "pi-model-unsupported", "pi-recap", "pi-recap-unsupported":
				current.Load().(*daemon.ConversationController).FixtureSnapshot().ServeHTTP(w, r)
				return

			}
			handler.ServeHTTP(w, r)
		}))
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
	adminPath := filepath.Join(tmp, "administration.json")
	if err := os.WriteFile(adminPath, []byte(`{"version":1,"name":"Synthetic lab","administrators":["42"],"default_limit_bytes":8589934592}`), 0600); err != nil {
		log.Fatal(err)
	}
	broker := &fixtureBroker{identities: identities}
	auth, e := gateway.NewAuth(gateway.OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: origin, CallbackURL: origin + "/auth/github/callback"}, gateway.AuthOptions{Provider: fixtureProvider, Sink: sink{&scenario}, Broker: broker, AdminFile: adminPath, Now: func() time.Time { return time.Now().Add(time.Duration(clock.Load()) * time.Hour) }, SnapshotDial: func(ctx context.Context, p string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", paths[p])
	}, SnapshotPeerUID: func(c *net.UnixConn) int { return peers[c.RemoteAddr().String()] }})
	if e != nil {
		log.Fatal(e)
	}
	product := gateway.NewWithAuth(os.Args[1], auth)
	ts.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/fixture/") {
			switch r.URL.Path {
			case "/fixture/lab-marker":
				if !lab {
					http.NotFound(w, r)
					return
				}
				w.WriteHeader(http.StatusNoContent)
				return
			case "/fixture/conversations-reset":
				// Each browser case starts from Pi's native unset default.
				for _, user := range []string{"alice", "bob"} {
					if err := os.Remove(filepath.Join(tmp, user, ".pi", "agent", "settings.json")); err != nil && !os.IsNotExist(err) {
						http.Error(w, "fixture failed", 500)
						return
					}
				}
				// Tests explicitly discard the previous synthetic daemon incarnation.
				for i, current := range conversationHandlers {
					conversations, cancel := conversationFactories[i]()
					previous := conversationCancels[i]
					current.Store(conversations)
					conversationCancels[i] = cancel
					previous()
				}
				w.WriteHeader(204)
				return
			case "/fixture/lab-conversations-clean":
				if !lab {
					http.NotFound(w, r)
					return
				}
				// Only the invented aurinkokello history is reset. Preserve the
				// seeded sessions; never delete a real profile or unrelated fixture.
				dir := filepath.Join(tmp, "alice", ".pi", "agent", "sessions", "--"+strings.ReplaceAll(strings.Trim(filepath.Join(tmp, "alice", "src", "aurinkokello"), "/"), "/", "-")+"--")
				entries, err := os.ReadDir(dir)
				if err != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				for _, entry := range entries {
					if !strings.HasSuffix(entry.Name(), ".jsonl") || strings.HasSuffix(entry.Name(), "_a1a1a1a1-0000-4000-8000-000000000001.jsonl") || strings.HasSuffix(entry.Name(), "_a1a1a1a1-0000-4000-8000-000000000002.jsonl") {
						continue
					}
					if err := os.Remove(filepath.Join(dir, entry.Name())); err != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				}
				w.WriteHeader(204)
				return
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
				} else if mode == "append" {
					f, e := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
					if e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
					_, e = f.WriteString(`{"type":"message","id":"terminal_append","message":{"role":"user","content":"Ulkoinen terminaaliviesti"}}` + "\n")
					if closeErr := f.Close(); e == nil {
						e = closeErr
					}
					if e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				} else if mode == "ready" || mode == "short" {
					count := 251
					if mode == "short" {
						count = 51 // Two page transitions still reach the untrusted oldest rows.
					}
					if e := seedBrowserHistory(path, filepath.Join(tmp, "alice", "src", "ordinary-dir"), count); e != nil {
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
			case "/fixture/profile-missing-email":
				fixtureProvider.missingEmail.Store(true)
				w.WriteHeader(204)
				return
			case "/fixture/scenario":
				name := r.URL.Query().Get("value")
				switch name {
				case "ready", "empty", "missing", "error", "partial", "malformed", "oversize", "delay", "native-error", "pi-blocked", "pi-onboarding", "pi-deltas", "pi-typed", "pi-visual-hold", "pi-auth-failure", "pi-model-unsupported", "pi-recap", "pi-recap-unsupported":
					// Read by the fake Pi child at turn start. Switching back to ready
					// keeps subsequent lab cases on the old, faster fixture.
					if err := os.Remove(filepath.Join(tmp, "fakepi-visual-phase")); err != nil && !os.IsNotExist(err) {
						http.Error(w, "fixture failed", 500)
						return
					}
					if e := os.WriteFile(fakePiScenario, []byte(name), 0600); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
					scenario.Store(name)
					for _, current := range conversationHandlers {
						if name == "pi-recap" || name == "pi-recap-unsupported" {
							current.Load().(*daemon.ConversationController).FixtureSetRecapIdleDelay(600 * time.Millisecond)
						} else {
							current.Load().(*daemon.ConversationController).FixtureSetRecapIdleDelay(0)
						}
					}
					if name == "pi-onboarding" || name == "pi-blocked" {
						// An isolated onboarding case starts a new synthetic daemon
						// attempt and device. A previous browser may have left a native
						// helper running; its lease must not affect the next case.
						clock.Add(1)
						for i, attempt := range attempts {
							previous := devices[i]
							devices[i] = &daemon.PiDevice{Home: previous.Home, Node: previous.Node, Entry: previous.Entry, Manifest: previous.Manifest, FixtureHome: previous.FixtureHome}
							attempt.Store(daemon.PiAttemptHandler(configs[i], trusters[i], devices[i], clearAuth[i]))
						}
					}
				default:
					http.Error(w, "unknown scenario", 400)
					return
				}
				w.WriteHeader(204)
			case "/fixture/pi-visual-ready":
				if !lab {
					http.NotFound(w, r)
					return
				}
				if _, err := os.Stat(filepath.Join(tmp, "fakepi-visual-phase")); err != nil {
					w.WriteHeader(http.StatusConflict)
					return
				}
				w.WriteHeader(http.StatusNoContent)
				return
			case "/fixture/pi-restart":
				// Replace ephemeral leases as if each synthetic daemon restarted.
				for i, attempt := range attempts {
					attempt.Store(daemon.PiAttemptHandler(configs[i], trusters[i], devices[i], clearAuth[i]))
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
				// Cross the browser session's renewable 90-day idle deadline.
				clock.Add(90*24 + 1)
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

type fixtureBroker struct {
	identities []gateway.Identity
	limits     sync.Map
}

func (b *fixtureBroker) Exchange(_ context.Context, r gateway.BrokerRequest) (gateway.BrokerReply, error) {
	for _, m := range b.identities {
		if m.Subject == r.ID {
			return gateway.BrokerReply{Route: &gateway.BrokerRoute{UID: uint32(m.UID), Username: m.Username, Socket: m.Socket}, Epoch: 1, Generation: 1}, nil
		}
	}
	return gateway.BrokerReply{}, errors.New("not allowlisted")
}

func (b *fixtureBroker) ListBound(context.Context) ([]gateway.BoundUser, error) {
	users := []gateway.BoundUser{}
	for _, m := range b.identities {
		users = append(users, gateway.BoundUser{ID: m.Subject, Username: m.Username})
	}
	return users, nil
}
func (b *fixtureBroker) LookupBound(_ context.Context, id string) (bool, error) {
	for _, m := range b.identities {
		if m.Subject == id {
			return true, nil
		}
	}
	return false, nil
}
func (b *fixtureBroker) ReadQuota(_ context.Context, id string) (gateway.Quota, gateway.QuotaFilesystem, error) {
	limit := uint64(8 << 30)
	if v, ok := b.limits.Load(id); ok {
		limit = v.(uint64)
	}
	return gateway.Quota{UsageBytes: 2 << 30, LimitBytes: limit}, gateway.QuotaFilesystem{CapacityBytes: 40 << 30, FreeBytes: 32 << 30}, nil
}
func (b *fixtureBroker) SetQuota(_ context.Context, id string, limit uint64) error {
	b.limits.Store(id, limit)
	return nil
}

func seedBrowserHistory(path, cwd string, count int) error {
	f, e := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	defer f.Close()
	encode := json.NewEncoder(f)
	if e := encode.Encode(map[string]any{"type": "session", "version": 3, "id": "11111111-1111-4111-8111-111111111111", "cwd": cwd}); e != nil {
		return e
	}
	for i := 0; i < count; i++ {
		content := fmt.Sprintf("Synteettinen viesti %d", i)
		if strings.Contains(cwd, "/bob/") {
			content = fmt.Sprintf("Bobin synteettinen viesti %d", i)
		}
		if i == count-3 {
			content = strings.Repeat("ä", 40000) + "<script>alert('bad')</script>"
		}
		row := map[string]any{"type": "message", "id": fmt.Sprintf("native%04d", i), "message": map[string]any{"role": "user", "content": content}}
		if i == count-1 {
			row["type"] = "unknown_fixture"
		}
		if e := encode.Encode(row); e != nil {
			return e
		}
	}
	return f.Sync()
}
