package nativegitea

import (
	"context"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

// Repository is the projection of one Gitea repository this adapter passes
// on. Its address is derived from the base the person connected, never taken
// from the server's own URL fields: those follow the server's configured root
// URL and can name another host.
type Repository struct {
	ID            int64
	Owner, Name   string
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
	// bounds. A server may shorten pages below the asked limit, so a short
	// page alone never ends the list.
	Complete bool
}

const (
	repoPageSize  = 50
	repoPages     = 20
	repoResults   = 1000
	repoListTime  = 30 * time.Second
	repoPageBytes = 1 << 20
)

// Repos lists /user/repos page by page within a time, page, result and byte
// bound. A failure on the first page is that error; a later failure, a page
// that repeats only known repositories, or a bound ends the list as
// incomplete with what was read.
func (c *Client) Repos(ctx context.Context, b Base, token string) (RepoList, error) {
	ctx, cancel := context.WithTimeout(ctx, repoListTime)
	defer cancel()
	seen := map[int64]bool{}
	dropped := false
	list := RepoList{Repositories: []Repository{}}
	for page := 1; page <= repoPages; page++ {
		var raw []apiRepository
		err := c.getLimited(ctx, b, "/user/repos?page="+strconv.Itoa(page)+"&limit="+strconv.Itoa(repoPageSize), token, repoPageBytes, &raw)
		if err != nil {
			if page == 1 {
				return RepoList{}, err
			}
			return list, nil
		}
		if len(raw) == 0 {
			list.Complete = !dropped
			return list, nil
		}
		fresh := 0
		for _, a := range raw {
			r, ok := a.project(b)
			if !ok {
				// One repository Gitea describes inconsistently is left
				// out, and the list then says it is incomplete.
				dropped = true
				continue
			}
			if seen[r.ID] {
				continue
			}
			seen[r.ID] = true
			fresh++
			if len(list.Repositories) == repoResults {
				return list, nil
			}
			list.Repositories = append(list.Repositories, r)
		}
		if fresh == 0 {
			// A server that repeats its pages would never end.
			return list, nil
		}
	}
	return list, nil
}
