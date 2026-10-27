//go:build linux

package nativegitlab

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
	"github.com/Open-Habitat/open-habitat/internal/nativegitlab/gitlabfake"
)

func TestProjectsWalkKeysetPagesWithNestedPaths(t *testing.T) {
	f := newFixture(t)
	for i := int64(0); i < 5; i++ {
		if err := f.srv.AddProject(gitlabfake.Project{ID: 200 + i, Path: "konepaja/asiakkaat/kauppa-oy/p" + strconv.FormatInt(i, 10), Members: []int64{7}, NoStatistics: i == 2, Archived: i == 3}); err != nil {
			t.Fatal(err)
		}
	}
	if err := f.srv.AddProject(gitlabfake.Project{ID: 300, Path: "bob/private"}); err != nil {
		t.Fatal(err)
	}
	f.srv.SetPageSize(2)
	ctx := context.Background()
	account := Account{ID: 7, Username: "ada"}
	list, err := f.api.Projects(ctx, f.base, "glpat-ada-0001", account)
	if err != nil || !list.Complete || list.Elsewhere != 0 {
		t.Fatalf("%+v %v", list, err)
	}
	var names []string
	for _, p := range list.Projects {
		names = append(names, p.FullName)
	}
	if strings.Join(names, " ") != "ada/notes konepaja/verkkokauppa/infra/terraform konepaja/asiakkaat/kauppa-oy/p0 konepaja/asiakkaat/kauppa-oy/p1 konepaja/asiakkaat/kauppa-oy/p2 konepaja/asiakkaat/kauppa-oy/p3 konepaja/asiakkaat/kauppa-oy/p4" {
		t.Fatal(names)
	}
	own, group := list.Projects[0], list.Projects[1]
	if !own.Personal || !own.Own || group.Personal || group.Own || group.Visibility != "internal" || own.SizeKiB != 24 || list.Projects[4].SizeKiB != -1 || !list.Projects[5].Archived {
		t.Fatalf("%+v %+v", own, group)
	}
	if own.CloneURL(f.base) != f.srv.URL+"/ada/notes.git" {
		t.Fatal(own.CloneURL(f.base))
	}
	// Every page was asked for by the last id seen, under the base.
	pages := 0
	for _, p := range f.srv.APIPaths() {
		if strings.HasPrefix(p, "/api/v4/projects?") {
			pages++
			if !strings.Contains(p, "membership=true") || !strings.Contains(p, "pagination=keyset") {
				t.Errorf("page %s", p)
			}
		}
	}
	if pages != 4 {
		t.Fatalf("%d pages: %v", pages, f.srv.APIPaths())
	}
	p, err := f.api.Project(ctx, f.base, "glpat-ada-0001", account, 102)
	if err != nil || p.FullName != "konepaja/verkkokauppa/infra/terraform" {
		t.Fatal(p, err)
	}
	if _, err := f.api.Project(ctx, f.base, "glpat-ada-0001", account, 300); err != ErrNotFound {
		t.Fatal("another person's project:", err)
	}
}

// A project whose clone address GitLab gives outside the connected base (a
// wrong external_url) is never listed, so the token is never sent there;
// it is counted with the address's server so the person can say what to fix.
func TestProjectsElsewhereAreCountedNotListed(t *testing.T) {
	f := newFixture(t)
	f.srv.SetHTTPURL(101, "http://gitlab.internal:8080/ada/notes.git")
	list, err := f.api.Projects(context.Background(), f.base, "glpat-ada-0001", Account{ID: 7, Username: "ada"})
	if err != nil || !list.Complete || list.Elsewhere != 1 || list.ElsewhereOrigin != "http://gitlab.internal:8080" || len(list.Projects) != 1 {
		t.Fatalf("%+v %v", list, err)
	}
	if _, err := f.api.Project(context.Background(), f.base, "glpat-ada-0001", Account{ID: 7, Username: "ada"}, 101); err != ErrProtocol {
		t.Fatal(err)
	}
}

// pageServer answers the project list with fixed pages: body by id_after.
func pageServer(t *testing.T, pages map[string]string, link func(r *http.Request, after string) string) (*Client, Base) {
	t.Helper()
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		after := r.URL.Query().Get("id_after")
		body, ok := pages[after]
		if !ok {
			w.WriteHeader(500)
			return
		}
		if l := link(r, after); l != "" {
			w.Header().Set("Link", l)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	c := NewClientWithRoots(nil)
	c.roots = srv.Client().Transport.(*http.Transport).TLSClientConfig.RootCAs
	return c, mustBase(t, srv.URL)
}

func project(b Base, id int, path string) string {
	ns := path[:strings.LastIndexByte(path, '/')]
	v, _ := json.Marshal(map[string]any{"id": id, "path": path[strings.LastIndexByte(path, '/')+1:], "path_with_namespace": path, "namespace": map[string]any{"full_path": ns, "kind": "group"}, "visibility": "private", "http_url_to_repo": b.String() + "/" + path + ".git"})
	return string(v)
}

func TestProjectsPageConsistency(t *testing.T) {
	ctx := context.Background()
	account := Account{ID: 7, Username: "ada"}
	var base Base
	next := func(r *http.Request, after string) string { return "" }
	pages := map[string]string{}
	c, b := pageServer(t, pages, func(r *http.Request, after string) string { return next(r, after) })
	base = b
	self := func(after string) string {
		return "<" + base.String() + "/api/v4/projects?id_after=" + after + "&membership=true&pagination=keyset>; rel=\"next\""
	}
	pages[""] = "[" + project(base, 1, "g/a") + "," + project(base, 2, "g/sub/b") + "]"
	pages["2"] = "[" + project(base, 3, "g/c") + "]"
	next = func(r *http.Request, after string) string {
		if after == "" {
			return self("2")
		}
		return ""
	}
	if list, err := c.Projects(ctx, base, "tok", account); err != nil || !list.Complete || len(list.Projects) != 3 {
		t.Fatalf("%+v %v", list, err)
	}
	for name, tc := range map[string]struct {
		pages map[string]string
		next  func(*http.Request, string) string
		why   nativeforge.Incomplete
	}{
		"repeated id": {map[string]string{"": "[" + project(base, 1, "g/a") + "]", "1": "[" + project(base, 1, "g/a") + "]"}, func(r *http.Request, a string) string {
			if a == "" {
				return self("1")
			}
			return ""
		}, nativeforge.IncompleteInconsistent},
		"link elsewhere": {map[string]string{"": "[" + project(base, 1, "g/a") + "]"}, func(r *http.Request, a string) string {
			return "<https://evil.example/api/v4/projects?id_after=1>; rel=\"next\""
		}, nativeforge.IncompleteInconsistent},
		"later page fails": {map[string]string{"": "[" + project(base, 1, "g/a") + "]"}, func(r *http.Request, a string) string { return self("1") }, nativeforge.IncompleteInterrupted},
		"malformed project": {map[string]string{"": "[" + project(base, 1, "g/a") + `,{"id":2,"path":"x","path_with_namespace":"../x","namespace":{"full_path":"..","kind":"group"},"visibility":"private"}]`}, func(r *http.Request, a string) string { return "" }, nativeforge.IncompleteInconsistent},
	} {
		for k := range pages {
			delete(pages, k)
		}
		for k, v := range tc.pages {
			pages[k] = v
		}
		next = tc.next
		list, err := c.Projects(ctx, base, "tok", account)
		if err != nil || list.Complete || list.Incomplete != tc.why || len(list.Projects) != 1 {
			t.Errorf("%s: %+v %v", name, list, err)
		}
	}
}
