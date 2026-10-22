//go:build linux

package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/Open-Habitat/open-habitat/internal/host"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestHostValidationBeforeObservation(t *testing.T) {
	for _, args := range [][]string{
		{"check"}, {"check", "--site", "relative"}, {"plan", "--site", "/x", "--site", "/y"},
		{"plan", "--site", "/x", "--dry-run"}, {"apply", "--site", "/x"}, {"operation", "show", "../active"},
		{"check", "--secret", "SECRET_SENTINEL"}, {"operation", "show", strings.Repeat("a", 32), "--site", "/x"},
	} {
		var out, err bytes.Buffer
		code := Run(append([]string{"--json", "host"}, args...), &out, &err)
		if code != 1 || out.Len() != 0 || !strings.Contains(err.String(), `"code":"invalid_arguments"`) || strings.Contains(err.String(), "SECRET_SENTINEL") {
			t.Fatal(args, code, out.String(), err.String())
		}
	}
}
func TestHostReadOnlyCLI(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("actual root in test-host-initialization-uids.sh")
	}
	if os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("synthetic networkless container only")
	}
	dir, e := os.MkdirTemp("/root", "oh-host-cli-")
	if e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(dir)
	b, e := os.ReadFile("/opt/example-site.json")
	if e != nil {
		t.Fatal(e)
	}
	var s map[string]any
	if json.Unmarshal(b, &s) != nil {
		t.Fatal("fixture")
	}
	g := s["gateway"].(map[string]any)
	secret := filepath.Join(dir, "secret")
	os.WriteFile(secret, []byte("SECRET_SENTINEL"), 0600)
	for _, key := range []string{"oauth_secret_file", "tls_cert_file", "tls_key_file"} {
		g[key] = secret
	}
	site := filepath.Join(dir, "site.json")
	b, _ = json.Marshal(s)
	os.WriteFile(site, b, 0600)
	for _, verb := range []string{"check", "plan"} {
		var out, err bytes.Buffer
		code := Run([]string{"host", verb, "--site", site, "--json"}, &out, &err)
		if code != 1 || out.Len() != 0 || strings.Contains(err.String(), "SECRET_SENTINEL") || strings.Contains(err.String(), secret) {
			t.Fatal(code, out.String(), err.String())
		}
		var envelope struct {
			Schema int `json:"schema_version"`
			Error  struct {
				Code   string `json:"code"`
				Result struct {
					Schema int            `json:"schema_version"`
					Data   map[string]any `json:"data"`
				} `json:"result"`
			} `json:"error"`
		}
		if json.Unmarshal(err.Bytes(), &envelope) != nil || envelope.Schema != 1 || envelope.Error.Code != "host_"+verb+"_blocked" || envelope.Error.Result.Schema != 1 || envelope.Error.Result.Data["checks"] == nil {
			t.Fatal(err.String())
		}
		if verb == "plan" && envelope.Error.Result.Data["approvable"] != false {
			t.Fatal("approvable plan")
		}
	}
	p, e := host.BuildPlan(context.Background(), site)
	if e != nil {
		t.Fatal(e)
	}
	for _, verb := range []string{"apply", "prepare"} {
		idForVerb := p.PlanID
		if verb == "prepare" {
			r, err := host.Prepare(context.Background(), host.PrepareRequest{SitePath: site, DryRun: true})
			if err != host.ErrHomeMount {
				t.Fatal(err)
			}
			idForVerb = r.Plan.PlanID
		}
		for _, dry := range []bool{false, true} {
			for _, stale := range []bool{false, true} {
				id := idForVerb
				if stale {
					id = strings.Repeat("0", 64)
				}
				args := []string{"host", verb, "--site", site, "--approved-plan", id}
				if verb == "prepare" {
					args = append(args, "--approve-disruption")
				}
				if dry {
					args = append(args, "--dry-run", "--json")
				} else {
					args = append(args, "--output=jsonl")
				}
				var out, diagnostic bytes.Buffer
				code := Run(args, &out, &diagnostic)
				want := "host_" + verb + "_blocked"
				if verb == "prepare" {
					want = "home_mount_required"
				}
				if stale {
					want = "stale_plan"
				}
				if code != 1 || strings.Contains(out.String()+diagnostic.String(), "SECRET_SENTINEL") || strings.Contains(out.String()+diagnostic.String(), secret) {
					t.Fatal(code, out.String(), diagnostic.String())
				}
				if dry {
					if out.Len() != 0 || !strings.Contains(diagnostic.String(), want) || !strings.Contains(diagnostic.String(), `"dry_run":true`) {
						t.Fatal(out.String(), diagnostic.String())
					}
				} else {
					lines := strings.Split(strings.TrimSpace(out.String()), "\n")
					if len(lines) != 2 {
						t.Fatal(out.String())
					}
					for i, line := range lines {
						var event hostMaintenanceEvent
						if json.Unmarshal([]byte(line), &event) != nil || event.SchemaVersion != 1 || event.Seq != uint64(i+1) {
							t.Fatal(line)
						}
						if i == 0 && event.Event != "progress" || i == 1 && (event.Event != "error" || event.Code != want) {
							t.Fatal(event)
						}
					}
				}
			}
		}
	}
	entries, e := os.ReadDir(dir)
	if e != nil || len(entries) != 2 {
		t.Fatal("host state created", e)
	}
	if _, e := os.Stat("/var/lib/open-habitat"); !os.IsNotExist(e) {
		t.Fatal("system state touched", e)
	}
}

func TestHostOperationShowCLI(t *testing.T) {
	if os.Geteuid() != 0 || os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("synthetic root container only")
	}
	var out, err bytes.Buffer
	id := strings.Repeat("a", 32)
	if code := Run([]string{"host", "operation", "show", id, "--json"}, &out, &err); code != 1 || !strings.Contains(err.String(), "operation_not_found") {
		t.Fatal(code, out.String(), err.String())
	}
	if e := os.Mkdir("/var/lib/open-habitat", 0700); e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll("/var/lib/open-habitat")
	lock, e := host.OpenOperationLock(context.Background())
	if e != nil {
		t.Fatal(e)
	}
	defer lock.Close()
	op, e := lock.Begin("apply", strings.Repeat("b", 64), host.Release{Version: "0.1.0", ManifestSHA256: strings.Repeat("c", 64)})
	if e != nil {
		t.Fatal(e)
	}
	receipt := "/var/lib/open-habitat/host/" + op.ID + ".json"
	before, _ := os.ReadFile(receipt)
	st, _ := os.Stat(receipt)
	out.Reset()
	err.Reset()
	if code := Run([]string{"host", "operation", "show", op.ID, "--json"}, &out, &err); code != 0 || err.Len() != 0 || !strings.Contains(out.String(), `"phase":"started"`) {
		t.Fatal(code, out.String(), err.String())
	}
	after, _ := os.ReadFile(receipt)
	now, _ := os.Stat(receipt)
	if !bytes.Equal(before, after) || !st.ModTime().Equal(now.ModTime()) {
		t.Fatal("show changed journal")
	}
}

func TestHostRootRefusalAndUnstableClassification(t *testing.T) {
	if ce := hostError(host.ErrUnstable); ce.exit != 1 || ce.code != "observation_unstable" || ce.code == hostError(host.ErrRecovery).code {
		t.Fatal("unstable read confused with recovery", ce)
	}
	if os.Geteuid() == 0 {
		return
	}
	for _, verb := range []string{"check", "plan"} {
		var out, err bytes.Buffer
		if code := Run([]string{"host", verb, "--site", "/unreadable/site.json", "--json"}, &out, &err); code != 1 || out.Len() != 0 || !strings.Contains(err.String(), "unsafe_host_input") {
			t.Fatal(code, out.String(), err.String())
		}
	}
}

func TestHostApplyParsing(t *testing.T) {
	id := strings.Repeat("a", 64)
	for _, tc := range []struct {
		args []string
		json bool
	}{
		{[]string{"--site", "relative", "--dry-run"}, true},
		{[]string{"--site", "/site.json", "--site", "/other", "--dry-run"}, true},
		{[]string{"--site", "/site.json", "--dry-run", "--dry-run"}, true},
		{[]string{"--site", "/site.json", "--dry-run", "--approved-plan", ""}, true},
		{[]string{"--site", "/site.json", "--dry-run", "--approved-plan", "SECRET_SENTINEL"}, true},
		{[]string{"--site", "/site.json", "--approved-plan", id}, true},
		{[]string{"--site", "/site.json", "--approved-plan", id, "--output=jsonl"}, true},
		{[]string{"--site", "/site.json", "--approved-plan", id, "--output", "jsonl"}, false},
		{[]string{"--site", "/site.json", "--dry-run", "--resume", "SECRET_SENTINEL"}, true},
	} {
		_, err := parseHostApply(tc.args, tc.json)
		if err == nil || strings.Contains(err.Error(), "SECRET_SENTINEL") {
			t.Fatal(tc, err)
		}
	}
	for _, tc := range []struct {
		args []string
		json bool
	}{
		{[]string{"--site", "/site.json", "--dry-run"}, true},
		{[]string{"--dry-run", "--approved-plan", id, "--site", "/site.json"}, false},
		{[]string{"--approved-plan", id, "--site", "/site.json", "--output=jsonl"}, false},
	} {
		if _, err := parseHostApply(tc.args, tc.json); err != nil {
			t.Fatal(tc, err)
		}
	}
}

func TestHostApplyNoFabricatedResultBeforeObservation(t *testing.T) {
	var out, diagnostic bytes.Buffer
	// The path is deliberately absent; nonroot runners refuse earlier at the
	// effective UID boundary. Neither case has a plan to report as actual data.
	code := Run([]string{"host", "apply", "--site", "/nonexistent/host-site.json", "--dry-run", "--output=jsonl"}, &out, &diagnostic)
	if code == 0 {
		t.Fatal("missing site succeeded")
	}
	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
	if len(lines) != 2 {
		t.Fatal(out.String())
	}
	var terminal map[string]any
	if json.Unmarshal([]byte(lines[1]), &terminal) != nil || terminal["event"] != "error" {
		t.Fatal(out.String())
	}
	if _, ok := terminal["data"]; ok {
		t.Fatal("fabricated plan/outcome/dry_run on pre-observation failure", out.String())
	}
}
