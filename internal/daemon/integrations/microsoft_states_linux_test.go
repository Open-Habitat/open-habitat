//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// After the upgrade, roots an earlier release's folder step offered and
// nobody chose are no failure: the files row is the sign-in's, as agents
// reach those files by search. A root whose pass left anything of its own is
// an unfinished first sync, and one with both listings syncs.
func TestMicrosoftFilesNeverChosenAreReachedOnDemand(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := msLogin(t, m, env, "")
	address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	earlierRoots(t, m, env, address, LevelFull, earlierFullGrant)
	reply, _ := json.Marshal(map[string]any{"state": "ok", "scopes": strings.Fields(earlierFullGrant + " " + microsoftMCPScopes)})
	os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), reply, 0600)
	states := func() map[string]Service {
		out := map[string]Service{}
		for _, s := range m.Check(context.Background(), env, address) {
			out[s.ID] = s
		}
		return out
	}
	got := states()
	if s := got["onedrive"]; s.State != StateOK || s.Failure != "" || s.Access != AccessFull {
		t.Fatalf("onedrive %+v", s)
	}
	if _, ok := got["sharepoint"]; ok {
		t.Fatal("an unchosen library shown", got)
	}
	if dirs := m.Directories(env, address); len(dirs) != 0 {
		t.Fatal(dirs)
	}
	work := filepath.Join(env.Home, microsoftWork(address, "onedrive"))
	os.MkdirAll(work, 0700)
	os.WriteFile(filepath.Join(work, "x.path1.lst-new"), nil, 0600)
	if s := states()["onedrive"]; s.State != StateSyncFailed || s.Failure != InitialSyncIncomplete {
		t.Fatalf("started pass %+v", s)
	}
	for _, side := range []string{"path1", "path2"} {
		os.WriteFile(filepath.Join(work, "x."+side+".lst"), nil, 0600)
	}
	got = states()
	if got["onedrive"].State != StateOK || got["mail"].State != StateOK {
		t.Fatalf("%+v", got)
	}
	if _, ok := got["sharepoint"]; ok {
		t.Fatal("an unchosen library shown", got)
	}
	// A read grant names SharePoint's access; its row is the sign-in's too.
	reply, _ = json.Marshal(map[string]any{"state": "ok", "scopes": strings.Fields("User.Read Files.Read.All Sites.Read.All Mail.Read Calendars.Read Contacts.Read")})
	os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), reply, 0600)
	if s, ok := states()["sharepoint"]; !ok || s.State != StateOK || s.Access != AccessRead {
		t.Fatalf("read sharepoint %+v", s)
	}
}
