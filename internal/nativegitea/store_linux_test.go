//go:build linux

package nativegitea

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"go.yaml.in/yaml/v3"
	"golang.org/x/sys/unix"
)

// fixture is tea v0.16.0 YAML as tea writes it, plus what a person or a later
// tea may add: an unknown login field, an unknown preference and comments.
const fixture = `# my tea logins
logins:
    - name: work
      url: https://git.example.org
      token: tok-alice-0001
      default: true
      ssh_host: git.example.org
      ssh_key: ""
      insecure: false
      ssh_certificate_principal: ""
      ssh_agent: false
      ssh_key_agent_pub: ""
      version_check: true
      user: alice
      created: 1700000000
      future_field: kept
    - name: second
      url: https://git.example.org
      token: tok-bob-0002
      user: bob
    - name: sub
      url: https://git.example.org/gitea
      token: tok-carol-0003
      user: carol
    - name: ported
      url: https://git.example.org:3000
      token: tok-dave-0004
      user: dave
    - name: oauth
      url: https://other.example.org
      user: erin
      auth_method: oauth
    - name: sshonly
      url: https://other.example.org
      ssh_key: /home/x/.ssh/id_ed25519
      user: frank
    - name: insecure
      url: https://insecure.example.org
      token: tok-gina-0005
      insecure: true
      user: gina
    - name: plain
      url: http://plain.example.org
      token: tok-hal-0006
      user: hal
preferences:
    editor: true
    flag_defaults:
        remote: upstream
    future_pref: 1
# trailing comment
`

type fakeVerifier map[string]Account

func (f fakeVerifier) Verify(_ context.Context, _ Base, token string) (Account, error) {
	if a, ok := f[token]; ok {
		return a, nil
	}
	return Account{}, ErrRejected
}

func newStore(t *testing.T) (*Store, string) {
	t.Helper()
	home := t.TempDir()
	os.Chmod(home, 0o700) // a group-writable home is refused, as it should be
	s, err := NewStore(home, filepath.Join(home, ".config"))
	if err != nil {
		t.Fatal(err)
	}
	s.files.LockTimeout = 300 * time.Millisecond
	return s, home
}

func writeTea(t *testing.T, home, rel, content string) string {
	t.Helper()
	p := filepath.Join(home, rel)
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

const xdgRel = ".config/tea/config.yml"

func mustBase(t *testing.T, s string) Base {
	t.Helper()
	b, err := ParseBase(s)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func read(t *testing.T, p string) []byte {
	t.Helper()
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestLoginsFixture(t *testing.T) {
	s, home := newStore(t)
	writeTea(t, home, xdgRel, fixture)
	logins, err := s.Logins()
	if err != nil {
		t.Fatal(err)
	}
	kinds := map[string]Kind{}
	for _, l := range logins {
		kinds[l.Name] = l.Kind
		if l.Ambiguous || l.Owned {
			t.Errorf("%s: %+v", l.Name, l)
		}
	}
	want := map[string]Kind{"work": KindPAT, "second": KindPAT, "sub": KindPAT, "ported": KindPAT, "oauth": KindOAuth, "sshonly": KindSSH, "insecure": KindInsecure, "plain": KindInvalid}
	if len(kinds) != len(want) {
		t.Fatalf("%v", kinds)
	}
	for k, v := range want {
		if kinds[k] != v {
			t.Errorf("%s: %s, want %s", k, kinds[k], v)
		}
	}
	if logins[0].Base != mustBase(t, "git.example.org") || !logins[0].Default || logins[1].Base != logins[0].Base {
		t.Fatalf("two accounts on one host: %+v %+v", logins[0], logins[1])
	}
	// The projection never carries a token.
	if strings.Contains(strings.Join(func() []string {
		var out []string
		for _, l := range logins {
			out = append(out, l.Name, l.URL, l.User, l.ConnectionID())
		}
		return out
	}(), " "), "tok-") {
		t.Fatal("token in projection")
	}
	if logins[0].ConnectionID() == logins[1].ConnectionID() {
		t.Fatal("same connection id for two accounts")
	}
}

func TestMissingConfigIsEmptyAndCreatesNothing(t *testing.T) {
	s, home := newStore(t)
	logins, err := s.Logins()
	if err != nil || len(logins) != 0 {
		t.Fatalf("%v %v", logins, err)
	}
	if _, err := os.Lstat(filepath.Join(home, ".config")); !os.IsNotExist(err) {
		t.Fatal("read created directories")
	}
}

func TestUnsafeOrMalformedIsUnavailable(t *testing.T) {
	cases := map[string]func(t *testing.T, home string){
		"malformed":       func(t *testing.T, h string) { writeTea(t, h, xdgRel, "logins: [\n") },
		"empty truncated": func(t *testing.T, h string) { writeTea(t, h, xdgRel, "") },
		"duplicate key":   func(t *testing.T, h string) { writeTea(t, h, xdgRel, "logins: []\nlogins: []\n") },
		"duplicate field": func(t *testing.T, h string) {
			writeTea(t, h, xdgRel, "logins:\n  - name: a\n    token: x\n    token: y\n")
		},
		"two documents":   func(t *testing.T, h string) { writeTea(t, h, xdgRel, "logins: []\n---\nlogins: []\n") },
		"alias":           func(t *testing.T, h string) { writeTea(t, h, xdgRel, "x: &a {name: a}\nlogins: [*a]\n") },
		"logins scalar":   func(t *testing.T, h string) { writeTea(t, h, xdgRel, "logins: nope\n") },
		"root list":       func(t *testing.T, h string) { writeTea(t, h, xdgRel, "- a\n") },
		"login not a map": func(t *testing.T, h string) { writeTea(t, h, xdgRel, "logins: [a]\n") },
		"wrong type":      func(t *testing.T, h string) { writeTea(t, h, xdgRel, "logins:\n  - default: [x]\n") },
		"too large":       func(t *testing.T, h string) { writeTea(t, h, xdgRel, "logins: []\n#"+strings.Repeat("x", maxConfig)) },
		"broad mode": func(t *testing.T, h string) {
			os.Chmod(writeTea(t, h, xdgRel, fixture), 0o644)
		},
		"symlink file": func(t *testing.T, h string) {
			real := writeTea(t, h, "elsewhere.yml", fixture)
			os.MkdirAll(filepath.Join(h, ".config/tea"), 0o700)
			os.Symlink(real, filepath.Join(h, xdgRel))
		},
		"hardlink": func(t *testing.T, h string) {
			p := writeTea(t, h, xdgRel, fixture)
			os.Link(p, filepath.Join(h, "copy.yml"))
		},
		"fifo": func(t *testing.T, h string) {
			os.MkdirAll(filepath.Join(h, ".config/tea"), 0o700)
			unix.Mkfifo(filepath.Join(h, xdgRel), 0o600)
		},
		"symlinked dir": func(t *testing.T, h string) {
			writeTea(t, h, "dot/tea/config.yml", fixture)
			os.Symlink(filepath.Join(h, "dot"), filepath.Join(h, ".config"))
		},
		"group-writable dir": func(t *testing.T, h string) {
			writeTea(t, h, xdgRel, fixture)
			os.Chmod(filepath.Join(h, ".config"), 0o770)
		},
		"symlinked lock": func(t *testing.T, h string) {
			writeTea(t, h, xdgRel, fixture)
			os.Symlink(filepath.Join(h, "target"), filepath.Join(h, xdgRel+".lock"))
		},
	}
	for name, setup := range cases {
		t.Run(name, func(t *testing.T) {
			s, home := newStore(t)
			setup(t, home)
			if l, err := s.Logins(); err != ErrUnavailable {
				t.Fatalf("%v %v", l, err)
			}
			v := fakeVerifier{"tok-new-1": {ID: 5, Login: "zoe"}}
			if _, _, err := s.Connect(context.Background(), v, mustBase(t, "new.example.org"), "tok-new-1"); err != ErrUnavailable {
				t.Fatalf("connect into unavailable: %v", err)
			}
		})
	}
	t.Run("wrong uid", func(t *testing.T) {
		s, home := newStore(t)
		writeTea(t, home, xdgRel, fixture)
		s.files.UID = os.Geteuid() + 1
		if _, err := s.Logins(); err != ErrUnavailable {
			t.Fatal(err)
		}
	})
}

func TestLegacyPathSelection(t *testing.T) {
	s, home := newStore(t)
	legacyPath := writeTea(t, home, ".tea/tea.yml", "logins:\n    - name: old\n      url: https://git.example.org\n      token: tok-old-1\n      user: olga\n")
	logins, err := s.Logins()
	if err != nil || len(logins) != 1 || logins[0].Name != "old" {
		t.Fatalf("%v %v", logins, err)
	}
	v := fakeVerifier{"tok-new-1": {ID: 5, Login: "zoe"}}
	if _, out, err := s.Connect(context.Background(), v, mustBase(t, "git.example.org"), "tok-new-1"); err != nil || out != Written {
		t.Fatal(out, err)
	}
	if !bytes.Contains(read(t, legacyPath), []byte("zoe")) {
		t.Fatal("legacy file not edited")
	}
	if _, err := os.Lstat(legacyPath + ".lock"); err != nil {
		t.Fatal("tea's lock path for the legacy file not used")
	}
	if _, err := os.Lstat(filepath.Join(home, ".config")); !os.IsNotExist(err) {
		t.Fatal("XDG file created beside the selected legacy file")
	}
	// Once the XDG file exists tea selects it, and so do we.
	writeTea(t, home, xdgRel, "logins: []\n")
	if logins, err := s.Logins(); err != nil || len(logins) != 0 {
		t.Fatalf("%v %v", logins, err)
	}
}

func TestConnectPreservesNativeState(t *testing.T) {
	s, home := newStore(t)
	p := writeTea(t, home, xdgRel, fixture)
	ctx := context.Background()
	b := mustBase(t, "git.example.org")
	v := fakeVerifier{"tok-ivy-1": {ID: 42, Login: "ivy"}, "tok-ivy-2": {ID: 42, Login: "ivy"}, "tok-alice-9": {ID: 3, Login: "Alice"}, "tok-carol-0003": {ID: 4, Login: "zed"}}
	l, out, err := s.Connect(ctx, v, b, "tok-ivy-1")
	if err != nil || out != Written || l.Name != OwnedName(b, 42) || !l.Owned || l.OwnedID != 42 {
		t.Fatalf("%+v %s %v", l, out, err)
	}
	after := read(t, p)
	var before, now map[string]any
	yaml.Unmarshal([]byte(fixture), &before)
	yaml.Unmarshal(after, &now)
	logins := now["logins"].([]any)
	if len(logins) != 9 {
		t.Fatalf("entries: %d", len(logins))
	}
	for i, e := range before["logins"].([]any) {
		if !equalYAML(e, logins[i]) {
			t.Fatalf("entry %d changed: %v -> %v", i, e, logins[i])
		}
	}
	if !equalYAML(before["preferences"], now["preferences"]) || !bytes.Contains(after, []byte("# my tea logins")) || !bytes.Contains(after, []byte("# trailing comment")) {
		t.Fatalf("preferences or comments lost:\n%s", after)
	}
	added := logins[8].(map[string]any)
	if added["default"] != false || added["token"] != "tok-ivy-1" || added["url"] != "https://git.example.org" || added["user"] != "ivy" || added["ssh_host"] != "git.example.org" {
		t.Fatalf("added %v", added)
	}
	if st, _ := os.Stat(p); st.Mode().Perm() != 0o600 {
		t.Fatalf("mode %v", st.Mode())
	}
	if l2, err := s.Logins(); err != nil || l2[0].Default != true || l2[8].Default {
		t.Fatal("default changed", err)
	}
	// A repeated connect after a lost reply observes; it does not write.
	if _, out, err := s.Connect(ctx, v, b, "tok-ivy-1"); err != nil || out != Unchanged || !bytes.Equal(read(t, p), after) {
		t.Fatalf("repeat: %s %v", out, err)
	}
	// Refusals leave every byte in place.
	for tok, want := range map[string]error{
		"tok-ivy-2":      ErrExists, // same owned account, different PAT: Replace is the explicit route
		"tok-alice-9":    ErrExists, // external entry already holds this account
		"tok-carol-0003": ErrExists, // tea refuses a PAT another login already uses
		"tok-unknown":    ErrRejected,
	} {
		if _, _, err := s.Connect(ctx, v, b, tok); err != want {
			t.Errorf("%s: %v, want %v", tok, err, want)
		}
		if !bytes.Equal(read(t, p), after) {
			t.Fatalf("%s changed bytes", tok)
		}
	}
}

func equalYAML(a, b any) bool {
	x, _ := yaml.Marshal(a)
	y, _ := yaml.Marshal(b)
	return bytes.Equal(x, y)
}

func TestConnectCreatesPrivateFileAndRefusesNameTakeover(t *testing.T) {
	s, home := newStore(t)
	b := mustBase(t, "https://git.example.org:3000/gitea")
	v := fakeVerifier{"tok-1": {ID: 8, Login: "ivy"}}
	if _, out, err := s.Connect(context.Background(), v, b, "tok-1"); err != nil || out != Written {
		t.Fatal(out, err)
	}
	for rel, mode := range map[string]os.FileMode{".config": 0o700, ".config/tea": 0o700, xdgRel: 0o600} {
		if st, err := os.Lstat(filepath.Join(home, rel)); err != nil || st.Mode().Perm() != mode {
			t.Fatalf("%s: %v %v", rel, st.Mode(), err)
		}
	}
	data := read(t, filepath.Join(home, xdgRel))
	var cfg teaConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil || len(cfg.Logins) != 1 || cfg.Logins[0].URL != "https://git.example.org:3000/gitea" || cfg.Logins[0].SSHHost != "git.example.org:3000" {
		t.Fatalf("%s %v", data, err)
	}

	s2, home2 := newStore(t)
	name := OwnedName(b, 8)
	p := writeTea(t, home2, xdgRel, "logins:\n    - name: "+strings.ToUpper(name)+"\n      url: https://other.example.org\n      token: t\n      user: mallory\n")
	before := read(t, p)
	if _, _, err := s2.Connect(context.Background(), v, b, "tok-1"); err != ErrNameTaken || !bytes.Equal(read(t, p), before) {
		t.Fatalf("takeover: %v", err)
	}
}

func ownedFixture(t *testing.T) (*Store, string, Login) {
	s, home := newStore(t)
	p := writeTea(t, home, xdgRel, fixture)
	v := fakeVerifier{"tok-ivy-1": {ID: 42, Login: "ivy"}}
	l, _, err := s.Connect(context.Background(), v, mustBase(t, "git.example.org"), "tok-ivy-1")
	if err != nil {
		t.Fatal(err)
	}
	return s, p, l
}

func TestReplace(t *testing.T) {
	s, p, l := ownedFixture(t)
	ctx := context.Background()
	v := fakeVerifier{
		"tok-ivy-2":   {ID: 42, Login: "ivy"},
		"tok-other":   {ID: 43, Login: "ivy"}, // same name, different Gitea account
		"tok-bob-new": {ID: 2, Login: "bob"},
		"tok-erin":    {ID: 9, Login: "erin"},
	}
	before := read(t, p)
	for _, c := range []struct {
		target Target
		token  string
		want   error
	}{
		{l.Target(), "tok-other", ErrAccountMismatch},
		{l.Target(), "tok-bob-new", ErrAccountMismatch},
		{l.Target(), "tok-revoked", ErrRejected},
		{l.Target(), "tok-alice-0001", ErrRejected},
		{Target{Name: l.Name, Base: l.Base, User: "someone"}, "tok-ivy-2", ErrChanged},
		{Target{Name: "missing", Base: l.Base, User: "ivy"}, "tok-ivy-2", ErrNotFound},
		{Target{Name: "oauth", Base: mustBase(t, "other.example.org"), User: "erin"}, "tok-erin", ErrUnsupported},
	} {
		if _, _, err := s.Replace(ctx, v, c.target, c.token); err != c.want {
			t.Errorf("%+v %s: %v, want %v", c.target, c.token, err, c.want)
		}
		if !bytes.Equal(read(t, p), before) {
			t.Fatalf("refused replacement changed bytes: %+v %s", c.target, c.token)
		}
	}
	if _, out, err := s.Replace(ctx, v, l.Target(), "tok-ivy-2"); err != nil || out != Written {
		t.Fatal(out, err)
	}
	after := read(t, p)
	if !bytes.Equal(bytes.Replace(before, []byte("tok-ivy-1"), []byte("tok-ivy-2"), 1), after) {
		t.Fatalf("replacement changed more than the token:\n%s", after)
	}
	if _, out, err := s.Replace(ctx, v, l.Target(), "tok-ivy-2"); err != nil || out != Unchanged {
		t.Fatal(out, err)
	}
	// An explicitly targeted external PAT entry may be replaced for the same
	// username; it carries no ID, so the user is its identity.
	bob := Target{Name: "second", Base: mustBase(t, "git.example.org"), User: "bob"}
	if _, out, err := s.Replace(ctx, v, bob, "tok-bob-new"); err != nil || out != Written {
		t.Fatal(out, err)
	}
}

func TestRemoveAndHold(t *testing.T) {
	s, p, l := ownedFixture(t)
	release, err := s.Hold(l.Name)
	if err != nil {
		t.Fatal(err)
	}
	before := read(t, p)
	if _, err := s.Remove(l.Target()); err != ErrInUse || !bytes.Equal(read(t, p), before) {
		t.Fatalf("removed while held: %v", err)
	}
	if _, err := s.Remove(Target{Name: l.Name, Base: mustBase(t, "other.example.org"), User: "ivy"}); err != ErrInUse {
		t.Fatalf("held check: %v", err)
	}
	release()
	release() // idempotent
	if _, err := s.Remove(Target{Name: l.Name, Base: l.Base, User: "bob"}); err != ErrChanged || !bytes.Equal(read(t, p), before) {
		t.Fatalf("changed target: %v", err)
	}
	if out, err := s.Remove(l.Target()); err != nil || out != Written {
		t.Fatal(out, err)
	}
	var now map[string]any
	yaml.Unmarshal(read(t, p), &now)
	var orig map[string]any
	yaml.Unmarshal([]byte(fixture), &orig)
	if !equalYAML(now, orig) {
		t.Fatalf("remove did not restore the other entries:\n%s", read(t, p))
	}
	if out, err := s.Remove(l.Target()); err != nil || out != Absent {
		t.Fatal(out, err)
	}
}

// teaLock takes the lock exactly as tea v0.16.0 does.
func teaLock(t *testing.T, path string) func() {
	t.Helper()
	f, err := os.OpenFile(path+".lock", os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		t.Fatal(err)
	}
	return func() { syscall.Flock(int(f.Fd()), syscall.LOCK_UN); f.Close() }
}

func TestTeaLockContention(t *testing.T) {
	s, home := newStore(t)
	p := writeTea(t, home, xdgRel, fixture)
	v := fakeVerifier{"tok-ivy-1": {ID: 42, Login: "ivy"}}
	b := mustBase(t, "git.example.org")
	unlock := teaLock(t, p)
	if _, _, err := s.Connect(context.Background(), v, b, "tok-ivy-1"); err != ErrBusy {
		t.Fatalf("connect under tea lock: %v", err)
	}
	if _, err := s.Logins(); err != ErrBusy {
		t.Fatalf("read under tea's exclusive lock: %v", err)
	}
	if !bytes.Equal(read(t, p), []byte(fixture)) {
		t.Fatal("bytes changed under tea lock")
	}
	// tea writes (truncating in place, as it does) while holding its lock;
	// our edit waits, rereads under the lock and keeps tea's change.
	s.files.LockTimeout = 5 * time.Second
	done := make(chan error, 1)
	go func() {
		_, _, err := s.Connect(context.Background(), v, b, "tok-ivy-1")
		done <- err
	}()
	time.Sleep(150 * time.Millisecond)
	teaAdded := fixture + "" // tea marshals the whole config; append one login
	teaAdded = strings.Replace(teaAdded, "preferences:", "    - name: native\n      url: https://git.example.org\n      token: tok-native-7\n      user: nina\npreferences:", 1)
	if err := os.WriteFile(p, []byte(teaAdded), 0o600); err != nil {
		t.Fatal(err)
	}
	unlock()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	logins, err := s.Logins()
	if err != nil || len(logins) != 10 || logins[8].Name != "native" || logins[9].User != "ivy" {
		t.Fatalf("%v %v", logins, err)
	}
}

func TestWriteFailuresPreserveBytes(t *testing.T) {
	for step, fault := range map[string]error{"write": unix.ENOSPC, "sync": unix.EDQUOT, "rename": unix.EXDEV} {
		t.Run(step, func(t *testing.T) {
			s, home := newStore(t)
			p := writeTea(t, home, xdgRel, fixture)
			s.files.Fault = func(at string) error {
				if at == step {
					return fault
				}
				return nil
			}
			v := fakeVerifier{"tok-ivy-1": {ID: 42, Login: "ivy"}}
			if _, _, err := s.Connect(context.Background(), v, mustBase(t, "git.example.org"), "tok-ivy-1"); err != ErrWriteFailed {
				t.Fatal(err)
			}
			if !bytes.Equal(read(t, p), []byte(fixture)) {
				t.Fatal("bytes changed")
			}
			names, _ := os.ReadDir(filepath.Dir(p))
			for _, n := range names {
				if strings.HasSuffix(n.Name(), ".tmp") {
					t.Fatalf("temporary file left: %s", n.Name())
				}
			}
		})
	}
	t.Run("dirsync is uncertain", func(t *testing.T) {
		s, home := newStore(t)
		writeTea(t, home, xdgRel, fixture)
		s.files.Fault = func(at string) error {
			if at == "dirsync" {
				return unix.EIO
			}
			return nil
		}
		v := fakeVerifier{"tok-ivy-1": {ID: 42, Login: "ivy"}}
		if _, _, err := s.Connect(context.Background(), v, mustBase(t, "git.example.org"), "tok-ivy-1"); err != ErrUncertain {
			t.Fatal(err)
		}
		// Observation, not replay, settles it.
		s.files.Fault = nil
		if _, out, err := s.Connect(context.Background(), v, mustBase(t, "git.example.org"), "tok-ivy-1"); err != nil || out != Unchanged {
			t.Fatal(out, err)
		}
	})
	t.Run("editor ignoring the lock", func(t *testing.T) {
		s, home := newStore(t)
		p := writeTea(t, home, xdgRel, fixture)
		edited := fixture + "# edited by hand meanwhile\n"
		s.files.Fault = func(at string) error {
			if at == "write" {
				os.WriteFile(p, []byte(edited), 0o600)
			}
			return nil
		}
		v := fakeVerifier{"tok-ivy-1": {ID: 42, Login: "ivy"}}
		if _, _, err := s.Connect(context.Background(), v, mustBase(t, "git.example.org"), "tok-ivy-1"); err != ErrChanged {
			t.Fatal(err)
		}
		if string(read(t, p)) != edited {
			t.Fatal("concurrent edit overwritten")
		}
	})
}
