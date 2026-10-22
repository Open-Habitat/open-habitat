//go:build linux

package host

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReleasePackageObservation(t *testing.T) {
	core, _ := releaseFixture(t)
	core.Packages = []RuntimePackage{{"git", "amd64", "1:2.43.0-1ubuntu7.3"}}
	optional := core
	optional.Profile, optional.Archive = "editor", "editor.tar.gz"
	optional.Packages = []RuntimePackage{{"editor-data", "all", "4.0.0"}}
	r := authenticatedFixture(t, releaseManifest(core, optional))
	good := "git\tamd64\t1:2.43.0-1ubuntu7.3\tinstall ok installed\n"
	for _, tc := range []struct {
		name, data, status, reason string
		queryErr                   error
		profiles                   []string
	}{
		{name: "exact", data: good, status: "pass", reason: "runtime_packages_match"},
		{name: "held", data: strings.Replace(good, "install ok", "hold ok", 1), status: "pass", reason: "runtime_packages_match"},
		{name: "security update", data: strings.Replace(good, "ubuntu7.3", "ubuntu7.4", 1), status: "fail", reason: "runtime_package_drift"},
		{name: "missing", data: "", status: "fail", reason: "runtime_package_drift"},
		{name: "wrong architecture", data: strings.Replace(good, "amd64", "arm64", 1), status: "fail", reason: "runtime_package_drift"},
		{name: "residual", data: strings.Replace(good, "install ok installed", "deinstall ok config-files", 1), status: "fail", reason: "runtime_package_drift"},
		{name: "broken", data: strings.Replace(good, "install ok installed", "install reinstreq installed", 1), status: "fail", reason: "runtime_package_drift"},
		{name: "unconfigured", data: strings.Replace(good, "ok installed", "ok unpacked", 1), status: "fail", reason: "runtime_package_drift"},
		{name: "selected absent", data: good, profiles: []string{"editor"}, status: "fail", reason: "runtime_package_drift"},
		{name: "selected exact", data: good + "editor-data\tall\t4.0.0\tinstall ok installed\n", profiles: []string{"editor"}, status: "pass", reason: "runtime_packages_match"},
		{name: "command error with partial stdout", data: good, status: "unavailable", reason: "runtime_package_observation_required", queryErr: errors.New("sensitive-native-text")},
		{name: "truncated", data: strings.TrimSuffix(good, "\n"), status: "unavailable", reason: "runtime_package_observation_required"},
		{name: "duplicate", data: good + good, status: "unavailable", reason: "runtime_package_observation_required"},
		{name: "unknown status", data: strings.Replace(good, "installed", "surprise", 1), status: "unavailable", reason: "runtime_package_observation_required"},
		{name: "malformed unrelated record", data: good + "corrupt\n", status: "unavailable", reason: "runtime_package_observation_required"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			check, err := r.observeRuntimePackages(context.Background(), tc.profiles, func(context.Context) ([]byte, error) { return []byte(tc.data), tc.queryErr })
			if err != nil || check.Status != tc.status || check.Reason != tc.reason {
				t.Fatalf("%+v %v", check, err)
			}
		})
	}
	calls := 0
	query := func(context.Context) ([]byte, error) { calls++; return []byte(good), nil }
	if _, err := (AuthenticatedRelease{}).observeRuntimePackages(context.Background(), nil, query); !errors.Is(err, ErrReleaseSignature) {
		t.Fatal(err)
	}
	if _, err := r.observeRuntimePackages(context.Background(), []string{"absent"}, query); !errors.Is(err, ErrReleaseProfile) {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := r.observeRuntimePackages(ctx, nil, query); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	empty, _ := releaseFixture(t)
	check, err := authenticatedFixture(t, releaseManifest(empty)).observeRuntimePackages(context.Background(), nil, query)
	if err != nil || check.Status != "unavailable" || check.Reason != "runtime_package_lock_required" || calls != 0 {
		t.Fatalf("%+v %v calls %d", check, err, calls)
	}
	ctx, cancel = context.WithCancel(context.Background())
	_, err = r.observeRuntimePackages(ctx, nil, func(context.Context) ([]byte, error) { cancel(); return []byte(good), nil })
	if !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}

func TestReleasePackageOutputBound(t *testing.T) {
	b := &packageOutput{}
	// io.Copy must not bypass the writer limit through a promoted ReadFrom.
	n, err := io.Copy(b, io.LimitReader(zeroPackageReader{}, maxPackageObservationBytes+1))
	if err == nil || n > maxPackageObservationBytes || b.data.Len() > maxPackageObservationBytes {
		t.Fatalf("%d %d %v", n, b.data.Len(), err)
	}
	if _, err := parseRuntimePackages(bytes.Repeat([]byte{'x'}, maxPackageObservationBytes+1)); err == nil {
		t.Fatal("unbounded parser")
	}
}

type zeroPackageReader struct{}

func (zeroPackageReader) Read(p []byte) (int, error) { clear(p); return len(p), nil }

func TestReleaseNativePackageQuery(t *testing.T) {
	if _, err := os.Stat("/usr/bin/dpkg-query"); os.IsNotExist(err) {
		t.Skip("requires native dpkg-query")
	}
	// A caller-selected alternate database/PATH must never qualify the host.
	fake := t.TempDir()
	t.Setenv("DPKG_ADMINDIR", fake)
	t.Setenv("DPKG_ROOT", fake)
	t.Setenv("PATH", fake)
	if err := os.WriteFile(filepath.Join(fake, "dpkg-query"), []byte("#!/bin/sh\nprintf 'fake-package\\tall\\t1\\tinstall ok installed\\n'\n"), 0700); err != nil {
		t.Fatal(err)
	}
	output, err := queryRuntimePackages(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	observed, err := parseRuntimePackages(output)
	if err != nil || observed["dpkg:amd64"] == "" || observed["fake-package:all"] != "" {
		t.Fatalf("native observation failed: %v", err)
	}
	a, _ := releaseFixture(t)
	a.Packages = []RuntimePackage{{"dpkg", "amd64", observed["dpkg:amd64"]}}
	r := authenticatedFixture(t, releaseManifest(a))
	check, err := r.ObserveRuntimePackages(context.Background(), nil)
	if err != nil || check.Status != "pass" {
		t.Fatalf("%+v %v", check, err)
	}
	a.Packages[0].Version = "0.0.0-test"
	check, err = authenticatedFixture(t, releaseManifest(a)).ObserveRuntimePackages(context.Background(), nil)
	if err != nil || check.Reason != "runtime_package_drift" {
		t.Fatalf("%+v %v", check, err)
	}
}
