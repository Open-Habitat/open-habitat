//go:build linux

package provision

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/unix"
)

func TestActivationRequiresCommittedAdmission(t *testing.T) {
	for _, tc := range []struct{ name, file, body string }{
		{"committed", "", ""},
		{"pending", "pending.json", "{}"},
		{"staging", "allowlist.json.next", "{}"},
		{"revoked", "allowlist.json", `{"version":1,"epoch":2,"ids":[]}`},
		{"rollback", "head.json", `{"version":1,"epoch":2,"generation":3}`},
		{"out_of_pool", "bindings.json", `{"version":1,"generation":2,"bindings":[{"id":"123","uid":40000,"username":"person"}]}`},
		{"foreign_name", "bindings.json", `{"version":1,"generation":2,"bindings":[{"id":"123","uid":32000,"username":"stranger"}]}`},
		{"duplicate_uid", "bindings.json", `{"version":1,"generation":2,"bindings":[{"id":"123","uid":32000,"username":"person"},{"id":"456","uid":32000,"username":"stranger"}]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root, owner, p := installFixture(t)
			if _, err := initializeBroker(context.Background(), root, "broker", p, []string{"123"}, owner, nil); err != nil {
				t.Fatal(err)
			}
			dir := filepath.Join(root, "broker")
			for name, body := range map[string]string{"bindings.json": `{"version":1,"generation":2,"bindings":[{"id":"123","uid":32000,"username":"person"}]}`, "head.json": `{"version":1,"epoch":1,"generation":2}`} {
				if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0600); err != nil {
					t.Fatal(err)
				}
			}
			if tc.file != "" {
				if err := os.WriteFile(filepath.Join(dir, tc.file), []byte(tc.body), 0600); err != nil {
					t.Fatal(err)
				}
			}
			before := map[string]string{}
			entries, err := os.ReadDir(dir)
			if err != nil {
				t.Fatal(err)
			}
			for _, entry := range entries {
				b, err := os.ReadFile(filepath.Join(dir, entry.Name()))
				if err != nil {
					t.Fatal(err)
				}
				before[entry.Name()] = string(b)
			}
			fd, err := lockedDir(context.Background(), dir, owner)
			if err != nil {
				t.Fatal(err)
			}
			defer unix.Close(fd)
			defer unix.Flock(fd, unix.LOCK_UN)
			_, i, err := activationAt(context.Background(), fd, owner, "person")
			if tc.name == "committed" {
				if err != nil || i.username != "person" || i.uid != 32000 || i.id != "123" {
					t.Fatal(i, err)
				}
			} else if err == nil {
				t.Fatal("uncommitted/foreign identity accepted", i)
			}
			for name, body := range before {
				b, err := os.ReadFile(filepath.Join(dir, name))
				if err != nil || string(b) != body {
					t.Fatal("gate selection wrote state", name, err)
				}
			}
		})
	}
}
