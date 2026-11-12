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
	// The public entry imports many other SDK and dependency files. Checking
	// only the entry leaves a writable transitive module executable as every UID.
	// The entire release must be safe, including files not imported today.
	if err := filepath.WalkDir(root, func(path string, _ os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return errors.New("runtime tree unavailable")
		}
		info, err := os.Lstat(path)
		if err != nil {
			return errors.New("runtime tree unavailable")
		}
		owner, ok := info.Sys().(*syscall.Stat_t)
		if !ok || owner.Uid != 0 {
			return errors.New("unsafe runtime tree")
		}
		// Symlink permission bits are always 0777 on Linux; only the
		// target's permissions have meaning and it is visited below.
		if info.Mode()&os.ModeSymlink != 0 {
			target, err := os.Readlink(path)
			if err != nil {
				return errors.New("invalid runtime link")
			}
			first := target
			if !filepath.IsAbs(first) {
				first = filepath.Join(filepath.Dir(path), first)
			}
			firstRel, err := filepath.Rel(root, filepath.Clean(first))
			if err != nil || firstRel == ".." || strings.HasPrefix(firstRel, ".."+string(os.PathSeparator)) {
				return errors.New("runtime link escapes release")
			}
			// Check both the first hop and final destination. A link through
			// a writable outside directory could otherwise re-enter the tree
			// during validation and change target before the SDK import.
			resolved, err := filepath.EvalSymlinks(path)
			if err != nil {
				return errors.New("invalid runtime link")
			}
			rel, err := filepath.Rel(root, resolved)
			if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
				return errors.New("runtime link escapes release")
			}
			return nil // target is also visited in this release tree
		}
		if info.Mode().Perm()&0022 != 0 {
			return errors.New("unsafe runtime tree")
		}
		if !info.IsDir() && !info.Mode().IsRegular() {
			return errors.New("invalid runtime file type")
		}
		return nil
	}); err != nil {
		return err
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
		Name    string            `json:"name"`
		Version string            `json:"version"`
		Bin     map[string]string `json:"bin"`
		Exports map[string]struct {
			Import string `json:"import"`
		} `json:"exports"`
	}
	if json.Unmarshal(data, &manifest) != nil || manifest.Name != "@earendil-works/pi-coding-agent" || manifest.Version != "1.5.2" || manifest.Exports["."].Import != "./dist/index.js" || manifest.Bin["pi"] != "dist/bundle/cli.js" {
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
