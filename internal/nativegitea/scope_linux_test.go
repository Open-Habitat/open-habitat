//go:build linux

package nativegitea

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/nativegitea/giteafake"
)

// A connection needs both scopes the connector reads with. Gitea shows a
// token none of its scopes, so only the reads themselves can tell: a PAT
// lacking either is refused before tea's file holds it, and a replacement
// lacking either leaves the previous bytes in place.
func TestConnectAndReplaceNeedBothReadScopes(t *testing.T) {
	srv, err := giteafake.Start(t.TempDir(), []giteafake.Account{
		{ID: 7, Login: "ada", Token: "tok-ada"},
		{ID: 8, Login: "bob", Token: "tok-bob-user", Scopes: []string{"read:user"}},
		{ID: 9, Login: "cy", Token: "tok-cy-repo", Scopes: []string{"read:repository"}},
		{ID: 10, Login: "dee", Token: "tok-dee-write", Scopes: []string{"read:user", "write:repository"}},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(srv.Close)
	b, err := ParseBase(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	c := NewClientWithRoots(srv.Roots)
	ctx := context.Background()

	// Verify: both reads, and an account with no repositories is fine.
	if a, err := c.Verify(ctx, b, "tok-ada"); err != nil || a != (Account{ID: 7, Login: "ada"}) {
		t.Fatalf("verify: %+v %v", a, err)
	}
	for tok, want := range map[string]error{"tok-bob-user": ErrScope, "tok-cy-repo": ErrScope, "wrong": ErrRejected} {
		if _, err := c.Verify(ctx, b, tok); err != want {
			t.Errorf("verify %s: %v, want %v", tok, err, want)
		}
	}
	// User alone still answers for a read:user-only PAT: that is the gap
	// Verify closes.
	if _, err := c.User(ctx, b, "tok-bob-user"); err != nil {
		t.Fatalf("user: %v", err)
	}

	s, home := newStore(t)
	tea := filepath.Join(home, ".config", "tea", "config.yml")
	for _, tok := range []string{"tok-bob-user", "tok-cy-repo"} {
		if _, _, err := s.Connect(ctx, c, b, tok); err != ErrScope {
			t.Fatalf("connect %s: %v", tok, err)
		}
		if _, err := os.Stat(tea); !os.IsNotExist(err) {
			t.Fatalf("connect %s wrote tea's file: %v", tok, err)
		}
	}
	// A write scope covers the read; the connector cannot see it beyond that.
	if _, out, err := s.Connect(ctx, c, b, "tok-dee-write"); err != nil || out != Written {
		t.Fatalf("connect write-scoped: %s %v", out, err)
	}
	l, out, err := s.Connect(ctx, c, b, "tok-ada")
	if err != nil || out != Written {
		t.Fatalf("connect: %s %v", out, err)
	}

	before, _ := os.ReadFile(tea)
	srv.SetToken(7, "tok-ada-2")
	srv.SetScopes(7, []string{"read:user"})
	if _, _, err := s.Replace(ctx, c, l.Target(), "tok-ada-2"); err != ErrScope {
		t.Fatalf("replace without read:repository: %v", err)
	}
	srv.SetScopes(7, []string{"read:repository"})
	if _, _, err := s.Replace(ctx, c, l.Target(), "tok-ada-2"); err != ErrScope {
		t.Fatalf("replace without read:user: %v", err)
	}
	if after, _ := os.ReadFile(tea); !bytes.Equal(before, after) {
		t.Fatal("a refused replacement changed tea's file")
	}
	srv.SetScopes(7, nil)
	if _, out, err := s.Replace(ctx, c, l.Target(), "tok-ada-2"); err != nil || out != Written {
		t.Fatalf("replace: %s %v", out, err)
	}
}
