//go:build linux

package integrations

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/msmcp"
)

// TestMicrosoftFootprintLab measures the whole MCP-side memory of one person
// with four open conversations (ADR 0039): the one native Microsoft
// process, the production endpoint (msmcp.Server, hosted here by the test
// binary exactly as the daemon hosts it) and the twenty relays, reported
// apart from the four Pi processes. It is a lab, not a check: it runs only
// with
//
//	OH_LAB_EVIDENCE  a directory for the JSON result
//	OH_LAB_RELAY     a built open-habitat binary (with its sibling relay)
//	OH_LAB_MICROSOFT the pinned integrations runtime (bin/ms-365-mcp-server)
//	OH_LAB_PI_NODE, OH_LAB_PI_CLI  the core runtime's node and Pi cli.js
//
// The account is synthetic and signed in nowhere; no tool is called, so the
// native server makes no Graph request.
func TestMicrosoftFootprintLab(t *testing.T) {
	evidence, relay, runtime := os.Getenv("OH_LAB_EVIDENCE"), os.Getenv("OH_LAB_RELAY"), os.Getenv("OH_LAB_MICROSOFT")
	node, cli := os.Getenv("OH_LAB_PI_NODE"), os.Getenv("OH_LAB_PI_CLI")
	if evidence == "" || relay == "" || runtime == "" || node == "" || cli == "" {
		t.Skip("footprint lab not configured")
	}
	home := t.TempDir()
	address := "aino.virtanen@contoso.test"
	env := Env{Home: home, Relay: relay, FixtureTools: true, Config: Config{Tools: map[string]string{"ms-365-mcp-server": filepath.Join(runtime, "bin/ms-365-mcp-server")}}}
	app := MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000001", TenantID: "00000000-0000-4000-8000-0000000000aa"}
	allowed := microsoftAllowed(microsoftGranted(strings.Fields(microsoftLevelScopes[LevelFull])))
	if err := os.MkdirAll(filepath.Join(home, microsoftMCPDir, address), 0700); err != nil {
		t.Fatal(err)
	}
	if err := microsoftRegister(context.Background(), env, app, address, allowed); err != nil {
		t.Fatal(err)
	}
	selfBefore := memory(os.Getpid())
	// The native identity pin makes the server exit at start for an account
	// not in its cache; the synthetic account cannot sign in, so the lab
	// alone drops the pin. Everything else is the production binding.
	srv := msmcp.NewServer(func(a string) (msmcp.Binding, error) {
		b, err := microsoftBinding(env, a)
		b.Env = slices.DeleteFunc(b.Env, func(e string) bool { return strings.HasPrefix(e, "MS365_MCP_EXPECTED_USERNAME=") })
		return b, err
	}, msmcp.Options{})
	ctx, cancel := context.WithCancel(context.Background())
	served := make(chan struct{})
	go func() { defer close(served); _ = srv.Serve(ctx, home) }()
	defer func() { cancel(); <-served }()

	type row struct {
		Conversations    int     `json:"conversations"`
		NativeRSS        float64 `json:"native_rss_mib"`
		NativePSS        float64 `json:"native_pss_mib"`
		NativeProcesses  int     `json:"native_processes"`
		RelaysRSS        float64 `json:"relays_rss_mib"`
		RelaysPSS        float64 `json:"relays_pss_mib"`
		Relays           int     `json:"relays"`
		EndpointRSSDelta float64 `json:"endpoint_host_rss_delta_mib"`
		MCPTotalRSS      float64 `json:"mcp_side_total_rss_mib"`
		MCPTotalPSS      float64 `json:"mcp_side_total_pss_mib"`
		PiRSS            float64 `json:"pi_rss_mib"`
		PiPSS            float64 `json:"pi_pss_mib"`
	}
	var rows []row
	var pis []*exec.Cmd
	defer func() {
		for _, p := range pis {
			_ = syscall.Kill(-p.Process.Pid, syscall.SIGTERM)
			_ = p.Wait()
		}
	}()
	for n := 1; n <= 4; n++ {
		cmd := exec.Command(node, cli, "--mode", "rpc", "--no-session")
		cmd.Dir, cmd.Env = home, []string{"HOME=" + home, "PATH=/usr/bin:/bin", "PI_OFFLINE=1"}
		cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGKILL}
		stdin, _ := cmd.StdinPipe()
		_ = stdin
		logf, _ := os.Create(filepath.Join(evidence, "pi-"+strconv.Itoa(n)+".err"))
		cmd.Stdout, cmd.Stderr = nil, logf
		if err := cmd.Start(); err != nil {
			t.Fatal(err)
		}
		pis = append(pis, cmd)
		// Each Pi connects its five area entries at session start.
		deadline := time.Now().Add(90 * time.Second)
		for len(relaysOf(relay, pis)) < 5*n || srv.Running() == 0 {
			if time.Now().After(deadline) {
				for i, p := range pis {
					t.Logf("pi %d: exited %v", i+1, syscall.Kill(p.Process.Pid, 0))
				}
				t.Fatalf("conversation %d: %d relays, native %d", n, len(relaysOf(relay, pis)), srv.Running())
			}
			time.Sleep(200 * time.Millisecond)
		}
		time.Sleep(3 * time.Second)
		r := row{Conversations: n}
		native := srv.Running()
		for _, pid := range append([]int{native}, descendants(native)...) {
			m := memory(pid)
			r.NativeRSS += m.rss
			r.NativePSS += m.pss
			r.NativeProcesses++
		}
		relays := relaysOf(relay, pis)
		r.Relays = len(relays)
		for _, pid := range relays {
			m := memory(pid)
			r.RelaysRSS += m.rss
			r.RelaysPSS += m.pss
		}
		for _, p := range pis {
			for _, pid := range append([]int{p.Process.Pid}, descendants(p.Process.Pid)...) {
				if !contains(relays, pid) {
					m := memory(pid)
					r.PiRSS += m.rss
					r.PiPSS += m.pss
				}
			}
		}
		r.EndpointRSSDelta = memory(os.Getpid()).rss - selfBefore.rss
		r.MCPTotalRSS = r.NativeRSS + r.RelaysRSS + r.EndpointRSSDelta
		r.MCPTotalPSS = r.NativePSS + r.RelaysPSS + r.EndpointRSSDelta
		if r.NativeProcesses != 1 || r.Relays != 5*n {
			t.Fatalf("conversation %d: native processes %d, relay processes %d; want 1 and %d", n, r.NativeProcesses, r.Relays, 5*n)
		}
		rows = append(rows, r)
	}
	out, _ := json.MarshalIndent(map[string]any{"account": "synthetic, not signed in", "level": "full", "rows": rows,
		"note": "RSS/PSS in MiB from /proc after a 3 s settle. The endpoint row is the RSS growth of the process hosting msmcp.Server (here the test binary, in production the daemon) since before it served."}, "", "  ")
	if err := os.WriteFile(filepath.Join(evidence, "footprint.json"), out, 0600); err != nil {
		t.Fatal(err)
	}
	t.Logf("%s", out)
}

type mem struct{ rss, pss float64 }

// memory is a process's RSS and PSS in MiB, zero when it is gone.
func memory(pid int) mem {
	var m mem
	if f, err := os.Open("/proc/" + strconv.Itoa(pid) + "/smaps_rollup"); err == nil {
		s := bufio.NewScanner(f)
		for s.Scan() {
			fields := strings.Fields(s.Text())
			if len(fields) >= 2 {
				kb, _ := strconv.ParseFloat(fields[1], 64)
				switch fields[0] {
				case "Rss:":
					m.rss = kb / 1024
				case "Pss:":
					m.pss = kb / 1024
				}
			}
		}
		f.Close()
	}
	return m
}

func children() map[int][]int {
	out := map[int][]int{}
	entries, _ := os.ReadDir("/proc")
	for _, e := range entries {
		pid, err := strconv.Atoi(e.Name())
		if err != nil {
			continue
		}
		data, err := os.ReadFile("/proc/" + e.Name() + "/stat")
		if err != nil {
			continue
		}
		s := string(data)
		rest := s[strings.LastIndexByte(s, ')')+2:]
		fields := strings.Fields(rest)
		if len(fields) > 1 {
			ppid, _ := strconv.Atoi(fields[1])
			out[ppid] = append(out[ppid], pid)
		}
	}
	return out
}

func descendants(pid int) []int {
	tree := children()
	var out []int
	queue := []int{pid}
	for len(queue) > 0 {
		p := queue[0]
		queue = queue[1:]
		for _, c := range tree[p] {
			out = append(out, c)
			queue = append(queue, c)
		}
	}
	return out
}

func relaysOf(relay string, pis []*exec.Cmd) []int {
	var out []int
	for _, p := range pis {
		for _, pid := range descendants(p.Process.Pid) {
			cmdline, _ := os.ReadFile("/proc/" + strconv.Itoa(pid) + "/cmdline")
			args := strings.Split(string(cmdline), "\x00")
			// Also recognize the exec-replaced minimal relay. Keeping the old
			// entry lets this same lab measure a pre-change binary for comparison.
			if len(args) > 1 && ((args[0] == relay && args[1] == "mcp-relay") ||
				(args[0] == filepath.Join(filepath.Dir(relay), "open-habitat-mcp-relay") && args[1] == "microsoft")) {
				out = append(out, pid)
			}
		}
	}
	return out
}

func contains(list []int, v int) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}
