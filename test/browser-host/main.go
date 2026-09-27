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
	if marker := os.Getenv("BROWSER_HOST_MARKER"); marker != "" {
		if e := os.MkdirAll(filepath.Dir(marker), 0700); e != nil {
			log.Fatal(e)
		}
		if e := os.WriteFile(marker, []byte(tmp), 0600); e != nil {
			log.Fatal(e)
		}
		defer os.Remove(marker)
	}
	identities := []gateway.Identity{{Provider: "github", Subject: "42", UID: 1001, Username: "alice", Socket: "/run/native-agent-host/users/alice/daemon.sock"}, {Provider: "github", Subject: "43", UID: 1002, Username: "bob", Socket: "/run/native-agent-host/users/bob/daemon.sock"}}
	var scenario atomic.Value
	scenario.Store("ready")
	var clock atomic.Int64
	paths := map[string]string{}
	histories := map[string]string{}
	peers := map[string]int{}
	var servers []*http.Server
	defer func() {
		for _, srv := range servers {
			_ = srv.Close()
		}
	}()
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
		mux := http.NewServeMux()
		mux.Handle("/api/v1/agents/", daemon.HistoryHandlerWithNativeRoot(cfg, func(r *http.Request) bool { return r.Context().Value("peer") == uid }, home))
		mux.Handle("/api/v1/content/", daemon.HistoryHandlerWithNativeRoot(cfg, func(r *http.Request) bool { return r.Context().Value("peer") == uid }, home))
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
	ts.Listener, e = net.Listen("tcp", "127.0.0.1:4174")
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
			case "/fixture/history":
				mode := r.URL.Query().Get("mode")
				path := histories["alice"]
				if mode == "missing" {
					if e := os.Remove(path); e != nil && !os.IsNotExist(e) {
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
				case "ready", "empty", "missing", "error", "partial", "malformed", "oversize", "delay", "native-error", "foreign":
					scenario.Store(name)
				default:
					http.Error(w, "unknown scenario", 400)
					return
				}
				w.WriteHeader(204)
			case "/fixture/expire":
				clock.Add(25)
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
