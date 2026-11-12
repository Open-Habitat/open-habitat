//go:build linux

package integrations

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"unicode/utf8"

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

// googleNative is what an account's rclone config says: the Drive scope it
// signed in with, rclone's own choice of drive or drive.readonly, and the
// grant's refresh token.
type googleNative struct{ scope, refresh string }

func googleReadNative(env Env, address string) (googleNative, error) {
	var n googleNative
	if !ValidAddress(address) {
		return n, ToolFailed
	}
	fd, err := openHomeDir(env.Home, false, splitPath(googleDir)...)
	if err != nil {
		return n, err
	}
	data, err := readFileAt(fd, address+".conf", 64<<10)
	unix.Close(fd)
	if err != nil {
		return n, err
	}
	for _, line := range strings.Split(string(data), "\n") {
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		switch value = strings.TrimSpace(value); strings.TrimSpace(key) {
		case "scope":
			n.scope = value
		case "token":
			var t struct {
				Refresh string `json:"refresh_token"`
			}
			if json.Unmarshal([]byte(value), &t) == nil {
				n.refresh = t.Refresh
			}
		}
	}
	return n, nil
}

// googleDriveMirror reports whether Drive's rclone login reads only, so its
// files are a one-way mirror.
func googleDriveMirror(env Env, address string) bool {
	n, err := googleReadNative(env, address)
	return err == nil && n.scope == "drive.readonly"
}
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

// googleWhole is the choice of the whole drive; Drive's own folder IDs never
// take this form.
const googleWhole = "all"

// googleFolderMax leaves the contract's last folder slot to the whole drive.
const googleFolderMax = 63

// googleTopFolder is a folder at the root of My Drive, as rclone names it.
type googleTopFolder struct{ id, name string }

// googleTop lists My Drive's top-level folders. It reads only the root, never
// recursively, so it is quick whatever the drive holds.
func googleTop(ctx context.Context, env Env, address string) ([]googleTopFolder, error) {
	c, ok := googleCommand(env, address, "lsjson", "google:", "--dirs-only", "--no-modtime", "--no-mimetype")
	if !ok {
		return nil, ToolFailed
	}
	data, err := env.run(ctx, c, nil)
	if err != nil {
		return nil, ToolFailed
	}
	var list []struct {
		Name  string `json:"Name"`
		ID    string `json:"ID"`
		IsDir bool   `json:"IsDir"`
	}
	if json.Unmarshal(data, &list) != nil {
		return nil, ToolFailed
	}
	var out []googleTopFolder
	for _, f := range list {
		if f.IsDir && f.Name != "" {
			out = append(out, googleTopFolder{f.ID, f.Name})
		}
	}
	return out, nil
}

// offered says whether a top-level folder can be chosen on its own: its ID
// fits the contract, and its name is one the page can show.
func (f googleTopFolder) offered() bool {
	if f.id == googleWhole || !folderID.MatchString(f.id) || len(f.name) > 256 || !utf8.ValidString(f.name) {
		return false
	}
	for _, r := range f.name {
		if r < 0x20 || r == 0x7f {
			return false
		}
	}
	return true
}

// googleEstimate is what Google's own storage accounting says My Drive's
// files take, outside the trash. It is quick, and counts the files the
// person owns, so it is an estimate of what syncs, not a count.
func googleEstimate(ctx context.Context, env Env, address string) (uint64, bool) {
	c, ok := googleCommand(env, address, "about", "google:", "--json")
	if !ok {
		return 0, false
	}
	data, err := env.run(ctx, c, nil)
	if err != nil {
		return 0, false
	}
	var about struct {
		Used    *uint64 `json:"used"`
		Trashed uint64  `json:"trashed"`
	}
	if json.Unmarshal(data, &about) != nil || about.Used == nil || *about.Used > maxSyncBytes {
		return 0, false
	}
	return *about.Used - min(about.Trashed, *about.Used), true
}

// Folders offers the whole drive with Google's estimate of its size, and
// each top-level folder on its own, so a drive that does not fit the home
// can still sync the folders that do. Their sizes are counted while the
// person chooses (SizeFolders).
func (d *google) Folders(ctx context.Context, env Env, address string) ([]Folder, error) {
	d.native.RLock()
	defer d.native.RUnlock()
	whole := Folder{ID: googleWhole, Name: "Koko Google Drive", Whole: true, Suggested: true, UnknownSize: true}
	if n, ok := googleEstimate(ctx, env, address); ok {
		whole.Bytes, whole.UnknownSize, whole.Estimated = n, false, true
	}
	out := []Folder{whole}
	// Without the listing the whole drive is still a choice.
	top, _ := googleTop(ctx, env, address)
	seen := map[string]bool{}
	for _, f := range top {
		if len(out) > googleFolderMax {
			break
		}
		if f.offered() && !seen[f.id] {
			seen[f.id] = true
			out = append(out, Folder{ID: f.id, Name: f.name, UnknownSize: true})
		}
	}
	return out, nil
}

// SizeFolders counts each top-level folder, then the whole drive as their
// sum with the files at its root once every count succeeded. Three counts
// run at a time; each is rclone's own recursive size.
func (d *google) SizeFolders(ctx context.Context, env Env, address string, report func(string, uint64)) {
	d.native.RLock()
	defer d.native.RUnlock()
	top, err := googleTop(ctx, env, address)
	if err != nil {
		return
	}
	var mu sync.Mutex
	total, complete := uint64(0), true
	add := func(n uint64, err error) bool {
		mu.Lock()
		defer mu.Unlock()
		if err != nil || n > maxSyncBytes-total {
			complete = false
			return false
		}
		total += n
		return true
	}
	if c, ok := googleCommand(env, address, "size", "google:", "--max-depth", "1", "--json"); ok {
		add(env.measureSize(ctx, c, "drive"))
	} else {
		return
	}
	slots := make(chan struct{}, 3)
	var wg sync.WaitGroup
	for _, f := range top {
		c, ok := googleCommand(env, address, "size", "google:"+f.name, "--fast-list", "--json")
		if !ok {
			add(0, ToolFailed)
			break
		}
		select {
		case slots <- struct{}{}:
		case <-ctx.Done():
		}
		if ctx.Err() != nil {
			break
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer func() { <-slots }()
			n, err := env.measureSize(ctx, c, "drive")
			if add(n, err) && f.offered() {
				report(f.id, n)
			}
		}()
	}
	wg.Wait()
	if complete && ctx.Err() == nil {
		report(googleWhole, total)
	}
}

// MeasureFolders counts the chosen folders now, for a choice made before
// SizeFolders had counted them.
func (d *google) MeasureFolders(ctx context.Context, env Env, address string, ids []string) (uint64, error) {
	d.native.Lock()
	defer d.native.Unlock()
	if len(ids) == 1 && ids[0] == googleWhole {
		c, ok := googleCommand(env, address, "size", "google:", "--json")
		if !ok {
			return 0, ToolFailed
		}
		return env.measureSize(ctx, c, "drive")
	}
	names, err := googleChosen(ctx, env, address, ids)
	if err != nil {
		return 0, err
	}
	var total uint64
	for _, name := range names {
		c, ok := googleCommand(env, address, "size", "google:"+name, "--fast-list", "--json")
		if !ok {
			return 0, ToolFailed
		}
		n, err := env.measureSize(ctx, c, "drive")
		if err != nil || n > maxSyncBytes-total {
			return 0, ToolFailed
		}
		total += n
	}
	return total, nil
}

// googleChosen resolves chosen folder IDs to their current names. A folder
// that is gone or no longer offered fails the choice rather than syncing
// less than was chosen.
func googleChosen(ctx context.Context, env Env, address string, ids []string) ([]string, error) {
	top, err := googleTop(ctx, env, address)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, id := range ids {
		found := ""
		for _, f := range top {
			if f.id == id && f.offered() {
				found = f.name
			}
		}
		if found == "" {
			return nil, ToolFailed
		}
		names = append(names, found)
	}
	return names, nil
}

// googleFilter is rclone's own filter file for an account that syncs only
// some top-level folders. Both bisync and the mirror read it on every pass;
// bisync keeps its checksum beside it and refuses a changed one without
// --resync. Absent, the whole drive syncs.
func googleFilter(address string) string { return address + ".filter" }

// googleFilterRules names each chosen folder by its rclone glob, escaped so
// that a name is matched literally, and excludes everything else.
func googleFilterRules(names []string) []byte {
	var b strings.Builder
	for _, name := range names {
		b.WriteString("+ /")
		for _, r := range name {
			if strings.ContainsRune(`\*?[]{}`, r) {
				b.WriteByte('\\')
			}
			b.WriteRune(r)
		}
		b.WriteString("/**\n")
	}
	b.WriteString("- **\n")
	return []byte(b.String())
}

// googleFilterArgs are the flags that make a pass follow the account's
// filter file, when it has one.
func googleFilterArgs(env Env, address, flag string) ([]string, bool) {
	fd, err := openHomeDir(env.Home, false, splitPath(googleDir)...)
	if err != nil {
		return nil, false
	}
	defer unix.Close(fd)
	switch _, err := readFileAt(fd, googleFilter(address), 64<<10); {
	case err == nil:
		return []string{flag, filepath.Join(env.Home, googleDir, googleFilter(address))}, true
	case errors.Is(err, unix.ENOENT):
		return nil, true
	default:
		return nil, false
	}
}

// googleSetFilter records the person's choice in the filter file, or
// removes it for the whole drive.
func googleSetFilter(env Env, address string, names []string) error {
	fd, err := openHomeDir(env.Home, false, splitPath(googleDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	if names == nil {
		for _, n := range []string{googleFilter(address), googleFilter(address) + ".md5"} {
			if err := unix.Unlinkat(fd, n, 0); err != nil && !errors.Is(err, unix.ENOENT) {
				return err
			}
		}
		return nil
	}
	return writeFileAt(fd, googleFilter(address), googleFilterRules(names), 0o600)
}

func googleBisync(env Env, address string) (Command, bool) {
	filter, ok := googleFilterArgs(env, address, "--filters-file")
	if !ok {
		return Command{}, false
	}
	// googleCommand puts Drive's own flags after the arguments.
	pass := bisyncCommand(Command{}, env, "cloud/google-drive/"+address, "google:", googleWork(address))
	return googleCommand(env, address, append(pass.Args, filter...)...)
}

// googleMirror is one pass of the read-only mirror (mirrorCommand).
func googleMirror(env Env, address string) (Command, bool) {
	filter, ok := googleFilterArgs(env, address, "--filter-from")
	if !ok {
		return Command{}, false
	}
	return googleCommand(env, address, append([]string{"sync", "google:", filepath.Join(env.Home, "cloud/google-drive", address), "--create-empty-src-dirs"}, filter...)...)
}

// googleNotChosen reports an account whose files have never had a first
// pass: its work directory holds nothing, so nothing was copied.
func googleNotChosen(env Env, address string) bool {
	names, fd, err := listHomeDir(env.Home, googleWork(address))
	if err != nil {
		return false
	}
	if fd >= 0 {
		unix.Close(fd)
	}
	return len(names) == 0
}

func (d *google) ChooseFolders(ctx context.Context, env Env, address string, ids []string) error {
	var names []string
	if len(ids) != 1 || ids[0] != googleWhole {
		var err error
		if names, err = googleChosen(ctx, env, address, ids); err != nil {
			return err
		}
	}
	if err := googleSetFilter(env, address, names); err != nil {
		return err
	}
	return d.initialPass(ctx, env, address)
}

// initialPass is the first pass of the account's chosen files, the one a
// daemon stop interrupted included (resumeInitial).
func (d *google) initialPass(ctx context.Context, env Env, address string) error {
	n, err := googleReadNative(env, address)
	if err != nil {
		return err
	}
	switch n.scope {
	case "drive.readonly":
		fd, err := openHomeDir(env.Home, true, splitPath("cloud/google-drive/"+address)...)
		if err != nil {
			return err
		}
		unix.Close(fd)
		cmd, ok := googleMirror(env, address)
		if !ok {
			return ToolFailed
		}
		return initialMirror(ctx, env, cmd, googleWork(address), ".local/share/rclone/google-backups/"+address, "drive")
	case "drive":
	default:
		return ToolFailed
	}
	for _, rel := range []string{"cloud/google-drive/" + address, googleWork(address), ".local/share/rclone/google-backups/" + address} {
		fd, err := openHomeDir(env.Home, true, splitPath(rel)...)
		if err != nil {
			return err
		}
		unix.Close(fd)
	}
	if err := unmarkMirrored(env, googleWork(address)); err != nil {
		return err
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
	return env.runInitialSync(ctx, cmd, "drive")
}

// interruptedPasses names the work directory of a chosen first pass that a
// stop interrupted; resumeInitial runs that same choice again.
func (*google) interruptedPasses(env Env, address string) []string {
	if work := googleWork(address); interruptedResync(env, work) {
		return []string{work}
	}
	return nil
}
func (d *google) resumeInitial(ctx context.Context, env Env, address string, _ []string) error {
	if !interruptedResync(env, googleWork(address)) {
		return nil
	}
	return d.initialPass(ctx, env, address)
}
func (*google) passService(string) string { return "drive" }
func (d *google) SyncCommand(env Env, address string) (Command, bool) {
	n, err := googleReadNative(env, address)
	if err != nil {
		return Command{}, false
	}
	switch n.scope {
	case "drive.readonly":
		cmd, ok := googleMirror(env, address)
		if !ok || !mirrorReady(env.Home, googleWork(address)) {
			return Command{}, false
		}
		return syncLoop([]syncPass{{Work: googleWork(address), Cmd: cmd, Done: filepath.Join(env.Home, googleWork(address), mirrorDone)}}), true
	case "drive":
	default:
		return Command{}, false
	}
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
	return syncLoop([]syncPass{{Work: googleWork(address), Cmd: cmd}}), true
}
