//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// Seed through the pinned SDK, not a hand-written approximation of Pi JSONL.
// The CLI requests 256 KiB even for short text. The browser uses 64 KiB for
// text; the same browser route must also accept the endpoint's full budget.
func TestNativeHistoryBlockClientBudgets(t *testing.T) {
	p, home := piFixture(t)
	script := `const {SessionManager} = await import(process.argv[1]);
const s = SessionManager.create(process.argv[2], process.argv[3]);
const user = s.appendMessage({role:'user', content:[{type:'text',text:'synthetic user'}], timestamp:Date.now()});
s.appendMessage({role:'assistant',api:'openai-responses',provider:'openai',model:'synthetic',content:[{type:'text',text:'synthetic answer'}],stopReason:'stop',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}});
const bash = s.appendMessage({role:'bashExecution',command:'printf synthetic',output:'é'.repeat(600000),exitCode:0,cancelled:false,truncated:false,timestamp:Date.now()});
console.log(JSON.stringify({id:s.getSessionId(),user,bash}));`
	cmd := exec.Command(p.Node, "--input-type=module", "-e", script, p.Entry, home, filepath.Join(home, historyRoot))
	cmd.Env = append(os.Environ(), "PI_OFFLINE=1")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("native seed: %v %s", err, out)
	}
	var seed struct{ ID, User, Bash string }
	if err := json.Unmarshal(out, &seed); err != nil {
		t.Fatal(err, string(out))
	}
	cfg := transport.Config{Home: home, UID: os.Geteuid(), Socket: filepath.Join(home, "daemon.sock")}
	// Real agent listener supplies the kernel peer identity required by the adapter.
	socket := filepath.Join(home, "agent.sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: socket, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- transport.ServeAgent(ctx, ln, cfg, agentHistoryHandler(cfg)) }()
	defer func() {
		cancel()
		if err := <-done; err != nil {
			t.Error(err)
		}
	}()
	tr := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return net.Dial("unix", socket) }}
	defer tr.CloseIdleConnections()
	agent := &http.Client{Transport: tr, Timeout: 5 * time.Second}
	// Browser daemon route; gateway identity mapping itself is unchanged.
	browser := httptest.NewServer(HistoryHandler(cfg, func(*http.Request) bool { return true }))
	defer browser.Close()
	for _, route := range []struct {
		name, base string
		client     *http.Client
		budget     int
	}{
		{"agent", "http://unix" + AgentHistoryPath + "/pi:" + seed.ID, agent, 262144},
		{"browser", browser.URL + "/api/v1/agents/pi:" + seed.ID, browser.Client(), 65536},
		{"browser-large-request", browser.URL + "/api/v1/agents/pi:" + seed.ID, browser.Client(), 1048576},
	} {
		t.Run(route.name, func(t *testing.T) {
			get := func(url string, want int) []byte {
				t.Helper()
				req, err := http.NewRequest("GET", url, nil)
				if err != nil {
					t.Fatal(err)
				}
				req.Host = "unix"
				res, err := route.client.Do(req)
				if err != nil {
					t.Fatal(err)
				}
				defer res.Body.Close()
				b, err := io.ReadAll(res.Body)
				if err != nil {
					t.Fatal(err)
				}
				if res.StatusCode != want {
					t.Fatalf("GET %s: %d %s", url, res.StatusCode, b)
				}
				return b
			}
			history := route.base
			if strings.HasPrefix(route.name, "browser") {
				history += "/history"
			}
			var page struct {
				NativeRevision string         `json:"native_revision"`
				Entries        []historyEntry `json:"entries"`
			}
			if err := json.Unmarshal(get(history, 200), &page); err != nil {
				t.Fatal(err)
			}
			if len(page.Entries) != 3 || page.Entries[0].Key != seed.User || page.Entries[2].Key != seed.Bash {
				t.Fatalf("native entries: %+v", page)
			}
			blockURL := func(key string, index, offset, limit int, revision string) string {
				return fmt.Sprintf("%s/entries/%s/blocks/%d?revision=%s&offset=%d&limit_bytes=%d", route.base, key, index, revision, offset, limit)
			}
			for _, tc := range []struct {
				key   string
				index int
				text  string
			}{{seed.User, 0, "synthetic user"}, {page.Entries[1].Key, 0, "synthetic answer"}, {seed.Bash, 0, "printf synthetic"}, {seed.Bash, 1, strings.Repeat("é", 600000)}} {
				text := ""
				offset := 0
				for {
					var reply struct {
						Chunk struct {
							Text       string
							Complete   bool
							NextOffset int `json:"next_offset"`
						}
					}
					if err := json.Unmarshal(get(blockURL(tc.key, tc.index, offset, route.budget, page.NativeRevision), 200), &reply); err != nil {
						t.Fatal(err)
					}
					if len(reply.Chunk.Text) > min(route.budget, 65536) {
						t.Fatal("chunk exceeded client or text contract budget")
					}
					text += reply.Chunk.Text
					if reply.Chunk.Complete {
						break
					}
					if reply.Chunk.NextOffset <= offset {
						t.Fatal("no progress")
					}
					offset = reply.Chunk.NextOffset
				}
				if text != tc.text {
					t.Fatalf("block %s/%d: content mismatch", tc.key, tc.index)
				}
			}
			get(blockURL(seed.User, 0, 0, route.budget, "stale"), 404)
			get(blockURL(seed.User, 0, 0, historyBlockBudget+1, page.NativeRevision), 400)
		})
	}
}
