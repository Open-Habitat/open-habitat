//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const OwnMachinesPath = "/api/v1/own-machines"

// Omat koneet: the agent reaches the person's own computer over their own
// tailnet with plain SSH. Everything here runs as the person:
//
//   - a per-account tailscaled in userspace networking, a systemd user unit
//     of the account. Its LocalAPI socket lives only in the unit's
//     RuntimeDirectory (0700 under $XDG_RUNTIME_DIR): tailscaled makes the
//     socket 0666 and its dial endpoint checks no permission, so the
//     directory is the only thing keeping other Unix users out of the
//     person's tailnet. No SOCKS or HTTP proxy port is ever opened.
//   - its preferences come from a locked config file: shields up (inbound
//     tailnet connections would otherwise reach every user's loopback
//     services), no DNS or routes taken from the tailnet. Locked means
//     `tailscale set` cannot turn shields down; every start applies it again.
//   - the machines are the person's own SSH configuration, one file per
//     machine under ~/.ssh/config.d, included from ~/.ssh/config, so the
//     agent reaches one with ordinary `ssh <name>`. There is no other list.
//   - the grant itself is a line the person adds on their machine:
//     restrict, from= the node's tailnet address and expiry-time=. Habitat
//     cannot withdraw it; the machine can.
//
// The account's own SSH key (~/.ssh/id_ed25519, account_keys_linux.go) is
// the key the machines accept.

const (
	tailnetUnit        = "habitat-tailscale.service"
	tailnetRuntimeName = "habitat-tailscale"
	tailnetSocketName  = "ts.sock"
	tailnetStateRel    = ".local/state/habitat-tailscale"
	tailnetConfigRel   = ".config/habitat-tailscale"
	tailnetConfigName  = "tailscaled.json"
	machineDirRel      = ".ssh/config.d"
	sshInclude         = "Include ~/.ssh/config.d/habitat-*.conf"
	machineKeyRel      = ".ssh/id_ed25519"

	maxPeers    = 100
	maxMachines = 32
	tailnetIO   = 5 * time.Second
)

// Profile paths are the stable profile link, so a unit written by one
// release keeps working after an upgrade switches the link.
const (
	profileTailscale  = "/opt/open-habitat/profiles/integrations/bin/tailscale"
	profileTailscaled = "/opt/open-habitat/profiles/integrations/bin/tailscaled"
)

var (
	machineNamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)
	remoteUserPattern  = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$`)
	commentPartPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,120}$`)
	machineFilePattern = regexp.MustCompile(`^habitat-([a-z0-9][a-z0-9-]{0,62})\.(conf|known_hosts)$`)
	fingerprintPattern = regexp.MustCompile(`^SHA256:[A-Za-z0-9+/]{43}$`)
	grantDays          = map[int]bool{7: true, 30: true, 90: true}

	errTailnetUnavailable = errors.New("tailscale_unavailable")
	errUserManager        = errors.New("user_manager_unavailable")
	errTailnetOff         = errors.New("tailscale_not_connected")
	errAccountKey         = errors.New("account_key_unusable")
)

// ownMachineEnv is everything the feature touches. Tests and the browser
// host replace the programs and the user manager.
type ownMachineEnv struct {
	home, username string
	uid            int
	// runtimeDir is the account's $XDG_RUNTIME_DIR.
	runtimeDir string
	tailscale  string
	tailscaled string
	ssh        string
	keys       keyTools
	// userManager runs `systemctl --user` with args; managerReady says the
	// account's user manager runs and outlives the daemon (lingering).
	userManager  func(ctx context.Context, args ...string) error
	managerReady func() bool
	now          func() time.Time
	// comment names the account and site on the machine's line.
	comment string
}

func newOwnMachineEnv(cfg transport.Config) ownMachineEnv {
	runtime := "/run/user/" + strconv.Itoa(cfg.UID)
	env := ownMachineEnv{
		home: cfg.Home, username: cfg.Username, uid: cfg.UID, runtimeDir: runtime,
		tailscale: profileTailscale, tailscaled: profileTailscaled, ssh: "/usr/bin/ssh",
		keys: systemKeyTools, now: time.Now, comment: machineComment(cfg.Username),
	}
	env.userManager = func(ctx context.Context, args ...string) error {
		run, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		cmd := exec.CommandContext(run, "/usr/bin/systemctl", append([]string{"--user"}, args...)...)
		cmd.Dir = cfg.Home
		cmd.Env = []string{"HOME=" + cfg.Home, "PATH=/usr/bin:/bin", "LANG=C.UTF-8", "XDG_RUNTIME_DIR=" + runtime, "DBUS_SESSION_BUS_ADDRESS=unix:path=" + runtime + "/bus"}
		cmd.Stdin, cmd.Stdout, cmd.Stderr = nil, io.Discard, io.Discard
		return cmd.Run()
	}
	env.managerReady = func() bool {
		if _, err := os.Stat(filepath.Join("/var/lib/systemd/linger", cfg.Username)); err != nil {
			return false
		}
		info, err := os.Stat(filepath.Join(runtime, "bus"))
		return err == nil && info.Mode()&os.ModeSocket != 0
	}
	return env
}

// machineComment is the comment on the line the machine accepts:
// habitat:<account>@<site host>. The install and remove commands match
// exactly this comment, so they replace or remove only this account's line.
func machineComment(username string) string {
	host := "open-habitat"
	if site, err := loadSite(siteOriginPath); err == nil {
		if u, e := url.Parse(site.Origin); e == nil && commentPartPattern.MatchString(u.Hostname()) {
			host = u.Hostname()
		}
	}
	if !commentPartPattern.MatchString(username) {
		username = "habitat"
	}
	return "habitat:" + username + "@" + host
}

func (e ownMachineEnv) available() bool {
	for _, p := range []string{e.tailscale, e.tailscaled} {
		st, err := os.Stat(p)
		if err != nil || !st.Mode().IsRegular() || st.Mode().Perm()&0111 == 0 {
			return false
		}
	}
	return true
}

func (e ownMachineEnv) socket() string {
	return filepath.Join(e.runtimeDir, tailnetRuntimeName, tailnetSocketName)
}

func (e ownMachineEnv) controlPath(name string) string {
	return filepath.Join(e.runtimeDir, tailnetRuntimeName, "ssh-"+name)
}

// tailscaledArgs is the node's command line. The unit renders it with
// systemd specifiers; the distinct-UID test runs it with real paths.
func tailscaledArgs(socket, state, config string) []string {
	return []string{"--tun=userspace-networking", "--socket=" + socket, "--statedir=" + state, "--port=0", "--config=" + config}
}

// tailnetUnitText is the user unit. RuntimeDirectoryMode=0700 is what keeps
// the LocalAPI socket the account's own.
func (e ownMachineEnv) tailnetUnitText() string {
	args := tailscaledArgs("%t/"+tailnetRuntimeName+"/"+tailnetSocketName, "%h/"+tailnetStateRel, "%h/"+tailnetConfigRel+"/"+tailnetConfigName)
	return "# Written by Open Habitat (Settings > Omat koneet): this account's own\n" +
		"# Tailscale node. Its socket stays in the account's runtime directory and\n" +
		"# its locked config keeps shields up. Removing the node there removes this.\n" +
		"[Unit]\nDescription=Open Habitat: this account's Tailscale node\n\n" +
		"[Service]\n" +
		"Environment=TS_LOGS_DIR=%h/" + tailnetStateRel + "\n" +
		"ExecStart=" + e.tailscaled + " " + strings.Join(args, " ") + "\n" +
		"RuntimeDirectory=" + tailnetRuntimeName + "\nRuntimeDirectoryMode=0700\n" +
		"UMask=0077\nNoNewPrivileges=yes\nRestart=on-failure\nRestartSec=5\n\n" +
		"[Install]\nWantedBy=default.target\n"
}

// tailnetConfig is tailscaled's declarative config (ipn.ConfigVAlpha).
func (e ownMachineEnv) tailnetConfig() []byte {
	name := "habitat"
	if user := strings.ToLower(e.username); machineNamePattern.MatchString(user) && len(user) <= 50 {
		name = "habitat-" + user
	}
	b, _ := json.Marshal(map[string]any{
		"Version": "alpha0", "Locked": true, "Enabled": true, "Hostname": name,
		"AcceptDNS": false, "AcceptRoutes": false, "ShieldsUp": true,
		"RunSSHServer": false, "RunWebClient": false,
	})
	return append(b, '\n')
}

// ---- LocalAPI ----

type localAPI struct{ socket string }

func (l localAPI) client() *http.Client {
	return &http.Client{Timeout: tailnetIO, Transport: &http.Transport{
		DisableKeepAlives: true, MaxResponseHeaderBytes: 64 << 10,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 2 * time.Second}).DialContext(ctx, "unix", l.socket)
		},
	}}
}

func (l localAPI) do(ctx context.Context, method, path string, limit int64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, "http://local-tailscaled.sock/localapi/v0/"+path, nil)
	if err != nil {
		return nil, err
	}
	res, err := l.client().Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	b, err := io.ReadAll(io.LimitReader(res.Body, limit+1))
	if err != nil || int64(len(b)) > limit {
		return nil, errors.New("localapi reply too large")
	}
	if res.StatusCode/100 != 2 {
		return nil, errors.New("localapi refused")
	}
	return b, nil
}

type tailnetPeer struct {
	DNSName      string
	HostName     string
	OS           string
	TailscaleIPs []string
	Online       bool
	LastSeen     time.Time
	UserID       int64
}

type tailnetStatus struct {
	BackendState   string
	AuthURL        string
	Self           *tailnetPeer
	Peer           map[string]*tailnetPeer
	CurrentTailnet *struct{ Name string }
	User           map[string]struct{ LoginName string }
}

func (l localAPI) status(ctx context.Context) (tailnetStatus, error) {
	var st tailnetStatus
	b, err := l.do(ctx, http.MethodGet, "status", 4<<20)
	if err != nil {
		return st, err
	}
	return st, json.Unmarshal(b, &st)
}

func (l localAPI) shieldsUp(ctx context.Context) (bool, error) {
	b, err := l.do(ctx, http.MethodGet, "prefs", 1<<20)
	if err != nil {
		return false, err
	}
	var p struct{ ShieldsUp bool }
	return p.ShieldsUp, json.Unmarshal(b, &p)
}

// ---- What the page shows ----

type tailnetNode struct {
	Name      string `json:"name"`
	DNSName   string `json:"dns_name,omitempty"`
	Address   string `json:"address"`
	Tailnet   string `json:"tailnet,omitempty"`
	Login     string `json:"login,omitempty"`
	ShieldsUp bool   `json:"shields_up"`
}

type tailnetView struct {
	State   string       `json:"state"`
	AuthURL string       `json:"auth_url,omitempty"`
	Node    *tailnetNode `json:"node,omitempty"`
}

type peerView struct {
	Name     string     `json:"name"`
	DNSName  string     `json:"dns_name,omitempty"`
	OS       string     `json:"os"`
	Address  string     `json:"address"`
	Online   bool       `json:"online"`
	LastSeen *time.Time `json:"last_seen,omitempty"`
	// SSH: "possible" (macOS, Linux), "later" (Windows), "no" (phones).
	SSH string `json:"ssh"`
}

type machineView struct {
	Name           string     `json:"name"`
	User           string     `json:"user"`
	Address        string     `json:"address"`
	Expires        string     `json:"expires"`
	Expired        bool       `json:"expired"`
	InTailnet      bool       `json:"in_tailnet"`
	Online         bool       `json:"online"`
	LastSeen       *time.Time `json:"last_seen,omitempty"`
	OS             string     `json:"os,omitempty"`
	HostKey        string     `json:"host_key"`
	ConnectionOpen bool       `json:"connection_open"`
}

type ownMachinesView struct {
	Tailscale     tailnetView   `json:"tailscale"`
	Peers         []peerView    `json:"peers"`
	Machines      []machineView `json:"machines"`
	SSHInclude    bool          `json:"ssh_include"`
	AccountKey    *accountKey   `json:"account_key,omitempty"`
	RemoveCommand string        `json:"remove_command"`
	status        tailnetStatus
}

// peerName is the machine's name in the person's tailnet: the first label
// of its MagicDNS name, which is what Tailscale shows them.
func peerName(p *tailnetPeer) string {
	name := strings.ToLower(strings.SplitN(strings.TrimSuffix(p.DNSName, "."), ".", 2)[0])
	if !machineNamePattern.MatchString(name) {
		name = strings.ToLower(p.HostName)
	}
	if !machineNamePattern.MatchString(name) {
		return ""
	}
	return name
}

func ipv4(ips []string) string {
	for _, s := range ips {
		if a, err := netip.ParseAddr(s); err == nil && a.Is4() && netip.MustParsePrefix("100.64.0.0/10").Contains(a) {
			return a.String()
		}
	}
	return ""
}

func peerSSH(osName string) string {
	switch strings.ToLower(osName) {
	case "macos", "linux":
		return "possible"
	case "windows":
		return "later"
	}
	return "no"
}

func validAuthURL(s string) bool {
	u, err := url.Parse(s)
	return err == nil && len(s) <= 300 && u.Scheme == "https" && u.Host == "login.tailscale.com" && u.User == nil && strings.HasPrefix(u.Path, "/a/") && u.RawQuery == "" && u.Fragment == ""
}

func (e ownMachineEnv) unitInstalled() bool {
	_, err := os.Lstat(filepath.Join(e.home, ".config/systemd/user", tailnetUnit))
	return err == nil
}

func (e ownMachineEnv) read(ctx context.Context) (ownMachinesView, error) {
	view := ownMachinesView{Peers: []peerView{}, Machines: []machineView{}, RemoveCommand: removeCommand(e.comment)}
	view.Tailscale.State = "off"
	if !e.available() {
		view.Tailscale.State = "unavailable"
	} else if e.unitInstalled() {
		view.Tailscale.State = "stopped"
		api := localAPI{e.socket()}
		if st, err := api.status(ctx); err == nil {
			view.status = st
			switch st.BackendState {
			case "NeedsLogin":
				view.Tailscale.State = "login"
				if validAuthURL(st.AuthURL) {
					view.Tailscale.AuthURL = st.AuthURL
				}
			case "NeedsMachineAuth":
				view.Tailscale.State = "approval"
			case "Starting":
				view.Tailscale.State = "starting"
			case "Running":
				view.Tailscale.State = "on"
			}
			if view.Tailscale.State == "on" && st.Self != nil {
				node := &tailnetNode{Name: peerName(st.Self), DNSName: strings.TrimSuffix(st.Self.DNSName, "."), Address: ipv4(st.Self.TailscaleIPs)}
				if st.CurrentTailnet != nil {
					node.Tailnet = st.CurrentTailnet.Name
				}
				if u, ok := st.User[strconv.FormatInt(st.Self.UserID, 10)]; ok {
					node.Login = u.LoginName
				}
				node.ShieldsUp, _ = api.shieldsUp(ctx)
				if node.Address != "" && node.Name != "" {
					view.Tailscale.Node = node
				} else {
					view.Tailscale.State = "starting"
				}
			}
			if view.Tailscale.State == "on" {
				for _, p := range st.Peer {
					name, addr := peerName(p), ipv4(p.TailscaleIPs)
					if name == "" || addr == "" {
						continue
					}
					pv := peerView{Name: name, DNSName: strings.TrimSuffix(p.DNSName, "."), OS: p.OS, Address: addr, Online: p.Online, SSH: peerSSH(p.OS)}
					if !p.Online && !p.LastSeen.IsZero() {
						seen := p.LastSeen.UTC()
						pv.LastSeen = &seen
					}
					view.Peers = append(view.Peers, pv)
				}
				sort.Slice(view.Peers, func(i, j int) bool { return view.Peers[i].Name < view.Peers[j].Name })
				if len(view.Peers) > maxPeers {
					view.Peers = view.Peers[:maxPeers]
				}
			}
		}
	}
	machines, err := e.readMachines()
	if err != nil {
		return view, err
	}
	today := e.today()
	for _, m := range machines {
		mv := machineView{Name: m.name, User: m.user, Address: m.address, Expires: m.expires, Expired: m.expires <= today, HostKey: m.hostKey}
		for _, p := range view.Peers {
			if p.Address == m.address {
				mv.InTailnet, mv.Online, mv.LastSeen, mv.OS = true, p.Online, p.LastSeen, p.OS
			}
		}
		if st, e := os.Lstat(e.controlPath(m.name)); e == nil && st.Mode()&os.ModeSocket != 0 {
			mv.ConnectionOpen = true
		}
		view.Machines = append(view.Machines, mv)
	}
	view.SSHInclude = e.includePresent()
	if keys, err := readAccountKeys(e.home, e.keys); err == nil {
		for i, k := range keys.Keys {
			if k.Kind == keyKindSSH && k.File == "~/"+machineKeyRel {
				view.AccountKey = &keys.Keys[i]
			}
		}
	}
	return view, nil
}

func (e ownMachineEnv) today() string { return e.now().Format("2006-01-02") }

func validDate(s string) bool {
	t, err := time.Parse("2006-01-02", s)
	return err == nil && t.Format("2006-01-02") == s
}

// ---- The machines: ~/.ssh/config.d/habitat-<name>.conf ----

type machineFile struct {
	name, user, address, expires, hostKey string
}

const machineMarker = "# habitat-machine "

func (e ownMachineEnv) machineConfig(m machineFile) string {
	return "# Open Habitat: an own machine, managed in Settings > Omat koneet.\n" +
		machineMarker + "name=" + m.name + " user=" + m.user + " address=" + m.address + " expires=" + m.expires + "\n" +
		"Host " + m.name + "\n" +
		"\tHostName " + m.address + "\n" +
		"\tUser " + m.user + "\n" +
		"\tPort 22\n" +
		"\tProxyCommand " + e.tailscale + " --socket=" + e.socket() + " nc %h %p\n" +
		"\tIdentityFile ~/" + machineKeyRel + "\n" +
		"\tIdentitiesOnly yes\n\tIdentityAgent none\n\tBatchMode yes\n" +
		"\tHostKeyAlgorithms ssh-ed25519\n" +
		"\tUserKnownHostsFile ~/" + machineDirRel + "/habitat-" + m.name + ".known_hosts\n" +
		"\tGlobalKnownHostsFile /dev/null\n\tStrictHostKeyChecking yes\n\tUpdateHostKeys no\n" +
		"\tControlMaster auto\n\tControlPath " + e.runtimeDir + "/" + tailnetRuntimeName + "/ssh-%n\n\tControlPersist 10m\n" +
		"\tForwardAgent no\n\tForwardX11 no\n"
}

func machineDir(home string, create bool) (*os.File, error) {
	return personalDir(home, create, ".ssh", "config.d")
}

func (e ownMachineEnv) readMachines() ([]machineFile, error) {
	dir, err := machineDir(e.home, false)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	entries, err := dir.ReadDir(1024)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, err
	}
	var out []machineFile
	for _, ent := range entries {
		m := machineFilePattern.FindStringSubmatch(ent.Name())
		if m == nil || m[2] != "conf" || !ent.Type().IsRegular() {
			continue
		}
		b, _, err := readKeyFile(dir, ent.Name(), 8192)
		if err != nil {
			continue
		}
		mf, ok := parseMachineConfig(b)
		if !ok || mf.name != m[1] {
			continue
		}
		if kh, _, err := readKeyFile(dir, "habitat-"+mf.name+".known_hosts", 8192); err == nil {
			mf.hostKey, _ = knownHostFingerprint(kh)
		}
		out = append(out, mf)
		if len(out) == maxMachines {
			break
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].name < out[j].name })
	return out, nil
}

func parseMachineConfig(b []byte) (machineFile, bool) {
	for _, line := range strings.Split(string(b), "\n") {
		rest, ok := strings.CutPrefix(line, machineMarker)
		if !ok {
			continue
		}
		var m machineFile
		for _, f := range strings.Fields(rest) {
			k, v, _ := strings.Cut(f, "=")
			switch k {
			case "name":
				m.name = v
			case "user":
				m.user = v
			case "address":
				m.address = v
			case "expires":
				m.expires = v
			}
		}
		a, addrErr := netip.ParseAddr(m.address)
		return m, machineNamePattern.MatchString(m.name) && remoteUserPattern.MatchString(m.user) && validDate(m.expires) && addrErr == nil && a.Is4()
	}
	return machineFile{}, false
}

// knownHostFingerprint is the SHA256 fingerprint of the single ed25519 key
// in a known_hosts text, and that key as "ssh-ed25519 <base64>".
func knownHostFingerprint(b []byte) (string, string) {
	var fp, key string
	for _, line := range strings.Split(string(b), "\n") {
		f := strings.Fields(line)
		if len(f) < 3 || strings.HasPrefix(f[0], "#") || f[1] != "ssh-ed25519" {
			continue
		}
		blob, err := base64.StdEncoding.DecodeString(f[2])
		if err != nil || len(blob) > 256 {
			continue
		}
		if algo, rest, ok := sshString(blob); !ok || string(algo) != "ssh-ed25519" || len(rest) != 36 {
			continue
		}
		if fp != "" {
			return "", ""
		}
		sum := sha256.Sum256(blob)
		fp, key = "SHA256:"+base64.RawStdEncoding.EncodeToString(sum[:]), "ssh-ed25519 "+f[2]
	}
	return fp, key
}

// writePersonalFile replaces name in dir through a fresh file and a rename,
// never through whatever the name holds now.
func writePersonalFile(dir *os.File, name string, data []byte) error {
	var random [12]byte
	if _, err := rand.Read(random[:]); err != nil {
		return err
	}
	tmp := ".open-habitat-" + hex.EncodeToString(random[:])
	fd, err := unix.Openat(int(dir.Fd()), tmp, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return err
	}
	defer unix.Unlinkat(int(dir.Fd()), tmp, 0)
	f := os.NewFile(uintptr(fd), tmp)
	defer f.Close()
	if _, err = f.Write(data); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = unix.Renameat(int(dir.Fd()), tmp, int(dir.Fd()), name); err != nil {
		return err
	}
	return dir.Sync()
}

func (e ownMachineEnv) writeMachine(m machineFile, knownHostKey string) error {
	dir, err := machineDir(e.home, true)
	if err != nil {
		return err
	}
	defer dir.Close()
	if knownHostKey != "" {
		if err = writePersonalFile(dir, "habitat-"+m.name+".known_hosts", []byte(m.address+" "+knownHostKey+"\n")); err != nil {
			return err
		}
	}
	return writePersonalFile(dir, "habitat-"+m.name+".conf", []byte(e.machineConfig(m)))
}

func (e ownMachineEnv) removeMachineFiles(name string) error {
	dir, err := machineDir(e.home, false)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer dir.Close()
	for _, n := range []string{"habitat-" + name + ".conf", "habitat-" + name + ".known_hosts"} {
		if err := unix.Unlinkat(int(dir.Fd()), n, 0); err != nil && !errors.Is(err, unix.ENOENT) {
			return err
		}
	}
	return dir.Sync()
}

// includePresent says ~/.ssh/config includes the machines before its first
// Host or Match block, where an Include applies to every host.
func (e ownMachineEnv) includePresent() bool {
	dir, err := keyDir(e.home, false, keyKindSSH)
	if err != nil {
		return false
	}
	defer dir.Close()
	b, _, err := readKeyFile(dir, "config", 1<<20)
	if err != nil {
		return false
	}
	return includeBeforeHosts(b)
}

func includeBeforeHosts(b []byte) bool {
	sc := bufio.NewScanner(bytes.NewReader(b))
	sc.Buffer(make([]byte, 0, 64<<10), 1<<20)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == sshInclude {
			return true
		}
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "host ") || strings.HasPrefix(lower, "host\t") || strings.HasPrefix(lower, "match ") || strings.HasPrefix(lower, "match\t") {
			return false
		}
	}
	return false
}

// ensureInclude puts the Include line at the top of ~/.ssh/config. A config
// that is a link (a dotfiles checkout, say) or not the person's own is left
// alone; the page then shows the line to add by hand.
func (e ownMachineEnv) ensureInclude() bool {
	dir, err := keyDir(e.home, true, keyKindSSH)
	if err != nil {
		return false
	}
	defer dir.Close()
	var st unix.Stat_t
	var old []byte
	if err := unix.Fstatat(int(dir.Fd()), "config", &st, unix.AT_SYMLINK_NOFOLLOW); err == nil {
		if st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != uint32(os.Geteuid()) || st.Nlink != 1 {
			return false
		}
		if old, _, err = readKeyFile(dir, "config", 1<<20); err != nil {
			return false
		}
		if includeBeforeHosts(old) {
			return true
		}
	} else if !errors.Is(err, unix.ENOENT) {
		return false
	}
	next := append([]byte("# Open Habitat: own machines (Settings > Omat koneet).\n"+sshInclude+"\n\n"), old...)
	return writePersonalFile(dir, "config", next) == nil
}

// ---- The node: unit, config, start and stop ----

func (e ownMachineEnv) connect(ctx context.Context) error {
	if !e.available() {
		return errTailnetUnavailable
	}
	if !e.managerReady() {
		return errUserManager
	}
	cfgDir, err := personalDir(e.home, true, ".config", "habitat-tailscale")
	if err != nil {
		return err
	}
	cfgChanged := writeIfChanged(cfgDir, tailnetConfigName, e.tailnetConfig())
	cfgDir.Close()
	if _, err = personalDir(e.home, true, ".local", "state", "habitat-tailscale"); err != nil {
		return err
	}
	unitDir, err := personalDir(e.home, true, ".config", "systemd", "user")
	if err != nil {
		return err
	}
	unitChanged := writeIfChanged(unitDir, tailnetUnit, []byte(e.tailnetUnitText()))
	unitDir.Close()
	if cfgChanged == nil || unitChanged == nil {
		return errors.New("node files not written")
	}
	if err = e.userManager(ctx, "daemon-reload"); err != nil {
		return errUserManager
	}
	verb := "start"
	if *cfgChanged || *unitChanged {
		verb = "restart"
	}
	if err = e.userManager(ctx, "enable", tailnetUnit); err != nil {
		return errUserManager
	}
	if err = e.userManager(ctx, verb, tailnetUnit); err != nil {
		return errUserManager
	}
	api := localAPI{e.socket()}
	var st tailnetStatus
	deadline := time.Now().Add(15 * time.Second)
	for {
		if st, err = api.status(ctx); err == nil && st.BackendState != "" && st.BackendState != "NoState" {
			break
		}
		if time.Now().After(deadline) || ctx.Err() != nil {
			return errors.New("node did not answer")
		}
		time.Sleep(200 * time.Millisecond)
	}
	if st.BackendState != "NeedsLogin" {
		return nil
	}
	if _, err = api.do(ctx, http.MethodPost, "login-interactive", 4096); err != nil {
		return err
	}
	// The login URL comes from Tailscale's control server a moment later;
	// the page reads it with the status and keeps reading while it waits.
	for i := 0; i < 25; i++ {
		if st, err = api.status(ctx); err == nil && (st.AuthURL != "" || st.BackendState != "NeedsLogin") {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	return nil
}

// writeIfChanged writes data unless the file already holds exactly it, and
// says whether it wrote; nil means it could not.
func writeIfChanged(dir *os.File, name string, data []byte) *bool {
	changed := true
	if old, _, err := readKeyFile(dir, name, 65536); err == nil && bytes.Equal(old, data) {
		changed = false
		return &changed
	}
	if writePersonalFile(dir, name, data) != nil {
		return nil
	}
	return &changed
}

// disconnect stops the node and removes it from the account: the unit, its
// config, tailscaled's state (the node's private key) and every machine.
// The device stays listed in the person's tailnet until they remove it
// there; without its key it can no longer connect.
func (e ownMachineEnv) disconnect(ctx context.Context) error {
	// A browser that leaves mid-request must not leave a half-removed node:
	// stopping and its proof run to the end on their own deadline.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 45*time.Second)
	defer cancel()
	// The unit is stopped by name even when its file is already gone: a
	// running unit stays loaded after daemon-reload.
	if e.managerReady() {
		if err := e.userManager(ctx, "disable", "--now", tailnetUnit); err != nil && e.unitInstalled() {
			return err
		}
	}
	// The node must have stopped before its state goes: a running tailscaled
	// would write it again. Only a socket nobody listens on, or none at all,
	// proves it; a slow or failed answer proves nothing.
	if !e.nodeStopped(ctx) {
		return errors.New("node still running")
	}
	if unitDir, err := personalDir(e.home, false, ".config", "systemd", "user"); err == nil {
		err = unix.Unlinkat(int(unitDir.Fd()), tailnetUnit, 0)
		unitDir.Close()
		if err != nil && !errors.Is(err, unix.ENOENT) {
			return err
		}
		if e.managerReady() {
			_ = e.userManager(ctx, "daemon-reload")
		}
	}
	for _, p := range [][]string{{".config"}, {".local", "state"}} {
		parent, err := personalDir(e.home, false, p...)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return err
		}
		err = removeTreeAt(int(parent.Fd()), "habitat-tailscale", 4)
		parent.Close()
		if err != nil && !errors.Is(err, unix.ENOENT) {
			return err
		}
	}
	machines, err := e.readMachines()
	if err != nil {
		return err
	}
	for _, m := range machines {
		if err := e.removeMachineFiles(m.name); err != nil {
			return err
		}
	}
	return nil
}

// nodeStopped says nothing listens on the node's socket any more.
func (e ownMachineEnv) nodeStopped(ctx context.Context) bool {
	conn, err := (&net.Dialer{Timeout: 2 * time.Second}).DialContext(ctx, "unix", e.socket())
	if err == nil {
		conn.Close()
		return false
	}
	return errors.Is(err, unix.ENOENT) || errors.Is(err, unix.ECONNREFUSED)
}

// closeControl retires a machine's shared SSH connection, so a machine
// removed or added again under the same name is never reached through a
// connection authenticated for the earlier one. The socket's name goes
// whatever the master says; a master without its name serves only the
// sessions it already has.
func (e ownMachineEnv) closeControl(ctx context.Context, name string) {
	path := e.controlPath(name)
	if st, err := os.Lstat(path); err != nil || st.Mode()&os.ModeSocket == 0 {
		return
	}
	run, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(run, e.ssh, "-F", "/dev/null", "-o", "ControlPath="+path, "-O", "exit", name)
	cmd.Env = []string{"HOME=" + e.home, "PATH=/usr/bin:/bin", "LANG=C.UTF-8"}
	cmd.Stdin, cmd.Stdout, cmd.Stderr = nil, io.Discard, io.Discard
	_ = cmd.Run()
	_ = os.Remove(path)
}

// removeTreeAt removes name below the directory parent without following a
// link or crossing into another filesystem, at most depth levels deep.
func removeTreeAt(parent int, name string, depth int) error {
	var st unix.Stat_t
	if err := unix.Fstatat(parent, name, &st, unix.AT_SYMLINK_NOFOLLOW); err != nil {
		return err
	}
	if st.Mode&unix.S_IFMT != unix.S_IFDIR {
		return unix.Unlinkat(parent, name, 0)
	}
	if depth == 0 {
		return errors.New("tree too deep")
	}
	var pst unix.Stat_t
	if err := unix.Fstat(parent, &pst); err != nil || pst.Dev != st.Dev {
		return errors.New("other filesystem")
	}
	fd, err := unix.Openat(parent, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return err
	}
	dir := os.NewFile(uintptr(fd), name)
	names, err := dir.Readdirnames(4096)
	if err != nil && !errors.Is(err, io.EOF) {
		dir.Close()
		return err
	}
	for _, n := range names {
		if err := removeTreeAt(fd, n, depth-1); err != nil && !errors.Is(err, unix.ENOENT) {
			dir.Close()
			return err
		}
	}
	dir.Close()
	return unix.Unlinkat(parent, name, unix.AT_REMOVEDIR)
}

// ---- The grant on the machine ----

type grantView struct {
	Machine        string `json:"machine"`
	User           string `json:"user"`
	Address        string `json:"address"`
	Expires        string `json:"expires"`
	Line           string `json:"line"`
	Command        string `json:"command"`
	KeyFingerprint string `json:"key_fingerprint"`
}

func commentRegexp(comment string) string {
	return " " + strings.ReplaceAll(comment, ".", `\.`) + "$"
}

// installCommand adds the line to ~/.ssh/authorized_keys on the machine and
// drops an earlier line of this same account, so a renewal replaces it.
// grep -v exits 1 when no other line remains, which is fine; anything else
// (a read error, a full disk) leaves authorized_keys as it was.
func installCommand(line, comment string) string {
	return "umask 077 && mkdir -p ~/.ssh && touch ~/.ssh/authorized_keys && { { grep -v '" + commentRegexp(comment) + "' ~/.ssh/authorized_keys || [ $? -eq 1 ]; } && echo '" + line + "'; } > ~/.ssh/authorized_keys.habitat && mv ~/.ssh/authorized_keys.habitat ~/.ssh/authorized_keys"
}

func removeCommand(comment string) string {
	return "umask 077 && { grep -v '" + commentRegexp(comment) + "' ~/.ssh/authorized_keys || [ $? -eq 1 ]; } > ~/.ssh/authorized_keys.habitat && mv ~/.ssh/authorized_keys.habitat ~/.ssh/authorized_keys"
}

// accountMachineKey is the account's default SSH key, made if it is missing:
// asking for a machine's line is the person's request for a key to give it.
func (e ownMachineEnv) accountMachineKey(ctx context.Context) (accountKey, error) {
	find := func() (accountKey, bool, error) {
		keys, err := readAccountKeys(e.home, e.keys)
		if err != nil {
			return accountKey{}, false, err
		}
		for _, k := range keys.Keys {
			if k.Kind == keyKindSSH && k.File == "~/"+machineKeyRel {
				return k, true, nil
			}
		}
		for _, m := range keys.Missing {
			if m.Kind == keyKindSSH {
				return accountKey{}, false, nil
			}
		}
		// The file exists but is not a key this page can verify (a
		// passphrase, a hardware key): it is never replaced.
		return accountKey{}, false, errAccountKey
	}
	k, ok, err := find()
	if ok || err != nil {
		return k, err
	}
	if !accountKeysWriter.TryLock() {
		return accountKey{}, errAccountKey
	}
	_, err = createAccountKey(ctx, e.home, e.keys, keyComment(e.username), keyKindSSH)
	accountKeysWriter.Unlock()
	if err != nil && !errors.Is(err, errKeyExists) {
		return accountKey{}, errAccountKey
	}
	if k, ok, err = find(); !ok || err != nil {
		return accountKey{}, errAccountKey
	}
	return k, nil
}

func (e ownMachineEnv) grant(ctx context.Context, view ownMachinesView, target machineFile, days int) (grantView, error) {
	node := view.Tailscale.Node
	if node == nil {
		return grantView{}, errTailnetOff
	}
	key, err := e.accountMachineKey(ctx)
	if err != nil {
		return grantView{}, err
	}
	fields := strings.Fields(key.PublicKey)
	if len(fields) < 2 || fields[0] != "ssh-ed25519" {
		return grantView{}, errAccountKey
	}
	until := e.now().AddDate(0, 0, days)
	line := `restrict,from="` + node.Address + `",expiry-time="` + until.Format("20060102") + `" ssh-ed25519 ` + fields[1] + " " + e.comment
	return grantView{
		Machine: target.name, User: target.user, Address: target.address, Expires: until.Format("2006-01-02"),
		Line: line, Command: installCommand(line, e.comment), KeyFingerprint: key.Fingerprint,
	}, nil
}

// ---- Checking the connection ----

type checkView struct {
	Machine string `json:"machine"`
	Result  string `json:"result"`
	HostKey string `json:"host_key,omitempty"`
}

// probe connects once as the account with the account key and runs `true`.
// A machine not saved yet is reached with a throwaway known_hosts that takes
// whatever key the machine shows; a saved one only with its pinned key. The
// person's own ssh configuration plays no part.
func (e ownMachineEnv) probe(ctx context.Context, m machineFile, online bool, pinned bool) (checkView, string) {
	result := checkView{Machine: m.name}
	scratch, err := os.MkdirTemp(e.runtimeDir, ".habitat-probe-")
	if err != nil {
		if scratch, err = os.MkdirTemp("", "habitat-probe-"); err != nil {
			result.Result = "failed"
			return result, ""
		}
	}
	defer os.RemoveAll(scratch)
	known := filepath.Join(scratch, "known_hosts")
	strict := "accept-new"
	if pinned {
		strict = "yes"
		dir, err := machineDir(e.home, false)
		if err != nil {
			result.Result = "failed"
			return result, ""
		}
		kh, _, err := readKeyFile(dir, "habitat-"+m.name+".known_hosts", 8192)
		dir.Close()
		if err != nil || os.WriteFile(known, kh, 0600) != nil {
			result.Result = "failed"
			return result, ""
		}
	}
	run, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	cmd := exec.CommandContext(run, e.ssh, "-F", "/dev/null",
		"-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "ConnectionAttempts=1",
		"-o", "HostKeyAlgorithms=ssh-ed25519", "-o", "StrictHostKeyChecking="+strict,
		"-o", "UserKnownHostsFile="+known, "-o", "GlobalKnownHostsFile=/dev/null", "-o", "UpdateHostKeys=no",
		"-o", "HashKnownHosts=no", "-o", "IdentitiesOnly=yes", "-o", "IdentityAgent=none",
		"-o", "IdentityFile="+filepath.Join(e.home, machineKeyRel), "-o", "ControlMaster=no", "-o", "ControlPath=none",
		"-o", "ProxyCommand="+e.tailscale+" --socket="+e.socket()+" nc %h %p",
		"-l", m.user, "-p", "22", m.address, "true")
	cmd.Dir = e.home
	cmd.Env = []string{"HOME=" + e.home, "PATH=/usr/bin:/bin", "LANG=C.UTF-8"}
	cmd.Stdin, cmd.Stdout = nil, io.Discard
	var stderr boundedText
	stderr.limit = 8192
	cmd.Stderr = &stderr
	err = cmd.Run()
	kh, _ := os.ReadFile(known)
	result.HostKey, _ = knownHostFingerprint(kh)
	_, hostKeyLine := knownHostFingerprint(kh)
	text := stderr.String()
	switch {
	case err == nil:
		result.Result = "ok"
	case strings.Contains(text, "REMOTE HOST IDENTIFICATION HAS CHANGED") || strings.Contains(text, "Host key verification failed"):
		result.Result = "host_key_changed"
		result.HostKey = ""
		hostKeyLine = ""
	case strings.Contains(text, "Permission denied"):
		result.Result = "key_rejected"
	case !online:
		result.Result = "offline"
	case result.HostKey == "":
		// The machine is in the tailnet but nothing answered SSH on it.
		result.Result = "no_ssh"
	default:
		result.Result = "failed"
	}
	return result, hostKeyLine
}

type boundedText struct {
	limit int
	b     []byte
}

func (t *boundedText) Write(p []byte) (int, error) {
	if room := t.limit - len(t.b); room > 0 {
		if len(p) < room {
			room = len(p)
		}
		t.b = append(t.b, p[:room]...)
	}
	return len(p), nil
}

func (t *boundedText) String() string { return string(t.b) }

// ---- HTTP ----

var ownMachinesWriter sync.Mutex

type ownMachinesRequest struct {
	Action  string `json:"action"`
	Peer    string `json:"peer,omitempty"`
	Machine string `json:"machine,omitempty"`
	User    string `json:"user,omitempty"`
	Days    int    `json:"days,omitempty"`
	Expires string `json:"expires,omitempty"`
	HostKey string `json:"host_key,omitempty"`
}

// decodeOwnMachinesRequest takes exactly the keys each action names.
func decodeOwnMachinesRequest(b []byte) (ownMachinesRequest, bool) {
	var in map[string]json.RawMessage
	var req ownMachinesRequest
	dec := json.NewDecoder(bytes.NewReader(b))
	if !catalogNoDuplicates(b) || dec.Decode(&in) != nil || dec.Decode(new(any)) != io.EOF {
		return req, false
	}
	str := func(k string, out *string) bool { return json.Unmarshal(in[k], out) == nil }
	if !str("action", &req.Action) {
		return req, false
	}
	want := map[string][]string{
		"connect":    {},
		"disconnect": {},
		"grant":      {"peer", "user", "days"},
		"renew":      {"machine", "days"},
		"check":      {"peer", "user"},
		"recheck":    {"machine"},
		"save":       {"peer", "user", "expires", "host_key"},
		"extend":     {"machine", "expires"},
		"remove":     {"machine"},
	}
	keys, ok := want[req.Action]
	if !ok || len(in) != len(keys)+1 {
		return req, false
	}
	for _, k := range keys {
		var ok bool
		switch k {
		case "peer":
			ok = str(k, &req.Peer) && machineNamePattern.MatchString(req.Peer)
		case "machine":
			ok = str(k, &req.Machine) && machineNamePattern.MatchString(req.Machine)
		case "user":
			ok = str(k, &req.User) && remoteUserPattern.MatchString(req.User)
		case "days":
			ok = json.Unmarshal(in[k], &req.Days) == nil && grantDays[req.Days]
		case "expires":
			ok = str(k, &req.Expires) && validDate(req.Expires)
		case "host_key":
			ok = str(k, &req.HostKey) && fingerprintPattern.MatchString(req.HostKey)
		}
		if !ok {
			return req, false
		}
	}
	return req, true
}

func OwnMachinesHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return ownMachinesHandler(cfg, trusted, newOwnMachineEnv(cfg))
}

// OwnMachinesFixture replaces what the browser host cannot have: the
// profile's tailscale programs, ssh, the user manager and the runtime
// directory.
type OwnMachinesFixture struct {
	RuntimeDir, Tailscale, Tailscaled, SSH, SSHKeygen string
	UserManager                                       func(ctx context.Context, args ...string) error
	Comment                                           string
}

func OwnMachinesHandlerWithFixture(cfg transport.Config, trusted func(*http.Request) bool, f OwnMachinesFixture) http.Handler {
	env := newOwnMachineEnv(cfg)
	env.runtimeDir, env.tailscale, env.tailscaled, env.ssh = f.RuntimeDir, f.Tailscale, f.Tailscaled, f.SSH
	env.keys = keyTools{sshKeygen: f.SSHKeygen, ageKeygen: "/nonexistent"}
	env.userManager = f.UserManager
	env.managerReady = func() bool { return true }
	env.comment = f.Comment
	return ownMachinesHandler(cfg, trusted, env)
}

func ownMachinesHandler(cfg transport.Config, trusted func(*http.Request) bool, env ownMachineEnv) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		post := r.Method == http.MethodPost
		if r.URL.Path != OwnMachinesPath || r.URL.EscapedPath() != OwnMachinesPath || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 || (!post && r.Method != http.MethodGet) || (!post && r.ContentLength > 0) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if cfg.UID != os.Geteuid() || cfg.Home == "" {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		reply := map[string]any{}
		if post {
			if r.ContentLength < 2 || r.ContentLength > 512 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			b, err := io.ReadAll(io.LimitReader(r.Body, 513))
			req, ok := decodeOwnMachinesRequest(b)
			if err != nil || int64(len(b)) != r.ContentLength || !ok {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if !ownMachinesWriter.TryLock() {
				snapshotError(w, 409, "own_machines_busy")
				return
			}
			status, code := env.act(r.Context(), req, reply)
			ownMachinesWriter.Unlock()
			if code != "" {
				snapshotError(w, status, code)
				return
			}
		}
		view, err := env.read(r.Context())
		if err != nil {
			snapshotError(w, 503, "own_machines_unavailable")
			return
		}
		reply["schema_version"] = 1
		reply["web_identity_id"] = opaque("wid_", cfg.Provider+":"+cfg.Subject)
		reply["tailscale"] = view.Tailscale
		reply["peers"] = view.Peers
		reply["machines"] = view.Machines
		reply["ssh_include"] = view.SSHInclude
		reply["remove_command"] = view.RemoveCommand
		if view.AccountKey != nil {
			reply["account_key"] = map[string]string{"file": view.AccountKey.File, "fingerprint": view.AccountKey.Fingerprint}
		}
		historyJSON(w, reply)
	})
}

// act performs one request and puts its own result into reply. It returns a
// status and fixed code when it refuses.
func (e ownMachineEnv) act(ctx context.Context, req ownMachinesRequest, reply map[string]any) (int, string) {
	switch req.Action {
	case "connect":
		switch err := e.connect(ctx); {
		case errors.Is(err, errTailnetUnavailable):
			return 409, "tailscale_unavailable"
		case errors.Is(err, errUserManager):
			return 409, "user_manager_unavailable"
		case err != nil:
			return 503, "tailscale_start_failed"
		}
		return 0, ""
	case "disconnect":
		if err := e.disconnect(ctx); err != nil {
			return 503, "tailscale_stop_failed"
		}
		return 0, ""
	}
	view, err := e.read(ctx)
	if err != nil {
		return 503, "own_machines_unavailable"
	}
	// Removing a machine is local; everything else needs the node.
	if view.Tailscale.Node == nil && req.Action != "remove" {
		return 409, "tailscale_not_connected"
	}
	saved := map[string]machineView{}
	for _, m := range view.Machines {
		saved[m.Name] = m
	}
	// A new machine is named by the person's tailnet, never by the browser:
	// its address comes from Tailscale's own peer list.
	var target machineFile
	online := false
	switch {
	case req.Peer != "":
		found := false
		for _, p := range view.Peers {
			if p.Name == req.Peer && p.SSH == "possible" {
				target, online, found = machineFile{name: p.Name, user: req.User, address: p.Address}, p.Online, true
			}
		}
		if !found {
			return 409, "unknown_peer"
		}
		if _, ok := saved[req.Peer]; ok {
			return 409, "machine_exists"
		}
		if len(saved) >= maxMachines {
			return 409, "too_many_machines"
		}
	case req.Machine != "":
		m, ok := saved[req.Machine]
		if !ok {
			return 409, "unknown_machine"
		}
		target, online = machineFile{name: m.Name, user: m.User, address: m.Address, expires: m.Expires, hostKey: m.HostKey}, m.Online
	}
	switch req.Action {
	case "grant", "renew":
		g, err := e.grant(ctx, view, target, req.Days)
		if err != nil {
			return 409, "account_key_unusable"
		}
		reply["grant"] = g
	case "check", "recheck":
		c, _ := e.probe(ctx, target, online, req.Action == "recheck")
		reply["check"] = c
	case "save", "extend":
		today := e.today()
		limit := e.now().AddDate(0, 0, 91).Format("2006-01-02")
		// expiry-time="YYYYMMDD" is refused from the start of that day.
		if req.Expires <= today || req.Expires > limit {
			return 400, "invalid_request"
		}
		c, hostKeyLine := e.probe(ctx, target, online, req.Action == "extend")
		reply["check"] = c
		if c.Result != "ok" {
			return 0, ""
		}
		if req.Action == "save" && (c.HostKey != req.HostKey || hostKeyLine == "") {
			// The machine shows another key than the one the person compared:
			// nothing is saved.
			return 409, "host_key_mismatch"
		}
		target.expires = req.Expires
		if req.Action == "extend" {
			hostKeyLine = ""
		}
		e.closeControl(ctx, target.name)
		if err := e.writeMachine(target, hostKeyLine); err != nil {
			return 503, "machine_save_failed"
		}
		reply["saved"] = target.name
		// A config the page may not change is shown with the line to add.
		_ = e.ensureInclude()
	case "remove":
		e.closeControl(ctx, target.name)
		if err := e.removeMachineFiles(target.name); err != nil {
			return 503, "machine_remove_failed"
		}
		reply["removed"] = target.name
	}
	return 0, ""
}
