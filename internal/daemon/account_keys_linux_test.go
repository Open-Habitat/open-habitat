//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func needTool(t *testing.T, path string) {
	t.Helper()
	if _, err := os.Stat(path); err != nil {
		t.Skip("requires " + path)
	}
}

func sshKeygen(t *testing.T, args ...string) string {
	t.Helper()
	out, err := exec.Command("/usr/bin/ssh-keygen", args...).Output()
	if err != nil {
		t.Fatal(err)
	}
	return strings.TrimSpace(string(out))
}

func keysRequest(t *testing.T, h http.Handler, method, body string) (int, map[string]any, string) {
	t.Helper()
	r := httptest.NewRequest(method, "http://unix"+AccountKeysPath, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	var reply map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &reply)
	return w.Code, reply, w.Body.String()
}

func keysHandler(home string, tools keyTools) http.Handler {
	cfg := transport.Config{Home: home, UID: os.Geteuid(), Username: "person", Provider: "github", Subject: "42"}
	return accountKeysHandler(cfg, func(*http.Request) bool { return true }, tools)
}

// The public half comes from the private file, whatever the .pub beside it
// says; a .pub alone, a link, a key that cannot be checked and a file that
// only wraps someone else's public key are not the account's keys.
func TestAccountKeysReadDerivesFromPrivateFiles(t *testing.T) {
	needTool(t, "/usr/bin/ssh-keygen")
	home, outside := t.TempDir(), t.TempDir()
	ssh := filepath.Join(home, ".ssh")
	if err := os.Mkdir(ssh, 0700); err != nil {
		t.Fatal(err)
	}
	sshKeygen(t, "-q", "-t", "ed25519", "-N", "", "-C", "mine@example", "-f", filepath.Join(ssh, "id_ed25519"))
	sshKeygen(t, "-q", "-t", "rsa", "-b", "2048", "-N", "", "-C", "rsa@example", "-f", filepath.Join(ssh, "id_rsa"))
	for _, bits := range []string{"256", "384", "521"} {
		sshKeygen(t, "-q", "-t", "ecdsa", "-b", bits, "-N", "", "-C", "ecdsa@example", "-f", filepath.Join(ssh, "id_ecdsa"+bits))
	}
	// A passphrase key cannot be checked without the passphrase.
	sshKeygen(t, "-q", "-t", "ed25519", "-N", "correct horse", "-C", "locked@example", "-f", filepath.Join(ssh, "locked_ed25519"))
	sshKeygen(t, "-q", "-t", "ed25519", "-N", "", "-C", "attacker@example", "-f", filepath.Join(outside, "other"))
	// The default key's .pub is replaced by another key: neither its key nor
	// its comment may show.
	attacker, _ := os.ReadFile(filepath.Join(outside, "other.pub"))
	if err := os.WriteFile(filepath.Join(ssh, "id_ed25519.pub"), attacker, 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(ssh, "admin.pub"), attacker, 0644); err != nil {
		t.Fatal(err)
	}
	// A container whose public copy is someone else's key around this
	// account's own private section.
	mine, _ := os.ReadFile(filepath.Join(ssh, "id_ed25519"))
	theirs, _ := os.ReadFile(filepath.Join(outside, "other"))
	mineBlock, _ := pem.Decode(mine)
	theirsBlock, _ := pem.Decode(theirs)
	header := func(b []byte) []byte {
		rest := b[len("openssh-key-v1\x00"):]
		for range 3 {
			_, rest, _ = sshString(rest)
		}
		blob, _, _ := sshString(rest[4:])
		return blob
	}
	forged := bytes.Replace(mineBlock.Bytes, header(mineBlock.Bytes), header(theirsBlock.Bytes), 1)
	if err := os.WriteFile(filepath.Join(ssh, "forged"), pem.EncodeToMemory(&pem.Block{Type: "OPENSSH PRIVATE KEY", Bytes: forged}), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(outside, "other"), filepath.Join(ssh, "linked")); err != nil {
		t.Fatal(err)
	}
	for name, body := range map[string]string{"known_hosts": "example ssh-ed25519 AAAA\n", "config": "Host x\n", "authorized_keys": string(attacker)} {
		if err := os.WriteFile(filepath.Join(ssh, name), []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	keys, err := readAccountKeys(home, keyTools{sshKeygen: "/usr/bin/ssh-keygen", ageKeygen: filepath.Join(outside, "absent")})
	if err != nil {
		t.Fatal(err)
	}
	files := []string{}
	for _, k := range keys.Keys {
		files = append(files, k.File)
	}
	if strings.Join(files, " ") != "~/.ssh/id_ed25519 ~/.ssh/id_ecdsa256 ~/.ssh/id_ecdsa384 ~/.ssh/id_ecdsa521 ~/.ssh/id_rsa" {
		t.Fatalf("keys: %v", files)
	}
	for _, k := range keys.Keys {
		private := filepath.Join(home, strings.TrimPrefix(k.File, "~/"))
		// ssh-keygen's own public half and fingerprint of the private file
		// (`-lf` on the private file would read a replaced .pub instead).
		derived := strings.Fields(sshKeygen(t, "-y", "-f", private))
		line := filepath.Join(outside, "derived.pub")
		if err := os.WriteFile(line, []byte(strings.Join(derived, " ")+"\n"), 0600); err != nil {
			t.Fatal(err)
		}
		want := strings.Fields(sshKeygen(t, "-lf", line))[1]
		if k.Fingerprint != want || !strings.HasPrefix(k.PublicKey, derived[0]+" "+derived[1]+" ") {
			t.Fatalf("%s: %+v, ssh-keygen %v %s", k.File, k, derived, want)
		}
	}
	if keys.Keys[0].Comment != "mine@example" {
		t.Fatalf("comment not the private file's: %+v", keys.Keys[0])
	}
	// The SSH default exists; the age key is missing and its tool absent.
	if len(keys.Missing) != 1 || keys.Missing[0] != (missingKey{Kind: "age", File: "~/.config/sops/age/keys.txt", CanCreate: false}) {
		t.Fatalf("missing: %+v", keys.Missing)
	}
}

func TestAccountKeysAgeRecipientMatchesAgeKeygen(t *testing.T) {
	needTool(t, "/usr/bin/age-keygen")
	home := t.TempDir()
	dir := filepath.Join(home, ".config/sops/age")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(dir, "keys.txt")
	if err := exec.Command("/usr/bin/age-keygen", "-o", file).Run(); err != nil {
		t.Fatal(err)
	}
	first, _ := os.ReadFile(file)
	second, err := exec.Command("/usr/bin/age-keygen").Output()
	if err != nil {
		t.Fatal(err)
	}
	// A second identity, a plugin identity, a forged "public key" comment
	// and a corrupted identity in one file.
	forged := "# public key: age1zgxd79sw3jvcsj2c2tlr7stegtxpd9kcq2zjwpkuylg6yrlwvegsv5juss\nAGE-PLUGIN-YUBIKEY-1QQQQQQ\nAGE-SECRET-KEY-1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ\n"
	if err := os.WriteFile(file, append(append(first, forged...), second...), 0600); err != nil {
		t.Fatal(err)
	}
	keys, err := readAccountKeys(home, systemKeyTools)
	if err != nil {
		t.Fatal(err)
	}
	var recipients []string
	for _, k := range keys.Keys {
		if k.Kind == "age" {
			recipients = append(recipients, k.PublicKey)
		}
	}
	want := []string{}
	for _, part := range [][]byte{first, second} {
		cmd := exec.Command("/usr/bin/age-keygen", "-y")
		cmd.Stdin = strings.NewReader(string(part))
		out, err := cmd.Output()
		if err != nil {
			t.Fatal(err)
		}
		want = append(want, strings.TrimSpace(string(out)))
	}
	if strings.Join(recipients, ",") != strings.Join(want, ",") {
		t.Fatalf("recipients %v want %v", recipients, want)
	}
}

func TestBech32RejectsCorruption(t *testing.T) {
	for _, valid := range []string{"A12UEL5L", "abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw"} {
		if _, _, ok := bech32Decode(valid); !ok {
			t.Fatal("rejected BIP 173 vector", valid)
		}
	}
	for _, invalid := range []string{"A12UEL5l", "a12uel5m", "1qzzfhee", "abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxx", "pzry9x0s0muk"} {
		if _, _, ok := bech32Decode(invalid); ok {
			t.Fatal("accepted", invalid)
		}
	}
}

// Creation writes the default key with the native tool, answers with its
// public half only, and never replaces anything already at the name.
func TestAccountKeysCreateNeverReplaces(t *testing.T) {
	needTool(t, "/usr/bin/ssh-keygen")
	home := t.TempDir()
	old := siteOriginPath
	siteOriginPath = filepath.Join(home, "absent-site.json")
	t.Cleanup(func() { siteOriginPath = old })
	h := keysHandler(home, keyTools{sshKeygen: "/usr/bin/ssh-keygen", ageKeygen: filepath.Join(home, "absent")})
	status, reply, body := keysRequest(t, h, "GET", "")
	if status != 200 || len(reply["missing"].([]any)) != 2 {
		t.Fatalf("empty account: %d %s", status, body)
	}
	if _, err := os.Stat(filepath.Join(home, ".ssh")); !os.IsNotExist(err) {
		t.Fatal("read created ~/.ssh")
	}
	status, reply, body = keysRequest(t, h, "POST", `{"kind":"ssh"}`)
	if status != 200 {
		t.Fatalf("create: %d %s", status, body)
	}
	private := filepath.Join(home, ".ssh/id_ed25519")
	st, err := os.Lstat(private)
	if err != nil || !st.Mode().IsRegular() || st.Mode().Perm() != 0600 {
		t.Fatalf("private key: %v %v", st, err)
	}
	derived := strings.Fields(sshKeygen(t, "-y", "-f", private))
	key := reply["keys"].([]any)[0].(map[string]any)
	if created, _ := reply["created"].(map[string]any); created["fingerprint"] != key["fingerprint"] {
		t.Fatalf("created %v, listed %v", reply["created"], key)
	}
	if key["public_key"] != derived[0]+" "+derived[1]+" person@open-habitat" || key["comment"] != "person@open-habitat" {
		t.Fatalf("created key: %v (ssh-keygen says %v)", key, derived)
	}
	if strings.Contains(body, "PRIVATE") || strings.Contains(body, "BEGIN") {
		t.Fatal("reply carries private material")
	}
	pub, _ := os.ReadFile(private + ".pub")
	if strings.TrimSpace(string(pub)) != key["public_key"] {
		t.Fatalf(".pub %q", pub)
	}
	entries, _ := os.ReadDir(filepath.Join(home, ".ssh"))
	if len(entries) != 2 {
		t.Fatalf("staging left behind: %v", entries)
	}
	before, _ := os.ReadFile(private)
	if status, _, body = keysRequest(t, h, "POST", `{"kind":"ssh"}`); status != 409 || !strings.Contains(body, "key_exists") {
		t.Fatalf("second create: %d %s", status, body)
	}
	after, _ := os.ReadFile(private)
	if string(before) != string(after) {
		t.Fatal("existing key replaced")
	}
	// The age tool is absent: nothing to run, nothing written.
	if status, _, body = keysRequest(t, h, "POST", `{"kind":"age"}`); status != 409 || !strings.Contains(body, "key_tool_unavailable") {
		t.Fatalf("absent tool: %d %s", status, body)
	}
	if _, err := os.Stat(filepath.Join(home, ".config")); !os.IsNotExist(err) {
		t.Fatal("absent tool created directories")
	}
}

func TestAccountKeysCreateLosesRaceToConcurrentWriter(t *testing.T) {
	needTool(t, "/usr/bin/ssh-keygen")
	home, outside := t.TempDir(), t.TempDir()
	// An agent writes the default key while the tool runs: the page's key
	// must not land over it.
	tool := filepath.Join(outside, "ssh-keygen")
	script := "#!/bin/sh\nprintf 'agent key\\n' > \"$HOME/.ssh/id_ed25519\"\nexec /usr/bin/ssh-keygen \"$@\"\n"
	if err := os.WriteFile(tool, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	h := keysHandler(home, keyTools{sshKeygen: tool, ageKeygen: tool})
	if status, _, body := keysRequest(t, h, "POST", `{"kind":"ssh"}`); status != 409 || !strings.Contains(body, "key_exists") {
		t.Fatalf("race: %d %s", status, body)
	}
	b, _ := os.ReadFile(filepath.Join(home, ".ssh/id_ed25519"))
	if string(b) != "agent key\n" {
		t.Fatalf("concurrent file replaced: %q", b)
	}
	if entries, _ := os.ReadDir(filepath.Join(home, ".ssh")); len(entries) != 1 {
		t.Fatalf("staging left behind: %v", entries)
	}
}

func TestAccountKeysCreateRefusesLinksAndUnsafeDirectories(t *testing.T) {
	needTool(t, "/usr/bin/ssh-keygen")
	tools := keyTools{sshKeygen: "/usr/bin/ssh-keygen", ageKeygen: "/usr/bin/ssh-keygen"}
	t.Run("dangling link at the name", func(t *testing.T) {
		home, outside := t.TempDir(), t.TempDir()
		os.Mkdir(filepath.Join(home, ".ssh"), 0700)
		if err := os.Symlink(filepath.Join(outside, "target"), filepath.Join(home, ".ssh/id_ed25519")); err != nil {
			t.Fatal(err)
		}
		if status, _, body := keysRequest(t, keysHandler(home, tools), "POST", `{"kind":"ssh"}`); status != 409 {
			t.Fatalf("%d %s", status, body)
		}
		if entries, _ := os.ReadDir(outside); len(entries) != 0 {
			t.Fatal("wrote through link")
		}
	})
	t.Run("linked directory", func(t *testing.T) {
		home, outside := t.TempDir(), t.TempDir()
		if err := os.Symlink(outside, filepath.Join(home, ".ssh")); err != nil {
			t.Fatal(err)
		}
		if status, _, _ := keysRequest(t, keysHandler(home, tools), "POST", `{"kind":"ssh"}`); status != 503 {
			t.Fatalf("followed directory link: %d", status)
		}
		if status, _, _ := keysRequest(t, keysHandler(home, tools), "GET", ""); status != 503 {
			t.Fatalf("read through directory link: %d", status)
		}
		if entries, _ := os.ReadDir(outside); len(entries) != 0 {
			t.Fatal("wrote through link")
		}
	})
	t.Run("group-writable directory", func(t *testing.T) {
		home := t.TempDir()
		os.Mkdir(filepath.Join(home, ".ssh"), 0700)
		os.Chmod(filepath.Join(home, ".ssh"), 0770)
		if status, _, _ := keysRequest(t, keysHandler(home, tools), "POST", `{"kind":"ssh"}`); status != 503 {
			t.Fatalf("wrote into shared directory: %d", status)
		}
		// Reading still works: a user-private group's ~/.config is often 0775.
		if status, _, _ := keysRequest(t, keysHandler(home, tools), "GET", ""); status != 200 {
			t.Fatalf("read refused: %d", status)
		}
	})
}

func TestAccountKeysCreatesAgeIdentity(t *testing.T) {
	needTool(t, "/usr/bin/age-keygen")
	home := t.TempDir()
	h := keysHandler(home, systemKeyTools)
	status, reply, body := keysRequest(t, h, "POST", `{"kind":"age"}`)
	if status != 200 || strings.Contains(body, "AGE-SECRET-KEY") {
		t.Fatalf("%d %s", status, body)
	}
	file := filepath.Join(home, ".config/sops/age/keys.txt")
	st, err := os.Lstat(file)
	if err != nil || st.Mode().Perm() != 0600 {
		t.Fatalf("%v %v", st, err)
	}
	cmd := exec.Command("/usr/bin/age-keygen", "-y", file)
	out, err := cmd.Output()
	if err != nil {
		t.Fatal(err)
	}
	var recipient string
	for _, k := range reply["keys"].([]any) {
		if k.(map[string]any)["kind"] == "age" {
			recipient = k.(map[string]any)["public_key"].(string)
		}
	}
	if recipient != strings.TrimSpace(string(out)) {
		t.Fatalf("recipient %q, age-keygen %q", recipient, out)
	}
}

func TestAccountKeysHTTPBoundary(t *testing.T) {
	home := t.TempDir()
	tools := keyTools{sshKeygen: filepath.Join(home, "absent"), ageKeygen: filepath.Join(home, "absent")}
	trusted := true
	cfg := transport.Config{Home: home, UID: os.Geteuid(), Provider: "github", Subject: "42"}
	h := accountKeysHandler(cfg, func(*http.Request) bool { return trusted }, tools)
	for _, tc := range []struct {
		method, suffix, body string
		status               int
	}{
		{"GET", "", "", 200}, {"GET", "?home=/root", "", 400}, {"PUT", "", `{"kind":"ssh"}`, 400},
		{"POST", "", `{"kind":"rsa"}`, 400}, {"POST", "", `{"Kind":"ssh"}`, 400}, {"POST", "", `{"kind":"ssh","file":"x"}`, 400},
		{"POST", "", `{"kind":"ssh"} {}`, 400}, {"POST", "", `{"kind":"ssh","kind":"age"}`, 400}, {"POST", "", `{}`, 400},
		{"POST", "", `{"kind":"ssh"}`, 409},
	} {
		r := httptest.NewRequest(tc.method, "http://unix"+AccountKeysPath+tc.suffix, strings.NewReader(tc.body))
		if tc.body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatalf("%+v: %d %s", tc, w.Code, w.Body.String())
		}
	}
	trusted = false
	if status, _, _ := keysRequest(t, h, "GET", ""); status != 403 {
		t.Fatalf("untrusted peer: %d", status)
	}
	trusted = true
	cfg.UID = os.Geteuid() + 1
	other := accountKeysHandler(cfg, func(*http.Request) bool { return true }, tools)
	if status, _, _ := keysRequest(t, other, "GET", ""); status != 403 {
		t.Fatalf("another UID's home: %d", status)
	}
}
