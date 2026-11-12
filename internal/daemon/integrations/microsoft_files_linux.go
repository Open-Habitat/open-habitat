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
	if sitesGranted {
		if err := d.teams(granted); err != nil {
			return err
		}
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

// microsoftShortestRoot is less than any root's config section: its fixed
// lines with the shortest name, drive and path.
const microsoftShortestRoot = 128

// The bounds that can leave teams out of the folder step, for the journal.
const (
	microsoftRemoteLimit = "remote_limit"
	microsoftConfigLimit = "config_limit"
	microsoftLibraryList = "library_list_paged"
	microsoftTeamList    = "team_list_paged"
)

// bound records that a bound fired, once per kind.
func (d *microsoftDiscovery) bound(kind string) {
	if !slices.Contains(d.bounds, kind) {
		d.bounds = append(d.bounds, kind)
	}
}

func cloneSet(m map[string]bool) map[string]bool {
	out := make(map[string]bool, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

// leaveOut names a team the folder step does not offer. The page's list is
// bounded; its last entry then says there are more.
func (d *microsoftDiscovery) leaveOut(team string) {
	d.teamsLeftOut = teamsTooMany
	d.teamsOmitted++
	if len(d.teamsNotOffered) < 32 {
		d.teamsNotOffered = append(d.teamsNotOffered, team)
	} else {
		d.teamsNotOffered[31] = "…"
	}
}

const microsoftLabelKey = "habitat_label"

// teams adds the libraries of the teams the person has joined, and of each
// private or shared channel's own site, one whole team at a time. A team
// that does not fit the config's bounds is left out and named, and the next
// one is still tried. A standard channel's files are a folder of its team's
// library, already offered. What is left out is said in the folder step
// (teamsLeftOut, teamsNotOffered, unavailableSites); none of it fails sign-in.
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
		d.bound(microsoftTeamList)
	}
	for _, t := range teams.Value {
		d.step = "team_id"
		if !microsoftGUID.MatchString(t.ID) {
			return ToolFailed
		}
		team := microsoftDisplayName(t.Name, "Teams")
		// Once no root can fit, the rest are named without asking Graph. No
		// root's section is shorter than microsoftShortestRoot.
		if len(d.sections) >= maxMicrosoftRemotes {
			d.bound(microsoftRemoteLimit)
			d.leaveOut(team)
			continue
		}
		if d.size+microsoftShortestRoot > maxMicrosoftConfig {
			d.bound(microsoftConfigLimit)
			d.leaveOut(team)
			continue
		}
		// A team left out leaves its sites and libraries to later teams: a
		// shared channel's library can belong to several.
		sites, drives := cloneSet(d.sites), cloneSet(d.drives)
		var group []microsoftRemote
		var root microsoftSite
		d.step = "team_site"
		if err := d.entry.request(d.ctx, "https://graph.microsoft.com/v1.0/groups/"+t.ID+"/sites/root?$select=id,displayName,webUrl", nil, d.bearer, &root); err != nil {
			if !d.unavailable(err, team, 403, 404) {
				return err
			}
		} else if !d.sites[strings.ToLower(root.ID)] {
			found, err := d.libraries(root, "Teams", team)
			if errors.Is(err, errMicrosoftTruncated) {
				// A team too large to list whole is left out, and said.
				d.bound(microsoftLibraryList)
				d.leaveOut(team)
				d.sites, d.drives = sites, drives
				continue
			}
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
			d.bound(d.step)
			d.leaveOut(team)
			d.sites, d.drives = sites, drives
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
	c, ok := microsoftCommand(env, address)
	if !ok {
		return Command{}, false
	}
	return bisyncCommand(c, env, r.Directory, r.Name+":", microsoftWork(address, r.Name)), true
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
	data, err := readFileAt(fd, address+".conf", maxMicrosoftConfigRead)
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
