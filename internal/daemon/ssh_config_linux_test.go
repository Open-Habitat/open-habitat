//go:build linux

package daemon

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/daemon/tailnetfake"
)

func writeHomeFile(t *testing.T, home, rel, text string) {
	t.Helper()
	path := filepath.Join(home, rel)
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(text), 0600); err != nil {
		t.Fatal(err)
	}
}

const syntheticSSHConfig = `# The person's own hosts.
Include config.d/*.conf
Include ~/.ssh/config.d/habitat-*.conf

Host nas NAS-Alias
  HostName nas.home.arpa
  User admin
  IdentityFile ~/.ssh/id_ed25519

Host=rakennus
  HostName = 10.20.0.5
  User "build"
  Port 2222
  ProxyJump nas
  User ignored-second-value

Host tyokone
  HostName tyokone.tail0a1b.ts.net # trailing comment

Host github.com
  User git

Host gh
  HostName github.com

Host *.lan !x.lan
  User lanuser

Host broken
  Port notanumber

Host neg !neg
  HostName neg.example

Host "unterminated
  User nobody

Match host 10.20.*
  User matched

Host pilvi
  HostName 100.101.7.9
  User deploy
  ProxyCommand nc %h %p

Host *
  User defaultuser
  IdentityFile ~/.ssh/id_%h
`

func syntheticSSHHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	writeHomeFile(t, home, ".ssh/config", syntheticSSHConfig)
	writeHomeFile(t, home, ".ssh/config.d/old.conf", "Host vanha\n  HostName old.example.net\n  User root\n")
	// Habitat's own machine file is on the page already.
	writeHomeFile(t, home, ".ssh/config.d/habitat-kirjasto.conf", "Host kirjasto\n  HostName 100.101.7.20\n")
	writeHomeFile(t, home, ".ssh/id_ed25519", "not read\n")
	return home
}

// The values are the ones `ssh <alias>` uses: first value wins over every
// block the alias matches, including the trailing Host *; wildcard, Match,
// Git services, malformed lines and Habitat's own files are left out.
func TestSSHConfigReadsHostsAsSSHWould(t *testing.T) {
	home := syntheticSSHHome(t)
	view := readSSHConfig(home, "alice")
	if view.State != "ok" || !view.Match {
		t.Fatalf("state %q match %v", view.State, view.Match)
	}
	if want := []string{"~/.ssh/config", "~/.ssh/config.d/old.conf"}; !reflect.DeepEqual(view.Files, want) {
		t.Fatalf("files %v", view.Files)
	}
	byAlias := map[string]sshConfigHost{}
	var order []string
	for _, h := range view.Hosts {
		byAlias[h.Alias] = h
		order = append(order, h.Alias)
	}
	if want := []string{"vanha", "nas", "nas-alias", "rakennus", "tyokone", "pilvi"}; !reflect.DeepEqual(order, want) {
		t.Fatalf("hosts %v", order)
	}
	nas := byAlias["nas"]
	if nas.HostName != "nas.home.arpa" || nas.User != "admin" || nas.Port != 22 || nas.File != "~/.ssh/config" || nas.Line != 5 {
		t.Fatalf("nas %+v", nas)
	}
	if want := []sshConfigKey{{"~/.ssh/id_ed25519", true}, {"~/.ssh/id_nas.home.arpa", false}}; !reflect.DeepEqual(nas.Keys, want) {
		t.Fatalf("nas keys %+v", nas.Keys)
	}
	if r := byAlias["rakennus"]; r.HostName != "10.20.0.5" || r.User != "build" || r.Port != 2222 || r.ProxyJump != "nas" || r.ProxyCommand {
		t.Fatalf("rakennus %+v", r)
	}
	if w := byAlias["tyokone"]; !w.Tailscale || w.User != "defaultuser" || w.HostName != "tyokone.tail0a1b.ts.net" {
		t.Fatalf("tyokone %+v", w)
	}
	if p := byAlias["pilvi"]; !p.ProxyCommand || !p.Tailscale || p.User != "deploy" {
		t.Fatalf("pilvi %+v", p)
	}
	if v := byAlias["vanha"]; v.File != "~/.ssh/config.d/old.conf" || v.Line != 1 || v.User != "root" {
		t.Fatalf("vanha %+v", v)
	}
	skipped := map[string]string{}
	for _, s := range view.Skipped {
		skipped[s.What] = s.Why
	}
	for what, why := range map[string]string{"Host *.lan !x.lan": "wildcard", "Host *": "wildcard", "Match host 10.20.*": "match", "github.com": "git_service", "gh": "git_service"} {
		if skipped[what] != why {
			t.Errorf("skipped %q = %q, want %q (all %v)", what, skipped[what], why, view.Skipped)
		}
	}
	for _, gone := range []string{"broken", "neg", "kirjasto", "matched", "nobody"} {
		if _, ok := byAlias[gone]; ok {
			t.Errorf("%s listed", gone)
		}
	}
}

func TestSSHConfigStatesAndIncludes(t *testing.T) {
	t.Run("missing is empty", func(t *testing.T) {
		if v := readSSHConfig(t.TempDir(), "alice"); v.State != "empty" || len(v.Hosts) != 0 {
			t.Fatalf("%+v", v)
		}
	})
	t.Run("only wildcards is empty", func(t *testing.T) {
		home := t.TempDir()
		writeHomeFile(t, home, ".ssh/config", "Host *\n  User x\n")
		if v := readSSHConfig(home, "alice"); v.State != "empty" || len(v.Skipped) != 1 {
			t.Fatalf("%+v", v)
		}
	})
	t.Run("over 1 MiB is unreadable", func(t *testing.T) {
		home := t.TempDir()
		writeHomeFile(t, home, ".ssh/config", "Host a\n"+strings.Repeat("#", sshConfigFileLimit))
		if v := readSSHConfig(home, "alice"); v.State != "unreadable" || len(v.Hosts) != 0 {
			t.Fatalf("%+v", v)
		}
	})
	t.Run("a directory is unreadable", func(t *testing.T) {
		home := t.TempDir()
		if err := os.MkdirAll(filepath.Join(home, ".ssh/config"), 0700); err != nil {
			t.Fatal(err)
		}
		if v := readSSHConfig(home, "alice"); v.State != "unreadable" {
			t.Fatalf("%+v", v)
		}
	})
	t.Run("a linked config is followed", func(t *testing.T) {
		home := t.TempDir()
		writeHomeFile(t, home, "dotfiles/ssh_config", "Host linked\n")
		if err := os.Mkdir(filepath.Join(home, ".ssh"), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.Symlink(filepath.Join(home, "dotfiles/ssh_config"), filepath.Join(home, ".ssh/config")); err != nil {
			t.Fatal(err)
		}
		if v := readSSHConfig(home, "alice"); v.State != "ok" || len(v.Hosts) != 1 || v.Hosts[0].Alias != "linked" || v.Hosts[0].User != "alice" {
			t.Fatalf("%+v", v)
		}
	})
	t.Run("a file that includes itself ends", func(t *testing.T) {
		home := t.TempDir()
		writeHomeFile(t, home, ".ssh/config", "Host loop\nInclude config\n")
		v := readSSHConfig(home, "alice")
		if v.State != "ok" || len(v.Hosts) != 1 || len(v.Files) > sshConfigMaxFiles {
			t.Fatalf("%+v", v)
		}
		if v.Skipped[len(v.Skipped)-1].Why != "limit" {
			t.Fatalf("skipped %+v", v.Skipped)
		}
	})
	t.Run("an Include under a Host applies only to it", func(t *testing.T) {
		home := t.TempDir()
		writeHomeFile(t, home, ".ssh/config", "Host outer\n  Include inner.conf\n  User after-include\n")
		writeHomeFile(t, home, ".ssh/inner.conf", "Port 2200\nHost inner\n  HostName inner.example\n")
		v := readSSHConfig(home, "alice")
		if len(v.Hosts) != 1 || v.Hosts[0].Alias != "outer" || v.Hosts[0].Port != 2200 || v.Hosts[0].User != "after-include" {
			t.Fatalf("%+v", v.Hosts)
		}
	})
	t.Run("an unreadable Include is said", func(t *testing.T) {
		home := t.TempDir()
		writeHomeFile(t, home, ".ssh/config", "Include sub\nHost a\n")
		// A directory where the Include names a file.
		if err := os.Mkdir(filepath.Join(home, ".ssh/sub"), 0700); err != nil {
			t.Fatal(err)
		}
		v := readSSHConfig(home, "alice")
		if v.State != "ok" || len(v.Skipped) != 1 || v.Skipped[0].Why != "unreadable" {
			t.Fatalf("%+v", v)
		}
	})
}

func TestSSHConfigLine(t *testing.T) {
	for raw, want := range map[string][]string{
		"Host a b":                 {"host", "a", "b"},
		"  HOSTNAME=example.org\r": {"hostname", "example.org"},
		"User = bob":               {"user", "bob"},
		`IdentityFile "~/my key"`:  {"identityfile", "~/my key"},
		"Port 22 # comment":        {"port", "22"},
		"# Host commented":         nil,
		"":                         nil,
		"Host":                     nil,
		`Host "open`:               nil,
		"Host a\x1b[31m":           nil,
		"=value":                   nil,
	} {
		key, args, ok := sshConfigLine(raw)
		var got []string
		if ok {
			got = append([]string{key}, args...)
		}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("%q: %v, want %v", raw, got, want)
		}
	}
}

func TestSSHPatterns(t *testing.T) {
	for _, c := range []struct {
		name     string
		patterns []string
		want     bool
	}{
		{"nas", []string{"*"}, true},
		{"a.lan", []string{"*.lan"}, true},
		{"x.lan", []string{"*.lan", "!x.lan"}, false},
		{"ab", []string{"a?"}, true},
		{"a", []string{"a?"}, false},
		{"b", []string{"!a"}, false},
	} {
		if got := sshPatternList(c.name, c.patterns); got != c.want {
			t.Errorf("%s %v: %v", c.name, c.patterns, got)
		}
	}
}

// The person's choices with every bound reached still fit the document.
func TestSSHConfigChoicesFitPreferences(t *testing.T) {
	home := t.TempDir()
	value := accountPreferences{Engine: "codemirror6", Experimental: map[string]bool{}, Sound: &soundPreferences{Workspaces: map[string]string{}}}
	for i := 0; i < maxExperimentalFeatures; i++ {
		value.Experimental[fmt.Sprintf("%s%07d", strings.Repeat("f", 40), i)] = true
	}
	for i := 0; i < maxWorkspaceSounds; i++ {
		value.Sound.Workspaces[fmt.Sprintf("ws_%s%03d", strings.Repeat("x", 61), i)] = "tunnus-puu"
	}
	m := &sshConfigMachines{}
	for i := 0; i < sshConfigMaxChosen; i++ {
		m.Shown = append(m.Shown, fmt.Sprintf("s%s%02d", strings.Repeat("a", 60), i))
		m.Hidden = append(m.Hidden, fmt.Sprintf("h%s%02d", strings.Repeat("a", 60), i))
	}
	value.SSHConfigMachines = m
	if err := savePreferences(home, value); err != nil {
		t.Fatal(err)
	}
	if _, err := readPreferences(home); err != nil {
		t.Fatal(err)
	}
	m.Hidden = append(m.Hidden, "one-too-many")
	if savePreferences(home, value) == nil {
		t.Fatal("33 hidden saved")
	}
}

func TestClassifyConfigCheck(t *testing.T) {
	failed := os.ErrInvalid
	for text, want := range map[string]string{
		"@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@\nHost key verification failed.": "host_key_changed",
		"No ED25519 host key is known for a and you have requested strict checking.":              "hostkey_unknown",
		"ssh: Could not resolve hostname a: Name or service not known":                            "unresolved",
		"a@b: Permission denied (publickey,password).":                                            "key_rejected",
		"ssh: connect to host b port 22: Connection timed out":                                    "offline",
		"kex_exchange_identification: Connection closed by remote host":                           "failed",
	} {
		if got := classifyConfigCheck(failed, text); got != want {
			t.Errorf("%q: %s, want %s", text, got, want)
		}
	}
	if classifyConfigCheck(nil, "Permission denied") != "ok" {
		t.Error("a zero exit is ok")
	}
}

// Off, the daemon does not read the file and refuses every config action.
// On, the hosts come from the file, the choices are aliases in the
// preferences, a check runs the person's own ssh only for a shown host,
// and neither ~/.ssh/config nor known_hosts is ever written.
func TestOwnMachinesSSHConfigHosts(t *testing.T) {
	f := newMachinesFixture(t)
	writeHomeFile(t, f.home, ".ssh/config", syntheticSSHConfig)
	writeHomeFile(t, f.home, ".ssh/config.d/old.conf", "Host vanha\n  HostName old.example.net\n")
	before, _ := os.ReadFile(filepath.Join(f.home, ".ssh/config"))

	if reply := f.must(t, ""); reply["ssh_config"] != nil {
		t.Fatalf("read while off: %v", reply["ssh_config"])
	}
	if code, reply := f.do(t, `{"action":"config_show","alias":"nas"}`); code != 409 || field(reply, "error", "code") != "feature_off" {
		t.Fatalf("show while off: %d %v", code, reply)
	}
	if _, err := applyPreferences(f.home, preferencesWrite{Experimental: map[string]bool{SSHConfigFeature: true}}); err != nil {
		t.Fatal(err)
	}
	reply := f.must(t, "")
	if field(reply, "ssh_config", "state") != "ok" || len(field(reply, "ssh_config", "hosts").([]any)) != 6 {
		t.Fatalf("on: %v", reply["ssh_config"])
	}
	for _, refused := range []string{
		`{"action":"config_check","alias":"nas"}`,       // not shown yet
		`{"action":"config_show","alias":"unknown"}`,    // not in the file
		`{"action":"config_hide","alias":"github.com"}`, // skipped
	} {
		if code, _ := f.do(t, refused); code != 409 {
			t.Fatalf("%s: %d", refused, code)
		}
	}
	for _, bad := range []string{
		`{"action":"config_show","alias":"-oProxyCommand=x"}`,
		`{"action":"config_show","alias":"NAS"}`,
		`{"action":"config_show","alias":"nas","machine":"nas"}`,
		`{"action":"config_show"}`,
	} {
		if code, _ := f.do(t, bad); code != 400 {
			t.Fatalf("%s: %d", bad, code)
		}
	}
	f.must(t, `{"action":"config_show","alias":"nas"}`)
	f.must(t, `{"action":"config_hide","alias":"pilvi"}`)
	reply = f.must(t, `{"action":"config_show","alias":"rakennus"}`)
	if got := field(reply, "ssh_config", "shown"); !reflect.DeepEqual(got, []any{"nas", "rakennus"}) {
		t.Fatalf("shown %v", got)
	}
	if got := field(reply, "ssh_config", "hidden"); !reflect.DeepEqual(got, []any{"pilvi"}) {
		t.Fatalf("hidden %v", got)
	}
	// Showing a hidden host moves it; hiding a shown one too.
	reply = f.must(t, `{"action":"config_show","alias":"pilvi"}`)
	if !reflect.DeepEqual(field(reply, "ssh_config", "hidden"), []any{}) {
		t.Fatalf("hidden %v", field(reply, "ssh_config", "hidden"))
	}
	f.must(t, `{"action":"config_unshow","alias":"pilvi"}`)

	if err := tailnetfake.SetConfigHost(f.sshDir, "rakennus", "offline"); err != nil {
		t.Fatal(err)
	}
	reply = f.must(t, `{"action":"config_check","alias":"rakennus"}`)
	if field(reply, "config_check", "result") != "offline" || field(reply, "config_check", "alias") != "rakennus" {
		t.Fatalf("check %v", reply["config_check"])
	}
	args, _ := os.ReadFile(filepath.Join(f.sshDir, "last-args"))
	for _, want := range []string{"StrictHostKeyChecking=yes", "UpdateHostKeys=no", "BatchMode=yes", "ControlMaster=no", "ClearAllForwardings=yes", "--\nrakennus\nexit 0\n"} {
		if !bytes.Contains(args, []byte(want)) {
			t.Errorf("ssh args lack %q:\n%s", want, args)
		}
	}
	// The person's own configuration is what is checked.
	if bytes.Contains(args, []byte("/dev/null")) || bytes.Contains(args, []byte("\n-F\n")) {
		t.Errorf("ssh args replace the person's config:\n%s", args)
	}
	if err := tailnetfake.SetConfigHost(f.sshDir, "nas", "ok"); err != nil {
		t.Fatal(err)
	}
	if reply = f.must(t, `{"action":"config_check","alias":"nas"}`); field(reply, "config_check", "result") != "ok" {
		t.Fatalf("check %v", reply["config_check"])
	}

	after, _ := os.ReadFile(filepath.Join(f.home, ".ssh/config"))
	if !bytes.Equal(before, after) {
		t.Fatal("~/.ssh/config changed")
	}
	if _, err := os.Stat(filepath.Join(f.home, ".ssh/known_hosts")); !os.IsNotExist(err) {
		t.Fatalf("known_hosts: %v", err)
	}

	// A host that leaves the file leaves the page, and the next choice
	// drops it from the preferences.
	writeHomeFile(t, f.home, ".ssh/config", strings.Replace(syntheticSSHConfig, "Host=rakennus", "Host=rakennus-uusi", 1))
	reply = f.must(t, "")
	if !reflect.DeepEqual(field(reply, "ssh_config", "shown"), []any{"nas"}) {
		t.Fatalf("shown after removal %v", field(reply, "ssh_config", "shown"))
	}
	f.must(t, `{"action":"config_unhide","alias":"pilvi"}`)
	if prefs, err := readPreferences(f.home); err != nil || !reflect.DeepEqual(prefs.SSHConfigMachines.Shown, []string{"nas"}) {
		t.Fatalf("preferences %+v %v", prefs.SSHConfigMachines, err)
	}
	f.matchContract(t)
}
