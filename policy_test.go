package installationpolicy

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func directives(unit, section string) map[string][]string {
	out := map[string][]string{}
	current := ""
	for _, line := range strings.Split(unit, "\n") {
		line = strings.TrimSpace(line)
		switch {
		case line == "" || strings.HasPrefix(line, "#"):
		case strings.HasPrefix(line, "["):
			current = line
		case current == section:
			key, value, _ := strings.Cut(line, "=")
			out[key] = append(out[key], value)
		}
	}
	return out
}

// Agents' /var/tmp must survive a daemon restart without becoming shared:
// a root-created 0700 directory of the unit's own user replaces PrivateTmp's
// /var/tmp, /tmp stays private, and tmpfiles ages the persistent one.
func TestDaemonTemporaryDirectories(t *testing.T) {
	service := directives(DaemonService, "[Service]")
	for key, want := range map[string]string{
		"User":               "%i",
		"PrivateTmp":         "yes",
		"StateDirectory":     "open-habitat-tmp/%i",
		"StateDirectoryMode": "0700",
		"BindPaths":          "/var/lib/open-habitat-tmp/%i:/var/tmp",
	} {
		if got := service[key]; len(got) != 1 || got[0] != want {
			t.Errorf("%s = %q, want exactly %q", key, got, want)
		}
	}
	for _, key := range []string{"TemporaryFileSystem", "BindReadOnlyPaths", "DynamicUser"} {
		if _, ok := service[key]; ok {
			t.Errorf("%s would change which /tmp or /var/tmp the agents see", key)
		}
	}
	if !strings.Contains("\n"+Tmpfiles, "\ne /var/lib/open-habitat-tmp/* - - - 30d\n") {
		t.Error("tmpfiles policy does not age the persistent /var/tmp")
	}
}

// needrestart evaluates every /etc/needrestart/conf.d/*.conf as Perl after its
// own defaults and dies on a syntax error, which would fail the apt hook of
// every later upgrade. The first override_rc regex that matches a unit decides
// whether it is restarted; the product's units must all be held back, and
// nothing else.
func TestNeedrestartOverride(t *testing.T) {
	perl, err := exec.LookPath("perl")
	if err != nil {
		t.Skip("perl is not installed")
	}
	dir := t.TempDir()
	conf := filepath.Join(dir, "open-habitat.conf")
	if err := os.WriteFile(conf, []byte(NeedrestartOverride), 0o600); err != nil {
		t.Fatal(err)
	}
	units := []string{
		"open-habitat-daemon@alice.service", "open-habitat-gateway.service", "open-habitat-broker.service",
		"open-habitat-storage.service", "open-habitat-binding@alice.service", "open-habitat-proc.service",
		"ssh.service", "nginx.service", "user@1000.service", "open-habitat-daemon@alice.socket", "my-open-habitat-gateway.service",
	}
	script := `our %nrconf = (override_rc => {qr(^user@\d+\.service) => 0});
eval do { local(@ARGV, $/) = shift @ARGV; <> }; die "parse: $@" if $@;
for my $rc (@ARGV) { my $r = 1; for my $re (keys %{$nrconf{override_rc}}) { next unless $rc =~ /$re/; $r = $nrconf{override_rc}->{$re}; last } print "$rc=$r\n" }`
	out, err := exec.Command(perl, append([]string{"-e", script, conf}, units...)...).CombinedOutput()
	if err != nil {
		t.Fatalf("perl: %v\n%s", err, out)
	}
	want := map[string]string{"ssh.service": "1", "nginx.service": "1", "user@1000.service": "0", "open-habitat-daemon@alice.socket": "1", "my-open-habitat-gateway.service": "1"}
	got := map[string]string{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		k, v, _ := strings.Cut(line, "=")
		got[k] = v
	}
	for _, u := range units {
		w, ok := want[u]
		if !ok {
			w = "0"
		}
		if got[u] != w {
			t.Errorf("%s restart=%q, want %q", u, got[u], w)
		}
	}
}
