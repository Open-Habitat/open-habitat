//go:build linux

package integrations

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"golang.org/x/sys/unix"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// Real sealed interpreter/modules and pinned rclone, synthetic Entra/Graph only.
// The fixture shim injects MSAL's network seam; production has no endpoint knob.
func TestMicrosoftSingleGrantNativeRuntime(t *testing.T) {
	runtime, rclone := os.Getenv("OH_TEST_MICROSOFT_RUNTIME"), os.Getenv("OH_TEST_RCLONE")
	if runtime == "" || rclone == "" {
		t.Skip("requires sealed Microsoft runtime with test fixtures and pinned rclone")
	}
	for _, personal := range []bool{false, true} {
		t.Run(fmt.Sprint(personal), func(t *testing.T) {
			env := microsoftEnv(t)
			adapter := filepath.Join(t.TempDir(), "import")
			script := fmt.Sprintf("#!/bin/sh\nexec %q %q\n", filepath.Join(runtime, "bin/node"), filepath.Join(runtime, "microsoft-import-fixture.mjs"))
			if err := os.WriteFile(adapter, []byte(script), 0700); err != nil {
				t.Fatal(err)
			}
			env.Config.Tools["microsoft-native"] = adapter
			env.Config.Tools["ms-365-mcp-server"] = filepath.Join(runtime, "bin/ms-365-mcp-server")
			m := syntheticMicrosoft(t, "person@example.test", "")
			base := m.client.Transport
			codes := 0
			m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
				if strings.HasSuffix(r.URL.Path, "/devicecode") {
					codes++
					_ = r.ParseForm()
					for _, scope := range []string{"Files.ReadWrite.All", "Mail.ReadWrite", "Mail.Send", "Calendars.ReadWrite", "Contacts.ReadWrite"} {
						if !strings.Contains(r.Form.Get("scope"), scope) {
							t.Error("union scope missing", scope)
						}
					}
				}
				if personal && r.URL.Path == "/v1.0/me/drive" {
					return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"id":"personal-drive","name":"OneDrive","driveType":"personal"}`))}, nil
				}
				return base.RoundTrip(r)
			})
			l := msLogin(t, m, env, "")
			address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { t.Error("second device code requested"); return ToolFailed })
			if err != nil || codes != 1 {
				t.Fatal("single grant native import", err, codes)
			}
			if err := l.Commit(context.Background(), address); err != nil {
				t.Fatal(err)
			}
			// The actual MCP library must reload the adapter's encrypted account.
			cmd, _ := microsoftMCPCommand(env, l.app, microsoftMCPDir+"/"+address, address, "--list-accounts")
			data, err := env.run(context.Background(), cmd, nil)
			var accounts struct {
				Accounts []struct {
					Username string `json:"username"`
				} `json:"accounts"`
			}
			if err != nil || json.Unmarshal(data, &accounts) != nil || len(accounts.Accounts) != 1 || accounts.Accounts[0].Username != address {
				t.Fatal("native MCP reload", err)
			}

			// rclone refreshes from the catalog's config. Both OAuth and Graph are
			// loopback-only fixtures; a CONNECT proxy never forwards to the Internet.
			var refreshes atomic.Int32
			tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_ = r.ParseForm()
				if r.Form.Get("grant_type") != "refresh_token" || r.Form.Get("refresh_token") != "refresh-secret" {
					t.Error("rclone did not reload native refresh state")
				}
				refreshes.Add(1)
				w.Header().Set("Content-Type", "application/json")
				io.WriteString(w, `{"access_token":"rotated-files-access","refresh_token":"rotated-files-refresh","token_type":"Bearer","expires_in":3600}`)
			}))
			defer tokenServer.Close()
			_, cert := syntheticTLS(t, t.TempDir())
			proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != "CONNECT" || r.Host != "graph.microsoft.com:443" {
					t.Error("unexpected network destination")
					w.WriteHeader(502)
					return
				}
				conn, _, err := w.(http.Hijacker).Hijack()
				if err != nil {
					return
				}
				defer conn.Close()
				conn.SetDeadline(time.Now().Add(10 * time.Second))
				fmt.Fprint(conn, "HTTP/1.1 200 Connection established\r\n\r\n")
				secure := tls.Server(conn, &tls.Config{Certificates: []tls.Certificate{cert}})
				reader := bufio.NewReader(secure)
				for {
					req, err := http.ReadRequest(reader)
					if err != nil {
						return
					}
					req.Body.Close()
					if req.Header.Get("Authorization") != "Bearer rotated-files-access" {
						t.Error("rclone did not use refreshed token")
					}
					body := `{"id":"drive","driveType":"business","quota":{"total":10000,"used":100,"remaining":9900}}`
					fmt.Fprintf(secure, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\n\r\n%s", len(body), body)
				}
			}))
			defer proxy.Close()
			fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
			if err != nil {
				t.Fatal(err)
			}
			// Expire only the access token, exactly as time would; keep the original
			// native refresh token and all discovered remote fields.
			var config string
			original, err := os.ReadFile(filepath.Join(env.Home, microsoftDir, address+".conf"))
			if err != nil {
				t.Fatal(err)
			}
			config = string(original)
			var tok map[string]any
			for _, line := range strings.Split(config, "\n") {
				if strings.HasPrefix(line, "token = ") {
					if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "token = ")), &tok); err != nil {
						t.Fatal(err)
					}
					break
				}
			}
			oldToken, _ := json.Marshal(tok)
			tok["expiry"] = "2000-01-01T00:00:00Z"
			expired, _ := json.Marshal(tok)
			config = strings.ReplaceAll(config, string(oldToken), string(expired))
			if err := writeFileAt(fd, address+".conf", []byte(config), 0600); err != nil {
				t.Fatal(err)
			}
			// fd is intentionally closed before native rclone's atomic replacement.
			unix.Close(fd)
			env.Config.Tools["rclone"] = rclone
			cmd, _ = microsoftCommand(env, address, "about", "onedrive:", "--json", "--onedrive-token-url", tokenServer.URL, "--onedrive-root-folder-id", "root", "--no-check-certificate")
			cmd.Env = []string{"HTTPS_PROXY=" + proxy.URL, "HTTP_PROXY=" + proxy.URL, "NO_PROXY=127.0.0.1"}
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			data, err = env.run(ctx, cmd, nil)
			if err != nil || !strings.Contains(string(data), `"total"`) || refreshes.Load() != 1 {
				t.Fatal("native rclone refresh", err, refreshes.Load())
			}
			reloaded, err := os.ReadFile(filepath.Join(env.Home, microsoftDir, address+".conf"))
			if err != nil || !strings.Contains(string(reloaded), "rotated-files-refresh") {
				t.Fatal("rclone did not persist rotated native token", err)
			}
		})
	}
}
