package nativegitea

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

// Repository is the projection of one Gitea repository this adapter passes
// on. Its address is derived from the base the person connected, never taken
// from the server's own URL fields: those follow the server's configured root
// URL and can name another host.
type Repository struct {
	ID          int64
	Owner, Name string
	// OwnerID is Gitea's id of the owning user or organisation, 0 when
	// Gitea gave none. The list compares it with the PAT's account to say
	// which repositories are the person's own; a login name could have
	// been renamed since tea stored it.
	OwnerID       int64
	Private       bool
	Empty         bool
	Archived      bool
	Description   string
	DefaultBranch string // "" when Gitea names none
	// UpdatedAt is UTC RFC 3339 with seconds, or "" when Gitea gives none.
	UpdatedAt string
	SizeKiB   int64
}

// FullName is owner/name as Gitea spells it.
func (r Repository) FullName() string { return r.Owner + "/" + r.Name }

// CloneURL is the credential-free HTTPS address of r under b.
func (r Repository) CloneURL(b Base) string { return b.String() + "/" + r.FullName() + ".git" }

// HTMLURL is r's page under b.
func (r Repository) HTMLURL(b Base) string { return b.String() + "/" + r.FullName() }

var (
	giteaOwner = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,40}$`)
	giteaRepo  = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,100}$`)
)

type apiRepository struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Owner    struct {
		ID    int64  `json:"id"`
		Login string `json:"login"`
	} `json:"owner"`
	Private       bool   `json:"private"`
	Empty         bool   `json:"empty"`
	Archived      bool   `json:"archived"`
	Description   string `json:"description"`
	DefaultBranch string `json:"default_branch"`
	Updated       string `json:"updated_at"`
	Size          int64  `json:"size"`
	CloneURL      string `json:"clone_url"`
}

// project validates one API repository. A repository whose names could
// mean a different path, or whose clone URL Gitea says is elsewhere than
// the connected base, is not passed on: a PAT is never sent there.
func (a apiRepository) project(b Base) (Repository, bool) {
	if a.ID <= 0 || !giteaOwner.MatchString(a.Owner.Login) || !giteaRepo.MatchString(a.Name) || a.Name == "." || a.Name == ".." || a.Owner.Login == "." || a.Owner.Login == ".." || a.FullName != a.Owner.Login+"/"+a.Name || a.Size < 0 {
		return Repository{}, false
	}
	r := Repository{ID: a.ID, Owner: a.Owner.Login, Name: a.Name, Private: a.Private, Empty: a.Empty, Archived: a.Archived, SizeKiB: a.Size}
	if a.Owner.ID > 0 {
		r.OwnerID = a.Owner.ID
	}
	if a.CloneURL != r.CloneURL(b) {
		return Repository{}, false
	}
	r.Description = boundText(a.Description, 500)
	if branch := strings.TrimSpace(a.DefaultBranch); branch != "" && len(branch) <= 255 && printable(branch) {
		r.DefaultBranch = branch
	}
	if t, err := time.Parse(time.RFC3339, a.Updated); err == nil && t.Year() >= 1970 && t.Year() < 10000 {
		r.UpdatedAt = t.UTC().Truncate(time.Second).Format("2006-01-02T15:04:05Z")
	}
	return r, true
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

// Repository reads one repository by Gitea's id with the PAT. Its clone
// address must be exactly the expected path under b.
func (c *Client) Repository(ctx context.Context, b Base, token string, id int64) (Repository, error) {
	if id <= 0 {
		return Repository{}, ErrProtocol
	}
	var a apiRepository
	if err := c.get(ctx, b, "/repositories/"+strconv.FormatInt(id, 10), token, &a); err != nil {
		return Repository{}, err
	}
	r, ok := a.project(b)
	if !ok || r.ID != id {
		return Repository{}, ErrProtocol
	}
	return r, nil
}

// RepoList is the repositories one PAT can read.
type RepoList struct {
	Repositories []Repository
	// Complete is true only when Gitea answered an empty page within the
	// bounds and the pages agreed with each other. A server may shorten
	// pages below the asked limit, so a short page alone never ends the list.
	Complete bool
	// Incomplete says why a list that is not complete ended.
	Incomplete Incomplete
}

// Incomplete is why a repository list ended before Gitea said it was done.
type Incomplete = nativeforge.Incomplete

const (
	IncompleteLimit        = nativeforge.IncompleteLimit
	IncompleteInterrupted  = nativeforge.IncompleteInterrupted
	IncompleteInconsistent = nativeforge.IncompleteInconsistent
)

const (
	repoPageSize  = 50
	repoPages     = 100
	repoResults   = 1000
	repoListTime  = 30 * time.Second
	repoPageBytes = 1 << 20
	repoListBytes = 8 << 20
)

// Repos lists /user/repos page by page within a time, page, result and byte
// bound. Pages are always asked for by number under b; a pagination link
// Gitea sends is only checked, never followed. A failure on the first page
// is that error, and so is a rejection, a missing scope or a refused
// destination on any later page: the token's answer then is that it cannot
// list. Any other later failure, a page that repeats a repository, a total
// that changes, or a bound ends the list as incomplete with what was read.
func (c *Client) Repos(ctx context.Context, b Base, token string) (RepoList, error) {
	ctx, cancel := context.WithTimeout(ctx, repoListTime)
	defer cancel()
	seen := map[int64]bool{}
	total, bytes := -1, 0
	list := RepoList{Repositories: []Repository{}}
	end := func(why Incomplete) (RepoList, error) {
		list.Incomplete = why
		return list, nil
	}
	inconsistent := false
	for page := 1; page <= repoPages; page++ {
		var raw []json.RawMessage
		header, err := c.getLimited(ctx, b, repoPagePath(page), token, repoPageBytes, &raw)
		if err != nil {
			if page == 1 || err == ErrRejected || err == ErrScope || err == ErrRedirect || err == ErrForbiddenDestination || err == ErrUntrustedTLS {
				return RepoList{}, err
			}
			return end(IncompleteInterrupted)
		}
		for _, r := range raw {
			bytes += len(r)
		}
		if raw == nil {
			// JSON null is no page of repositories.
			if page == 1 {
				return RepoList{}, ErrProtocol
			}
			return end(IncompleteInterrupted)
		}
		if len(raw) == 0 {
			count, ok := totalCount(header)
			if ok && total < 0 {
				total = count
			}
			_, linked := nextPage(header, b)
			if linked || inconsistent || (ok && count != total) || (total >= 0 && len(seen) != total) {
				return end(IncompleteInconsistent)
			}
			list.Complete = true
			return list, nil
		}
		for _, one := range raw {
			var a apiRepository
			if json.Unmarshal(one, &a) != nil {
				inconsistent = true
				continue
			}
			if a.ID > 0 && seen[a.ID] {
				return end(IncompleteInconsistent)
			}
			if a.ID > 0 {
				seen[a.ID] = true
			}
			r, ok := a.project(b)
			if !ok {
				// One repository Gitea describes inconsistently is left
				// out, and the list then says it is incomplete.
				inconsistent = true
				continue
			}
			if len(list.Repositories) == repoResults {
				return end(IncompleteLimit)
			}
			list.Repositories = append(list.Repositories, r)
		}
		// What a page holds is the person's either way; whether the pages
		// agree decides only whether the list can be complete.
		count, ok := totalCount(header)
		if ok && total >= 0 && count != total {
			// Repositories were added or removed while the pages were read;
			// numbered pages then shift and one may have been skipped.
			return end(IncompleteInconsistent)
		}
		if ok {
			total = count
		}
		next, linked := nextPage(header, b)
		if linked && next != page+1 {
			return end(IncompleteInconsistent)
		}
		if bytes > repoListBytes {
			return end(IncompleteLimit)
		}
	}
	return end(IncompleteLimit)
}

func repoPagePath(page int) string {
	return "/user/repos?page=" + strconv.Itoa(page) + "&limit=" + strconv.Itoa(repoPageSize)
}

// totalCount is Gitea's X-Total-Count, when it sends a valid one.
func totalCount(h http.Header) (int, bool) {
	v := h.Values("X-Total-Count")
	if len(v) != 1 {
		return 0, false
	}
	n, err := strconv.Atoi(v[0])
	return n, err == nil && n >= 0 && n <= 1<<30
}

// nextPage reads the rel="next" pagination link. linked is true when
// Gitea sent one; next is the page number it names, or 0 when the link is
// not exactly the same list under b (another host, port, base path or
// endpoint, userinfo, or a page that is not a plain number). Gitea builds
// the link from its configured root URL, so a server whose root URL is not
// the connected base names another address; its repositories' clone URLs
// do too and were dropped already.
func nextPage(h http.Header, b Base) (next int, linked bool) {
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
				// Two next links name no one page.
				return 0, true
			}
			linked = true
			next = samePage(strings.TrimSuffix(strings.TrimPrefix(target, "<"), ">"), b)
		}
	}
	return next, linked
}

func samePage(raw string, b Base) int {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Fragment != "" || u.Opaque != "" {
		return 0
	}
	server, ok := RemoteAuthority("https://" + u.Host + "/")
	if !ok || !server.SameServer(b) || u.EscapedPath() != b.Path+"/api/v1/user/repos" {
		return 0
	}
	q, err := url.ParseQuery(u.RawQuery)
	if err != nil || len(q["page"]) != 1 {
		return 0
	}
	n, err := strconv.Atoi(q["page"][0])
	if err != nil || n < 1 {
		return 0
	}
	return n
}
