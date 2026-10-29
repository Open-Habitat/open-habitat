//go:build linux

package daemon

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func restingMessage(id, parent, role string, at time.Time) string {
	p := "null"
	if parent != "" {
		p = fmt.Sprintf("%q", parent)
	}
	return fmt.Sprintf(`{"type":"message","id":%q,"parentId":%s,"timestamp":%q,"message":{"role":%q,"content":[{"type":"text","text":"x"}]}}`, id, p, at.UTC().Format(time.RFC3339Nano), role)
}

func restingRecapEntry(id, parent, through string) string {
	return fmt.Sprintf(`{"type":"custom","customType":"conversation-recap","id":%q,"parentId":%q,"timestamp":"2026-10-28T05:40:00.000Z","data":{"recap":"Done.","next":"Check","through":%q,"generatedAt":1761630000000,"trigger":"automatic"}}`, id, parent, through)
}

// A restart loses the in-memory timer of an automatic recap; the daemon
// derives from native history alone which recaps are still owed (Jari
// 28.10.2026: a turn ended 05:36:45 and no recap came after restarts).
func TestOwedRecapsComeFromNativeHistory(t *testing.T) {
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "work")
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	ended := now.Add(-34 * time.Minute)
	browser := func(id string) {
		t.Helper()
		owner, err := acquirePiOwnership(home, id)
		if err != nil {
			t.Fatal(err)
		}
		defer owner.release()
		if err := owner.markBrowser("ws_example123", cwd); err != nil {
			t.Fatal(err)
		}
	}
	turn := []string{restingMessage("u1", "", "user", ended.Add(-time.Minute)), restingMessage("a1", "u1", "assistant", ended)}
	owed := "11111111-1111-4111-8111-111111111111"
	writeSession(t, home, owed, cwd, turn...)
	browser(owed)
	recapped := "22222222-2222-4222-8222-222222222222"
	writeSession(t, home, recapped, cwd, append(turn, restingRecapEntry("r1", "a1", "a1"))...)
	browser(recapped)
	// A recap of an earlier message does not cover the newest turn.
	stale := "33333333-3333-4333-8333-333333333333"
	writeSession(t, home, stale, cwd, append(turn, restingRecapEntry("r1", "a1", "a1"), restingMessage("u2", "r1", "user", ended), restingMessage("a2", "u2", "assistant", ended))...)
	browser(stale)
	terminal := "44444444-4444-4444-8444-444444444444"
	writeSession(t, home, terminal, cwd, turn...)
	// A turn cut off before the agent answered is the rest card's, not a recap's.
	unanswered := "55555555-5555-4555-8555-555555555555"
	writeSession(t, home, unanswered, cwd, turn[0])
	browser(unanswered)
	old := "66666666-6666-4666-8666-666666666666"
	writeSession(t, home, old, cwd, restingMessage("u1", "", "user", now.Add(-26*time.Hour)), restingMessage("a1", "u1", "assistant", now.Add(-25*time.Hour)))
	browser(old)

	c := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	got := c.owedRecaps(now, 3*time.Minute)
	ids := map[string]bool{}
	for _, o := range got {
		ids[o.id] = true
		// Both turns ended at the same instant; the recap is due its delay later.
		if !o.due.Equal(ended.Add(3 * time.Minute)) {
			t.Fatalf("due %v, want %v", o.due, ended.Add(3*time.Minute))
		}
	}
	if len(got) != 2 || !ids[owed] || !ids[stale] {
		t.Fatalf("owed recaps = %+v", got)
	}

	// The person's first automatic recap waits for more completed turns.
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "settings.json"), []byte(`{"openHabitat":{"recap":{"firstAfterTurns":2}}}`), 0600); err != nil {
		t.Fatal(err)
	}
	if got := c.owedRecaps(now, 3*time.Minute); len(got) != 1 || got[0].id != stale {
		t.Fatalf("with two turns first: %+v", got)
	}
}

// The backward turn count agrees with recap-extension.mjs's forward one.
func TestScanNativeRecapCountsCompletedTurns(t *testing.T) {
	home := t.TempDir()
	at := time.Date(2026, 10, 28, 5, 36, 45, 0, time.UTC)
	id := "11111111-1111-4111-8111-111111111111"
	path := writeSession(t, home, id, "/work",
		restingMessage("u1", "", "user", at),
		restingMessage("u2", "u1", "user", at),
		restingMessage("a1", "u2", "assistant", at),
		restingMessage("a2", "a1", "assistant", at),
		restingMessage("u3", "a2", "user", at),
		restingMessage("a3", "u3", "assistant", at),
		restingMessage("u4", "a3", "user", at))
	scan, ok := scanNativeRecap(path, os.Geteuid(), id, "/work", true)
	if !ok || scan.turns != 2 || scan.latest.ID != "u4" || scan.latestKind != "user" {
		t.Fatalf("scan = %+v %v", scan, ok)
	}
}
