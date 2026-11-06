//go:build linux

package integrations

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestMicrosoftRecoveryPendingSelectionSurvivesRestart(t *testing.T) {
	env, m := recoveryAccount(t, false)
	fail := filepath.Join(env.Home, "resync-fail")
	if err := os.WriteFile(fail, nil, 0600); err != nil {
		t.Fatal(err)
	}
	if err := m.recoverLibraries(context.Background(), env, "person@example.test"); err == nil {
		t.Fatal("expected failed first pass")
	}
	if err := os.Remove(fail); err != nil {
		t.Fatal(err)
	}
	// A fresh entry has no memory of the inferred choice. Only its native
	// config can carry the pending root across publication/first-pass failure.
	fresh := syntheticMicrosoft(t, "person@example.test", "")
	if err := fresh.recoverLibraries(context.Background(), env, "person@example.test"); err != nil {
		t.Fatal(err)
	}
	roots, err := microsoftRemotes(env, "person@example.test")
	if err != nil || len(roots) != 2 {
		t.Fatal(roots, err)
	}
	for _, r := range roots {
		if !microsoftReady(env, "person@example.test", r) {
			t.Fatal("lost pending library", r.Name)
		}
	}
}
