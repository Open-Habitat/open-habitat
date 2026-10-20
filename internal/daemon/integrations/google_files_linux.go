//go:build linux

package integrations

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/sys/unix"
)

const googleDir = ".config/rclone/open-habitat-google"

// Accounts derives the union of the two native stores. An interrupted commit
// or a manually removed native config remains visible for repair/removal.
func (*google) Accounts(env Env) ([]string, error) {
	accounts := map[string]bool{}
	for _, store := range []string{googleDir, googleGogHome + "/data/keyring"} {
		names, fd, err := listHomeDir(env.Home, store)
		if err != nil {
			return nil, err
		}
		if fd < 0 {
			continue
		}
		for _, name := range names {
			var address string
			if store == googleDir {
				var ok bool
				address, ok = strings.CutSuffix(name, ".conf")
				if !ok {
					continue
				}
			} else {
				raw, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(name, "_gogcli_key_v1_"))
				if err == nil {
					address, _ = strings.CutPrefix(string(raw), "token:default:")
				}
			}
			if !ValidAddress(address) {
				continue
			}
			if _, err := readFileAt(fd, name, 64<<10); err != nil {
				unix.Close(fd)
				return nil, err
			}
			accounts[address] = true
		}
		unix.Close(fd)
	}
	var out []string
	for address := range accounts {
		out = append(out, address)
	}
	sort.Strings(out)
	return out, nil
}
func googleWork(address string) string { return googleDir + "/bisync/" + address }
func googleCommand(env Env, address string, args ...string) (Command, bool) {
	tool, ok := env.Tool("rclone")
	if !ok || !ValidAddress(address) {
		return Command{}, false
	}
	fd, err := openHomeDir(env.Home, false, splitPath(googleDir)...)
	if err != nil {
		return Command{}, false
	}
	_, err = readFileAt(fd, address+".conf", 64<<10)
	unix.Close(fd)
	if err != nil {
		return Command{}, false
	}
	return Command{Path: tool, Args: append([]string{"--config", filepath.Join(env.Home, googleDir, address+".conf")}, append(args, "--drive-skip-gdocs", "--drive-skip-shortcuts")...)}, true
}

func (d *google) Folders(ctx context.Context, env Env, address string) ([]Folder, error) {
	d.native.Lock()
	defer d.native.Unlock()
	cmd, ok := googleCommand(env, address, "size", "google:", "--json")
	if !ok {
		return nil, ToolFailed
	}
	data, err := env.run(ctx, cmd, nil)
	var size struct {
		Bytes uint64 `json:"bytes"`
	}
	if err != nil || json.Unmarshal(data, &size) != nil {
		return nil, ToolFailed
	}
	return []Folder{{ID: "all", Name: "Google Drive", Bytes: size.Bytes, Suggested: true}}, nil
}
func googleBisync(env Env, address string) (Command, bool) {
	return googleCommand(env, address, "bisync", filepath.Join(env.Home, "cloud/google-drive", address), "google:", "--workdir", filepath.Join(env.Home, googleWork(address)), "--resilient", "--recover", "--max-lock", "2m", "--max-delete", "50", "--conflict-resolve", "none", "--conflict-loser", "num", "--create-empty-src-dirs", "--refresh-times", "--compare", "size,modtime")
}
func (d *google) ChooseFolders(ctx context.Context, env Env, address string, ids []string) error {
	if len(ids) != 1 || ids[0] != "all" {
		return ToolFailed
	}
	for _, rel := range []string{"cloud/google-drive/" + address, googleWork(address), ".local/share/rclone/google-backups/" + address} {
		fd, err := openHomeDir(env.Home, true, splitPath(rel)...)
		if err != nil {
			return err
		}
		unix.Close(fd)
	}
	cmd, ok := googleBisync(env, address)
	if !ok {
		return ToolFailed
	}
	// Only an explicit first choice resyncs. Prefer cloud versions on the
	// initial union. Differing local files go to the local backup directory.
	// Ordinary restarts NEVER resync after a corrupt/missing listing.
	// Initial copies can have equal size/time but different contents. Compare
	// their hashes once; steady passes use native size/time change detection
	// with rclone's default transfer verification, not a full local rehash each minute.
	cmd.Args = append(cmd.Args, "--resync", "--resync-mode", "path2", "--compare", "size,modtime,checksum", "--backup-dir1", filepath.Join(env.Home, ".local/share/rclone/google-backups", address))
	_, err := env.run(ctx, cmd, nil)
	return err
}
func (d *google) SyncCommand(env Env, address string) (Command, bool) {
	names, fd, err := listHomeDir(env.Home, googleWork(address))
	if err != nil || fd < 0 {
		return Command{}, false
	}
	unix.Close(fd)
	one, two := false, false
	for _, n := range names {
		one = one || strings.HasSuffix(n, ".path1.lst")
		two = two || strings.HasSuffix(n, ".path2.lst")
	}
	if !one || !two {
		return Command{}, false
	}
	cmd, ok := googleBisync(env, address)
	if !ok {
		return Command{}, false
	}
	// rclone bisync is one pass. The supervised child repeats successful passes
	// every minute and exits on failure, leaving backoff to the catalog.
	return Command{Path: "/bin/sh", Args: append([]string{"-c", `while "$@"; do sleep 60; done; exit 1`, "google-sync", cmd.Path}, cmd.Args...)}, true
}
