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
	"fmt"
	"io"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
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
	smtp, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{cert}})
	if err != nil {
		t.Fatal(err)
	}
	defer smtp.Close()
	var sent atomic.Int32
	go serveSMTP(smtp, "right-password", &sent, nil)
	port := ln.Addr().(*net.TCPAddr).Port
	extraToolEnv = []string{"SSL_CERT_FILE=" + caFile}
	defer func() { extraToolEnv = nil }()

	home := newHome(t)
	c := New(Env{Home: home, Config: Config{Tools: map[string]string{"himalaya": binary}}, FixtureTools: true}, Production(), nil)
	h := c.Handler(allow)
	account := func(password string, port int) map[string]any {
		return map[string]any{"action": "connect", "provider": "imap", "address": "person@example.test", "server": "localhost", "port": port, "security": "tls", "username": "person", "password": password, "smtp_server": "localhost", "smtp_port": smtp.Addr().(*net.TCPAddr).Port, "smtp_security": "tls"}
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
	badSMTP := account("right-password", port)
	badSMTP["smtp_port"] = closedPort
	if code, out, _ := call(t, h, "POST", AccountsPath, "", badSMTP); code != 422 || errorCode(out) != "server_unreachable" {
		t.Fatalf("closed SMTP port: %d %v", code, out)
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
	if sent.Load() != 0 {
		t.Fatal("credential check sent mail")
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
	// Follow the generated skill: a draft is appended over IMAP, not SMTP.
	args := []string{"-c", filepath.Join(home, himalayaDir, "person@example.test.toml"), "message", "compose", "--to", "other@example.test", "--subject", "synthetic", "--body", "synthetic body", "--save", "Drafts", "--json"}
	if out, err := (Env{Home: home}).run(t.Context(), Command{Path: binary, Args: args}, nil); err != nil {
		t.Fatalf("draft: %s %v", out, err)
	}
	if sent.Load() != 0 {
		t.Fatal("draft sent mail")
	}
	args = append(args[:len(args)-3], "--send", "--no-save", "--json")
	if out, err := (Env{Home: home}).run(t.Context(), Command{Path: binary, Args: args}, nil); err != nil {
		t.Fatalf("send: %s %v", out, err)
	}
	if sent.Load() != 1 {
		t.Fatalf("explicit send delivered %d messages", sent.Load())
	}
	// SMTP STARTTLS must upgrade before AUTH; never downgrade to cleartext.
	starttls, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer starttls.Close()
	go serveSMTP(starttls, "right-password", &sent, &tls.Config{Certificates: []tls.Certificate{cert}})
	second := account("right-password", port)
	second["address"] = "second@example.test"
	second["smtp_port"] = starttls.Addr().(*net.TCPAddr).Port
	second["smtp_security"] = "starttls"
	if code, out, _ := call(t, h, "POST", AccountsPath, "", second); code != 200 {
		t.Fatalf("STARTTLS: %d %v", code, out)
	}
	// A password rotation must retain SMTP, not silently turn sending off.
	if code, out, _ := call(t, h, "POST", AccountsPath, "", map[string]any{"action": "password", "provider": "imap", "address": "second@example.test", "password": "right-password"}); code != 200 {
		t.Fatalf("renew SMTP: %d %v", code, out)
	}
	file, err := os.ReadFile(filepath.Join(home, himalayaDir, "second@example.test.toml"))
	parsed, ok := parseHimalayaConfig("second@example.test", file)
	if err != nil || !ok || parsed.SMTPPort != second["smtp_port"] || parsed.SMTPSecurity != "starttls" {
		t.Fatal("renewal lost SMTP settings")
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
				case "APPEND":
					literal := strings.Trim(parts[len(parts)-1], "{}+\r\n")
					n, _ := strconv.Atoi(literal)
					write("+ ready")
					if _, err := io.CopyN(io.Discard, r, int64(n)); err != nil {
						return
					}
					r.ReadString('\n')
					write(tag + " OK [APPENDUID 1 1] appended")
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

// Synthetic SMTP accepts authentication and counts DATA, distinguishing a
// credential probe or draft from an actual send.
func serveSMTP(ln net.Listener, password string, sent *atomic.Int32, upgrade *tls.Config) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go func() {
			defer conn.Close()
			conn.SetDeadline(time.Now().Add(10 * time.Second))
			r := bufio.NewReader(conn)
			write := func(s string) { fmt.Fprint(conn, s+"\r\n") }
			write("220 localhost synthetic SMTP")
			for {
				line, err := r.ReadString('\n')
				if err != nil {
					return
				}
				parts := strings.Fields(line)
				if len(parts) == 0 {
					return
				}
				switch strings.ToUpper(parts[0]) {
				case "EHLO":
					if upgrade != nil {
						write("250-localhost\r\n250-STARTTLS\r\n250 AUTH PLAIN")
					} else {
						write("250-localhost\r\n250-AUTH PLAIN\r\n250 8BITMIME")
					}
				case "STARTTLS":
					if upgrade == nil {
						write("454 unavailable")
						continue
					}
					write("220 ready")
					secure := tls.Server(conn, upgrade)
					if err := secure.Handshake(); err != nil {
						return
					}
					conn = secure
					r = bufio.NewReader(conn)
				case "AUTH":
					if _, ok := conn.(*tls.Conn); !ok {
						write("530 TLS required")
						continue
					}
					response := ""
					if len(parts) > 2 {
						response = parts[2]
					} else {
						write("334 ")
						response, _ = r.ReadString('\n')
					}
					decoded, _ := base64.StdEncoding.DecodeString(strings.TrimSpace(response))
					fields := strings.Split(string(decoded), "\x00")
					if len(fields) == 3 && fields[2] == password {
						write("235 authenticated")
					} else {
						write("535 authentication failed")
					}
				case "DATA":
					write("354 send data")
					for {
						line, err = r.ReadString('\n')
						if err != nil {
							return
						}
						if line == ".\r\n" {
							break
						}
					}
					sent.Add(1)
					write("250 queued")
				case "QUIT":
					write("221 bye")
					return
				default:
					write("250 OK")
				}
			}
		}()
	}
}
