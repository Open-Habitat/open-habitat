//go:build linux

package integrations

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNativeFileChoicesDoNotEnumerateAndMeasureOnlyApprovedRoots(t *testing.T) {
	for _, provider := range []string{"dropbox", "google"} {
		t.Run(provider, func(t *testing.T) {
			env := dropboxEnv(t)
			address := "person@example.test"
			dir, config, id := dropboxDir, "[dropbox]\ntype = dropbox\n", "all"
			var entry interface {
				Folders(context.Context, Env, string) ([]Folder, error)
				MeasureFolders(context.Context, Env, string, []string) (uint64, error)
			} = &dropbox{}
			if provider == "google" {
				dir = googleDir
				config = "[google]\ntype = drive\n"
				entry = &google{}
			}
			if err := os.MkdirAll(filepath.Join(env.Home, dir), 0700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(env.Home, dir, address+".conf"), []byte(config), 0600); err != nil {
				t.Fatal(err)
			}
			tool := filepath.Join(env.Home, "rclone")
			if err := os.WriteFile(tool, []byte("#!/bin/sh\nset -eu\n[ \"$3\" = size ]\nprintf '%s\\n' \"$4\" >> \"$HOME/measured\"\necho '{\"count\":500000,\"bytes\":5000000000}'\n"), 0700); err != nil {
				t.Fatal(err)
			}
			env.Config.Tools["rclone"] = tool
			folders, err := entry.Folders(context.Background(), env, address)
			if err != nil || len(folders) == 0 {
				t.Fatal(folders, err)
			}
			for _, f := range folders {
				if !f.UnknownSize {
					t.Fatal("pre-choice recursive size", f)
				}
			}
			if _, err := os.Stat(filepath.Join(env.Home, "measured")); !os.IsNotExist(err) {
				t.Fatal("choice invoked native recursion")
			}
			bytes, err := entry.MeasureFolders(context.Background(), env, address, []string{id})
			if err != nil || bytes != 5000000000 {
				t.Fatal(bytes, err)
			}
			measured, err := os.ReadFile(filepath.Join(env.Home, "measured"))
			remote := provider
			if err != nil || string(measured) != remote+":\n" {
				t.Fatal("unselected roots measured", string(measured), err)
			}
		})
	}
}

func TestInventoryUnknownMalformedAndUnsafeTotalsRefuse(t *testing.T) {
	env := Env{Home: newHome(t)}
	for _, raw := range []string{`{}`, `{"bytes":null}`, `{"bytes":-1}`, `{"bytes":9007199254740992}`, `{"bytes":"secret"}`, `not json`} {
		if _, err := env.measureSize(context.Background(), Command{Path: "/bin/echo", Args: []string{raw}}, "dropbox"); err == nil {
			t.Fatal("unsafe inventory accepted", raw)
		}
	}
	// Zero is valid only when the native result explicitly supplied it.
	if n, err := env.measureSize(context.Background(), Command{Path: "/bin/echo", Args: []string{`{"bytes":0}`}}, "dropbox"); err != nil || n != 0 {
		t.Fatal(n, err)
	}
	if _, err := env.measureSize(context.Background(), Command{Path: "/bin/echo", Args: []string{strings.Repeat("x", 70<<10)}}, "dropbox"); err == nil {
		t.Fatal("oversize inventory accepted")
	}
}
