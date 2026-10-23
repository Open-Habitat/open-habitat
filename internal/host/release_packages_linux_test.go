//go:build linux

package host

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"
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
		{name: "empty database", data: "", status: "unavailable", reason: "runtime_package_observation_required"},
		{name: "missing", data: "unrelated\tall\t1\tinstall ok installed\n", status: "fail", reason: "runtime_package_drift"},
		{name: "non-policy unrelated version", data: good + "unrelated\tall\tv1.2.3\tinstall ok installed\n", status: "pass", reason: "runtime_packages_match"},
		{name: "arch-less unrelated record", data: good + "unrelated\t\t\tunknown ok not-installed\n", status: "pass", reason: "runtime_packages_match"},
		{name: "arch-less locked name", data: strings.Replace(good, "\tamd64\t", "\t\t", 1), status: "fail", reason: "runtime_package_drift"},
		{name: "non-policy locked version", data: strings.Replace(good, "1:2.43.0-1ubuntu7.3", "v1.2.3", 1), status: "fail", reason: "runtime_package_drift"},
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
	if runtime.GOARCH != "amd64" {
		t.Skip("native Ubuntu runtime target is amd64")
	}
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

func TestReleaseNativePackageDatabaseAvailability(t *testing.T) {
	if _, err := os.Stat("/usr/bin/dpkg-query"); os.IsNotExist(err) {
		t.Skip("requires native dpkg-query")
	}
	const stanza = "Package: synthetic-expectation\nStatus: install ok installed\nVersion: 1.2.3\nArchitecture: amd64\nMaintainer: Synthetic <test@example.org>\nDescription: synthetic\n\n"
	a, _ := releaseFixture(t)
	a.Packages = []RuntimePackage{{"synthetic-expectation", "amd64", "1.2.3"}}
	r := authenticatedFixture(t, releaseManifest(a))
	for _, kind := range []string{"missing", "empty", "missing-with-update", "empty-with-update", "symlink", "fifo", "directory", "valid-with-update"} {
		t.Run(kind, func(t *testing.T) {
			admin := t.TempDir()
			status := filepath.Join(admin, "status")
			switch kind {
			case "empty", "empty-with-update":
				if err := os.WriteFile(status, nil, 0600); err != nil {
					t.Fatal(err)
				}
			case "valid-with-update":
				if err := os.WriteFile(status, []byte(strings.ReplaceAll(stanza, "synthetic-expectation", "unrelated-base")), 0600); err != nil {
					t.Fatal(err)
				}
			case "symlink":
				if err := os.WriteFile(filepath.Join(admin, "elsewhere"), []byte(stanza), 0600); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink("elsewhere", status); err != nil {
					t.Fatal(err)
				}
			case "fifo":
				if err := unix.Mkfifo(status, 0600); err != nil {
					t.Fatal(err)
				}
			case "directory":
				if err := os.Mkdir(status, 0700); err != nil {
					t.Fatal(err)
				}
			}
			if strings.Contains(kind, "with-update") {
				if err := os.Mkdir(filepath.Join(admin, "updates"), 0700); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(admin, "updates", "0000"), []byte(stanza), 0600); err != nil {
					t.Fatal(err)
				}
			}
			check, err := r.observeRuntimePackages(context.Background(), nil, func(ctx context.Context) ([]byte, error) { return queryRuntimePackagesAt(ctx, admin) })
			want := "unavailable"
			if kind == "valid-with-update" {
				want = "pass"
			}
			if err != nil || check.Status != want {
				t.Fatalf("%+v %v", check, err)
			}
		})
	}
	// A concurrent normal dpkg atomic replacement, even with identical bytes,
	// cannot pass the before/after database identity check.
	dir := t.TempDir()
	status := filepath.Join(dir, "status")
	if err := os.WriteFile(status, []byte(stanza), 0600); err != nil {
		t.Fatal(err)
	}
	before, err := packageDatabaseStat(status)
	if err != nil {
		t.Fatal(err)
	}
	replacement := filepath.Join(dir, "replacement")
	if err := os.WriteFile(replacement, []byte(stanza), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(replacement, status); err != nil {
		t.Fatal(err)
	}
	after, err := packageDatabaseStat(status)
	if err != nil || samePackageDatabase(before, after) {
		t.Fatal("accepted replaced base database", err)
	}
}

func TestReleaseNativePackageQueryPreservesCancellation(t *testing.T) {
	admin := t.TempDir()
	// Reach command execution with a valid base, without touching the host DB.
	if err := os.WriteFile(filepath.Join(admin, "status"), []byte("Package: synthetic\nStatus: install ok installed\nVersion: 1\nArchitecture: all\nDescription: synthetic\n"), 0600); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := queryRuntimePackagesAt(ctx, admin)
	if !errors.Is(err, context.Canceled) || !errors.Is(err, ErrRuntimePackageObservation) {
		t.Fatalf("lost cancellation: %v", err)
	}
}

func TestReleasePostInstallObservationClassification(t *testing.T) {
	core, _ := releaseFixture(t)
	core.Packages = []RuntimePackage{{"git", "amd64", "1"}}
	r := authenticatedFixture(t, releaseManifest(core))
	good := "git\tamd64\t1\tinstall ok installed\n"
	for _, tc := range []struct {
		name     string
		data     string
		queryErr error
		want     error
	}{
		{"exact", good, nil, nil},
		{"unavailable", good, errors.New("native read failure"), ErrRuntimePackageObservation},
		{"child deadline", good, context.DeadlineExceeded, ErrRuntimePackageObservation},
		{"malformed", "invalid", nil, ErrRuntimePackageObservation},
		{"drift", strings.Replace(good, "\t1\t", "\t2\t", 1), nil, ErrReleaseTarget},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := r.requireRuntimePackages(context.Background(), nil, func(context.Context) ([]byte, error) { return []byte(tc.data), tc.queryErr })
			if (tc.want == nil && err != nil) || (tc.want != nil && !errors.Is(err, tc.want)) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
	ctx, cancel := context.WithCancel(context.Background())
	err := r.requireRuntimePackages(ctx, nil, func(context.Context) ([]byte, error) {
		cancel()
		return []byte(good), nil
	})
	if !errors.Is(err, context.Canceled) || !errors.Is(err, ErrRuntimePackageObservation) {
		t.Fatalf("lost parent cancellation: %v", err)
	}
	ctx, cancel = context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	err = r.requireRuntimePackages(ctx, nil, func(context.Context) ([]byte, error) { t.Fatal("query after deadline"); return nil, nil })
	if !errors.Is(err, context.DeadlineExceeded) || !errors.Is(err, ErrRuntimePackageObservation) {
		t.Fatalf("lost parent deadline: %v", err)
	}
}
