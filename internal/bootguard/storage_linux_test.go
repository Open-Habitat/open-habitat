//go:build linux

package bootguard

import (
	policy "github.com/Open-Habitat/open-habitat"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPolicyTrust(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("root-owned trusted ancestry required")
	}
	// /var/tmp itself is writable and therefore correctly refused.
	dir := t.TempDir()
	p := filepath.Join(dir, "policy")
	if e := os.WriteFile(p, []byte("{}"), 0644); e != nil {
		t.Fatal(e)
	}
	if _, e := readPolicy(p); e == nil {
		t.Fatal("writable ancestry accepted")
	}
}
func TestBootMissingPolicyOrHome(t *testing.T) {
	// An ordinary developer host must never satisfy this installed baseline.
	if _, e := os.Stat("/etc/open-habitat/storage-policy.json"); !os.IsNotExist(e) {
		t.Skip("installed host")
	}
	if got := Storage(); got == "verified" {
		t.Fatal("missing policy accepted")
	}
}

func TestStoragePolicyExact(t *testing.T) {
	good := `{"schema_version":1,"home_uuid":"12345678-1234-1234-1234-123456789abc","user_quota":true}`
	if _, ok := parsePolicy([]byte(good + "\n")); !ok {
		t.Fatal("valid policy refused")
	}
	for _, bad := range []string{
		`{}`, `null`, good + good,
		strings.Replace(good, `"schema_version":1`, `"schema_version":1,"schema_version":1`, 1),
		strings.Replace(good, `"home_uuid"`, `"Home_UUID"`, 1),
		strings.Replace(good, `true`, `false`, 1),
		strings.Replace(good, `12345678-1234-1234-1234-123456789abc`, `../../dev/root`, 1),
		strings.Replace(good, `"schema_version":1`, `"schema_version":2`, 1),
		strings.Replace(good, `"user_quota":true`, `"user_quota":true,"unknown":0`, 1),
	} {
		if _, ok := parsePolicy([]byte(bad)); ok {
			t.Fatalf("invalid policy accepted: %s", bad)
		}
	}
}
func TestShippedStorageDependencies(t *testing.T) {
	for name, content := range map[string]string{"broker": policy.BrokerService, "broker.socket": policy.BrokerSocket, "daemon": policy.DaemonSocket, "agent": policy.AgentSocket} {
		if !strings.Contains(content, "Requires=open-habitat-storage.service") || !strings.Contains(content, "After=open-habitat-storage.service") {
			t.Fatalf("unguarded %s", name)
		}
	}
	for name, content := range map[string]string{"storage": policy.StorageService, "binding": policy.BindingService} {
		if strings.Contains(content, "RemainAfterExit=yes") {
			t.Fatalf("%s success must not be cached", name)
		}
		// Uncached gates may run more often than systemd's default start burst
		// during boot or a release switch. The directive belongs in [Unit].
		section := ""
		interval := ""
		for _, line := range strings.Split(content, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "[") {
				section = line
			}
			if section == "[Unit]" && strings.HasPrefix(line, "StartLimitIntervalSec=") {
				interval = strings.TrimPrefix(line, "StartLimitIntervalSec=")
			}
		}
		if interval != "0" {
			t.Fatalf("%s uncached gate must disable start-rate limiting", name)
		}
	}
}

func TestPolicyFilesystemRefusals(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("disposable root fixture required")
	}
	dir, e := os.MkdirTemp("/root", "bootguard-")
	if e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(dir)
	p := filepath.Join(dir, "policy")
	if e = os.WriteFile(p, []byte("synthetic-policy"), 0644); e != nil {
		t.Fatal(e)
	}
	if b, e := readPolicy(p); e != nil || string(b) != "synthetic-policy" {
		t.Fatalf("trusted file refused: %v", e)
	}
	if e = os.Chmod(p, 0666); e != nil {
		t.Fatal(e)
	}
	if _, e := readPolicy(p); e == nil {
		t.Fatal("writable policy accepted")
	}
	if e = os.Chmod(p, 0644); e != nil {
		t.Fatal(e)
	}
	link := filepath.Join(dir, "link")
	if e = os.Symlink(p, link); e != nil {
		t.Fatal(e)
	}
	if _, e := readPolicy(link); e == nil {
		t.Fatal("symlink accepted")
	}
	hard := filepath.Join(dir, "hard")
	if e = os.Link(p, hard); e != nil {
		t.Fatal(e)
	}
	if _, e := readPolicy(p); e == nil {
		t.Fatal("multiply linked policy accepted")
	}
	if e = os.Remove(hard); e != nil {
		t.Fatal(e)
	}
	if e = os.Chown(p, 21001, 21001); e != nil {
		t.Fatal(e)
	}
	if _, e := readPolicy(p); e == nil {
		t.Fatal("foreign-owned policy accepted")
	}
	if e = os.Chown(p, 0, 0); e != nil {
		t.Fatal(e)
	}
	if e = os.Chmod(dir, 0777); e != nil {
		t.Fatal(e)
	}
	if _, e := readPolicy(p); e == nil {
		t.Fatal("writable parent accepted")
	}
}
