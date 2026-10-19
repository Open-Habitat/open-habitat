//go:build linux

package integrations

import (
	"bufio"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestRealHimalayaOverTLS drives the pinned himalaya binary named by
// OH_TEST_HIMALAYA against a synthetic IMAP server with a synthetic CA. It
// proves that the file the catalog writes is one himalaya reads, that the
// check's JSON is classified as the entry expects, and that a refused password
// leaves nothing behind. No real account or network is involved.
func TestRealHimalayaOverTLS(t *testing.T) {
	binary := os.Getenv("OH_TEST_HIMALAYA")
	if binary == "" {
		t.Skip("OH_TEST_HIMALAYA names no himalaya binary; the fake tool covers the catalog")
	}
	dir := t.TempDir()
	caFile, cert := syntheticTLS(t, dir)
	ln, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{cert}})
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	go serveIMAP(ln, "right-password")
	port := ln.Addr().(*net.TCPAddr).Port
	extraToolEnv = []string{"SSL_CERT_FILE=" + caFile}
	defer func() { extraToolEnv = nil }()

	home := newHome(t)
	c := New(Env{Home: home, Config: Config{Tools: map[string]string{"himalaya": binary}}, FixtureTools: true}, Production(), nil)
	h := c.Handler(allow)
	account := func(password string, port int) map[string]any {
		return map[string]any{"action": "connect", "provider": "imap", "address": "person@example.test", "server": "localhost", "port": port, "security": "tls", "username": "person", "password": password}
	}
	if code, out, _ := call(t, h, "POST", AccountsPath, "", account("wrong", port)); code != 422 || errorCode(out) != "credentials_rejected" {
		t.Fatalf("wrong password: %d %v", code, out)
	}
	closed, _ := net.Listen("tcp", "127.0.0.1:0")
	closedPort := closed.Addr().(*net.TCPAddr).Port
	closed.Close()
	if code, out, _ := call(t, h, "POST", AccountsPath, "", account("right-password", closedPort)); code != 422 || errorCode(out) != "server_unreachable" {
		t.Fatalf("closed port: %d %v", code, out)
	}
	if entries, _ := os.ReadDir(filepath.Join(home, himalayaDir)); len(entries) != 0 {
		t.Fatalf("refused sign-ins left %v", entries)
	}
	code, out, raw := call(t, h, "POST", AccountsPath, "", account("right-password", port))
	if code != 200 || strings.Contains(raw, "right-password") {
		t.Fatalf("connect: %d %s", code, raw)
	}
	if s := out["account"].(map[string]any)["services"].([]any)[0].(map[string]any)["state"]; s != "ok" {
		t.Fatalf("state: %v", s)
	}
	// The file is himalaya's own: it lists the account as the default, so
	// an agent following the skill needs no --account.
	list, err := Env{Home: home}.run(t.Context(), Command{Path: binary, Args: []string{"-c", filepath.Join(home, himalayaDir, "person@example.test.toml"), "account", "list", "--json"}}, nil)
	var accounts struct {
		Accounts []struct {
			Name    string `json:"name"`
			Default bool   `json:"default"`
		} `json:"accounts"`
	}
	if err != nil || json.Unmarshal(list, &accounts) != nil || len(accounts.Accounts) != 1 || accounts.Accounts[0].Name != "person@example.test" || !accounts.Accounts[0].Default {
		t.Fatalf("himalaya account list: %s %v", list, err)
	}
}

func syntheticTLS(t *testing.T, dir string) (string, tls.Certificate) {
	t.Helper()
	caKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "synthetic test CA"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	caDER, err := x509.CreateCertificate(rand.Reader, ca, ca, &caKey.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	caCert, _ := x509.ParseCertificate(caDER)
	leafKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	leaf := &x509.Certificate{SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: "localhost"}, DNSNames: []string{"localhost"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	leafDER, err := x509.CreateCertificate(rand.Reader, leaf, caCert, &leafKey.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	caFile := filepath.Join(dir, "ca.pem")
	if err := os.WriteFile(caFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}), 0o600); err != nil {
		t.Fatal(err)
	}
	return caFile, tls.Certificate{Certificate: [][]byte{leafDER}, PrivateKey: leafKey}
}

// serveIMAP answers just enough IMAP4rev1 for a sign-in check: a greeting,
// CAPABILITY, AUTHENTICATE PLAIN with or without an initial response, and
// LOGOUT.
func serveIMAP(ln net.Listener, password string) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go func() {
			defer conn.Close()
			conn.SetDeadline(time.Now().Add(10 * time.Second))
			r := bufio.NewReader(conn)
			write := func(s string) { conn.Write([]byte(s + "\r\n")) }
			write("* OK [CAPABILITY IMAP4rev1 AUTH=PLAIN SASL-IR] synthetic")
			for {
				line, err := r.ReadString('\n')
				if err != nil {
					return
				}
				parts := strings.Fields(line)
				if len(parts) < 2 {
					return
				}
				tag, cmd := parts[0], strings.ToUpper(parts[1])
				switch cmd {
				case "CAPABILITY":
					write("* CAPABILITY IMAP4rev1 AUTH=PLAIN SASL-IR")
					write(tag + " OK done")
				case "AUTHENTICATE":
					response := ""
					if len(parts) > 3 {
						response = parts[3]
					} else {
						write("+ ")
						response, _ = r.ReadString('\n')
					}
					decoded, _ := base64.StdEncoding.DecodeString(strings.TrimSpace(response))
					fields := strings.Split(string(decoded), "\x00")
					if len(fields) == 3 && fields[2] == password {
						write(tag + " OK [CAPABILITY IMAP4rev1] signed in")
					} else {
						write(tag + " NO [AUTHENTICATIONFAILED] synthetic refusal")
					}
				case "LOGOUT":
					write("* BYE")
					write(tag + " OK bye")
					return
				default:
					write(tag + " OK")
				}
			}
		}()
	}
}
