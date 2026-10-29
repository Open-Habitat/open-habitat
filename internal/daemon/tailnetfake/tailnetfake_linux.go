//go:build linux

// Package tailnetfake stands in for a person's tailscaled and their own
// machines' sshd in tests and the browser host: a LocalAPI on a Unix socket
// that answers status, prefs and login-interactive, and an ssh program whose
// outcome per address a test sets. Nothing here joins a tailnet or opens a
// network connection. The product never imports it.
package tailnetfake

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Peer is one device in the fake tailnet.
type Peer struct {
	Name, OS, Address string
	Online            bool
	LastSeen          time.Time
}

// Node is a fake tailscaled answering on socket.
type Node struct {
	mu       sync.Mutex
	state    string
	authURL  string
	loginAsk int
	peers    []Peer
	srv      *http.Server
	socket   string
}

const (
	SelfName    = "habitat-alice"
	SelfAddress = "100.101.22.7"
	Tailnet     = "example-tailnet.ts.net"
	AuthURL     = "https://login.tailscale.com/a/1f3c9e2b7a4d"
)

// DefaultPeers is a small tailnet: a Mac, a Linux desktop asleep, a phone
// and a Windows machine.
func DefaultPeers() []Peer {
	return []Peer{
		{Name: "alice-macbook", OS: "macOS", Address: "100.88.14.53", Online: true},
		{Name: "workstation", OS: "linux", Address: "100.71.203.9", Online: true},
		{Name: "living-room-nas", OS: "linux", Address: "100.71.203.10", Online: false, LastSeen: time.Date(2026, 10, 26, 9, 0, 0, 0, time.UTC)},
		{Name: "alice-phone", OS: "iOS", Address: "100.90.1.2", Online: true},
		{Name: "gaming-pc", OS: "windows", Address: "100.90.1.3", Online: true},
	}
}

// Start listens on socket, in the NeedsLogin state with no login URL yet.
func Start(socket string, peers []Peer) (*Node, error) {
	if err := os.MkdirAll(filepath.Dir(socket), 0700); err != nil {
		return nil, err
	}
	_ = os.Remove(socket)
	ln, err := net.Listen("unix", socket)
	if err != nil {
		return nil, err
	}
	n := &Node{state: "NeedsLogin", peers: peers, socket: socket}
	n.srv = &http.Server{Handler: http.HandlerFunc(n.serve), ReadHeaderTimeout: 5 * time.Second}
	go n.srv.Serve(ln)
	return n, nil
}

func (n *Node) Close() {
	_ = n.srv.Close()
	_ = os.Remove(n.socket)
}

// Approve is the person finishing the login in Tailscale.
func (n *Node) Approve() {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.state, n.authURL = "Running", ""
}

// LoginRequests counts login-interactive calls.
func (n *Node) LoginRequests() int {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.loginAsk
}

// SetAuthURL makes the node report url as its login URL.
func (n *Node) SetAuthURL(url string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.authURL = url
}

func (n *Node) SetPeers(peers []Peer) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.peers = peers
}

func (n *Node) serve(w http.ResponseWriter, r *http.Request) {
	if r.Host != "local-tailscaled.sock" {
		http.Error(w, "invalid localapi request", 403)
		return
	}
	n.mu.Lock()
	defer n.mu.Unlock()
	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/localapi/v0/status":
		peers := map[string]any{}
		for i, p := range n.peers {
			peers["nodekey:"+string(rune('a'+i))] = map[string]any{
				"DNSName": p.Name + "." + Tailnet + ".", "HostName": p.Name, "OS": p.OS,
				"TailscaleIPs": []string{p.Address, "fd7a:115c:a1e0::1"}, "Online": p.Online, "LastSeen": p.LastSeen, "UserID": 7,
			}
		}
		status := map[string]any{"BackendState": n.state, "AuthURL": n.authURL, "Peer": peers,
			"User": map[string]any{"7": map[string]any{"LoginName": "alice@example.com"}}}
		if n.state == "Running" {
			status["Self"] = map[string]any{"DNSName": SelfName + "." + Tailnet + ".", "HostName": SelfName, "OS": "linux", "TailscaleIPs": []string{SelfAddress}, "Online": true, "UserID": 7}
			status["CurrentTailnet"] = map[string]any{"Name": Tailnet}
		} else {
			status["Peer"] = map[string]any{}
		}
		_ = json.NewEncoder(w).Encode(status)
	case r.Method == http.MethodGet && r.URL.Path == "/localapi/v0/prefs":
		_ = json.NewEncoder(w).Encode(map[string]any{"ShieldsUp": true, "WantRunning": true, "CorpDNS": false})
	case r.Method == http.MethodPost && r.URL.Path == "/localapi/v0/login-interactive":
		n.loginAsk++
		if n.state == "NeedsLogin" {
			n.authURL = AuthURL
		}
		w.WriteHeader(204)
	default:
		http.NotFound(w, r)
	}
}

// HostKey is the ed25519 host key every fake machine shows, as a
// known_hosts key field.
func HostKey(seed byte) string {
	blob := binary.BigEndian.AppendUint32(nil, 11)
	blob = append(blob, "ssh-ed25519"...)
	blob = binary.BigEndian.AppendUint32(blob, 32)
	for i := 0; i < 32; i++ {
		blob = append(blob, seed+byte(i))
	}
	return base64.StdEncoding.EncodeToString(blob)
}

// WriteSSH writes a fake ssh into dir. Its outcome for an address is the
// content of dir/mode-<address>: "ok", "rejected" (the default) or "down";
// dir/hostkey-<address> holds a seed byte for that machine's host key
// (default 'A'), so a test can make a machine show another key. It records
// a new host key as ssh's accept-new does and checks a pinned one.
func WriteSSH(dir string) (string, error) {
	path := filepath.Join(dir, "fake-ssh")
	script := `#!/bin/sh
fix='` + dir + `'
known= strict= host= prev=
for a in "$@"; do
  case "$a" in
    UserKnownHostsFile=*) known=${a#UserKnownHostsFile=} ;;
    StrictHostKeyChecking=*) strict=${a#StrictHostKeyChecking=} ;;
  esac
  host=$prev; prev=$a
done
mode=rejected; [ -f "$fix/mode-$host" ] && mode=$(cat "$fix/mode-$host")
if [ "$mode" = down ]; then echo "kex_exchange_identification: Connection closed by remote host" >&2; exit 255; fi
key=$(cat "$fix/key-A")
[ -f "$fix/hostkey-$host" ] && key=$(cat "$fix/key-$(cat "$fix/hostkey-$host")")
if [ "$strict" = accept-new ] && ! grep -q "$key" "$known" 2>/dev/null; then echo "$host ssh-ed25519 $key" >>"$known"; fi
if ! grep -q "$key" "$known" 2>/dev/null; then echo "@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@" >&2; echo "Host key verification failed." >&2; exit 255; fi
if [ "$mode" = ok ]; then exit 0; fi
echo "user@$host: Permission denied (publickey)." >&2
exit 255
`
	for _, seed := range []byte{'A', 'B'} {
		if err := os.WriteFile(filepath.Join(dir, "key-"+string(seed)), []byte(HostKey(seed)), 0600); err != nil {
			return "", err
		}
	}
	if err := os.WriteFile(path, []byte(script), 0700); err != nil {
		return "", err
	}
	return path, nil
}

// SetMachine sets how the fake machine at address answers.
func SetMachine(dir, address, mode string) error {
	if mode != "ok" && mode != "rejected" && mode != "down" {
		return errors.New("unknown mode")
	}
	return os.WriteFile(filepath.Join(dir, "mode-"+address), []byte(mode), 0600)
}

// SetHostKey makes the machine at address show host key seed 'A' or 'B'.
func SetHostKey(dir, address string, seed byte) error {
	if seed != 'A' && seed != 'B' {
		return errors.New("unknown key")
	}
	return os.WriteFile(filepath.Join(dir, "hostkey-"+address), []byte{seed}, 0600)
}
