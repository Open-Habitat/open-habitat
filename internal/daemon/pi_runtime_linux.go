//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// validateRuntime trusts only a root-owned, non-writable release tree. In
// particular, no mapped user may redirect module resolution through a symlink.
func (p *PiDevice) validateRuntime() error {
	const pkg = "node_modules/@earendil-works/pi-coding-agent"
	root := filepath.Dir(filepath.Dir(p.Node))
	if !filepath.IsAbs(root) || root == "/" || filepath.Clean(root) != root ||
		p.Node != filepath.Join(root, "bin/node") ||
		p.Manifest != filepath.Join(root, pkg, "package.json") ||
		p.Entry != filepath.Join(root, pkg, "dist/index.js") {
		return errors.New("invalid runtime layout")
	}
	for _, path := range []string{p.Node, p.Entry, p.Manifest} {
		for current := path; ; current = filepath.Dir(current) {
			info, err := os.Lstat(current)
			if err != nil {
				return errors.New("runtime path missing")
			}
			owner, ok := info.Sys().(*syscall.Stat_t)
			if !ok || owner.Uid != 0 || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0022 != 0 {
				return errors.New("unsafe runtime path")
			}
			if current == path {
				if !info.Mode().IsRegular() || (path == p.Node && info.Mode().Perm()&0111 == 0) {
					return errors.New("invalid runtime file")
				}
			} else if !info.IsDir() {
				return errors.New("invalid runtime directory")
			}
			if current == "/" {
				break
			}
		}
	}
	data, err := os.ReadFile(p.Manifest)
	if err != nil || len(data) > 1024*1024 {
		return errors.New("invalid runtime manifest")
	}
	var manifest struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Exports map[string]struct {
			Import string `json:"import"`
		} `json:"exports"`
	}
	if json.Unmarshal(data, &manifest) != nil || manifest.Name != "@earendil-works/pi-coding-agent" || manifest.Version != "0.85.1" || manifest.Exports["."].Import != "./dist/index.js" {
		return errors.New("unsupported Pi SDK")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, p.Node, "--version")
	cmd.Env = []string{"HOME=" + p.Home, "PATH=/usr/bin:/bin"}
	output, err := cmd.Output()
	if err != nil || strings.TrimSpace(string(output)) != "v22.21.1" {
		return errors.New("unsupported Node runtime")
	}
	return nil
}
