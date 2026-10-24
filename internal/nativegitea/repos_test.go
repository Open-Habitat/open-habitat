package nativegitea

import (
	"context"
	"crypto/x509"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/nativegitea/giteafake"
)

func startFake(t *testing.T) (*giteafake.Server, Base) {
	t.Helper()
	srv, err := giteafake.Start(t.TempDir(), []giteafake.Account{{ID: 7, Login: "ada", Token: "tok-ada"}, {ID: 8, Login: "bob", Token: "tok-bob"}}, []giteafake.Repo{
		{ID: 1, Owner: "ada", Name: "one", Private: true},
		{ID: 2, Owner: "ada", Name: "two", Empty: true},
		{ID: 3, Owner: "bob", Name: "shared", Readers: []int64{7}},
		{ID: 4, Owner: "bob", Name: "secret", Private: true},
		{ID: 5, Owner: "ada", Name: "five"},
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(srv.Close)
	b, err := ParseBase(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	return srv, b
}

// A server that shortens pages below the asked limit must not end the list
// at its first short page, and only what the token may read is listed.
func TestReposWalksShortenedPagesToTheEmptyOne(t *testing.T) {
	srv, b := startFake(t)
	srv.PageLimit.Store(2)
	c := NewClientWithRoots(srv.Roots)
	list, err := c.Repos(context.Background(), b, "tok-ada")
	if err != nil || !list.Complete {
		t.Fatalf("list = %+v, %v", list, err)
	}
	got := map[int64]Repository{}
	for _, r := range list.Repositories {
		got[r.ID] = r
	}
	if len(got) != 4 || got[4].ID != 0 || got[3].FullName() != "bob/shared" || !got[2].Empty || got[2].DefaultBranch != "" || got[1].DefaultBranch != "main" || got[1].UpdatedAt != "2026-10-20T07:00:00Z" {
		t.Fatalf("repositories = %+v", list.Repositories)
	}
	if got[1].CloneURL(b) != srv.URL+"/ada/one.git" {
		t.Fatalf("clone url %q", got[1].CloneURL(b))
	}
	if _, err := c.Repos(context.Background(), b, "wrong"); err != ErrRejected {
		t.Fatalf("rejected token: %v", err)
	}
}

func TestRepositoryLookupIsTheTokensOwn(t *testing.T) {
	srv, b := startFake(t)
	c := NewClientWithRoots(srv.Roots)
	if r, err := c.Repository(context.Background(), b, "tok-ada", 1); err != nil || r.FullName() != "ada/one" || !r.Private {
		t.Fatalf("own repository: %+v %v", r, err)
	}
	// Gitea answers 404 for a repository the token cannot read.
	if _, err := c.Repository(context.Background(), b, "tok-ada", 4); err == nil {
		t.Fatal("another account's private repository was found")
	}
}

// The server's own URL fields can name another host; such a repository is
// never passed on, so a PAT is never sent there.
func TestProjectionRefusesAForeignCloneURL(t *testing.T) {
	b, _ := ParseBase("https://git.example.test/gitea")
	a := apiRepository{ID: 3, Name: "x", FullName: "o/x", CloneURL: "https://git.example.test/gitea/o/x.git"}
	a.Owner.Login = "o"
	if _, ok := a.project(b); !ok {
		t.Fatal("canonical repository refused")
	}
	for _, bad := range []string{"https://elsewhere.example.test/gitea/o/x.git", "https://git.example.test/o/x.git", "https://user:pw@git.example.test/gitea/o/x.git", "http://git.example.test/gitea/o/x.git"} {
		a.CloneURL = bad
		if _, ok := a.project(b); ok {
			t.Fatalf("clone url %q accepted", bad)
		}
	}
	a.CloneURL = "https://git.example.test/gitea/o/x.git"
	a.FullName = "o/y"
	if _, ok := a.project(b); ok {
		t.Fatal("inconsistent full name accepted")
	}
}

// scriptedGitea answers /gitea/api/v1/user/repos with page(n); every other
// path is 404. The base has a path so that a link outside it is visible.
func scriptedGitea(t *testing.T, page func(n int, w http.ResponseWriter, r *http.Request)) (*Client, Base) {
	t.Helper()
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/gitea/api/v1/user/repos" || r.Header.Get("Authorization") != "token tok" {
			http.NotFound(w, r)
			return
		}
		n, _ := strconv.Atoi(r.URL.Query().Get("page"))
		page(n, w, r)
	}))
	t.Cleanup(srv.Close)
	roots := x509.NewCertPool()
	roots.AddCert(srv.Certificate())
	b, err := ParseBase(srv.URL + "/gitea")
	if err != nil {
		t.Fatal(err)
	}
	return NewClientWithRoots(roots), b
}

// repoPage writes repositories first..first+n-1 as Gitea would, with
// total as X-Total-Count (omitted when negative) and next as the Link.
func repoPage(w http.ResponseWriter, b Base, first, n, total int, next string) {
	out := make([]map[string]any, 0, n)
	for id := first; id < first+n; id++ {
		name := "r" + strconv.Itoa(id)
		out = append(out, map[string]any{"id": id, "name": name, "full_name": "o/" + name, "owner": map[string]any{"id": 9, "login": "o"}, "clone_url": b.String() + "/o/" + name + ".git", "size": 1})
	}
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	if total >= 0 {
		w.Header().Set("X-Total-Count", strconv.Itoa(total))
	}
	if next != "" {
		w.Header().Set("Link", "<"+next+`>; rel="next"`)
	}
	_ = json.NewEncoder(w).Encode(out)
}

// Each list is either complete, incomplete with its reason and what was
// read, or the token's failure; never a shortened list that says complete.
func TestReposBoundsAndPageConsistency(t *testing.T) {
	type want struct {
		n          int
		complete   bool
		incomplete Incomplete
		err        error
	}
	link := func(b Base, page int) string {
		return b.String() + "/api/v1/user/repos?limit=50&page=" + strconv.Itoa(page)
	}
	cases := []struct {
		name string
		page func(b Base, n int, w http.ResponseWriter, r *http.Request)
		ctx  time.Duration
		want want
	}{
		{"small pages with links end at the empty page", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			if n <= 3 {
				repoPage(w, b, n*2-1, 2, 6, link(b, n+1))
				return
			}
			repoPage(w, b, 0, 0, 6, "")
		}, 0, want{n: 6, complete: true}},
		{"no headers at all still ends at the empty page", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, n, min(1, 4-n), -1, "")
		}, 0, want{n: 3, complete: true}},
		{"result bound", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, (n-1)*50+1, 50, 1100, "")
		}, 0, want{n: repoResults, incomplete: IncompleteLimit}},
		{"page bound on a server that shortens pages", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, n, 1, 5000, "")
		}, 0, want{n: repoPages, incomplete: IncompleteLimit}},
		{"byte bound", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			big := strings.Repeat("x", 900<<10)
			_ = json.NewEncoder(w).Encode([]map[string]any{{"id": n, "name": "r", "full_name": "o/r", "owner": map[string]any{"id": 9, "login": "o"}, "clone_url": b.String() + "/o/r.git", "description": big}})
		}, 0, want{n: 10, incomplete: IncompleteLimit}},
		{"time bound mid-list", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			if n == 3 {
				<-r.Context().Done()
				return
			}
			repoPage(w, b, n*2-1, 2, -1, "")
		}, 500 * time.Millisecond, want{n: 4, incomplete: IncompleteInterrupted}},
		{"later server error", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			if n == 2 {
				w.WriteHeader(http.StatusBadGateway)
				return
			}
			repoPage(w, b, 1, 2, -1, "")
		}, 0, want{n: 2, incomplete: IncompleteInterrupted}},
		{"later login page", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			if n == 2 {
				w.Header().Set("Content-Type", "text/html")
				w.Write([]byte("<html>[]</html>"))
				return
			}
			repoPage(w, b, 1, 2, -1, "")
		}, 0, want{n: 2, incomplete: IncompleteInterrupted}},
		{"link back to an earlier page", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, n*2-1, 2, 10, link(b, 1))
		}, 0, want{n: 2, incomplete: IncompleteInconsistent}},
		{"link to another host", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, 1, 2, 10, "https://elsewhere.example/gitea/api/v1/user/repos?page=2")
		}, 0, want{n: 2, incomplete: IncompleteInconsistent}},
		{"link outside the base path", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, 1, 2, 10, strings.Replace(link(b, 2), "/gitea/", "/gitea2/", 1))
		}, 0, want{n: 2, incomplete: IncompleteInconsistent}},
		{"link with userinfo", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, 1, 2, 10, strings.Replace(link(b, 2), "https://", "https://u@", 1))
		}, 0, want{n: 2, incomplete: IncompleteInconsistent}},
		{"a repeated repository", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, min(n, 2), 2, -1, "")
		}, 0, want{n: 2, incomplete: IncompleteInconsistent}},
		{"a total that changes", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, n*2-1, 2, 4+n, "")
		}, 0, want{n: 4, incomplete: IncompleteInconsistent}},
		{"an empty page before the total", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, 1, min(2, 2*(2-n)), 5, "")
		}, 0, want{n: 2, incomplete: IncompleteInconsistent}},
		{"an empty page that links further", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			repoPage(w, b, 1, min(2, 2*(2-n)), -1, link(b, n+1))
		}, 0, want{n: 2, incomplete: IncompleteInconsistent}},
		{"rejected", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}, 0, want{err: ErrRejected}},
		{"missing scope", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusForbidden)
		}, 0, want{err: ErrScope}},
		// A PAT rotated or revoked while the list is read: the token cannot
		// list, whatever the first pages said.
		{"rejected on a later page", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			if n == 2 {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			repoPage(w, b, 1, 2, -1, "")
		}, 0, want{err: ErrRejected}},
		{"scope lost on a later page", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			if n == 2 {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			repoPage(w, b, 1, 2, -1, "")
		}, 0, want{err: ErrScope}},
		{"redirect on a later page", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			if n == 2 {
				http.Redirect(w, r, "https://elsewhere.example/", http.StatusFound)
				return
			}
			repoPage(w, b, 1, 2, -1, "")
		}, 0, want{err: ErrRedirect}},
		{"a login page instead of the API", func(b Base, n int, w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte("[]"))
		}, 0, want{err: ErrProtocol}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var b Base
			c, base := scriptedGitea(t, func(n int, w http.ResponseWriter, r *http.Request) { tc.page(b, n, w, r) })
			b = base
			ctx := context.Background()
			if tc.ctx > 0 {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, tc.ctx)
				defer cancel()
			}
			list, err := c.Repos(ctx, b, "tok")
			if err != tc.want.err {
				t.Fatalf("err = %v, want %v", err, tc.want.err)
			}
			if err != nil {
				return
			}
			if len(list.Repositories) != tc.want.n || list.Complete != tc.want.complete || list.Incomplete != tc.want.incomplete {
				t.Fatalf("list: %d repositories, complete %v, incomplete %q", len(list.Repositories), list.Complete, list.Incomplete)
			}
		})
	}
}
