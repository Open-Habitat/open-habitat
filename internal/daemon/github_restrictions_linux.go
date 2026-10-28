//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"
)

// orgRestriction reads GitHub's 403 for a repository whose organisation
// keeps the person's OAuth token out: "oauth_app" for the organisation's
// OAuth App access restrictions, which an owner lifts by approving the app,
// and "saml" for SAML single sign-on the token is not authorised for, which
// the person lifts by signing in to the organisation's SSO. GitHub's
// documented X-GitHub-SSO header and the two messages are the only signals;
// any other 403 is not one.
func orgRestriction(head, body []byte) string {
	for _, line := range strings.Split(string(head), "\n") {
		name, value, ok := strings.Cut(line, ":")
		if ok && strings.EqualFold(strings.TrimSpace(name), "X-GitHub-SSO") && strings.HasPrefix(strings.TrimSpace(value), "required") {
			return "saml"
		}
	}
	var reply struct {
		Message string `json:"message"`
	}
	if len(body) > repoOutputLimit || json.Unmarshal(body, &reply) != nil {
		return ""
	}
	switch {
	case strings.Contains(reply.Message, "has enabled OAuth App access restrictions"):
		return "oauth_app"
	case strings.HasPrefix(reply.Message, "Resource protected by organization SAML enforcement"):
		return "saml"
	}
	return ""
}

// rateLimited is GitHub's documented 403 for a primary or secondary rate
// limit: no requests left in the window, a Retry-After, or its message.
func rateLimited(head, body []byte) bool {
	for _, line := range strings.Split(string(head), "\n") {
		name, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		name, value = strings.TrimSpace(name), strings.TrimSpace(value)
		if strings.EqualFold(name, "X-RateLimit-Remaining") && value == "0" || strings.EqualFold(name, "Retry-After") {
			return true
		}
	}
	var reply struct {
		Message string `json:"message"`
	}
	return len(body) <= repoOutputLimit && json.Unmarshal(body, &reply) == nil && strings.Contains(strings.ToLower(reply.Message), "rate limit")
}

// githubOrgs remembers, in memory only, the organisations whose
// repositories GitHub refused this person's gh for the reasons above, each
// with the one repository that showed it. It is the daemon's own
// observation with the person's own credential, never a list kept for
// anyone else: a restart forgets it, and the next refusal finds it again.
// An entry is asked about again every orgRecheck, with or without a page
// open, so an owner's approval clears it without the person doing anything.
type githubOrgs struct {
	run     func(context.Context, ...string) ([]byte, error)
	changed func()
	every   time.Duration // orgRecheck; shorter in tests

	mu      sync.Mutex
	orgs    map[string]restrictedOrg // by lower-case owner
	probing map[string]bool          // by lower-case owner
}

type restrictedOrg struct {
	Owner, Repo, Kind string
	recheck           *time.Timer
}

const (
	maxRestrictedOrgs = 16
	orgRecheck        = 5 * time.Minute
	orgProbeBudget    = 15 * time.Second
)

func newGitHubOrgs(run func(context.Context, ...string) ([]byte, error)) *githubOrgs {
	return &githubOrgs{run: run, every: orgRecheck, orgs: map[string]restrictedOrg{}, probing: map[string]bool{}}
}

// noteLookup takes one lookup's answer about owner/repo. Only a restriction
// adds an organisation. It ends when GitHub answers otherwise about the very
// repository that showed it: a restricted organisation's public
// repositories stay readable, so another one being found says nothing. An
// unavailable answer says nothing either.
func (g *githubOrgs) noteLookup(name, state string) {
	if g == nil {
		return
	}
	owner, _, ok := strings.Cut(name, "/")
	if !ok || !repoOwner.MatchString(owner) {
		return
	}
	key := strings.ToLower(owner)
	g.mu.Lock()
	before, had := g.orgs[key]
	switch state {
	case "restricted_oauth_app", "restricted_saml":
		kind := strings.TrimPrefix(state, "restricted_")
		if !had && len(g.orgs) >= maxRestrictedOrgs {
			g.mu.Unlock()
			return
		}
		if had && before.recheck != nil {
			before.recheck.Stop()
		}
		entry := restrictedOrg{Owner: owner, Repo: name, Kind: kind}
		if g.run != nil {
			entry.recheck = time.AfterFunc(g.every, func() { g.probe(name) })
		}
		g.orgs[key] = entry
		had = had && before.Kind == kind
		g.mu.Unlock()
		if !had {
			g.tell()
		}
		return
	case "found", "not_found":
		if had && strings.EqualFold(before.Repo, name) {
			if before.recheck != nil {
				before.recheck.Stop()
			}
			delete(g.orgs, key)
			g.mu.Unlock()
			g.tell()
			return
		}
	}
	g.mu.Unlock()
}

func (g *githubOrgs) tell() {
	if g.changed != nil {
		g.changed()
	}
}

// probe asks GitHub about owner/repo in the background, at most once at a
// time per organisation.
func (g *githubOrgs) probe(name string) {
	if g == nil || g.run == nil || !validCloneName(name) {
		return
	}
	owner, _, _ := strings.Cut(name, "/")
	key := strings.ToLower(owner)
	g.mu.Lock()
	if g.probing[key] {
		g.mu.Unlock()
		return
	}
	g.probing[key] = true
	g.mu.Unlock()
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), orgProbeBudget)
		defer cancel()
		_, state := lookupRepo(ctx, g.run, name)
		g.noteLookup(name, state)
		g.mu.Lock()
		delete(g.probing, key)
		// An answer that said nothing keeps the entry: ask again later.
		if o, ok := g.orgs[key]; ok && strings.EqualFold(o.Repo, name) && state != "restricted_oauth_app" && state != "restricted_saml" {
			if o.recheck != nil {
				o.recheck.Stop()
			}
			o.recheck = time.AfterFunc(g.every, func() { g.probe(name) })
			g.orgs[key] = o
		}
		g.mu.Unlock()
	}()
}

// list is what the snapshot tells: the restricted organisations by name.
// An entry whose recheck has not answered is told as it was.
func (g *githubOrgs) list() []restrictedOrg {
	if g == nil {
		return nil
	}
	g.mu.Lock()
	out := make([]restrictedOrg, 0, len(g.orgs))
	for _, o := range g.orgs {
		out = append(out, o)
	}
	g.mu.Unlock()
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i].Owner) < strings.ToLower(out[j].Owner) })
	return out
}

// githubWatch is what a conversation's failed command can ask of the
// person's GitHub observation: a check of the connection now, and a look at
// the repositories it named.
type githubWatch struct {
	recheck func()
	orgs    *githubOrgs
}

func (c *ConversationController) githubOrgs() *githubOrgs {
	if c == nil || c.github == nil {
		return nil
	}
	return c.github.orgs
}

// gitGitHubURL is Git's own fatal line about a github.com HTTPS remote,
// whatever the reason: refused credentials, a 403 or 5xx, or no connection.
var gitGitHubURL = regexp.MustCompile(`^fatal: (?:unable to access|Authentication failed for|could not read (?:Username|Password) for) 'https://github\.com(?:/([A-Za-z0-9][A-Za-z0-9-]{0,38})/([A-Za-z0-9_.-]{1,100}?)(?:\.git)?/?)?'`)

// ghGitHubFailure are gh's lines for an answer about the connection rather
// than about one command: a rejected or missing token, an organisation's
// restriction, a server error or no connection.
var ghGitHubFailure = regexp.MustCompile(`^(?:gh: .*\(HTTP (?:401|403|5[0-9]{2})\)$|HTTP (?:401|403|5[0-9]{2}): |error connecting to api\.github\.com$|GraphQL: .*(?:OAuth App access restrictions|SAML enforcement))`)

// gitHubRefusal is what makes a failure worth a look at the repository:
// GitHub refused, rather than could not be reached.
var gitHubRefusal = regexp.MustCompile(`(?:The requested URL returned error: 403|\(HTTP 403\)|HTTP 403: |OAuth App access restrictions|SAML enforcement)`)

// githubFailureHint reads a failed bash result for git or gh failing
// against GitHub. It is only a hint to look again, never evidence: the
// connection's state still comes from the daemon's own check. It returns
// whether there was such a failure, whether GitHub refused, and the
// github.com repositories Git named.
func githubFailureHint(text string) (bool, bool, []string) {
	if len(text) > 1<<20 {
		text = text[len(text)-1<<20:]
	}
	var hit, refused bool
	var repos []string
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if len(line) > 1024 {
			continue
		}
		if m := gitGitHubURL.FindStringSubmatch(line); m != nil {
			hit = true
			if m[1] != "" && len(repos) < 2 {
				name := m[1] + "/" + m[2]
				if validCloneName(name) && !containsFold(repos, name) {
					repos = append(repos, name)
				}
			}
		} else if ghGitHubFailure.MatchString(line) {
			hit = true
		} else {
			continue
		}
		if gitHubRefusal.MatchString(line) {
			refused = true
		}
	}
	return hit, refused, repos
}

func containsFold(list []string, s string) bool {
	for _, v := range list {
		if strings.EqualFold(v, s) {
			return true
		}
	}
	return false
}

// noteGitHubFailure follows one failed bash result in a conversation whose
// working directory is cwd: a failure against GitHub asks for a check of the
// connection now, and a refusal also looks at the repositories it concerns,
// the ones Git named or else the checkout's own github.com origin.
func (c *ConversationController) noteGitHubFailure(cwd, text string) {
	watch := c.github
	if watch == nil {
		return
	}
	hit, refused, repos := githubFailureHint(text)
	if !hit {
		return
	}
	if watch.recheck != nil {
		watch.recheck()
	}
	if !refused || watch.orgs == nil {
		return
	}
	if len(repos) == 0 {
		if name, ok := checkoutGitHubRepo(c.cfg.Home, cwd); ok {
			repos = append(repos, name)
		}
	}
	for _, name := range repos {
		watch.orgs.probe(name)
	}
}

// checkoutGitHubRepo is owner/repo of the github.com origin of the checkout
// at cwd, read as the person like the snapshot's Git summary.
func checkoutGitHubRepo(home, cwd string) (string, bool) {
	if cwd == "" || !strings.HasPrefix(cwd, "/") {
		return "", false
	}
	fd, err := unix.Open(cwd, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return "", false
	}
	defer unix.Close(fd)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	origin, err := inspectGit(ctx, home, fd, "remote", "get-url", "origin")
	if err != nil {
		return "", false
	}
	return githubRepoName(string(bytes.TrimSpace(origin)))
}
