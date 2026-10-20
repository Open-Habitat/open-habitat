//go:build linux

package integrations

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

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
func (l *microsoftLogin) discover(ctx context.Context, bearer string, sitesGranted bool) error {
	type drive struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Type string `json:"driveType"`
	}
	var personal drive
	if err := l.entry.request(ctx, "https://graph.microsoft.com/v1.0/me/drive?$select=id,name,driveType", nil, bearer, &personal); err != nil {
		return err
	}
	if personal.Type == "personal" {
		// Personal accounts refresh through consumers, not common. Keep the
		// initial multi-audience discovery while pinning native refreshes.
		l.app.TenantID = "consumers"
	}
	remotes := []microsoftRemote{{Name: "onedrive", Directory: "cloud/onedrive/" + l.address, DriveID: personal.ID, DriveType: personal.Type}}
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
		if !sitesGranted {
			return ToolFailed
		}
		if err := l.entry.request(ctx, "https://graph.microsoft.com/v1.0/me/followedSites?$select=id,displayName,webUrl&$top=100", nil, bearer, &sites); err != nil {
			return err
		}
		if sites.Next != "" || len(sites.Value) > 32 {
			return ToolFailed
		}
	}
	for _, s := range sites.Value {
		var libraries struct {
			Value []drive `json:"value"`
			Next  string  `json:"@odata.nextLink"`
		}
		if err := l.entry.request(ctx, "https://graph.microsoft.com/v1.0/sites/"+url.PathEscape(s.ID)+"/drives?$select=id,name,driveType&$top=100", nil, bearer, &libraries); err != nil {
			return err
		}
		if libraries.Next != "" {
			return ToolFailed
		}
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
	if len(remotes) > 64 {
		return ToolFailed
	}
	var config strings.Builder
	for _, r := range remotes {
		if !microsoftDriveID.MatchString(r.DriveID) || (r.DriveType != "personal" && r.DriveType != "business" && r.DriveType != "documentLibrary") {
			return ToolFailed
		}
		fmt.Fprintf(&config, "[%s]\ntype = onedrive\nclient_id = %s\nregion = global\ntenant = %s\ndrive_id = %s\ndrive_type = %s\ndescription = %s\ntoken = %s\n\n", r.Name, l.app.ClientID, l.app.TenantID, r.DriveID, r.DriveType, r.Directory, l.token)
	}
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
	for _, r := range remotes {
		cmd, ok := microsoftCommand(env, address, "size", r.Name+":", "--json")
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
		label := "OneDrive"
		if r.Name != "onedrive" {
			label = "SharePoint · " + strings.TrimPrefix(r.Directory, "cloud/sharepoint/")
		}
		out = append(out, Folder{ID: r.Name, Name: label, Bytes: size.Bytes, Suggested: r.Name == "onedrive"})
	}
	return out, nil
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
		if !selected[r.Name] {
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
		if _, err := env.run(ctx, c, nil); err != nil {
			return err
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
	script.WriteString("while true; do ")
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
		script.WriteString(" || exit 1; ")
		count++
	}
	if count == 0 {
		return Command{}, false
	}
	script.WriteString("sleep 60; done")
	return Command{Path: "/bin/sh", Args: []string{"-c", script.String()}}, true
}
