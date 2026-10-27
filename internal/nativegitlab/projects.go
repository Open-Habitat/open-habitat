package nativegitlab

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
)

// Project is the projection of one GitLab project this adapter passes on.
// Its addresses are derived from the base the person connected, never taken
// from the server's own URL fields: those follow GitLab's external_url and
// can name another host.
type Project struct {
	ID int64
	// FullName is GitLab's path_with_namespace: group/subgroup/.../project.
	FullName string
	// Personal: the namespace is a user's, not a group's; Own: that user is
	// the one the token authenticates.
	Personal, Own bool
	// Visibility is private, internal or public.
	Visibility    string
	Empty         bool
	Archived      bool
	Description   string
	DefaultBranch string // "" when GitLab names none
	// ActivityAt is last_activity_at in UTC RFC 3339 with seconds, or "".
	// It is GitLab's last activity of any kind, not a push time.
	ActivityAt string
	// SizeKiB is the repository's size, or -1 when GitLab gives none (it
	// does only to Reporter and above).
	SizeKiB int64
}

// CloneURL is the credential-free HTTPS address of p under b.
func (p Project) CloneURL(b Base) string { return b.String() + "/" + p.FullName + ".git" }

// HTMLURL is p's page under b.
func (p Project) HTMLURL(b Base) string { return b.String() + "/" + p.FullName }

type apiProject struct {
	ID                int64  `json:"id"`
	Path              string `json:"path"`
	PathWithNamespace string `json:"path_with_namespace"`
	Namespace         struct {
		FullPath string `json:"full_path"`
		Kind     string `json:"kind"`
	} `json:"namespace"`
	Visibility    string  `json:"visibility"`
	EmptyRepo     bool    `json:"empty_repo"`
	Archived      bool    `json:"archived"`
	Description   *string `json:"description"`
	DefaultBranch *string `json:"default_branch"`
	LastActivity  string  `json:"last_activity_at"`
	HTTPURL       string  `json:"http_url_to_repo"`
	Statistics    *struct {
		RepositorySize *int64 `json:"repository_size"`
	} `json:"statistics"`
}

// projection is what one API project says, or why it is left out.
type projection int

const (
	projected projection = iota
	// elsewhere: GitLab gives the project's clone address outside the
	// connected base (its external_url is another address). The token is
	// never sent there, so the project is left out and counted.
	elsewhere
	// malformed: the project's names could mean another path.
	malformed
)

func (a apiProject) project(b Base, account Account) (Project, projection) {
	full := a.PathWithNamespace
	if a.ID <= 0 || !ValidFullName(full) || full != a.Namespace.FullPath+"/"+a.Path ||
		(a.Namespace.Kind != "user" && a.Namespace.Kind != "group") ||
		(a.Visibility != "private" && a.Visibility != "internal" && a.Visibility != "public") {
		return Project{}, malformed
	}
	p := Project{ID: a.ID, FullName: full, Personal: a.Namespace.Kind == "user", Visibility: a.Visibility, Empty: a.EmptyRepo, Archived: a.Archived, SizeKiB: -1}
	p.Own = p.Personal && strings.EqualFold(a.Namespace.FullPath, account.Username)
	if a.HTTPURL != p.CloneURL(b) {
		return Project{}, elsewhere
	}
	if a.Description != nil {
		p.Description = boundText(*a.Description, 500)
	}
	if a.DefaultBranch != nil {
		if branch := strings.TrimSpace(*a.DefaultBranch); branch != "" && len(branch) <= 255 && printable(branch) {
			p.DefaultBranch = branch
		}
	}
	if t, err := time.Parse(time.RFC3339, a.LastActivity); err == nil && t.Year() >= 1970 && t.Year() < 10000 {
		p.ActivityAt = t.UTC().Truncate(time.Second).Format("2006-01-02T15:04:05Z")
	}
	if a.Statistics != nil && a.Statistics.RepositorySize != nil && *a.Statistics.RepositorySize >= 0 {
		p.SizeKiB = (*a.Statistics.RepositorySize + 1023) / 1024
	}
	return p, projected
}

func printable(s string) bool {
	for _, c := range s {
		if c < 0x20 || c == 0x7f || c == utf8.RuneError {
			return false
		}
	}
	return true
}

// boundText keeps at most n characters with control characters removed.
func boundText(s string, n int) string {
	var out strings.Builder
	count := 0
	for _, c := range s {
		if count == n {
			break
		}
		if c < 0x20 || c == 0x7f || c == utf8.RuneError {
			continue
		}
		out.WriteRune(c)
		count++
	}
	return out.String()
}

// elsewhereOrigin is the scheme and authority of a clone address GitLab
// reports outside the base, for the person to tell their GitLab's
// administrator; never a path, userinfo or query.
func elsewhereOrigin(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || len(u.Host) > 255 {
		return ""
	}
	if _, _, ok := nativeforge.ParseAuthority(u.Host); !ok {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

// Project reads one project by GitLab's numeric id with the token: an id
// never redirects to a renamed path. Its clone address must be exactly the
// expected path under b.
func (c *Client) Project(ctx context.Context, b Base, token string, account Account, id int64) (Project, error) {
	if id <= 0 {
		return Project{}, ErrProtocol
	}
	var a apiProject
	if _, err := c.get(ctx, b, "/projects/"+strconv.FormatInt(id, 10)+"?statistics=true", token, maxBody, &a); err != nil {
		return Project{}, err
	}
	p, how := a.project(b, account)
	if how != projected || p.ID != id {
		return Project{}, ErrProtocol
	}
	return p, nil
}

// ProjectList is the projects one token's user is a member of.
type ProjectList struct {
	Projects []Project
	// Complete is true only when GitLab's last page carried no next link
	// within the bounds and every page agreed with the ones before.
	Complete bool
	// Incomplete says why a list that is not complete ended.
	Incomplete nativeforge.Incomplete
	// Elsewhere counts projects left out because GitLab gives their clone
	// address outside the connected base; ElsewhereOrigin is one such
	// address's scheme and host, or "".
	Elsewhere       int
	ElsewhereOrigin string
}

const (
	projectPages   = 20
	projectResults = 1000
	projectTime    = 30 * time.Second
	projectBytes   = 32 << 20
)

// Projects lists GET /projects?membership=true (without membership GitLab
// lists every public project it hosts) in id order with keyset pagination
// within a time, page, result and byte bound. Every page is asked for by the
// last id seen, under b; GitLab's next link is only checked to be the same
// list, never followed. A failure on the first page is that error, and so
// is a rejection, an expiry, a missing scope or a refused destination on any
// later page. Any other later failure, a page that repeats or reorders an
// id, or a bound ends the list as incomplete with what was read. Archived
// projects are listed and marked.
func (c *Client) Projects(ctx context.Context, b Base, token string, account Account) (ProjectList, error) {
	ctx, cancel := context.WithTimeout(ctx, projectTime)
	defer cancel()
	list := ProjectList{Projects: []Project{}}
	end := func(why nativeforge.Incomplete) (ProjectList, error) {
		list.Incomplete = why
		return list, nil
	}
	var last int64
	bytes := 0
	inconsistent := false
	for page := 1; page <= projectPages; page++ {
		var raw []json.RawMessage
		header, err := c.get(ctx, b, projectPagePath(last), token, projectPageMax, &raw)
		if err != nil {
			if page == 1 || err == ErrRejected || err == ErrExpired || err == ErrScope || err == ErrRedirect || err == ErrForbiddenDestination || err == ErrUntrustedTLS {
				if err == ErrNotFound {
					err = ErrProtocol
				}
				return ProjectList{}, err
			}
			return end(nativeforge.IncompleteInterrupted)
		}
		if raw == nil {
			if page == 1 {
				return ProjectList{}, ErrProtocol
			}
			return end(nativeforge.IncompleteInterrupted)
		}
		for _, r := range raw {
			bytes += len(r)
		}
		for _, one := range raw {
			var a apiProject
			if json.Unmarshal(one, &a) != nil || a.ID <= 0 {
				inconsistent = true
				continue
			}
			if a.ID <= last {
				// Keyset pages are in id order; a repeat or a step back
				// means the pages are not one list.
				return end(nativeforge.IncompleteInconsistent)
			}
			last = a.ID
			p, how := a.project(b, account)
			switch how {
			case elsewhere:
				list.Elsewhere++
				if list.ElsewhereOrigin == "" {
					list.ElsewhereOrigin = elsewhereOrigin(a.HTTPURL)
				}
				continue
			case malformed:
				inconsistent = true
				continue
			}
			if len(list.Projects) == projectResults {
				return end(nativeforge.IncompleteLimit)
			}
			list.Projects = append(list.Projects, p)
		}
		linked, same := nextLink(header, b)
		if !linked {
			if inconsistent {
				return end(nativeforge.IncompleteInconsistent)
			}
			list.Complete = true
			return list, nil
		}
		if !same || len(raw) == 0 {
			return end(nativeforge.IncompleteInconsistent)
		}
		if bytes > projectBytes {
			return end(nativeforge.IncompleteLimit)
		}
	}
	return end(nativeforge.IncompleteLimit)
}

func projectPagePath(after int64) string {
	p := "/projects?membership=true&statistics=true&pagination=keyset&order_by=id&sort=asc&per_page=" + strconv.Itoa(projectPageSize)
	if after > 0 {
		p += "&id_after=" + strconv.FormatInt(after, 10)
	}
	return p
}

var idAfter = regexp.MustCompile(`^[1-9][0-9]{0,18}$`)

// nextLink reads the rel="next" link. linked is true when GitLab sent one;
// same is true when it is exactly the project list under b (same host, port
// and path, no userinfo) continuing after an id. GitLab adds its own query
// parameters, which are not followed: the next page is asked for by the last
// id this adapter saw.
func nextLink(h http.Header, b Base) (linked, same bool) {
	for _, field := range h.Values("Link") {
		for _, part := range strings.Split(field, ",") {
			target, params, ok := strings.Cut(strings.TrimSpace(part), ";")
			if !ok || !strings.HasPrefix(target, "<") || !strings.HasSuffix(target, ">") {
				continue
			}
			isNext := false
			for _, p := range strings.Split(params, ";") {
				k, v, _ := strings.Cut(strings.TrimSpace(p), "=")
				if strings.EqualFold(k, "rel") && strings.Trim(v, `"`) == "next" {
					isNext = true
				}
			}
			if !isNext {
				continue
			}
			if linked {
				return true, false
			}
			linked = true
			same = sameList(strings.TrimSuffix(strings.TrimPrefix(target, "<"), ">"), b)
		}
	}
	return linked, same
}

func sameList(raw string, b Base) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Fragment != "" || u.Opaque != "" {
		return false
	}
	server, ok := nativeforge.RemoteAuthority("https://" + u.Host + "/")
	if !ok || !server.SameServer(b) || u.EscapedPath() != b.Path+"/api/v4/projects" {
		return false
	}
	q, err := url.ParseQuery(u.RawQuery)
	return err == nil && len(q["id_after"]) == 1 && idAfter.MatchString(q["id_after"][0])
}
