package cli

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func call(t *testing.T, args ...string) (int, map[string]any, string) {
	t.Helper()
	var out, err bytes.Buffer
	code := Run(args, &out, &err)
	var got map[string]any
	if out.Len() > 0 {
		if e := json.Unmarshal(out.Bytes(), &got); e != nil {
			t.Fatalf("stdout: %v: %s", e, out.String())
		}
	}
	return code, got, err.String()
}
func TestVersionStructured(t *testing.T) {
	code, out, err := call(t, "--json", "version")
	if code != 0 || err != "" {
		t.Fatalf("%d %s", code, err)
	}
	if out["schema_version"] != float64(1) {
		t.Fatal(out)
	}
}
func TestStrictUnknownAndJSONError(t *testing.T) {
	code, _, err := call(t, "--json", "wat")
	if code != 1 {
		t.Fatal(code)
	}
	var e map[string]any
	if json.Unmarshal([]byte(err), &e) != nil {
		t.Fatal(err)
	}
}
func TestConfigPrecedence(t *testing.T) {
	t.Setenv("NATIVE_AGENT_HOST_CONFIG", "/tmp/g.json")
	code, out, _ := call(t, "--json", "config", "path", "--component", "gateway")
	if code != 0 {
		t.Fatal(code)
	}
	data := out["data"].(map[string]any)
	if data["source"] != "env" {
		t.Fatal(data)
	}
}
func TestMaintenanceDryRunAndIdempotency(t *testing.T) {
	d := t.TempDir()
	t.Setenv("NATIVE_AGENT_HOST_STATE_DIR", d)
	for _, args := range [][]string{{"--json", "maintenance", "enter", "--idempotency-key", "k", "--dry-run"}, {"--json", "maintenance", "enter", "--idempotency-key", "k"}, {"--json", "maintenance", "enter", "--idempotency-key", "k"}, {"--json", "maintenance", "leave", "--idempotency-key", "k"}, {"--json", "maintenance", "leave", "--idempotency-key", "k"}} {
		code, _, err := call(t, args...)
		if code != 0 {
			t.Fatalf("%v: %s", args, err)
		}
	}
	if _, e := os.Stat(filepath.Join(d, "maintenance")); !os.IsNotExist(e) {
		t.Fatal(e)
	}
}
func TestReadinessHonest(t *testing.T) {
	code, out, _ := call(t, "--json", "admin", "readiness", "show")
	if code != 0 {
		t.Fatal(code)
	}
	if out["data"].(map[string]any)["ready"] != false {
		t.Fatal(out)
	}
}

func TestSkillPrintAndForceInstall(t *testing.T) {
	var output, stderr bytes.Buffer
	if code := Run([]string{"skill", "print", "operator"}, &output, &stderr); code != 0 {
		t.Fatalf("print: %d %s", code, stderr.String())
	}
	if output.String() != operatorSkillContent() {
		t.Fatal("skill print was not byte-identical to bundled content")
	}
	target := t.TempDir()
	args := []string{"--json", "skill", "install", "operator", "--agent", "pi", "--target", target}
	if code, _, message := call(t, args...); code != 0 {
		t.Fatalf("install: %s", message)
	}
	if code, _, _ := call(t, args...); code != 1 {
		t.Fatalf("overwrite without force returned %d", code)
	}
	args = append(args, "--force")
	if code, _, message := call(t, args...); code != 0 {
		t.Fatalf("force install: %s", message)
	}
	installed, err := os.ReadFile(filepath.Join(target, ".pi/agent/skills/operator/SKILL.md"))
	if err != nil || string(installed) != operatorSkillContent() {
		t.Fatalf("installed content drift: %v", err)
	}
}
