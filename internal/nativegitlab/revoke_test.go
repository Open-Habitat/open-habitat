package nativegitlab

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// RevokeSelf sends one DELETE of the token's own record with the token, and
// a token GitLab already refuses counts as ended.
func TestRevokeSelf(t *testing.T) {
	status := http.StatusNoContent
	var seen []string
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.Method+" "+r.URL.Path+" "+r.Header.Get("Private-Token"))
		w.WriteHeader(status)
	}))
	t.Cleanup(srv.Close)
	c := NewClientWithRoots(nil)
	c.roots = srv.Client().Transport.(*http.Transport).TLSClientConfig.RootCAs
	b := mustBase(t, srv.URL)
	if err := c.RevokeSelf(context.Background(), b, "glpat-ada-0001"); err != nil {
		t.Fatal(err)
	}
	if len(seen) != 1 || seen[0] != "DELETE /api/v4/personal_access_tokens/self glpat-ada-0001" {
		t.Fatal(seen)
	}
	status = http.StatusUnauthorized
	if err := c.RevokeSelf(context.Background(), b, "glpat-ada-0001"); err != nil {
		t.Fatal("refused token", err)
	}
	status = http.StatusInternalServerError
	if err := c.RevokeSelf(context.Background(), b, "glpat-ada-0001"); err != ErrProtocol {
		t.Fatal(err)
	}
	if err := c.RevokeSelf(context.Background(), b, ""); err != ErrInvalidToken {
		t.Fatal(err)
	}
}
