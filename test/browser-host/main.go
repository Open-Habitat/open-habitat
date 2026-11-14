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
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/open-habitat/open-habitat/internal/cli"
	"github.com/open-habitat/open-habitat/internal/core"
	"github.com/open-habitat/open-habitat/internal/daemon"
	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/gateway"
	"github.com/open-habitat/open-habitat/internal/testgitenv"
	"github.com/open-habitat/open-habitat/internal/transport"
)

type provider struct {
	origin       string
	challenges   sync.Map
	missingName  atomic.Bool
	missingEmail atomic.Bool // one-shot synthetic fixture for onboarding
}

func (p *provider) AuthorizationURL(state, challenge string, extraScopes []string) string {
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

// CheckRepository is the sign-in's access check: the synthetic person can
// read fixture/ and public-org/ repositories and nothing else.
func (p *provider) CheckRepository(_ context.Context, token, name string) string {
	if token != "synthetic-token" {
		return "check_failed"
	}
	if strings.HasPrefix(name, "fixture/") || strings.HasPrefix(name, "public-org/") {
		return "readable"
	}
	return "no_access"
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
	if p.missingName.Swap(false) {
		name = ""
	}
	email := login + "@example.invalid"
	if p.missingEmail.Swap(false) {
		email = ""
	}
	return token, id, login, gateway.AccountProfile{Name: name, Email: email}, nil
}

type sink struct {
	scenario *atomic.Value
	// The synthetic daemons' clone jobs, by subject, for the first-login plan.
	plans map[string]*daemon.CloneJobs
	// The synthetic daemons' native Pi credential helpers, by subject, for
	// the site AI key; seeded marks the fake Pi status usable, as native Pi
	// reports a literal key.
	seeds    map[string]*daemon.PiDevice
	piState  string
	seedFail *atomic.Bool
}

func (s sink) Deliver(context.Context, gateway.Identity, string, string) (gateway.Handoff, error) {
	if s.scenario.Load() == "native-error" {
		return "", errors.New("synthetic native failure")
	}
	return gateway.HandoffInUse, nil
}

// DeliverFirst answers the plan and the seed as the person's daemon does after
// installing the token: through that synthetic daemon's own clone jobs and
// its native Pi credential helper.
func (s sink) DeliverFirst(ctx context.Context, m gateway.Identity, subject, token string, first gateway.FirstLogin) (gateway.FirstLoginReply, error) {
	use, err := s.Deliver(ctx, m, subject, token)
	if err != nil {
		return gateway.FirstLoginReply{}, err
	}
	reply := gateway.FirstLoginReply{Token: use}
	if plan := first.Plan; plan != nil {
		jobs := s.plans[subject]
		if jobs == nil {
			return reply, errors.New("no synthetic daemon")
		}
		for _, o := range jobs.Plan(ctx, transport.Plan{Mode: plan.Mode, Defaults: plan.Defaults}) {
			reply.Defaults = append(reply.Defaults, gateway.PlanOutcome{FullName: o.FullName, Outcome: o.Outcome})
		}
	}
	if seed := first.Seed; seed != nil {
		device := s.seeds[subject]
		if device == nil {
			return reply, errors.New("no synthetic daemon")
		}
		reply.AIKey = "failed"
		if !s.seedFail.Load() {
			reply.AIKey = device.SeedSiteKey(ctx, seed.Provider, seed.Key)
		}
		if reply.AIKey == "seeded" {
			if err := os.WriteFile(s.piState, []byte("usable"), 0600); err != nil {
				return reply, err
			}
		}
	}
	return reply, nil
}
func main() {
	// Native Pi creates settings using the inherited umask. Keep invented
	// credentials/settings private, independently of the developer or runner.
	syscall.Umask(0077)
	// Git runs this binary as the registered Gitea credential helper, as it
	// runs the installed open-habitat binary in production.
	if len(os.Args) >= 2 && (os.Args[1] == "gitea" || os.Args[1] == "gitlab") {
		os.Exit(cli.Run(os.Args[1:], os.Stdout, os.Stderr))
	}
	// Playwright may run under `git bisect run` or a hook, which exports
	// GIT_DIR for the checkout; the fixtures' `git init` would then rewrite
	// that repository (marking it bare from a linked worktree).
	testgitenv.Scrub()
	// The daemon runs this binary as the fixture runtime's node; the icon
	// suggestion helper gets a synthetic model, other helpers none.
	if len(os.Args) >= 4 && os.Args[1] == "--input-type=module" && os.Args[2] == "-e" && strings.HasPrefix(os.Args[3], "// open-habitat icon suggestions") {
		os.Exit(runFakeIconModel())
	}
	guardLifetime(isFakePi(os.Args))
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
	giteaServer := startGiteaFixture(tmp)
	if giteaServer != nil {
		defer giteaServer.Close()
	}
	gitlabServer := startGitLabFixture(tmp)
	if gitlabServer != nil {
		defer gitlabServer.Close()
	}
	// Lab mode adds richer synthetic history and workspaces; both modes run
	// the real conversation controller against the fake Pi child.
	lab := os.Getenv("BROWSER_HOST_LAB") == "1"
	// Editor mode serves the app and the workspace editor on two sibling host
	// names, with a stand-in code-server unless BROWSER_HOST_CODE_SERVER names
	// a real one.
	editorMode := os.Getenv("BROWSER_HOST_EDITOR") == "1"
	// Views mode adds the per-view origin of agent HTML views (ADR 0032) on
	// the same sibling-host domain.
	viewsMode := os.Getenv("BROWSER_HOST_VIEWS") == "1"
	// Shared view links (ADR 0033) need views; the site's maximum is 90 days.
	viewLinkDays := 0
	if viewsMode && os.Getenv("BROWSER_HOST_VIEW_LINKS") == "1" {
		viewLinkDays = 90
	}
	// Ending the host stops a real code-server's process group.
	editorCtx, editorStop := context.WithCancel(context.Background())
	defer func() {
		editorStop()
		time.Sleep(200 * time.Millisecond)
	}()
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
	// A spec that depends on seeing the code holds it with
	// /fixture/pi-device-hold; otherwise the code lasts two seconds.
	piDeviceHold := filepath.Join(tmp, "pi-device-hold")
	deviceWait := "if [ -e " + piDeviceHold + " ]; then while [ -e " + piDeviceHold + " ] && kill -0 " + strconv.Itoa(os.Getpid()) + " 2>/dev/null; do sleep 0.1; done; else sleep 2; fi"
	if os.Getenv("BROWSER_HOST_HOLD_PI_DEVICE") == "1" {
		// Layout cases need a persistent native device-code state. The loop
		// also ends when this host exits, even after forced test teardown.
		deviceWait = "while kill -0 " + strconv.Itoa(os.Getpid()) + " 2>/dev/null; do sleep 0.1; done"
	}
	fakeScript := `#!/bin/sh
case "$6" in
 status) state=$(cat "` + piStateFile + `"); printf '{"type":"status","state":"%s"}\n' "$state" ;;
 login) printf '%s\n' '{"type":"device_code","verificationUri":"https://auth.openai.com/codex/device","userCode":"ABCD-1234"}'; ` + deviceWait + `; if [ "$(cat "` + piStateFile + `")" = usable ]; then printf '%s\n' '{"type":"completed"}'; else printf '%s\n' '{"type":"unknown"}'; fi ;;
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
	planTargets := map[string]*daemon.CloneJobs{}
	// The synthetic Soniox lives on this host's origin, known once the
	// listener is up.
	var sonioxBase atomic.Pointer[string]
	soniox := newSonioxFake(func() string { return *sonioxBase.Load() })
	seedTargets := map[string]*daemon.PiDevice{}
	var seedFail atomic.Bool
	var busyMu sync.Mutex
	var busy []*exec.Cmd
	defer func() {
		busyMu.Lock()
		defer busyMu.Unlock()
		for _, p := range busy {
			_ = p.Process.Kill()
			_ = p.Wait()
		}
	}()
	defer func() {
		for _, srv := range servers {
			_ = srv.Close()
		}
	}()
	gitProgram := filepath.Join(tmp, "synthetic-git")
	gitScript := `#!/bin/sh
if [ "$1" = clone ]; then
  # clone --progress [--filter=blob:none] -- <url> .
  n=0
  for a; do n=$((n+1)); [ "$n" -eq $(($#-1)) ] && url=$a; done
  /usr/bin/git init -q . || exit 1
  /usr/bin/git remote add origin "$url" || exit 1
  printf 'remote: https://host:secret@invalid.example/private\rReceiving objects: 22%% (1/4), 1.25 MiB\r' >&2
  # /fixture/clone: fail-once ends this clone as GitHub cutting the
  # connection; hold keeps it receiving until the marker is removed.
  if rm "__CTL__/clone-fail-once" 2>/dev/null; then
    printf 'Receiving objects: 31%% (2/4), 12.50 MiB\rfatal: early EOF\n' >&2
    exit 128
  fi
  if [ -e "__CTL__/clone-hold" ]; then
    printf 'Receiving objects: 14%% (1/4), 120.00 MiB\r' >&2
    while [ -e "__CTL__/clone-hold" ]; do sleep 1; done
  fi
  # A successful empty repository has neither refs nor an index.
  case "$url" in */last.git) exit 0 ;; esac
  sleep 0.2
  printf 'Updating files: 100%% (4/4)\n' >&2
  printf '%s\n' "$url" > .git/origin
  printf 'synthetic\n' > README.md
  : > .git/synthetic-head
  exit 0
fi
if [ ! -e .git/synthetic-head ]; then exec /usr/bin/git "$@"; fi
if [ "$1" = -c ]; then shift 2; fi
case "$1" in
 rev-parse) test -d .git || exit 1; if [ "$2" = --verify ]; then test -e .git/synthetic-head || exit 1; printf '0123456789abcdef0123456789abcdef01234567\n'; else printf 'true\n'; fi ;;
 for-each-ref) test -e .git/synthetic-head && printf 'refs/heads/main\n'; exit 0 ;;
 remote) cat .git/origin ;;
 config) cat .git/origin ;;
 status) test -d .git ;;
 *) exit 1 ;;
esac
`
	if e := os.WriteFile(gitProgram, []byte(strings.ReplaceAll(gitScript, "__CTL__", tmp)), 0700); e != nil {
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
		// Synthetic Taskfleet: unavailable until /fixture/taskfleet writes runs.
		if e := os.WriteFile(filepath.Join(bin, "taskfleet"), []byte(fakeTaskfleet), 0700); e != nil {
			log.Fatal(e)
		}
		// The shell's prompt names the invented identity, not the test's user.
		if e := os.WriteFile(filepath.Join(home, ".bash_profile"), []byte("PS1='\\[\\e[1;32m\\]"+m.Username+"@open-habitat-lab\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ '\nexport HISTFILE=/dev/null\n"), 0600); e != nil {
			log.Fatal(e)
		}
		for _, name := range []string{"git-project", "ordinary-dir", "without-metadata"} {
			if e := os.Mkdir(filepath.Join(home, "src", name), 0700); e != nil {
				log.Fatal(e)
			}
		}
		_ = os.Mkdir(filepath.Join(home, "src", "git-project", ".git"), 0700)
		{
			// A file for conversation links, independent of code-server availability.
			_ = os.MkdirAll(filepath.Join(home, "src", "git-project", "cmd"), 0700)
			_ = os.WriteFile(filepath.Join(home, "src", "git-project", "cmd", "main.go"), []byte("package main\n\nfunc main() {\n\tprintln(\"hei\")\n}\n"), 0600)
			writePreviewFixtures(filepath.Join(home, "src", "git-project", "cmd"))
		}
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
		discover := func(transport.Config) daemon.Discovery {
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
			if lab || scenario.Load() == "pi-onboarding" {
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
		}
		ghProgram := filepath.Join(tmp, "synthetic-gh-"+m.Username)
		ghScript := `#!/bin/sh
row() { printf '{"name":"%s","full_name":"%s/%s","private":%s,"description":%s,"pushed_at":%s,"html_url":"https://github.com/%s/%s","size":%s,"default_branch":"main","owner":{"login":"%s","type":"%s"}}' "$2" "$1" "$2" "$3" "$4" "$5" "$1" "$2" "$6" "$1" "$7"; }
if [ "$2" = --include ]; then
  case "$5" in
   /repos/fixture/*|/repos/public-org/*) owner="${5#/repos/}"; owner="${owner%%/*}"; name="${5##*/}"
     printf 'HTTP/2.0 200 OK\r\nContent-Type: application/json\r\n\r\n'
     row "$owner" "$name" false '"Synthetic lookup"' '"2026-10-01T10:00:00Z"' 2048 User; printf '\n' ;;
   *) printf 'HTTP/2.0 404 Not Found\r\nContent-Type: application/json\r\n\r\n{"message":"Not Found"}\n'; exit 1 ;;
  esac
  exit 0
fi
case "$4" in
 /user) printf '{"id":` + m.Subject + `,"login":"fixture","name":"Fixture Person"}\n' ;;
 /user/emails*) exit 1 ;;
 /user/repos*)
   case "$4" in
    *page=1\&*)
      printf '['
      row fixture first false '"Synthetic first"' '"2026-09-28T12:00:00Z"' 12 User
      printf ','; row fixture second true '"Synthetic second"' null 640000 User
      i=1
      while [ "$i" -le 48 ]; do
        printf ','; row fixture "$(printf 'repo%03d' "$i")" false null null 1 User
        i=$((i+1))
      done
      printf ','; row fixture last false null '"2025-01-01T00:00:00Z"' 1 User
      printf ','; row fixture older false null null 1 User
      printf ','; row synthetic-org org-tool true '"Organisation repository"' '"2026-09-20T09:00:00Z"' 4096 Organization
      printf ']\n' ;;
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
		mux.Handle(daemon.RepoLookupPath, daemon.RepoLookupHandlerWithFixtureGH(cfg, trusted, ghProgram, home))
		repoRoot, _ := filepath.Abs(filepath.Join(os.Args[1], "../.."))
		if giteaServer != nil {
			if e := giteaFixtureHome(home, giteaServer); e != nil {
				log.Fatal(e)
			}
		}
		if gitlabServer != nil {
			if e := gitlabFixtureHome(home, gitlabServer); e != nil {
				log.Fatal(e)
			}
		}
		catalog, forges := fixtureIntegrations(home, repoRoot, self, giteaServer, gitlabServer)
		handler := daemon.SnapshotHandlerWithNativeRootAndForges(cfg, func(r *http.Request) bool { return r.Context().Value("peer") == uid }, discover, home, forges)
		cloneJobs := daemon.NewCloneJobsWithFixturePrograms(context.Background(), cfg, trusted, home, ghProgram, gitProgram).WithForges(forges)
		planTargets[m.Subject] = cloneJobs
		clones := cloneJobs.Handler()
		mux.Handle(daemon.RepoClonesPath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost {
				cloneCalls.Add(1)
			}
			clones.ServeHTTP(w, r)
		}))
		mux.Handle(daemon.RepoCloneEventsPath, cloneJobs.Events())
		mux.Handle(daemon.RepoObservePath, daemon.RepoObserveHandlerWithFixtureGit(cfg, trusted, home, gitProgram, cloneJobs))
		mux.Handle("GET /api/v1/onboarding/pi/status", daemon.PiStatusHandler(cfg, trusted, status))
		mux.Handle("/api/v1/pi/models", piModelsFixture(home, trusted))
		nativePkg, _ := filepath.Abs(filepath.Join(os.Args[1], "../..", "internal/daemon/pi-device-test/node_modules/@earendil-works/pi-coding-agent"))
		nativeNode, _ := exec.LookPath("node")
		credentialDevice := &daemon.PiDevice{Home: home, Node: nativeNode, Entry: filepath.Join(nativePkg, "dist/index.js"), Manifest: filepath.Join(nativePkg, "package.json"), FixtureHome: true}
		seedTargets[m.Subject] = credentialDevice
		attachmentCfg := cfg
		attachmentCfg.Home = home
		attachments := daemon.AttachmentsHandler(attachmentCfg, trusted)
		mux.Handle(daemon.AttachmentsPath, attachments)
		mux.Handle(daemon.AttachmentsPath+"/", attachments)
		credentialHandler := daemon.PiCredentialsHandler(cfg, trusted, credentialDevice)
		for _, path := range daemon.PiCredentialPaths(daemon.PiCredentialsPath) {
			mux.Handle(path, credentialHandler)
		}
		// The gateway's own request giving the site key to a joined person,
		// decided by the same native Pi helper under Pi's lock.
		mux.Handle(daemon.SiteKeyPath, daemon.SiteKeyHandler(cfg, trusted, credentialDevice))
		speechCfg := cfg
		speechCfg.Home = home
		// The real handler and Pi's own SettingsManager, as with the keys above.
		mux.Handle(daemon.RecapSettingsPath, daemon.RecapSettingsHandler(speechCfg, trusted, credentialDevice))
		daemon.NewSpeechWithFixtureEndpoints(speechCfg, trusted, soniox.endpoints, soniox.client()).Mount(mux)
		// Exercise native Claude availability through the same handler as the daemon.
		// This synthetic host intentionally has no installed Claude runtime.
		mux.Handle("/api/v1/pi/claude-login", daemon.ClaudeLoginHandler(cfg, trusted, credentialDevice))

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
			c := daemon.ConversationHandlerWithFixtureRuntime(ctx, cfg, trusted, status, home, &core.PiRuntimeConfig{Node: self, Entry: "/synthetic/pi/dist/index.js", Manifest: "/synthetic/pi/package.json"})
			subject := cfg.Subject
			c.FixtureSetLiveLimits(func() ([]byte, error) { return liveFixture.file(subject) })
			// Only the recap scenarios' fake Pi can make a recap; elsewhere a
			// restarted daemon would only start Pis the cases do not expect.
			if name, _ := scenario.Load().(string); name == "pi-recap" || name == "pi-recap-unsupported" || name == "pi-recap-failing" {
				c.FixtureSetRecapIdleDelay(600 * time.Millisecond)
				c.FixtureRecapResting(ctx)
			}
			return c, cancel
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
		mux.Handle(daemon.WorkspaceGitPath, daemon.WorkspaceGitHandler(fixtureWorkspaceCfg, trusted))
		mux.Handle(daemon.WorkspaceGitFetchPath, daemon.WorkspaceGitFetchHandler(fixtureWorkspaceCfg, trusted, forges))
		mux.Handle(daemon.AccountPreferencesPath, daemon.AccountPreferencesHandler(fixtureWorkspaceCfg, trusted))
		// The real handler and the system's own ssh-keygen and age-keygen,
		// writing only into the disposable home.
		mux.Handle(daemon.AccountKeysPath, daemon.AccountKeysHandlerWithFixtureTools(fixtureWorkspaceCfg, trusted, "/usr/bin/ssh-keygen", "/usr/bin/age-keygen"))
		mux.Handle(daemon.FirstRoutePath, daemon.FirstRouteHandler(fixtureWorkspaceCfg, trusted))
		if _, own, e := newOwnMachinesHost(tmp, m.Username); e != nil {
			log.Fatal(e)
		} else {
			mux.Handle(daemon.OwnMachinesPath, daemon.OwnMachinesHandlerWithFixture(fixtureWorkspaceCfg, trusted, own))
		}
		mux.Handle(daemon.EditorFilesPrefix, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			current.Load().(*daemon.ConversationController).EditorFiles().ServeHTTP(w, r)
		}))
		mux.Handle(daemon.WorkspaceFilesPath, daemon.WorkspaceFilesHandler(fixtureWorkspaceCfg, trusted))
		mux.Handle(daemon.WorkspaceFilePreviewPath, daemon.WorkspaceFilePreviewHandler(fixtureWorkspaceCfg, trusted))
		mux.Handle(daemon.WorkspaceFileTreePath, daemon.WorkspaceFileTreeHandler(fixtureWorkspaceCfg, trusted))
		mux.Handle(daemon.WorkspaceIconPath, daemon.WorkspaceIconHandler(fixtureWorkspaceCfg, trusted))
		mux.Handle(daemon.WorkspaceStartPagePath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			current.Load().(*daemon.ConversationController).WorkspaceStartPage().ServeHTTP(w, r)
		}))
		mux.Handle(daemon.WorkspaceIconSuggestionsPath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			current.Load().(*daemon.ConversationController).WorkspaceIconSuggestions().ServeHTTP(w, r)
		}))
		mux.Handle(daemon.WorkspaceCommandsPath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			current.Load().(*daemon.ConversationController).WorkspaceCommands().ServeHTTP(w, r)
		}))
		// Real shells: tmux and bash run as the test's own UID in the invented
		// home, on a tmux server that ends with this host.
		daemon.MountTerminalFixture(context.Background(), mux, fixtureWorkspaceCfg, trusted, filepath.Join(tmp, "tmux-"+m.Username), diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username, "component", "terminal"))
		mux.Handle(daemon.WorkspacePath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			daemon.WorkspaceHandlerWithArchive(fixtureWorkspaceCfg, trusted, current.Load().(*daemon.ConversationController)).ServeHTTP(w, r)
		}))
		mux.Handle("/api/v1/conversations", serveConversation)
		mux.Handle("/api/v1/conversations/", serveConversation)
		mux.Handle("/api/v1/events", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if scenario.Load() != "ready" && scenario.Load() != "pi-deltas" && scenario.Load() != "pi-typed" && scenario.Load() != "pi-visual-hold" && scenario.Load() != "pi-auth-failure" && scenario.Load() != "pi-model-unsupported" && scenario.Load() != "pi-recap" && scenario.Load() != "pi-recap-unsupported" && scenario.Load() != "pi-recap-failing" && scenario.Load() != "pi-rewind" && scenario.Load() != "pi-slow-start" && scenario.Load() != "pi-start-fail" && scenario.Load() != "pi-slow-intake" {
				http.NotFound(w, r) // Fault scenarios exercise the HTTP fallback.
				return
			}
			current.Load().(*daemon.ConversationController).FixtureEvents().ServeHTTP(w, r)
		}))
		fileOffers := daemon.FileOffersHandler(fixtureWorkspaceCfg, trusted)
		mux.Handle(daemon.FileOffersPath, fileOffers)
		mux.Handle(daemon.FileOffersPath+"/", fileOffers)
		if viewsMode {
			views := daemon.ViewsHandler(fixtureWorkspaceCfg, trusted)
			mux.Handle(daemon.ViewsPath, views)
			mux.Handle(daemon.ViewsPath+"/", views)
			mux.Handle(daemon.ViewExportPrefix, daemon.ViewExportHandler(fixtureWorkspaceCfg, trusted))
		}
		// The person's server browser: a stand-in host (browser.go), or the
		// real one where BROWSER_HOST_REAL_BROWSER names Xvnc and Chrome.
		daemon.MountBrowserFixture(context.Background(), mux, fixtureWorkspaceCfg, trusted, daemon.BrowserFixture{Dir: filepath.Join(tmp, "browser-"+m.Username), Start: newBrowserStart(tmp, m.Username)}, diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username, "component", "browser"))
		if editorMode {
			editorDir := filepath.Join(tmp, "editor-"+filepath.Base(home))
			daemon.MountEditorFixture(editorCtx, mux, fixtureWorkspaceCfg, trusted, editorDir, os.Getenv("BROWSER_HOST_CODE_SERVER"), startFakeEditor, diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username))
		}
		mux.Handle("/api/v1/agents/", daemon.HistoryHandlerWithNativeRoot(cfg, trusted, home))
		mux.Handle(daemon.ContextDetailPattern, daemon.ContextDetailHandlerWithNativeRoot(cfg, trusted, credentialDevice, home))
		mux.Handle("/api/v1/content/", daemon.HistoryHandlerWithNativeRoot(cfg, trusted, home))
		catalog.Start(context.Background())
		integrationRoutes := catalog.Handler(func(r *http.Request) bool {
			return trusted(r) && r.Host == "unix" && r.ProtoMajor == 1 && r.ProtoMinor == 1
		})
		for _, path := range []string{integrations.ListPath, integrations.AccountsPath, integrations.LoginPath, integrations.GiteaPath, integrations.GiteaReposPath, integrations.GitLabPath, integrations.GitLabReposPath, integrations.GitLabTokensPath, integrations.FilesPath} {
			mux.Handle(path, integrationRoutes)
		}
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
			case "ready", "pi-deltas", "pi-typed", "pi-visual-hold", "pi-auth-failure", "pi-model-unsupported", "pi-recap", "pi-recap-unsupported", "pi-recap-failing", "pi-rewind", "pi-slow-start", "pi-start-fail", "pi-slow-intake":
				current.Load().(*daemon.ConversationController).FixtureSnapshotWithForges(forges).ServeHTTP(w, r)
				return

			}
			handler.ServeHTTP(w, r)
		}))
		// Match the production daemon's response deadline. A deadline-free lab
		// hid lost creation replies when native Pi startup exceeded five seconds.
		logged := daemon.RequestLog(diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username), trusted, mux)
		srv := &http.Server{Handler: logged, WriteTimeout: 5 * time.Second, ConnContext: func(ctx context.Context, c net.Conn) context.Context {
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
	// BROWSER_HOST_EDGE puts a relay that a test can break (/fixture/edge)
	// on the public port, between the browser and the TLS gateway.
	var edge *edgeRelay
	public := listen
	if os.Getenv("BROWSER_HOST_EDGE") == "1" {
		listen = "127.0.0.1:0"
	}
	ts.Listener, e = net.Listen("tcp", listen)
	if e != nil {
		log.Fatal(e)
	}
	origin := "https://" + ts.Listener.Addr().String()
	if listen != public {
		ln, err := net.Listen("tcp", public)
		if err != nil {
			log.Fatal(err)
		}
		edge = newEdgeRelay(ln, ts.Listener.Addr().String())
		origin = "https://" + ln.Addr().String()
	}
	editorOrigin, viewOrigin := "", ""
	if editorMode || viewsMode {
		// Same-site sibling hosts, as the installation's app and editor
		// hosts are; browsers resolve *.localhost to the loopback listener.
		domain := "oh.localhost"
		if d := os.Getenv("BROWSER_HOST_EDITOR_DOMAIN"); d != "" {
			domain = d // for browsers that resolve *.localhost differently
		}
		origin = "https://app." + domain + ":" + strconv.Itoa(port)
		if editorMode {
			editorOrigin = "https://oh-code-*." + domain
		}
		if viewsMode {
			viewOrigin = "https://oh-view-*." + domain
		}
	}
	sonioxBase.Store(&origin)
	fixtureProvider := &provider{origin: origin}
	adminPath := filepath.Join(tmp, "administration.json")
	if err := os.WriteFile(adminPath, []byte(`{"version":1,"name":"Synthetic lab","administrators":["42"],"default_limit_bytes":8589934592}`), 0600); err != nil {
		log.Fatal(err)
	}
	broker := &fixtureBroker{identities: identities, created: map[string]bool{}, access: newFixtureAccess()}
	var currentAuth atomic.Pointer[gateway.Auth]
	// /fixture/upgrade replaces the served bundle and the gateway's version, as
	// a release switch does; the main loop reads both only when it restarts.
	var release atomic.Int32
	webDir := os.Args[1]
	newProduct := func() http.Handler {
		version := "0.0.0-lab"
		if n := release.Load(); n > 0 {
			version += "." + strconv.Itoa(int(n))
		}
		auth, err := gateway.NewAuth(gateway.OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: origin, EditorOrigin: editorOrigin, ViewOrigin: viewOrigin, ViewLinkMaxDays: viewLinkDays, CallbackURL: origin + "/auth/github/callback"}, gateway.AuthOptions{Version: version, Commit: strings.Repeat(strconv.Itoa(int(release.Load())%10), 40), Provider: fixtureProvider, Sink: sink{&scenario, planTargets, seedTargets, piStateFile, &seedFail}, Broker: broker, AdminFile: adminPath, SiteKeyFile: filepath.Join(tmp, "site-ai-key.json"), SessionFile: filepath.Join(tmp, "sessions.json"), Now: func() time.Time { return time.Now().Add(time.Duration(clock.Load()) * time.Hour) }, SnapshotDial: func(ctx context.Context, p string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", paths[p])
		}, SnapshotPeerUID: func(c *net.UnixConn) int { return peers[c.RemoteAddr().String()] }})
		if err != nil {
			log.Fatal(err)
		}
		currentAuth.Store(auth)
		return gateway.NewWithAuth(webDir, auth)
	}
	product := newProduct()
	gatewayRestart := make(chan struct{}, 1)
	// /fixture/edge-hold-head makes the event stream behave as the live
	// Cloudflare route does: the browser receives the response head only
	// together with the first body bytes, not on a bare header flush.
	var edgeHoldHead atomic.Bool
	delayReply := replyDelayFromEnv()
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/fixture/soniox" || strings.HasPrefix(r.URL.Path, "/fixture/soniox/") {
			soniox.serve(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/fixture/") {
			switch r.URL.Path {
			case "/fixture/lab-marker":
				if !lab {
					http.NotFound(w, r)
					return
				}
				w.WriteHeader(http.StatusNoContent)
				return
			case "/fixture/upgrade":
				// A new release: the same assets under different index.html
				// references, so the bundle identity changes but still loads.
				n := release.Load() + 1
				dir, e := upgradedWeb(os.Args[1], filepath.Join(tmp, "web-release-"+strconv.Itoa(int(n))), int(n))
				if e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				webDir = dir
				release.Store(n)
				w.WriteHeader(http.StatusNoContent)
				w.(http.Flusher).Flush()
				gatewayRestart <- struct{}{}
				return
			case "/fixture/edge":
				// freeze: existing connections go silent (a laptop's sleep, a
				// proxy that drops an idle stream without telling anyone);
				// cut: they are reset; down&ms=N: no route for N ms.
				mode := r.URL.Query().Get("mode")
				ms, _ := strconv.Atoi(r.URL.Query().Get("ms"))
				if edge == nil || (mode != "freeze" && mode != "cut" && mode != "down") || ms < 0 || ms > 120000 {
					http.Error(w, "invalid fixture", 400)
					return
				}
				w.WriteHeader(http.StatusNoContent)
				w.(http.Flusher).Flush()
				edge.apply(mode, r.RemoteAddr, time.Duration(ms)*time.Millisecond)
				return
			case "/fixture/edge-hold-head":
				edgeHoldHead.Store(true)
				w.WriteHeader(http.StatusNoContent)
				return
			case "/fixture/gateway-restart":
				w.WriteHeader(http.StatusNoContent)
				w.(http.Flusher).Flush()
				gatewayRestart <- struct{}{}
				return
			case "/fixture/daemon-restart":
				// Restart the actual Unix HTTP servers as well as their controller
				// incarnations. The gateway/session and invented native homes survive.
				// The fake Pi marks a turn the restart cuts, as Pi's companion does
				// when the daemon stops it for its own restart.
				restarting := filepath.Join(tmp, "fakepi-restarting")
				if err := os.WriteFile(restarting, nil, 0600); err != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				defer os.Remove(restarting)
				for i, srv := range servers {
					if err := srv.Close(); err != nil {
						http.Error(w, "fixture close failed", 500)
						return
					}
					if r.URL.Query().Get("transport_only") != "1" {
						// A restart receipt means the old native writers and
						// ownership fences are gone, not just cancellation queued.
						conversationHandlers[i].Load().(*daemon.ConversationController).FixtureShutdown()
						conversations, cancel := conversationFactories[i]()
						previous := conversationCancels[i]
						conversationHandlers[i].Store(conversations)
						conversationCancels[i] = cancel
						previous()
					}
					ln, err := net.Listen("unix", paths[identities[i].Socket])
					if err != nil {
						http.Error(w, "fixture listen failed", 500)
						return
					}
					next := &http.Server{Handler: srv.Handler, WriteTimeout: srv.WriteTimeout, ConnContext: srv.ConnContext}
					servers[i] = next
					go next.Serve(ln)
				}
				w.WriteHeader(http.StatusNoContent)
				return
			case "/fixture/conversations-reset":
				// Each browser case starts from Pi's native unset default.
				if err := os.Remove(filepath.Join(tmp, "fakepi-ai-refused")); err != nil && !os.IsNotExist(err) {
					http.Error(w, "fixture failed", 500)
					return
				}
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
			case "/fixture/clone":
				// Steers the synthetic git clone: hold, release, fail-once or normal.
				hold, fail := filepath.Join(tmp, "clone-hold"), filepath.Join(tmp, "clone-fail-once")
				var err error
				switch r.URL.Query().Get("mode") {
				case "hold":
					err = os.WriteFile(hold, nil, 0600)
				case "release":
					err = os.Remove(hold)
				case "fail-once":
					err = os.WriteFile(fail, nil, 0600)
				case "normal":
					_ = os.Remove(hold)
					_ = os.Remove(fail)
				default:
					http.Error(w, "invalid fixture", 400)
					return
				}
				if err != nil && !os.IsNotExist(err) {
					http.Error(w, "fixture failed", 500)
					return
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
				if mode == "gitea-interrupted" {
					giteaInterruptedFixture(giteaServer, filepath.Join(tmp, "alice"), name, w)
					return
				}
				if (name != "first" && name != "second") || (mode != "existing" && mode != "conflict" && mode != "absent" && mode != "interrupted") {
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
					if e := os.WriteFile(filepath.Join(destination, ".git", "synthetic-head"), nil, 0600); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
					if e := os.WriteFile(filepath.Join(destination, ".git", "origin"), []byte("https://github.com/fixture/"+name+".git\n"), 0600); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				}
				if mode == "interrupted" {
					// What git clone leaves when the daemon stops mid-receive.
					origin := "https://github.com/fixture/" + name + ".git"
					for _, args := range [][]string{{"init", "-q", destination}, {"-C", destination, "remote", "add", "origin", origin}} {
						if out, e := exec.Command("/usr/bin/git", args...).CombinedOutput(); e != nil {
							http.Error(w, "fixture failed: "+string(out), 500)
							return
						}
					}
					if e := os.WriteFile(filepath.Join(destination, ".git", "origin"), []byte(origin+"\n"), 0600); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				}
				w.WriteHeader(204)
				return
			case "/fixture/open-at-end":
				if !lab {
					http.NotFound(w, r)
					return
				}
				if err := seedOpeningHistory(filepath.Join(tmp, "alice")); err != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				w.WriteHeader(204)
				return
			case "/fixture/view":
				id, ok := conversationHandlers[0].Load().(*daemon.ConversationController).FixtureView(r.URL.Query().Get("target"))
				if !ok {
					http.Error(w, "fixture failed", 400)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprintf(w, `{"view_id":%q}`, id)
				return
			case "/fixture/files":
				ids, ok := conversationHandlers[0].Load().(*daemon.ConversationController).FixtureFiles(r.URL.Query().Get("target"), r.URL.Query().Get("set"))
				if !ok {
					http.Error(w, "fixture failed", 400)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]any{"offer_ids": ids})
				return
			case "/fixture/files-remove":
				if !conversationHandlers[0].Load().(*daemon.ConversationController).FixtureRemoveFiles(r.URL.Query().Get("id")) {
					http.Error(w, "fixture failed", 400)
					return
				}
				w.WriteHeader(204)
				return
			case "/fixture/own-machines":
				ownMachinesFixture(w, r)
				return
			case "/fixture/browser":
				fakeBrowserFixture(w, r, "alice")
				return
			case "/fixture/agent-files":
				if e := seedAgentFiles(filepath.Join(tmp, "alice")); e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				w.WriteHeader(204)
				return
			case "/fixture/agent-key":
				// The agent, as the same Unix user, makes a key beside the
				// page: ssh-keygen in the person's home, outside the page.
				home := filepath.Join(tmp, "alice")
				name := r.URL.Query().Get("name")
				if name != "id_ed25519" && name != "deploy_ed25519" {
					http.Error(w, "unknown key", 400)
					return
				}
				_ = os.Mkdir(filepath.Join(home, ".ssh"), 0700)
				_ = os.Remove(filepath.Join(home, ".ssh", name))
				_ = os.Remove(filepath.Join(home, ".ssh", name+".pub"))
				if e := exec.Command("/usr/bin/ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "agent@example", "-f", filepath.Join(home, ".ssh", name)).Run(); e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				w.WriteHeader(204)
				return
			case "/fixture/heavy":
				mib, _ := strconv.Atoi(r.URL.Query().Get("mib"))
				if e := appendHeavyHistory(filepath.Join(tmp, "alice"), r.URL.Query().Get("id"), mib); e != nil {
					http.Error(w, "fixture failed", 400)
					return
				}
				w.WriteHeader(204)
				return
			case "/fixture/notice":
				if !conversationHandlers[0].Load().(*daemon.ConversationController).FixtureNotice(r.URL.Query().Get("id"), r.URL.Query().Get("text")) {
					http.Error(w, "fixture failed", 400)
					return
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
				} else if mode == "notice" {
					row := map[string]any{"type": "custom", "id": "notice1", "parentId": nil, "timestamp": "2026-10-21T10:00:00Z", "customType": "oh-agent-notice", "data": map[string]any{"notice_id": "22222222-2222-4222-8222-222222222222", "origin": "agent", "timestamp": "2026-10-21T10:00:00Z", "text": "Synthetic notice <img src=x onerror=alert(1)> <script>alert(1)</script>", "persistence": "unknown"}}
					header, _ := json.Marshal(map[string]any{"type": "session", "version": 3, "id": "11111111-1111-4111-8111-111111111111", "cwd": filepath.Join(tmp, "alice", "src", "ordinary-dir")})
					encoded, _ := json.Marshal(row)
					if e := os.WriteFile(path, append(append(header, '\n'), append(encoded, '\n')...), 0600); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				} else if mode == "images" {
					if e := seedImageHistory(path, filepath.Join(tmp, "alice"), filepath.Join(tmp, "alice", "src", "ordinary-dir")); e != nil {
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
				} else if mode == "several" {
					// Three short settled conversations beside the default
					// one, for archiving several in quick succession.
					if e := seedSeveralHistories(filepath.Dir(path), filepath.Join(tmp, "alice", "src", "ordinary-dir")); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				} else if mode == "turn-changes" {
					if e := seedTurnChangesHistory(path, filepath.Join(tmp, "alice", "src", "ordinary-dir")); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				} else if mode == "tool-heavy" {
					if e := seedToolHeavyHistory(path, filepath.Join(tmp, "alice", "src", "ordinary-dir"), 150); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
				} else if mode == "ready" || mode == "short" || mode == "cut-off" {
					// A 100-message tail page and two older pages reach the
					// untrusted oldest rows.
					if e := seedBrowserHistory(path, filepath.Join(tmp, "alice", "src", "ordinary-dir"), 251); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
					if mode == "cut-off" {
						f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
						if err != nil {
							http.Error(w, "fixture failed", 500)
							return
						}
						_, err = f.WriteString(`{"type":"message","id":"cut","message":{"role":"assistant","content":"lost`)
						closeErr := f.Close()
						if err != nil || closeErr != nil {
							http.Error(w, "fixture failed", 500)
							return
						}
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
			case "/fixture/onboarding":
				// Root's admin onboarding update, as the installing agent runs
				// it: mode, comma-separated defaults, integration steps
				// ("google:required,microsoft"; none when absent) and the AI
				// offer ("all" when absent).
				defaults := []string{}
				if raw := r.URL.Query().Get("defaults"); raw != "" {
					defaults = strings.Split(raw, ",")
				}
				steps := []any{}
				if raw := r.URL.Query().Get("integrations"); raw != "" {
					for _, item := range strings.Split(raw, ",") {
						provider, flag, _ := strings.Cut(item, ":")
						steps = append(steps, map[string]any{"provider": provider, "required": flag == "required"})
					}
				}
				mode := r.URL.Query().Get("mode")
				if mode == "" {
					mode = "preselected"
				}
				offer := r.URL.Query().Get("offer")
				if offer == "" {
					offer = "all"
				}
				shown, err := currentAuth.Load().AdminControl(r.Context(), []byte(`{"operation":"onboarding_show"}`))
				var current struct {
					Version int `json:"version"`
				}
				if err != nil || json.Unmarshal(shown, &current) != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				doc, _ := json.Marshal(map[string]any{"repositories": map[string]any{"mode": mode, "defaults": defaults}, "integrations": steps, "ai_account": map[string]any{"offer": offer}})
				payload, _ := json.Marshal(map[string]any{"operation": "onboarding_update", "expected_version": current.Version, "document": json.RawMessage(doc)})
				if _, err := currentAuth.Load().AdminControl(r.Context(), payload); err != nil {
					http.Error(w, "fixture refused", 400)
					return
				}
				w.WriteHeader(204)
				return
			case "/fixture/seed-fail":
				// The next seeds answer failed, as a daemon whose native Pi
				// write did not succeed.
				seedFail.Store(r.URL.Query().Get("value") != "0")
				w.WriteHeader(204)
				return
			case "/fixture/profile-missing-name":
				fixtureProvider.missingName.Store(true)
				w.WriteHeader(204)
				return
			case "/fixture/profile-missing-email":
				fixtureProvider.missingEmail.Store(true)
				w.WriteHeader(204)
				return
			case "/fixture/recap-hold":
				// Hold exactly one fake model call across a daemon restart.
				if r.URL.Query().Get("arm") == "1" {
					_ = os.Remove(filepath.Join(tmp, "fakepi-recap-started"))
					if err := os.WriteFile(filepath.Join(tmp, "fakepi-recap-hold"), nil, 0600); err != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
					w.WriteHeader(204)
				} else if _, err := os.Stat(filepath.Join(tmp, "fakepi-recap-started")); err == nil {
					w.WriteHeader(204)
				} else {
					w.WriteHeader(404)
				}
				return
			case "/fixture/scenario":
				name := r.URL.Query().Get("value")
				switch name {
				case "ready", "empty", "missing", "error", "partial", "malformed", "oversize", "delay", "native-error", "pi-blocked", "pi-onboarding", "pi-deltas", "pi-typed", "pi-visual-hold", "pi-auth-failure", "pi-model-unsupported", "pi-recap", "pi-recap-unsupported", "pi-recap-failing", "pi-rewind", "pi-slow-start", "pi-start-fail", "pi-slow-intake":
					// Read by the fake Pi child at turn start. Switching back to ready
					// keeps subsequent lab cases on the old, faster fixture.
					if err := os.Remove(filepath.Join(tmp, "fakepi-start-fail")); err != nil && !os.IsNotExist(err) {
						http.Error(w, "fixture failed", 500)
						return
					}
					if err := os.Remove(filepath.Join(tmp, "fakepi-visual-phase")); err != nil && !os.IsNotExist(err) {
						http.Error(w, "fixture failed", 500)
						return
					}
					if e := os.WriteFile(fakePiScenario, []byte(name), 0600); e != nil {
						http.Error(w, "fixture failed", 500)
						return
					}
					scenario.Store(name)
					// A recap case may wait longer than its fake Pi takes to
					// reach the idle stop, as a delay past ten minutes does.
					recapDelay := 600 * time.Millisecond
					if ms, err := strconv.Atoi(r.URL.Query().Get("recap_delay_ms")); err == nil && ms > 0 && ms <= 60000 {
						recapDelay = time.Duration(ms) * time.Millisecond
					}
					for _, current := range conversationHandlers {
						if name == "pi-recap" || name == "pi-recap-unsupported" || name == "pi-recap-failing" {
							current.Load().(*daemon.ConversationController).FixtureSetRecapIdleDelay(recapDelay)
						} else {
							current.Load().(*daemon.ConversationController).FixtureSetRecapIdleDelay(0)
						}
						// A slow Pi misses a two-second budget for taking in a
						// prompt with a few megabytes of images.
						if name == "pi-slow-intake" {
							current.Load().(*daemon.ConversationController).FixtureSetPromptTimeout(2 * time.Second)
						} else {
							current.Load().(*daemon.ConversationController).FixtureSetPromptTimeout(0)
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
			case "/fixture/ai-refused":
				// claude: the fake Pi's Claude refuses every prompt, as an
				// expired subscription does. off: a sign-in, which rewrites
				// Claude Code's own credential store.
				value := r.URL.Query().Get("value")
				if value != "claude" && value != "off" {
					http.Error(w, "unknown value", 400)
					return
				}
				if e := os.WriteFile(filepath.Join(tmp, "fakepi-ai-refused"), []byte(value), 0600); e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				if value == "off" {
					for _, user := range []string{"alice", "bob"} {
						store := filepath.Join(tmp, user, ".claude", ".credentials.json")
						if os.MkdirAll(filepath.Dir(store), 0700) != nil || os.WriteFile(store, []byte("{}"), 0600) != nil {
							http.Error(w, "fixture failed", 500)
							return
						}
					}
				}
				w.WriteHeader(204)
			case "/fixture/idle-stop":
				// The daemon's idle timeout, without waiting ten minutes.
				for _, current := range conversationHandlers {
					current.Load().(*daemon.ConversationController).FixtureIdleStop(r.Context())
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
			case "/fixture/keep-workspaces":
				// One- and two-workspace homes: only the named workspaces stay in
				// Alice's disposable ~/src; the others are removed outright.
				var keep []string
				for _, n := range strings.Split(r.URL.Query().Get("names"), ",") {
					if !regexp.MustCompile(`^[a-z0-9-]{1,40}$`).MatchString(n) {
						http.Error(w, "invalid fixture", 400)
						return
					}
					keep = append(keep, n)
				}
				src := filepath.Join(tmp, "alice", "src")
				entries, e := os.ReadDir(src)
				if e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				for _, entry := range entries {
					if !slices.Contains(keep, entry.Name()) {
						if e := os.RemoveAll(filepath.Join(src, entry.Name())); e != nil {
							http.Error(w, "fixture failed", 500)
							return
						}
					}
				}
				w.WriteHeader(204)
				return
			case "/fixture/pushed-clone":
				// A clean clone whose remote holds every commit: a bare
				// repository inside the disposable home, so the fetch before an
				// outright deletion runs offline. Ignored files are local only.
				if !lab {
					http.NotFound(w, r)
					return
				}
				name := r.URL.Query().Get("name")
				if name != "kokeilu-wasm" && name != "vanha-demo" {
					http.Error(w, "invalid fixture", 400)
					return
				}
				if e := labPushedClone(filepath.Join(tmp, "alice"), name); e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				w.WriteHeader(204)
				return
			case "/fixture/worktrees":
				// Linked worktrees of aurinkokello in each Git state, one of
				// them owned by a live synthetic Taskfleet run.
				if !lab {
					http.NotFound(w, r)
					return
				}
				if e := labWorktrees(filepath.Join(tmp, "alice")); e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				w.WriteHeader(204)
				return
			case "/fixture/busy-process":
				// A real same-UID process whose cwd is in the workspace, so the
				// daemon's /proc scan blocks deletion. It ends with the host.
				if !lab {
					http.NotFound(w, r)
					return
				}
				name := r.URL.Query().Get("name")
				if name != "reseptikirja" {
					http.Error(w, "invalid fixture", 400)
					return
				}
				busyMu.Lock()
				defer busyMu.Unlock()
				if r.URL.Query().Get("stop") == "1" {
					for _, p := range busy {
						_ = p.Process.Kill()
						_ = p.Wait()
					}
					busy = nil
					w.WriteHeader(204)
					return
				}
				cmd := exec.Command("/bin/sleep", "600")
				cmd.Dir = filepath.Join(tmp, "alice", "src", name)
				if e := cmd.Start(); e != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				busy = append(busy, cmd)
				w.WriteHeader(204)
				return
			case "/fixture/cross-workspace":
				if e := crossWorkspaceFixture(filepath.Join(tmp, "alice"), r.URL.Query().Get("parent")); e != nil {
					http.Error(w, "fixture failed", 400)
					return
				}
				w.WriteHeader(204)
			case "/fixture/taskfleet":
				// One spinoff of a parent session, in a native-shaped run record
				// whose manifest the snapshot's listing cache stamps.
				q := r.URL.Query()
				if e := writeFakeTaskfleet(filepath.Join(tmp, "alice"), q.Get("parent"), q.Get("workspace"), q.Get("status")); e != nil {
					http.Error(w, "fixture failed", 400)
					return
				}
				if q.Get("harness") == "claude" {
					if e := writeFakeClaudeWorker(filepath.Join(tmp, "alice"), q.Get("workspace"), q.Get("history"), q.Get("landed") == "1"); e != nil {
						http.Error(w, "fixture failed", 400)
						return
					}
				}
				w.WriteHeader(204)
			case "/fixture/pi-start-fail":
				// on=1 makes every following Pi start fail; anything else ends it.
				flag := filepath.Join(tmp, "fakepi-start-fail")
				var err error
				if r.URL.Query().Get("on") == "1" {
					err = os.WriteFile(flag, nil, 0600)
				} else if err = os.Remove(flag); os.IsNotExist(err) {
					err = nil
				}
				if err != nil {
					http.Error(w, "fixture failed", 500)
					return
				}
				w.WriteHeader(204)
			case "/fixture/pi-restart":
				// Replace ephemeral leases as if each synthetic daemon restarted.
				for i, attempt := range attempts {
					attempt.Store(daemon.PiAttemptHandler(configs[i], trusters[i], devices[i], clearAuth[i]))
				}
				w.WriteHeader(204)
			case "/fixture/pi-device-hold":
				var e error
				switch r.URL.Query().Get("value") {
				case "on":
					e = os.WriteFile(piDeviceHold, nil, 0600)
				case "off":
					if e = os.Remove(piDeviceHold); errors.Is(e, os.ErrNotExist) {
						e = nil
					}
				default:
					http.Error(w, "unknown hold", 400)
					return
				}
				if e != nil {
					http.Error(w, "fixture failed", 500)
					return
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
			case "/fixture/gitea":
				giteaFixtureControl(giteaServer, w, r)
				return
			case "/fixture/gitlab":
				gitlabFixtureControl(gitlabServer, w, r)
				return
			case "/fixture/integrations":
				if !integrationFixture.set(r.URL.Query()) {
					http.Error(w, "unknown integration fixture action", 400)
					return
				}
				w.WriteHeader(204)
				return
			case "/fixture/integration-apps":
				if err := appFixture.fixture(r.URL.Query()); err != nil {
					http.Error(w, err.Error(), 400)
					return
				}
				w.WriteHeader(204)
			case "/fixture/access":
				if err := broker.fixture(r.URL.Query()); err != nil {
					http.Error(w, err.Error(), 400)
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
		if r.URL.Path == "/api/v1/events" && edgeHoldHead.Load() {
			w = &headHoldingWriter{ResponseWriter: w}
		}
		if !delayReply(w, r) {
			return
		}
		product.ServeHTTP(w, r)
	})
	ts.Config.Handler = handler
	ts.TLS = &tls.Config{MinVersion: tls.VersionTLS12}
	ts.StartTLS()
	defer func() { ts.CloseClientConnections(); ts.Close() }()
	fmt.Println("BROWSER_HOST_READY " + ts.URL)
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	defer signal.Stop(stop)
	for {
		select {
		case <-stop:
			return
		case <-gatewayRestart:
			// Replace the real TLS listener/server and the production gateway auth
			// instance. Only the durable session file and invented homes survive.
			address := ts.Listener.Addr().String()
			ts.CloseClientConnections()
			ts.Close()
			product = newProduct()
			ts = httptest.NewUnstartedServer(handler)
			_ = ts.Listener.Close()
			ts.Listener, e = net.Listen("tcp", address)
			if e != nil {
				log.Fatal(e)
			}
			ts.TLS = &tls.Config{MinVersion: tls.VersionTLS12}
			ts.StartTLS()
		}
	}
}

// upgradedWeb links every entry of the built bundle into dir and rewrites
// index.html so that its asset references carry ?release=n.
// headHoldingWriter sends the status and headers only with the first body
// bytes, as a buffering edge proxy does; a flush before them sends nothing.
type headHoldingWriter struct {
	http.ResponseWriter
	status int
	sent   bool
}

func (w *headHoldingWriter) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
}

func (w *headHoldingWriter) Write(b []byte) (int, error) {
	if !w.sent && len(b) > 0 {
		w.sent = true
		if w.status == 0 {
			w.status = http.StatusOK
		}
		w.ResponseWriter.WriteHeader(w.status)
	}
	return w.ResponseWriter.Write(b)
}

func (w *headHoldingWriter) Flush() {
	if w.sent {
		w.ResponseWriter.(http.Flusher).Flush()
	}
}

func (w *headHoldingWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func upgradedWeb(source, dir string, n int) (string, error) {
	if e := os.Mkdir(dir, 0700); e != nil {
		return "", e
	}
	entries, e := os.ReadDir(source)
	if e != nil {
		return "", e
	}
	for _, entry := range entries {
		if entry.Name() == "index.html" {
			continue
		}
		if e := os.Symlink(filepath.Join(source, entry.Name()), filepath.Join(dir, entry.Name())); e != nil {
			return "", e
		}
	}
	index, e := os.ReadFile(filepath.Join(source, "index.html"))
	if e != nil {
		return "", e
	}
	mark := "?release=" + strconv.Itoa(n)
	page := strings.NewReplacer(`.js"`, `.js`+mark+`"`, `.css"`, `.css`+mark+`"`).Replace(string(index))
	return dir, os.WriteFile(filepath.Join(dir, "index.html"), []byte(page), 0600)
}

type fixtureBroker struct {
	access     *fixtureAccess
	identities []gateway.Identity
	limits     sync.Map
	mu         sync.Mutex
	created    map[string]bool
}

// Exchange binds each synthetic person at their first ensure on this host,
// as the broker reports it, so that login carries the site's plan.
func (b *fixtureBroker) Exchange(_ context.Context, r gateway.BrokerRequest) (gateway.BrokerReply, error) {
	if !b.admitted(r.ID) {
		return gateway.BrokerReply{}, errors.New("not allowlisted")
	}
	if r.Operation == "ensure" {
		// The first sign-in of a person who had none creates the binding.
		b.access.mu.Lock()
		delete(b.access.unbound, r.ID)
		b.access.mu.Unlock()
	}
	for _, m := range b.identities {
		if m.Subject == r.ID {
			b.mu.Lock()
			created := r.Operation == "ensure" && !b.created[m.Subject]
			if created {
				b.created[m.Subject] = true
			}
			b.mu.Unlock()
			return gateway.BrokerReply{Route: &gateway.BrokerRoute{UID: uint32(m.UID), Username: m.Username, Socket: m.Socket}, Epoch: 1, Generation: 1, Created: created}, nil
		}
	}
	return gateway.BrokerReply{}, errors.New("not allowlisted")
}

func (b *fixtureBroker) ListBound(context.Context) ([]gateway.BoundUser, error) {
	b.access.mu.Lock()
	defer b.access.mu.Unlock()
	users := []gateway.BoundUser{}
	for _, m := range b.identities {
		if _, ok := b.bound(m.Subject); ok {
			users = append(users, gateway.BoundUser{ID: m.Subject, Username: m.Username})
		}
	}
	return users, nil
}
func (b *fixtureBroker) LookupBound(_ context.Context, id string) (bool, error) {
	b.access.mu.Lock()
	defer b.access.mu.Unlock()
	_, ok := b.bound(id)
	return ok, nil
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

// seedSeveralHistories writes three short settled native histories, titled
// "Arkistoitava 1".."Arkistoitava 3", with IDs 33333333-…-00000000000N.
func seedSeveralHistories(dir, cwd string) error {
	for n := 1; n <= 3; n++ {
		id := fmt.Sprintf("33333333-3333-4333-8333-%012d", n)
		rows := []map[string]any{
			{"type": "session", "version": 3, "id": id, "cwd": cwd},
			{"type": "message", "id": "u1", "message": map[string]any{"role": "user", "content": fmt.Sprintf("Arkistoitava %d", n)}},
			{"type": "message", "id": "a1", "message": map[string]any{"role": "assistant", "content": []map[string]any{{"type": "text", "text": "Selvä."}}}},
		}
		var b []byte
		for _, row := range rows {
			line, e := json.Marshal(row)
			if e != nil {
				return e
			}
			b = append(append(b, line...), '\n')
		}
		if e := os.WriteFile(filepath.Join(dir, fmt.Sprintf("several-%d.jsonl", n)), b, 0600); e != nil {
			return e
		}
	}
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

const fakeTaskfleetRunID = "01m53wnktnxb4w2xgdd79a66de"

const fakeTaskfleet = `#!/bin/sh
dir="$TASKFLEET_HOME"
case "$1 $2" in
 "version --output") printf '%s\n' '{"schema_version":1,"data":{"version":"0.15.0"}}' ;;
 "run list") test -f "$dir/fixture-list.json" && cat "$dir/fixture-list.json" || exit 1 ;;
 "run show") test -f "$dir/fixture-show.json" && cat "$dir/fixture-show.json" || exit 1 ;;
 *) exit 1 ;;
esac
`

func writeFakeTaskfleet(home, parent, workspace, status string) error {
	root := filepath.Join(home, ".taskfleet")
	if status == "none" {
		for _, name := range []string{"fixture-list.json", "fixture-show.json"} {
			if e := os.Remove(filepath.Join(root, name)); e != nil && !os.IsNotExist(e) {
				return e
			}
		}
		return os.RemoveAll(filepath.Join(root, "runs"))
	}
	if status == "empty" {
		// Installed and answering, with no runs at all.
		if e := os.MkdirAll(root, 0700); e != nil {
			return e
		}
		return os.WriteFile(filepath.Join(root, "fixture-list.json"), []byte(`{"schema_version":1,"data":{"runs":[]}}`+"\n"), 0600)
	}
	if !regexp.MustCompile(`^[0-9a-f-]{36}$`).MatchString(parent) || !regexp.MustCompile(`^[a-z-]+$`).MatchString(workspace) || status != "running" && status != "done" {
		return fmt.Errorf("invalid taskfleet fixture")
	}
	run := map[string]any{
		"run_id": fakeTaskfleetRunID, "kind": "spinoff", "title": "ui-test-ok", "status": status,
		"lifecycle": "headless", "agent_owner": "taskfleet", "source_branch": "main",
		"source_repo": filepath.Join(home, "src", workspace), "created_at": "2026-10-16T16:04:37.321422491Z",
		"created_by_session": map[string]string{"harness": "pi", "session_id": parent},
		"supervisor":         map[string]string{"state": "running"}, "node_transcripts": []any{},
		"preserved_work": []any{}, "report": map[string]string{"summary": "Synteettinen spinoff."},
	}
	if status == "done" {
		// Taskfleet records no end time; an ended run's manifest was last
		// written when it ended.
		run["manifest"] = map[string]string{"updated_at": time.Now().UTC().Format(time.RFC3339Nano)}
	}
	dir := filepath.Join(root, "runs", fakeTaskfleetRunID)
	if e := os.MkdirAll(dir, 0700); e != nil {
		return e
	}
	for name, value := range map[string]any{
		"fixture-list.json":                             map[string]any{"schema_version": 1, "data": map[string]any{"runs": []any{run}}},
		"fixture-show.json":                             map[string]any{"schema_version": 1, "data": run},
		"runs/" + fakeTaskfleetRunID + "/manifest.json": run,
	} {
		b, _ := json.Marshal(value)
		if e := os.WriteFile(filepath.Join(root, name), b, 0600); e != nil {
			return e
		}
	}
	return nil
}

func (b *fixtureBroker) ListQuotas(ctx context.Context) ([]gateway.QuotaRow, gateway.QuotaFilesystem, error) {
	users, err := b.ListBound(ctx)
	if err != nil {
		return nil, gateway.QuotaFilesystem{}, err
	}
	rows := make([]gateway.QuotaRow, 0, len(users))
	var fs gateway.QuotaFilesystem
	for _, u := range users {
		q, disk, err := b.ReadQuota(ctx, u.ID)
		if err != nil {
			return nil, fs, err
		}
		fs = disk
		rows = append(rows, gateway.QuotaRow{BoundUser: u, Quota: q})
	}
	return rows, fs, nil
}

// writePreviewFixtures gives the editor one file of each previewable kind:
// Markdown for the preview and heading folds, a table, a picture and a page.
func writePreviewFixtures(dir string) {
	// Markdown for the editor's preview and heading folds.
	_ = os.WriteFile(filepath.Join(dir, "notes.md"), []byte("# Muistiinpanot\n\nJohdanto.\n\n## Kaavio\n\n```mermaid\ngraph LR\n  A --> B\n```\n\n## Loppu\n\nViimeinen rivi.\n"), 0600)
	// A table, a picture and a page for the editor's other previews.
	_ = os.WriteFile(filepath.Join(dir, "taulu.csv"), []byte(browserTable()), 0600)
	_ = os.WriteFile(filepath.Join(dir, "tunnus.svg"), []byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80"><script>document.title="svg-ran"</script><rect x="10" y="10" width="100" height="60" rx="8" fill="teal"/><image href="https://example.test/tracker.png" width="1" height="1"/></svg>
`), 0600)
	_ = os.WriteFile(filepath.Join(dir, "sivu.html"), []byte(`<!doctype html>
<html>
<head>
<title>Kutsu</title>
<link rel="stylesheet" href="tyyli.css">
<style>h1 { color: teal; }</style>
</head>
<body>
<h1>Kutsu</h1>
<p>Tervetuloa <a href="https://example.test/">sivuille</a>.</p>
<img src="kuva.png" alt="kuva">
<script>document.body.dataset.ran = "1"; fetch("https://example.test/beacon");</script>
</body>
</html>
`), 0600)
}

// browserTable is a semicolon CSV long enough to scroll, with a quoted line
// break, so a row and its text line numbers part ways.
func browserTable() string {
	var b strings.Builder
	b.WriteString("Nimi;Ryhmä;Maksettu\n")
	b.WriteString("\"Kaksi\nriviä\";A;125\n")
	for i := 1; i <= 200; i++ {
		fmt.Fprintf(&b, "Henkilö %d;%c;%d\n", i, 'A'+rune(i%2), i*5)
	}
	return b.String()
}
