//go:build linux

package integrations

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/sys/unix"
)

type microsoftRemote struct{ Name, Directory, DriveID, DriveType string }

var microsoftDriveID = regexp.MustCompile(`^[A-Za-z0-9!_-]{1,256}$`)
var microsoftRemoteName = regexp.MustCompile(`^(onedrive|sp-[a-f0-9]{24})$`)

func microsoftWork(address, remote string) string {
	return microsoftDir + "/bisync/" + address + "/" + remote
}
func microsoftSegment(s string) string {
	// Include an identity hash: different provider names that slug to the same
	// path must never combine two live bidirectional sync roots.
	h := sha256.Sum256([]byte(s))
	var b strings.Builder
	for _, c := range strings.ToLower(s) {
		if c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-' {
			b.WriteRune(c)
		} else {
			b.WriteByte('-')
		}
		if b.Len() >= 40 {
			break
		}
	}
	return strings.Trim(b.String(), "-") + "-" + hex.EncodeToString(h[:6])
}
func (l *microsoftLogin) discover(ctx context.Context, bearer string, sitesGranted bool) (result error) {
	step, tenantKind := "onedrive", "unknown"
	defer func() {
		if result != nil {
			result = microsoftDiscoveryError{step: step, tenantKind: tenantKind, err: result}
		}
	}()
	type drive struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Type string `json:"driveType"`
	}
	var personal drive
	if err := l.entry.request(ctx, "https://graph.microsoft.com/v1.0/me/drive?$select=id,name,driveType", nil, bearer, &personal); err != nil {
		// Delegated GET auto-provisions licensed drives. A genuine 404 still
		// occurs for mail-only licences; do not make Outlook depend on files.
		var status microsoftHTTPStatus
		if !errors.As(err, &status) || status != 404 {
			return err
		}
	}
	if personal.Type == "personal" || personal.Type == "business" {
		tenantKind = personal.Type
	}
	if personal.Type == "personal" {
		// Personal accounts refresh through consumers, not common. Keep the
		// initial multi-audience discovery while pinning native refreshes.
		l.app.TenantID = "consumers"
	}
	var remotes []microsoftRemote
	if personal.ID != "" {
		remotes = append(remotes, microsoftRemote{Name: "onedrive", Directory: "cloud/onedrive/" + l.address, DriveID: personal.ID, DriveType: personal.Type})
	}
	// Followed sites are the person's native SharePoint selection, not a
	// tenant-wide crawl. Fail on truncated discovery rather than pretend empty.
	var sites struct {
		Value []struct {
			ID     string `json:"id"`
			Name   string `json:"displayName"`
			WebURL string `json:"webUrl"`
		} `json:"value"`
		Next string `json:"@odata.nextLink"`
	}
	if personal.Type != "personal" {
		step = "sharepoint_scope"
		if !sitesGranted {
			return ToolFailed
		}
		step = "followed_sites"
		if err := l.entry.request(ctx, "https://graph.microsoft.com/v1.0/me/followedSites?$select=id,displayName,webUrl&$top=100", nil, bearer, &sites); err != nil {
			return err
		}
		step = "followed_sites_limit"
		if sites.Next != "" || len(sites.Value) > 32 {
			return ToolFailed
		}
	}
	for _, s := range sites.Value {
		var libraries struct {
			Value []drive `json:"value"`
			Next  string  `json:"@odata.nextLink"`
		}
		step = "site_drives"
		if err := l.entry.request(ctx, "https://graph.microsoft.com/v1.0/sites/"+url.PathEscape(s.ID)+"/drives?$select=id,name,driveType&$top=100", nil, bearer, &libraries); err != nil {
			var status microsoftHTTPStatus
			if ctx.Err() == nil && errors.As(err, &status) && (status == 403 || status == 404) {
				l.skippedSites = append(l.skippedSites, microsoftDiscoveryError{step: step, tenantKind: tenantKind, err: err})
				name := s.Name
				if name == "" || len(name) > 256 || !utf8.ValidString(name) || strings.IndexFunc(name, unicode.IsControl) >= 0 {
					name = "SharePoint"
				}
				l.unavailableSites = append(l.unavailableSites, name)
				continue
			}
			return err
		}
		step = "site_drives_limit"
		if libraries.Next != "" {
			return ToolFailed
		}
		step = "site_url"
		u, err := url.Parse(s.WebURL)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" {
			return ToolFailed
		}
		for _, d := range libraries.Value {
			h := sha256.Sum256([]byte(d.ID))
			name := "sp-" + hex.EncodeToString(h[:12])
			// Include the account in the organisation component so two grants to the
			// same library never run competing sync clients against one local root.
			dir := "cloud/sharepoint/" + microsoftSegment(u.Hostname()) + "--" + l.address + "/" + microsoftSegment(s.ID+"-"+s.Name) + "/" + microsoftSegment(d.ID+"-"+d.Name)
			remotes = append(remotes, microsoftRemote{Name: name, Directory: dir, DriveID: d.ID, DriveType: d.Type})
		}
	}
	step = "remote_limit"
	if len(remotes) > 64 {
		return ToolFailed
	}
	var config strings.Builder
	config.WriteString("# Microsoft cloud roots discovered for this native account.\n")
	for _, r := range remotes {
		step = "onedrive_metadata"
		if r.Name != "onedrive" {
			step = "site_drive_metadata"
		}
		if !microsoftDriveID.MatchString(r.DriveID) || (r.DriveType != "personal" && r.DriveType != "business" && r.DriveType != "documentLibrary") {
			return ToolFailed
		}
		fmt.Fprintf(&config, "[%s]\ntype = onedrive\nclient_id = %s\nregion = global\ntenant = %s\ndrive_id = %s\ndrive_type = %s\ndescription = %s\ntoken = %s\n\n", r.Name, l.app.ClientID, l.app.TenantID, r.DriveID, r.DriveType, r.Directory, l.token)
	}
	step = "config_limit"
	if config.Len() > 64<<10 {
		return ToolFailed
	}
	l.config = []byte(config.String())
	return nil
}
func microsoftRemotes(env Env, address string) ([]microsoftRemote, error) {
	if !ValidAddress(address) {
		return nil, ToolFailed
	}
	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, address+".conf", 64<<10)
	if errors.Is(err, unix.ENOENT) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var out []microsoftRemote
	seen := map[string]bool{}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			name := strings.TrimSuffix(strings.TrimPrefix(line, "["), "]")
			if !microsoftRemoteName.MatchString(name) || seen[name] {
				return nil, ToolFailed
			}
			seen[name] = true
			out = append(out, microsoftRemote{Name: name})
		} else if key, value, ok := strings.Cut(line, "="); ok {
			if len(out) == 0 {
				return nil, ToolFailed
			}
			switch strings.TrimSpace(key) {
			case "description":
				out[len(out)-1].Directory = strings.TrimSpace(value)
			case "drive_type":
				out[len(out)-1].DriveType = strings.TrimSpace(value)
			}
		}
	}
	dirs := map[string]bool{}
	for _, r := range out {
		dir := r.Directory
		valid := dir == "cloud/onedrive/"+address
		if r.Name != "onedrive" {
			parts := strings.Split(dir, "/")
			valid = len(parts) == 5 && parts[0] == "cloud" && parts[1] == "sharepoint" && strings.HasSuffix(parts[2], "--"+address)
		}
		if !valid || filepath.Clean(dir) != dir || strings.ContainsAny(dir, "\r\n\\") || dirs[dir] {
			return nil, ToolFailed
		}
		for _, p := range strings.Split(dir, "/") {
			if p == "" || p == "." || p == ".." {
				return nil, ToolFailed
			}
		}
		dirs[dir] = true
	}
	return out, nil
}
func microsoftCommand(env Env, address string, args ...string) (Command, bool) {
	tool, ok := env.Tool("rclone")
	if !ok || !ValidAddress(address) {
		return Command{}, false
	}
	remotes, err := microsoftRemotes(env, address)
	if err != nil || len(remotes) == 0 {
		return Command{}, false
	}
	return Command{Path: tool, Args: append([]string{"--config", filepath.Join(env.Home, microsoftDir, address+".conf")}, args...)}, true
}
func microsoftReady(env Env, address, remote string) bool {
	names, fd, err := listHomeDir(env.Home, microsoftWork(address, remote))
	if err != nil || fd < 0 {
		return false
	}
	unix.Close(fd)
	one, two := false, false
	for _, n := range names {
		one = one || strings.HasSuffix(n, ".path1.lst")
		two = two || strings.HasSuffix(n, ".path2.lst")
	}
	return one && two
}
func (*microsoft) Directories(env Env, address string) []SyncDirectory {
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return nil
	}
	var out, pending []SyncDirectory
	for _, r := range remotes {
		service := "onedrive"
		if r.Name != "onedrive" {
			service = "sharepoint"
		}
		d := SyncDirectory{Service: service, Path: r.Directory}
		pending = append(pending, d)
		if microsoftReady(env, address, r.Name) {
			out = append(out, d)
		}
	}
	// The first-choice view needs a destination before native listings exist.
	// Once selected, advertise only directories actually being synced.
	if len(out) == 0 {
		return pending
	}
	return out
}

func (m *microsoft) Folders(ctx context.Context, env Env, address string) ([]Folder, error) {
	m.native.Lock()
	defer m.native.Unlock()
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return nil, err
	}
	var out []Folder
	anyReady := false
	for _, r := range remotes {
		anyReady = anyReady || microsoftReady(env, address, r.Name)
	}
	for _, r := range remotes {

		label := "OneDrive"
		if r.Name != "onedrive" {
			label = "SharePoint · " + strings.TrimPrefix(r.Directory, "cloud/sharepoint/")
		}
		out = append(out, Folder{ID: r.Name, Name: label, UnknownSize: true, Suggested: microsoftReady(env, address, r.Name) || (!anyReady && r.Name == "onedrive")})
	}
	return out, nil
}
func (m *microsoft) MeasureFolders(ctx context.Context, env Env, address string, ids []string) (uint64, error) {
	m.native.Lock()
	defer m.native.Unlock()
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return 0, err
	}
	var total uint64
	for _, id := range ids {
		found := false
		for _, r := range remotes {
			if r.Name != id {
				continue
			}
			found = true
			cmd, ok := microsoftCommand(env, address, "size", r.Name+":", "--json")
			if !ok {
				return 0, ToolFailed
			}
			service := "sharepoint"
			if id == "onedrive" {
				service = "onedrive"
			}
			n, err := env.measureSize(ctx, cmd, service)
			if err != nil {
				return 0, err
			}
			if n > maxSyncBytes-total {
				return 0, ToolFailed
			}
			total += n
		}
		if !found {
			return 0, ToolFailed
		}
	}
	return total, nil
}

func microsoftBisync(env Env, address string, r microsoftRemote) (Command, bool) {
	return microsoftCommand(env, address, "bisync", filepath.Join(env.Home, r.Directory), r.Name+":", "--workdir", filepath.Join(env.Home, microsoftWork(address, r.Name)), "--resilient", "--recover", "--max-lock", "2m", "--max-delete", "50", "--conflict-resolve", "none", "--conflict-loser", "num", "--create-empty-src-dirs", "--refresh-times", "--compare", "size,modtime")
}
func (m *microsoft) ChooseFolders(ctx context.Context, env Env, address string, ids []string) error {
	m.native.Lock()
	defer m.native.Unlock()
	if len(ids) == 0 {
		return ToolFailed
	}
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return err
	}
	selected := map[string]bool{}
	for _, id := range ids {
		if selected[id] {
			return ToolFailed
		}
		found := false
		for _, r := range remotes {
			found = found || id == r.Name
		}
		if !found {
			return ToolFailed
		}
		selected[id] = true
	}
	for _, r := range remotes {
		if !selected[r.Name] || microsoftReady(env, address, r.Name) {
			// Choosing more libraries never resyncs a healthy existing pair.
			continue
		}
		backup := ".local/share/rclone/microsoft-backups/" + address + "/" + r.Name
		for _, rel := range []string{r.Directory, microsoftWork(address, r.Name), backup} {
			fd, err := openHomeDir(env.Home, true, splitPath(rel)...)
			if err != nil {
				return err
			}
			unix.Close(fd)
		}
		c, ok := microsoftBisync(env, address, r)
		if !ok {
			return ToolFailed
		}
		c.Args = append(c.Args, "--resync", "--resync-mode", "path2", "--compare", "size,modtime,checksum", "--backup-dir1", filepath.Join(env.Home, backup))
		service := "sharepoint"
		if r.Name == "onedrive" {
			service = "onedrive"
		}
		if err := env.runInitialSync(ctx, c, service); err != nil {
			return err
		}
	}
	// Native listings are the selection. Stop deselected pairs without
	// deleting local files or approving any cloud-side deletion.
	for _, r := range remotes {
		if !selected[r.Name] {
			if err := microsoftRemoveFiles(env, microsoftWork(address, r.Name)); err != nil {
				return err
			}
		}
	}
	return nil
}
func (m *microsoft) SyncCommand(env Env, address string) (Command, bool) {
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return Command{}, false
	}
	// Serial passes share a native config (rclone may refresh its token). Never
	// let concurrent native writers lose one another's token/config changes.
	quote := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'" }
	var script strings.Builder
	script.WriteString("while true; do failed=0; ")
	count := 0
	for _, r := range remotes {
		if !microsoftReady(env, address, r.Name) {
			continue
		}
		c, ok := microsoftBisync(env, address, r)
		if !ok {
			return Command{}, false
		}
		script.WriteString(quote(c.Path))
		for _, a := range c.Args {
			script.WriteString(" " + quote(a))
		}
		script.WriteString(" || failed=1; ")
		count++
	}
	if count == 0 {
		return Command{}, false
	}
	script.WriteString(`[ "$failed" -eq 0 ] || exit 1; sleep 60; done`)
	return Command{Path: "/bin/sh", Args: []string{"-c", script.String()}}, true
}

// Every Microsoft sign-in offers the current libraries again. An empty file
// inventory (for example an Exchange-only licence) needs no folder step.
func (*microsoft) FolderChoiceAfterLogin(env Env, address string) (bool, error) {
	remotes, err := microsoftRemotes(env, address)
	return len(remotes) > 0, err
}

// Keep the local root stable across cloud display-name changes. The remote
// name is keyed by immutable drive ID, as are its native bisync listings.
func microsoftPreserveDirectories(config []byte, previous []microsoftRemote) []byte {
	paths := map[string]string{}
	for _, r := range previous {
		paths[r.Name] = r.Directory
	}
	lines := strings.Split(string(config), "\n")
	remote := ""
	for i, line := range lines {
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			remote = strings.Trim(line, "[]")
		}
		if key, _, ok := strings.Cut(line, "="); ok && strings.TrimSpace(key) == "description" && paths[remote] != "" {
			lines[i] = "description = " + paths[remote]
		}
	}
	return []byte(strings.Join(lines, "\n"))
}
