//go:build linux

package integrations

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/sys/unix"
)

// microsoftRemote is one cloud root of an account's rclone config. Writable
// is whether the sign-in's grant (grantKey) lets its files sync both ways; a
// root without a recorded grant was written when only that could sync.
type microsoftRemote struct {
	Name, Directory, DriveID, DriveType string
	// Label is the person's name for the root, such as a team and channel.
	Label            string
	Writable         bool
	RecoverySelected bool
}

// service is the account's service the root belongs to.
func (r microsoftRemote) service() string {
	if r.Name == "onedrive" {
		return "onedrive"
	}
	return "sharepoint"
}

// microsoftWritable is whether a grant lets a root of service sync both ways.
func microsoftWritable(service string, granted map[string]bool) bool {
	return microsoftRules.access(service, granted) == AccessFull
}

const microsoftSiteGUID = `[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}`

var microsoftSiteID = regexp.MustCompile(`^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?,` + microsoftSiteGUID + `,` + microsoftSiteGUID + `$`)
var microsoftDriveID = regexp.MustCompile(`^[A-Za-z0-9!_-]{1,256}$`)

func validMicrosoftSiteID(id string) bool {
	// Graph's site ID is hostname,siteCollectionId,webId, not a URL or
	// server-relative site path. Bound the DNS name as well as its labels.
	host, _, _ := strings.Cut(id, ",")
	return len(host) <= 253 && microsoftSiteID.MatchString(id)
}

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

// Teams' own permissions, the least privileged first. Graph also answers
// the team and channel lists to the broader ones a tenant may have granted.
var (
	microsoftTeamScopes    = []string{"Team.ReadBasic.All", "TeamSettings.Read.All", "TeamSettings.ReadWrite.All", "Directory.Read.All", "Directory.ReadWrite.All", "User.Read.All", "User.ReadWrite.All"}
	microsoftChannelScopes = []string{"Channel.ReadBasic.All", "ChannelSettings.Read.All", "ChannelSettings.ReadWrite.All", "Group.Read.All", "Group.ReadWrite.All", "Directory.Read.All", "Directory.ReadWrite.All"}
)

// Why the folder step offers no or only some Teams files; the browser says
// so (contracts/v1/integration-login.schema.json teams_left_out).
const (
	teamsNotGranted         = "not_granted"
	teamsRefused            = "refused"
	teamsChannelsNotGranted = "channels_not_granted"
	teamsTooMany            = "too_many"
)

var microsoftGUID = regexp.MustCompile(`^` + microsoftSiteGUID + `$`)
var microsoftChannelID = regexp.MustCompile(`^19:[A-Za-z0-9_-]{1,128}@thread\.(tacv2|skype)$`)

func microsoftGrantsAny(granted map[string]bool, scopes []string) bool {
	for _, s := range scopes {
		if granted[s] {
			return true
		}
	}
	return false
}

// microsoftDisplayName is a provider name fit to show, or the fallback.
func microsoftDisplayName(name, fallback string) string {
	if name == "" || len(name) > 256 || !utf8.ValidString(name) || strings.IndexFunc(name, unicode.IsControl) >= 0 {
		return fallback
	}
	return name
}

// microsoftLabel joins a root's names the way the person knows it, within
// the folder name's bound.
func microsoftLabel(parts ...string) string {
	label := strings.Join(parts, " · ")
	if len(label) <= 256 {
		return label
	}
	cut := 250
	for !utf8.RuneStart(label[cut]) {
		cut--
	}
	return label[:cut] + "…"
}

const maxMicrosoftRemotes, maxMicrosoftConfig = 64, 64 << 10

type microsoftDrive struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"driveType"`
}
type microsoftSite struct {
	ID     string `json:"id"`
	Name   string `json:"displayName"`
	WebURL string `json:"webUrl"`
}

// microsoftDiscovery is one sign-in's inventory of cloud roots in progress.
type microsoftDiscovery struct {
	*microsoftLogin
	ctx              context.Context
	bearer           string
	step, tenantKind string
	sites, drives    map[string]bool
	sections         []string
	size             int
	// reachable are the hosts of sites whose libraries opened; hostOf maps
	// a skipped site's index in skippedSites to its host.
	reachable map[string]bool
	hostOf    map[int]string
}

func (l *microsoftLogin) discover(ctx context.Context, bearer string, granted map[string]bool) (result error) {
	d := &microsoftDiscovery{microsoftLogin: l, ctx: ctx, bearer: bearer, step: "onedrive", tenantKind: "unknown", sites: map[string]bool{}, drives: map[string]bool{}, reachable: map[string]bool{}, hostOf: map[int]string{}, size: len(microsoftConfigHeader) + len(microsoftDiscoveryFixed)}
	defer func() {
		if result != nil {
			result = microsoftDiscoveryError{step: d.step, tenantKind: d.tenantKind, err: result}
		}
		// Place each skipped site's host relative to the sites that opened.
		for i, host := range d.hostOf {
			switch {
			case len(d.reachable) == 0:
				d.skippedSites[i].siteHost = siteHostUnknown
			case d.reachable[host]:
				d.skippedSites[i].siteHost = siteHostSame
			default:
				d.skippedSites[i].siteHost = siteHostOther
			}
		}
	}()
	var personal microsoftDrive
	if err := l.entry.request(ctx, "https://graph.microsoft.com/v1.0/me/drive?$select=id,name,driveType", nil, bearer, &personal); err != nil {
		// Delegated GET auto-provisions licensed drives. A genuine 404 still
		// occurs for mail-only licences; do not make Outlook depend on files.
		var status microsoftHTTPStatus
		if !errors.As(err, &status) || status != 404 {
			return err
		}
	}
	if personal.Type == "personal" || personal.Type == "business" {
		d.tenantKind = personal.Type
	}
	var remotes []microsoftRemote
	if personal.ID != "" {
		d.drives[personal.ID] = true
		remotes = append(remotes, microsoftRemote{Name: "onedrive", Directory: "cloud/onedrive/" + l.address, DriveID: personal.ID, DriveType: personal.Type, Label: "OneDrive"})
	}
	// Followed sites are the person's native SharePoint selection, not a
	// tenant-wide crawl. Fail on truncated discovery rather than pretend empty.
	var sites struct {
		Value []microsoftSite `json:"value"`
		Next  string          `json:"@odata.nextLink"`
	}
	// Without the sites grant the account syncs OneDrive alone, and the
	// SharePoint row shows the grant left it out.
	sitesGranted := personal.Type != "personal" && (granted["Sites.ReadWrite.All"] || granted["Sites.Read.All"])
	if sitesGranted {
		d.step = "followed_sites"
		if err := l.entry.request(ctx, "https://graph.microsoft.com/v1.0/me/followedSites?$select=id,displayName,webUrl&$top=100", nil, bearer, &sites); err != nil {
			return err
		}
		d.step = "followed_sites_limit"
		if sites.Next != "" || len(sites.Value) > 32 {
			return ToolFailed
		}
	}
	for _, s := range sites.Value {
		found, err := d.libraries(s, "SharePoint", microsoftDisplayName(s.Name, "SharePoint"))
		if err != nil {
			return err
		}
		remotes = append(remotes, found...)
	}
	if fits, err := d.add(remotes); err != nil || !fits {
		if err == nil {
			err = ToolFailed
		}
		return err
	}
	if sitesGranted {
		if err := d.teams(granted); err != nil {
			return err
		}
	}
	l.config = []byte(microsoftConfigHeader + microsoftDiscoveryFixed + strings.Join(d.sections, ""))
	return nil
}

// unavailable records one root Graph answered with one of statuses (403 or
// 404: deleted, or no access) under the name the person knows it by. Any
// other failure fails discovery: the inventory would silently be partial.
func (d *microsoftDiscovery) unavailable(err error, name string, statuses ...microsoftHTTPStatus) bool {
	var status microsoftHTTPStatus
	if d.ctx.Err() != nil || !errors.As(err, &status) || !slices.Contains(statuses, status) {
		return false
	}
	d.skippedSites = append(d.skippedSites, microsoftDiscoveryError{step: d.step, tenantKind: d.tenantKind, err: err})
	// The page's list is bounded; its last entry then says there are more.
	if len(d.unavailableSites) < 32 {
		d.unavailableSites = append(d.unavailableSites, name)
	} else {
		d.unavailableSites[31] = "…"
	}
	return true
}

// libraries lists a site's document libraries not already offered. label
// names the site; a site Graph refuses is reported under its last part.
func (d *microsoftDiscovery) libraries(s microsoftSite, label ...string) ([]microsoftRemote, error) {
	var list struct {
		Value []microsoftDrive `json:"value"`
		Next  string           `json:"@odata.nextLink"`
	}
	d.step = "site_id"
	if !validMicrosoftSiteID(s.ID) {
		return nil, ToolFailed
	}
	d.sites[strings.ToLower(s.ID)] = true
	host, _, _ := strings.Cut(strings.ToLower(s.ID), ",")
	d.step = "site_drives"
	// Preserve Graph's composite-ID delimiters, as in its site-get
	// request examples. Validation above makes this a single safe segment.
	if err := d.entry.request(d.ctx, "https://graph.microsoft.com/v1.0/sites/"+s.ID+"/drives?$select=id,name,driveType&$top=100", nil, d.bearer, &list); err != nil {
		if d.unavailable(err, label[len(label)-1], 403, 404) {
			d.hostOf[len(d.skippedSites)-1] = host
			return nil, nil
		}
		return nil, err
	}
	d.reachable[host] = true
	d.step = "site_drives_limit"
	if list.Next != "" {
		return nil, ToolFailed
	}
	d.step = "site_url"
	u, err := url.Parse(s.WebURL)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" {
		return nil, ToolFailed
	}
	var out []microsoftRemote
	for _, lib := range list.Value {
		if d.drives[lib.ID] {
			continue
		}
		d.drives[lib.ID] = true
		h := sha256.Sum256([]byte(lib.ID))
		// Include the account in the organisation component so two grants to the
		// same library never run competing sync clients against one local root.
		dir := "cloud/sharepoint/" + microsoftSegment(u.Hostname()) + "--" + d.address + "/" + microsoftSegment(s.ID+"-"+s.Name) + "/" + microsoftSegment(lib.ID+"-"+lib.Name)
		out = append(out, microsoftRemote{Name: "sp-" + hex.EncodeToString(h[:12]), Directory: dir, DriveID: lib.ID, DriveType: lib.Type, Label: microsoftLabel(append(label, microsoftDisplayName(lib.Name, "Documents"))...)})
	}
	return out, nil
}

// add writes a group of roots into the config if all of them fit its
// bounds, and reports whether they did.
func (d *microsoftDiscovery) add(group []microsoftRemote) (bool, error) {
	var more []string
	n := 0
	for _, r := range group {
		d.step = "onedrive_metadata"
		if r.Name != "onedrive" {
			d.step = "site_drive_metadata"
		}
		if !microsoftDriveID.MatchString(r.DriveID) || (r.DriveType != "personal" && r.DriveType != "business" && r.DriveType != "documentLibrary") {
			return false, ToolFailed
		}
		// The label is provider text: encoded, it never becomes config syntax.
		s := fmt.Sprintf("[%s]\ntype = onedrive\nclient_id = %s\nregion = global\ntenant = %s\ndrive_id = %s\ndrive_type = %s\ndescription = %s\n%s = %s\ntoken = %s\n%s\n", r.Name, d.app.ClientID, d.app.TenantID, r.DriveID, r.DriveType, r.Directory, microsoftLabelKey, base64.RawURLEncoding.EncodeToString([]byte(r.Label)), d.token, grantLine(d.granted))
		more, n = append(more, s), n+len(s)
	}
	d.step = "remote_limit"
	if len(d.sections)+len(more) > maxMicrosoftRemotes {
		return false, nil
	}
	d.step = "config_limit"
	if d.size+n > maxMicrosoftConfig {
		return false, nil
	}
	d.sections, d.size = append(d.sections, more...), d.size+n
	return true, nil
}

const microsoftLabelKey = "habitat_label"

// teams adds the libraries of the teams the person has joined, and of each
// private or shared channel's own site, one team at a time while the
// config's bounds allow. A standard channel's files are a folder of its
// team's library, already offered. What is left out is said in the folder
// step (teamsLeftOut, unavailableSites); none of it fails sign-in.
func (d *microsoftDiscovery) teams(granted map[string]bool) error {
	if !microsoftGrantsAny(granted, microsoftTeamScopes) {
		d.teamsLeftOut = teamsNotGranted
		return nil
	}
	var teams struct {
		Value []struct {
			ID   string `json:"id"`
			Name string `json:"displayName"`
		} `json:"value"`
		Next string `json:"@odata.nextLink"`
	}
	d.step = "joined_teams"
	if err := d.entry.request(d.ctx, "https://graph.microsoft.com/v1.0/me/joinedTeams", nil, d.bearer, &teams); err != nil {
		var status microsoftHTTPStatus
		if d.ctx.Err() == nil && errors.As(err, &status) && status == 403 {
			d.skippedSites = append(d.skippedSites, microsoftDiscoveryError{step: d.step, tenantKind: d.tenantKind, err: err})
			d.teamsLeftOut = teamsRefused
			return nil
		}
		return err
	}
	channels := microsoftGrantsAny(granted, microsoftChannelScopes)
	if !channels {
		d.teamsLeftOut = teamsChannelsNotGranted
	}
	if teams.Next != "" {
		d.teamsLeftOut = teamsTooMany
	}
	for _, t := range teams.Value {
		d.step = "team_id"
		if !microsoftGUID.MatchString(t.ID) {
			return ToolFailed
		}
		team := microsoftDisplayName(t.Name, "Teams")
		var group []microsoftRemote
		var root microsoftSite
		d.step = "team_site"
		if err := d.entry.request(d.ctx, "https://graph.microsoft.com/v1.0/groups/"+t.ID+"/sites/root?$select=id,displayName,webUrl", nil, d.bearer, &root); err != nil {
			if !d.unavailable(err, team, 403, 404) {
				return err
			}
		} else if !d.sites[strings.ToLower(root.ID)] {
			found, err := d.libraries(root, "Teams", team)
			if err != nil {
				return err
			}
			group = append(group, found...)
		}
		if channels {
			found, err := d.channels(t.ID, team)
			if err != nil {
				return err
			}
			group = append(group, found...)
		}
		fits, err := d.add(group)
		if err != nil {
			return err
		}
		if !fits {
			d.teamsLeftOut = teamsTooMany
			return nil
		}
	}
	return nil
}

// channels lists a team's private and shared channels' own libraries.
func (d *microsoftDiscovery) channels(teamID, team string) ([]microsoftRemote, error) {
	var list struct {
		Value []struct {
			ID         string `json:"id"`
			Name       string `json:"displayName"`
			Membership string `json:"membershipType"`
		} `json:"value"`
		Next string `json:"@odata.nextLink"`
	}
	d.step = "team_channels"
	if err := d.entry.request(d.ctx, "https://graph.microsoft.com/v1.0/teams/"+teamID+"/channels?$select=id,displayName,membershipType", nil, d.bearer, &list); err != nil {
		if d.unavailable(err, team, 403, 404) {
			return nil, nil
		}
		return nil, err
	}
	if list.Next != "" {
		d.teamsLeftOut = teamsTooMany
	}
	var out []microsoftRemote
	for _, c := range list.Value {
		if c.Membership != "private" && c.Membership != "shared" {
			continue
		}
		d.step = "channel_id"
		if !microsoftChannelID.MatchString(c.ID) {
			return nil, ToolFailed
		}
		channel := microsoftDisplayName(c.Name, "Teams")
		var folder struct {
			WebURL string `json:"webUrl"`
			Parent struct {
				DriveID   string `json:"driveId"`
				DriveType string `json:"driveType"`
			} `json:"parentReference"`
		}
		d.step = "channel_files"
		// Graph documents a 400 for some channel names; like a 403/404 it
		// leaves that one channel out.
		if err := d.entry.request(d.ctx, "https://graph.microsoft.com/v1.0/teams/"+teamID+"/channels/"+url.PathEscape(c.ID)+"/filesFolder", nil, d.bearer, &folder); err != nil {
			if d.unavailable(err, microsoftLabel(team, channel), 400, 403, 404) {
				continue
			}
			return nil, err
		}
		drive := folder.Parent.DriveID
		if d.drives[drive] {
			continue
		}
		d.step = "channel_url"
		u, err := url.Parse(folder.WebURL)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" {
			return nil, ToolFailed
		}
		d.drives[drive] = true
		h := sha256.Sum256([]byte(drive))
		dir := "cloud/sharepoint/" + microsoftSegment(u.Hostname()) + "--" + d.address + "/" + microsoftSegment(c.ID+"-"+team+"-"+channel) + "/" + microsoftSegment(drive+"-"+channel)
		out = append(out, microsoftRemote{Name: "sp-" + hex.EncodeToString(h[:12]), Directory: dir, DriveID: drive, DriveType: folder.Parent.DriveType, Label: microsoftLabel("Teams", team, channel)})
	}
	return out, nil
}

const microsoftConfigHeader = "# Microsoft cloud roots discovered for this native account.\n"

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
			out = append(out, microsoftRemote{Name: name, Writable: true})
		} else if key, value, ok := strings.Cut(line, "="); ok {
			if len(out) == 0 {
				return nil, ToolFailed
			}
			switch strings.TrimSpace(key) {
			case "description":
				out[len(out)-1].Directory = strings.TrimSpace(value)
			case "drive_type":
				out[len(out)-1].DriveType = strings.TrimSpace(value)
			case microsoftLabelKey:
				// A label that does not decode to a showable name is not shown.
				if label, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value)); err == nil && microsoftDisplayName(string(label), "") != "" {
					out[len(out)-1].Label = string(label)
				}
			case microsoftRecoverySelected:
				out[len(out)-1].RecoverySelected = strings.TrimSpace(value) == "true"
			case grantKey:
				r := &out[len(out)-1]
				r.Writable = microsoftWritable(r.service(), microsoftGranted(strings.Fields(value)))
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

// microsoftReady reports whether a root's chosen first pass finished in the
// direction its grant syncs: bisync's committed listings, or a mirror pass.
func microsoftReady(env Env, address string, r microsoftRemote) bool {
	if !r.Writable {
		return mirrorReady(env.Home, microsoftWork(address, r.Name))
	}
	names, fd, err := listHomeDir(env.Home, microsoftWork(address, r.Name))
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
		// A library whose listings a critical abort set aside stays listed,
		// so its stop is reported rather than hidden behind a ready sibling.
		if work := microsoftWork(address, r.Name); microsoftReady(env, address, r) || listingsFailed(env.Home, work) {
			d.Work = work
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
		anyReady = anyReady || microsoftReady(env, address, r)
	}
	for _, r := range remotes {
		label := r.Label
		if label == "" && r.Name == "onedrive" {
			label = "OneDrive"
		} else if label == "" {
			// Written before roots carried the person's names for them.
			label = "SharePoint · " + strings.TrimPrefix(r.Directory, "cloud/sharepoint/")
		}
		out = append(out, Folder{ID: r.Name, Name: label, UnknownSize: true, Suggested: microsoftReady(env, address, r) || (!anyReady && r.Name == "onedrive")})
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

// microsoftMirror is one read-only root's mirror pass.
func microsoftMirror(env Env, address string, r microsoftRemote) (Command, bool) {
	c, ok := microsoftCommand(env, address)
	if !ok {
		return Command{}, false
	}
	return mirrorCommand(c, env, r.Name+":", r.Directory), true
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
	// An explicit choice supersedes every automatic recovery selection, even
	// if a later first pass fails. Never re-add a library the person removed.
	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, address+".conf", 64<<10)
	if err != nil {
		return err
	}
	var lines []string
	for _, line := range strings.Split(string(data), "\n") {
		key, _, _ := strings.Cut(line, "=")
		if strings.TrimSpace(key) != microsoftRecoverySelected {
			lines = append(lines, line)
		}
	}
	if err := writeFileAt(fd, address+".conf", []byte(strings.Join(lines, "\n")), 0600); err != nil {
		return err
	}
	for _, r := range remotes {
		if !selected[r.Name] || microsoftReady(env, address, r) {
			// Choosing more libraries never resyncs a healthy existing pair.
			continue
		}
		if err := microsoftInitialPass(ctx, env, address, r); err != nil {
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

// microsoftInitialPass is one library's explicitly chosen first pass: a
// cloud-preferred union whose differing local files go to the backup directory.
func microsoftInitialPass(ctx context.Context, env Env, address string, r microsoftRemote) error {
	backup := ".local/share/rclone/microsoft-backups/" + address + "/" + r.Name
	if !r.Writable {
		fd, err := openHomeDir(env.Home, true, splitPath(r.Directory)...)
		if err != nil {
			return err
		}
		unix.Close(fd)
		c, ok := microsoftMirror(env, address, r)
		if !ok {
			return ToolFailed
		}
		return initialMirror(ctx, env, c, microsoftWork(address, r.Name), backup, r.service())
	}
	for _, rel := range []string{r.Directory, microsoftWork(address, r.Name), backup} {
		fd, err := openHomeDir(env.Home, true, splitPath(rel)...)
		if err != nil {
			return err
		}
		unix.Close(fd)
	}
	if err := unmarkMirrored(env, microsoftWork(address, r.Name)); err != nil {
		return err
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
	return env.runInitialSync(ctx, c, service)
}

// interruptedPasses lists the libraries whose chosen first pass was stopped.
func (*microsoft) interruptedPasses(env Env, address string) []string {
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return nil
	}
	var works []string
	for _, r := range remotes {
		if work := microsoftWork(address, r.Name); interruptedResync(env, work) {
			works = append(works, work)
		}
	}
	return works
}

// resumeInitial runs those libraries' first passes again, exactly as chosen.
// Libraries the person chose but whose pass never started leave no native
// trace, so they wait for the next explicit choice.
func (m *microsoft) resumeInitial(ctx context.Context, env Env, address string, works []string) error {
	m.native.Lock()
	defer m.native.Unlock()
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return err
	}
	for _, r := range remotes {
		work := microsoftWork(address, r.Name)
		if !slices.Contains(works, work) || !interruptedResync(env, work) {
			continue
		}
		if err := microsoftInitialPass(ctx, env, address, r); err != nil {
			return err
		}
	}
	return nil
}

func (*microsoft) passService(work string) string {
	if filepath.Base(work) == "onedrive" {
		return "onedrive"
	}
	return "sharepoint"
}

func (m *microsoft) SyncCommand(env Env, address string) (Command, bool) {
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return Command{}, false
	}
	var passes []syncPass
	for _, r := range remotes {
		if !microsoftReady(env, address, r) {
			continue
		}
		work := microsoftWork(address, r.Name)
		if !r.Writable {
			c, ok := microsoftMirror(env, address, r)
			if !ok {
				return Command{}, false
			}
			passes = append(passes, syncPass{Work: work, Cmd: c, Done: filepath.Join(env.Home, work, mirrorDone)})
			continue
		}
		c, ok := microsoftBisync(env, address, r)
		if !ok {
			return Command{}, false
		}
		passes = append(passes, syncPass{Work: work, Cmd: c})
	}
	if len(passes) == 0 {
		return Command{}, false
	}
	return syncLoop(passes), true
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
