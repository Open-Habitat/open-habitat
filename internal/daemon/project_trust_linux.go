//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Pi's project trust guards a folder's own skills, prompts, settings, MCP
// servers and extensions (`.agents/skills`, `.pi/…`). RPC mode cannot show
// Pi's trust prompt, so without a saved decision Pi silently skips them, and
// a browser-only person never gets the skills committed in their own
// repositories. A workspace under the person's ~/src is theirs: their agent
// already runs code there, and Pi's trust does not limit what tools can do.
// So conversations and the composer's list-only Pi in such a directory start
// with Pi's own one-run `--approve` (Jari 11.11.2026). Nothing is written to
// Pi's trust store; elsewhere Pi's default stands.
//
// `--approve` outranks every saved decision, so a person's own explicit
// "do not trust" saved in ~/.pi/agent/trust.json for the directory or the
// nearest ancestor is honoured by leaving the flag out: Pi then applies that
// saved decision itself.

// maxTrustStore bounds the read of Pi's trust store.
const maxTrustStore = 1 << 20

// projectTrustArgs returns Pi's `--approve` for a launch in the held
// directory when it lies below the person's ~/src. The held descriptor's path
// is what Pi's process gets as its working directory; cwd is the directory Pi
// is told about (a continued session's own cwd), so both must be inside.
func projectTrustArgs(home, cwd string, held *os.File) []string {
	if held == nil || !filepath.IsAbs(home) {
		return nil
	}
	src, err := filepath.EvalSymlinks(filepath.Join(home, "src"))
	if err != nil {
		return nil
	}
	dir, err := os.Readlink(fmt.Sprintf("/proc/self/fd/%d", held.Fd()))
	if err != nil || !belowDir(dir, src) {
		return nil
	}
	if cwd != "" {
		resolved, err := filepath.EvalSymlinks(cwd)
		if err != nil || resolved != dir {
			return nil
		}
	}
	if savedDistrust(home, dir) {
		return nil
	}
	return []string{"--approve"}
}

func belowDir(p, root string) bool {
	return filepath.IsAbs(p) && filepath.Clean(p) == p && p != root && insidePath(p, root)
}

// savedDistrust reports whether the nearest decision Pi saved for dir or an
// ancestor is false, read the way Pi reads its store (canonical directory
// keys, closest wins). An unreadable or malformed store is no decision: with
// it, Pi's own read would fail, which `--approve` avoids.
func savedDistrust(home, dir string) bool {
	f, err := os.Open(filepath.Join(home, ".pi", "agent", "trust.json"))
	if err != nil {
		return false
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, maxTrustStore+1))
	if err != nil || len(b) > maxTrustStore {
		return false
	}
	b = trimBOM(b)
	var saved map[string]*bool
	if json.Unmarshal(b, &saved) != nil {
		return false
	}
	for p := dir; ; p = filepath.Dir(p) {
		if v := saved[p]; v != nil {
			return !*v
		}
		if p == filepath.Dir(p) {
			return false
		}
	}
}

func trimBOM(b []byte) []byte {
	if len(b) >= 3 && b[0] == 0xef && b[1] == 0xbb && b[2] == 0xbf {
		return b[3:]
	}
	return b
}
