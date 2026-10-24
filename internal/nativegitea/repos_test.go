package nativegitea

import (
	"context"
	"testing"

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
