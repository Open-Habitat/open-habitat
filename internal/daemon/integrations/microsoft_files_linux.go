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

const microsoftHostname = `([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?`

var microsoftSiteID = regexp.MustCompile(`^` + microsoftHostname + `,` + microsoftSiteGUID + `,` + microsoftSiteGUID + `$`)
var microsoftSiteHost = regexp.MustCompile(`^` + microsoftHostname + `$`)
var microsoftDriveID = regexp.MustCompile(`^[A-Za-z0-9!_-]{1,256}$`)

func validMicrosoftSiteID(id string) bool {
	// Graph's site ID is hostname,siteCollectionId,webId, not a URL or
	// server-relative site path. Bound the DNS name as well as its labels.
	host, _, _ := strings.Cut(id, ",")
	return len(host) <= 253 && microsoftSiteID.MatchString(id)
}

// microsoftSiteByURL is Graph's path-addressed request for the site at a
// webUrl (/sites/{hostname}:/{server-relative-path}), or false when the URL
// is not a plain https site address. Each segment is rebuilt escaped, and
// one that could change what Graph addresses (a dot segment, a colon, an
// encoded slash) refuses the lookup rather than reaching another resource.
func microsoftSiteByURL(webURL string) (string, bool) {
	u, err := url.Parse(webURL)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Port() != "" || len(u.Hostname()) > 253 || !microsoftSiteHost.MatchString(u.Hostname()) {
		return "", false
	}
	// The raw input: EscapedPath re-escapes the decoded path, slashes and all,
	// whenever the input's own encoding is not canonical.
	if strings.Contains(strings.ToLower(webURL), "%2f") {
		return "", false
	}
	endpoint := "https://graph.microsoft.com/v1.0/sites/" + u.Hostname()
	if p := strings.Trim(u.Path, "/"); p != "" {
		var segments []string
		for _, seg := range strings.Split(p, "/") {
			if seg == "" || seg == "." || seg == ".." || strings.ContainsAny(seg, ":\\") {
				return "", false
			}
			segments = append(segments, url.PathEscape(seg))
		}
		endpoint += ":/" + strings.Join(segments, "/")
	}
	return endpoint + "?$select=id", true
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

// An account's config holds its one token in the microsoftAccount remote,
// and each cloud root is an alias of it with the root's drive: rclone saves
// a refreshed token into the remote's own section (its config name, not the
// alias's or the connection string's), so every root shares one token and a
// refresh rewrites that one. A token in every root's section once fit only
// about eleven roots under the read bound.
const microsoftAccount = "microsoft"

// maxMicrosoftConfig bounds what discovery writes; every reader accepts up
// to maxMicrosoftConfigRead. The difference is room for rclone to write a
// longer refreshed token: a reader refuses the whole file above its bound.
const maxMicrosoftRemotes, maxMicrosoftConfig, maxMicrosoftConfigRead = 64, 56 << 10, 64 << 10

// microsoftAliasRemote is a root's alias target: the account remote with
// the root's drive. Its parts are validated identifiers, never provider text.
var microsoftAliasRemote = regexp.MustCompile(`^` + microsoftAccount + `,drive_id=([A-Za-z0-9!_-]{1,256}),drive_type=(personal|business|documentLibrary):$`)

// microsoftAccountSection is the account remote: the application, tenant,
// grant and token every root uses.
func microsoftAccountSection(app MicrosoftApp, granted []string, token []byte) string {
	return fmt.Sprintf("[%s]\ntype = onedrive\nclient_id = %s\nregion = global\ntenant = %s\n%stoken = %s\n\n", microsoftAccount, app.ClientID, app.TenantID, grantLine(granted), token)
}

// errMicrosoftTruncated is a library list Graph paged: the inventory would
// be partial. A followed site fails discovery; a team is left out.
var errMicrosoftTruncated = errors.New("microsoft library list truncated")

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
	account := microsoftAccountSection(l.app, l.granted, l.token)
	d := &microsoftDiscovery{microsoftLogin: l, ctx: ctx, bearer: bearer, step: "onedrive", tenantKind: "unknown", sites: map[string]bool{}, drives: map[string]bool{}, reachable: map[string]bool{}, hostOf: map[int]string{}, size: len(microsoftConfigHeader) + len(microsoftDiscoveryFixed) + len(account)}
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
		if errors.Is(err, errMicrosoftTruncated) {
			return ToolFailed
		}
		if err != nil {
			return err
		}
		remotes = append(remotes, found...)
	}
	fits, err := d.add(remotes)
	if err == nil && !fits {
		// Labels are only names: an inventory that fit before them still
		// connects, under its directories' names.
		for i := range remotes {
			remotes[i].Label = ""
		}
		fits, err = d.add(remotes)
	}
	if err != nil || !fits {
		if err == nil {
			err = ToolFailed
		}
		return err
	}
	// Without roots there is no token for rclone to keep.
	if len(d.sections) == 0 {
		account = ""
	}
	l.config = []byte(microsoftConfigHeader + microsoftDiscoveryFixed + account + strings.Join(d.sections, ""))
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
	id, lookup, err := d.siteDrives(s, &list)
	if err != nil {
		if d.unavailable(err, label[len(label)-1], 403, 404) {
			d.skippedSites[len(d.skippedSites)-1].siteLookup = lookup
			d.hostOf[len(d.skippedSites)-1] = host
			return nil, nil
		}
		return nil, err
	}
	d.reachable[host] = true
	if lookup != siteLookupID {
		d.siteLookups = append(d.siteLookups, lookup)
	}
	d.step = "site_drives_limit"
	if list.Next != "" {
		return nil, errMicrosoftTruncated
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
		dir := "cloud/sharepoint/" + microsoftSegment(u.Hostname()) + "--" + d.address + "/" + microsoftSegment(id+"-"+s.Name) + "/" + microsoftSegment(lib.ID+"-"+lib.Name)
		out = append(out, microsoftRemote{Name: "sp-" + hex.EncodeToString(h[:12]), Directory: dir, DriveID: lib.ID, DriveType: lib.Type, Label: microsoftLabel(append(label, microsoftDisplayName(lib.Name, "Documents"))...)})
	}
	return out, nil
}

// siteDrives lists a site's libraries into list and returns the site ID that
// opened and the lookup form (siteLookupID, ...) that decided the outcome.
// Graph documents /me/followedSites as drifting from SharePoint following,
// and its composite ID can 404 for a site the person opens in SharePoint, so
// only on a 404 the site is looked up again by its webUrl. 403 stays "no
// access" and any other failure fails discovery, as for the first request.
func (d *microsoftDiscovery) siteDrives(s microsoftSite, list any) (string, string, error) {
	drives := func(id string) error {
		d.step = "site_drives"
		// Preserve Graph's composite-ID delimiters, as in its site-get
		// request examples. Validation makes this a single safe segment.
		return d.entry.request(d.ctx, "https://graph.microsoft.com/v1.0/sites/"+id+"/drives?$select=id,name,driveType&$top=100", nil, d.bearer, list)
	}
	err := drives(s.ID)
	var status microsoftHTTPStatus
	if d.ctx.Err() != nil || !errors.As(err, &status) || status != 404 {
		return s.ID, siteLookupID, err
	}
	endpoint, ok := microsoftSiteByURL(s.WebURL)
	if !ok {
		return s.ID, siteLookupID, err
	}
	d.step = "site_by_url"
	var site microsoftSite
	if err := d.entry.request(d.ctx, endpoint, nil, d.bearer, &site); err != nil {
		return "", siteLookupWebURL, err
	}
	d.step = "site_id"
	if !validMicrosoftSiteID(site.ID) {
		return "", siteLookupWebURL, ToolFailed
	}
	if strings.EqualFold(site.ID, s.ID) {
		// The site exists under the same ID; its libraries are what 404.
		d.step = "site_drives"
		return "", siteLookupSameID, err
	}
	d.sites[strings.ToLower(site.ID)] = true
	return site.ID, siteLookupWebURL, drives(site.ID)
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
		label := ""
		if r.Label != "" {
			label = microsoftLabelKey + " = " + base64.RawURLEncoding.EncodeToString([]byte(r.Label)) + "\n"
		}
		s := fmt.Sprintf("[%s]\ntype = alias\nremote = %s,drive_id=%s,drive_type=%s:\ndescription = %s\n%s\n", r.Name, microsoftAccount, r.DriveID, r.DriveType, r.Directory, label)
		more, n = append(more, s), n+len(s)
	}
	d.step = microsoftRemoteLimit
	if len(d.sections)+len(more) > maxMicrosoftRemotes {
		return false, nil
	}
	d.step = microsoftConfigLimit
	if d.size+n > maxMicrosoftConfig {
		return false, nil
	}
	d.sections, d.size = append(d.sections, more...), d.size+n
	return true, nil
}

// The bounds discovery's step names when the inventory does not fit.
const (
	microsoftRemoteLimit = "remote_limit"
	microsoftConfigLimit = "config_limit"
)

const microsoftLabelKey = "habitat_label"

const microsoftConfigHeader = "# Microsoft cloud roots discovered for this native account.\n"

func microsoftRemotes(env Env, address string) ([]microsoftRemote, error) {
	roots, _, err := microsoftReadRoots(env, address)
	return roots, err
}

// microsoftReadRoots reads the account's roots and the names of those still
// in the earlier form, each its own rclone remote with its own token, which
// the next start migrates (microsoftMigrate).
func microsoftReadRoots(env Env, address string) ([]microsoftRemote, []string, error) {
	if !ValidAddress(address) {
		return nil, nil, ToolFailed
	}
	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, address+".conf", maxMicrosoftConfigRead)
	if errors.Is(err, unix.ENOENT) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}
	return microsoftParseRoots(data, address)
}

func microsoftParseRoots(data []byte, address string) ([]microsoftRemote, []string, error) {
	var out []microsoftRemote
	var kinds, remotes []string
	var granted map[string]bool
	ownGrant := map[int]bool{}
	seen := map[string]bool{}
	account, inAccount := false, false
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			name := strings.TrimSuffix(strings.TrimPrefix(line, "["), "]")
			if name == microsoftAccount && !account {
				account, inAccount = true, true
				continue
			}
			if !microsoftRemoteName.MatchString(name) || seen[name] {
				return nil, nil, ToolFailed
			}
			seen[name], inAccount = true, false
			out, kinds, remotes = append(out, microsoftRemote{Name: name, Writable: true}), append(kinds, ""), append(remotes, "")
		} else if key, value, ok := strings.Cut(line, "="); ok {
			key, value = strings.TrimSpace(key), strings.TrimSpace(value)
			if inAccount {
				switch key {
				case "type":
					if value != "onedrive" {
						return nil, nil, ToolFailed
					}
				case grantKey:
					granted = microsoftGranted(strings.Fields(value))
				}
				continue
			}
			if len(out) == 0 {
				return nil, nil, ToolFailed
			}
			r, i := &out[len(out)-1], len(out)-1
			switch key {
			case "type":
				kinds[i] = value
			case "remote":
				remotes[i] = value
			case "description":
				r.Directory = value
			case "drive_id":
				r.DriveID = value
			case "drive_type":
				r.DriveType = value
			case microsoftLabelKey:
				// A label that does not decode to a showable name is not shown.
				if label, err := base64.RawURLEncoding.DecodeString(value); err == nil && microsoftDisplayName(string(label), "") != "" {
					r.Label = string(label)
				}
			case microsoftRecoverySelected:
				r.RecoverySelected = value == "true"
			case grantKey:
				r.Writable, ownGrant[i] = microsoftWritable(r.service(), microsoftGranted(strings.Fields(value))), true
			}
		}
	}
	var legacy []string
	dirs := map[string]bool{}
	for i := range out {
		r := &out[i]
		switch kinds[i] {
		case "alias":
			// A root reaches only its own drive through the account's token.
			m := microsoftAliasRemote.FindStringSubmatch(remotes[i])
			if m == nil || !account {
				return nil, nil, ToolFailed
			}
			r.DriveID, r.DriveType = m[1], m[2]
			if granted != nil && !ownGrant[i] {
				r.Writable = microsoftWritable(r.service(), granted)
			}
		case "onedrive":
			legacy = append(legacy, r.Name)
		default:
			return nil, nil, ToolFailed
		}
		dir := r.Directory
		valid := dir == "cloud/onedrive/"+address
		if r.Name != "onedrive" {
			parts := strings.Split(dir, "/")
			valid = len(parts) == 5 && parts[0] == "cloud" && parts[1] == "sharepoint" && strings.HasSuffix(parts[2], "--"+address)
		}
		if !valid || filepath.Clean(dir) != dir || strings.ContainsAny(dir, "\r\n\\") || dirs[dir] {
			return nil, nil, ToolFailed
		}
		for _, p := range strings.Split(dir, "/") {
			if p == "" || p == "." || p == ".." {
				return nil, nil, ToolFailed
			}
		}
		dirs[dir] = true
	}
	return out, legacy, nil
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

// microsoftPassStarted reports whether a root ever had a first pass: its
// work directory holds something. A choice refused before the copy, or a
// root the person left out, leaves it absent or empty.
func microsoftPassStarted(env Env, address string, r microsoftRemote) bool {
	names, fd, err := listHomeDir(env.Home, microsoftWork(address, r.Name))
	if err != nil {
		return true
	}
	if fd >= 0 {
		unix.Close(fd)
	}
	return len(names) > 0
}

// Directories are the roots that sync, and while none does yet, those whose
// first pass ran (a level change's or a resumed one). A root that never had
// a pass is no directory of the account's.
func (*microsoft) Directories(env Env, address string) []SyncDirectory {
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return nil
	}
	var out, pending []SyncDirectory
	for _, r := range remotes {
		if !microsoftKept(env, address, r) {
			continue
		}
		d := SyncDirectory{Service: r.service(), Path: r.Directory}
		// A library whose listings a critical abort set aside stays listed,
		// so its stop is reported rather than hidden behind a ready sibling.
		if work := microsoftWork(address, r.Name); microsoftReady(env, address, r) || listingsFailed(env.Home, work) {
			d.Work = work
			out = append(out, d)
		} else {
			pending = append(pending, d)
		}
	}
	if len(out) == 0 {
		return pending
	}
	return out
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
	c, ok := microsoftCommand(env, address)
	if !ok {
		return Command{}, false
	}
	return bisyncCommand(c, env, r.Directory, r.Name+":", microsoftWork(address, r.Name)), true
}

// restartPasses runs the first pass of roots a sign-in turned to the other
// direction, in the new one, so a level change does not stop their sync.
func (m *microsoft) restartPasses(ctx context.Context, env Env, address string, names []string) error {
	m.native.Lock()
	defer m.native.Unlock()
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return err
	}
	for _, r := range remotes {
		if !slices.Contains(names, r.Name) || microsoftReady(env, address, r) || listingsFailed(env.Home, microsoftWork(address, r.Name)) {
			continue
		}
		if err := microsoftInitialPass(ctx, env, address, r); err != nil {
			return err
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
// Libraries whose pass never started leave no native trace and do not sync.
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
	remotes, legacy, err := microsoftReadRoots(env, address)
	if err != nil {
		return Command{}, false
	}
	var passes []syncPass
	for _, r := range remotes {
		if !microsoftReady(env, address, r) {
			continue
		}
		// An alias whose session files still carry its own remote's name
		// would not find its pair: it waits for the migration to move them.
		if !slices.Contains(legacy, r.Name) && microsoftListingsUnmoved(env, address, r.Name) {
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

// microsoftKept reports whether a root keeps its place in the account's
// config across a sign-in: it had a first pass (its work directory holds
// listings, a mirror's marker or a stopped pass), or the startup repair
// selected it. A root that never had a pass was only offered by an earlier
// release's folder step, and nothing offers it now.
func microsoftKept(env Env, address string, r microsoftRemote) bool {
	return r.RecoverySelected || microsoftPassStarted(env, address, r)
}

// microsoftKeptConfig is the account's config after a sign-in: the new
// token and grant, and the roots that already sync under their own names
// and directories, so their native listings continue as they were.
func microsoftKeptConfig(app MicrosoftApp, granted []string, token []byte, kept []microsoftRemote) ([]byte, error) {
	var b strings.Builder
	b.WriteString(microsoftConfigHeader + microsoftDiscoveryFixed + microsoftAccountSection(app, granted, token))
	for _, r := range kept {
		if !microsoftRemoteName.MatchString(r.Name) || !microsoftDriveID.MatchString(r.DriveID) || (r.DriveType != "personal" && r.DriveType != "business" && r.DriveType != "documentLibrary") {
			return nil, ToolFailed
		}
		fmt.Fprintf(&b, "[%s]\ntype = alias\nremote = %s,drive_id=%s,drive_type=%s:\ndescription = %s\n", r.Name, microsoftAccount, r.DriveID, r.DriveType, r.Directory)
		if r.Label != "" {
			b.WriteString(microsoftLabelKey + " = " + base64.RawURLEncoding.EncodeToString([]byte(r.Label)) + "\n")
		}
		if r.RecoverySelected {
			b.WriteString(microsoftRecoverySelected + " = true\n")
		}
		b.WriteString("\n")
	}
	if b.Len() > maxMicrosoftConfig {
		return nil, ToolFailed
	}
	return []byte(b.String()), nil
}
