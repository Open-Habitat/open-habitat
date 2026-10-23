//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestDebVersionOrderingMatchesDpkg(t *testing.T) {
	versions := []string{"0", "00", "1", "1.0", "1.0-0", "1.0-1", "1.0~rc1", "1.0~~", "1.0+security1", "1.0a", "1.0A", "1.0001", "1.1", "1:0", "2:0", "10:0", "1:1.3.dfsg-3.1ubuntu2.2", "1:1.3.dfsg-3.1ubuntu2.3", "1.0-1ubuntu1", "1.0-1ubuntu1.1"}
	for _, a := range versions {
		for _, b := range versions {
			predicate := "eq"
			c := compareDebVersions(a, b)
			if c < 0 {
				predicate = "lt"
			}
			if c > 0 {
				predicate = "gt"
			}
			if err := exec.Command("/usr/bin/dpkg", "--compare-versions", a, predicate, b).Run(); err != nil {
				t.Fatalf("%q %s %q: %v", a, predicate, b, err)
			}
		}
	}
}

func TestUbuntuRequirementsMergeAndPlan(t *testing.T) {
	a, _ := releaseFixture(t)
	a.Packages = []RuntimePackage{{"git", "amd64", "2.0"}}
	b := a
	b.Profile, b.Archive = "extra", "extra.tar.gz"
	b.Packages = []RuntimePackage{{"git", "amd64", "2.1"}, {"data", "all", "1.0"}}
	r := authenticatedFixture(t, releaseManifest(a, b))
	for _, tc := range []struct {
		observed map[string]string
		names    []string
	}{
		{map[string]string{"git:amd64": "2.2", "data:all": "1.1"}, []string{}},
		{map[string]string{"git:amd64": "2.0"}, []string{"data", "git"}},
	} {
		missing, err := r.unmetUbuntuRequirements([]string{"extra"}, tc.observed)
		if err != nil {
			t.Fatal(err)
		}
		names := []string{}
		for _, p := range missing {
			names = append(names, p.Name)
		}
		if !reflect.DeepEqual(names, tc.names) {
			t.Fatalf("%v != %v", names, tc.names)
		}
	}
}

func TestUbuntuAptPlanAndRefusals(t *testing.T) {
	a, _ := releaseFixture(t)
	a.Packages = []RuntimePackage{{"git", "amd64", "2.0"}}
	r := authenticatedFixture(t, releaseManifest(a))
	for _, tc := range []struct {
		name, candidate string
		failure         error
		want            error
	}{
		{"newer", "2.1", nil, nil}, {"exact", "2.0", nil, nil},
		{"missing", "(none)", nil, ErrRuntimePackageSolve}, {"too old", "1.0", nil, ErrRuntimePackageSolve},
		{"query failed", "2.1", errors.New("query failure"), ErrRuntimePackageSolve},
	} {
		t.Run(tc.name, func(t *testing.T) {
			simulated := false
			run := func(ctx context.Context, budget time.Duration, path string, args ...string) ([]byte, error) {
				if path == "/usr/bin/apt-cache" {
					if !reflect.DeepEqual(args, []string{"policy", "git:amd64"}) {
						t.Fatal(args)
					}
					return []byte("git:\n  Candidate: " + tc.candidate + "\n"), tc.failure
				}
				if path != "/usr/bin/apt-get" || args[0] != "--simulate" {
					t.Fatal("plan mutated packages", path, args)
				}
				command := strings.Join(args, " ")
				for _, required := range []string{"--no-remove", "allow-Downgrades=false", "allow-Change-Held-Packages=false", "force-yes=false", "DPkg::Lock::Timeout=300", "APT::Cmd::Pattern-Only=true", "Dpkg::Options::=--force-confdef", "Dpkg::Options::=--force-confold", "AllowUnauthenticated=false", "install git:amd64"} {
					if !strings.Contains(command, required) {
						t.Fatal(command)
					}
				}
				simulated = true
				return nil, nil
			}
			err := transitionUbuntuPackages(context.Background(), nil, r, map[string]string{}, false, run)
			if tc.want == nil && (err != nil || !simulated) || tc.want != nil && !errors.Is(err, tc.want) {
				t.Fatalf("%v, simulated %v", err, simulated)
			}
		})
	}
	t.Run("solver refuses removal or held change", func(t *testing.T) {
		calls := 0
		run := func(context.Context, time.Duration, string, ...string) ([]byte, error) {
			calls++
			if calls == 1 {
				return []byte("git:\n  Candidate: 2.1\n"), nil
			}
			return nil, errors.New("solver refused")
		}
		err := transitionUbuntuPackages(context.Background(), nil, r, nil, true, run)
		if !errors.Is(err, ErrRuntimePackageSolve) || calls != 2 {
			t.Fatalf("%v %d", err, calls)
		}
	})
	t.Run("newer installed means no apt", func(t *testing.T) {
		err := transitionUbuntuPackages(context.Background(), nil, r, map[string]string{"git:amd64": "3"}, true, func(context.Context, time.Duration, string, ...string) ([]byte, error) {
			t.Fatal("unnecessary apt invocation")
			return nil, nil
		})
		if err != nil {
			t.Fatal(err)
		}
	})
}

func TestReleaseRejectsUbuntuPayload(t *testing.T) {
	for _, kind := range []string{"deb", "platform-deb"} {
		a, _ := closureFixture(t)
		a.Closure.Components[0].Kind = kind
		if validRuntimeClosure(a) {
			t.Fatal("accepted Ubuntu payload", kind)
		}
	}
}

// Only the disposable container runner sets this opt-in. Never use on a host.
func TestUbuntuNativeAptContainer(t *testing.T) {
	if os.Getenv("HOST_UBUNTU_APT_CONTAINER") != "1" {
		t.Skip("requires disposable Ubuntu apt container")
	}
	b, err := os.ReadFile("/etc/os-release")
	if err != nil || !strings.Contains(string(b), "Ubuntu") || os.Geteuid() != 0 {
		t.Fatal("requires root in disposable Ubuntu")
	}
	paths, err := filepath.Glob("/requirements/profiles/*/ubuntu-packages.json")
	if err != nil {
		t.Fatal(err)
	}
	paths = append([]string{"/requirements/core/ubuntu-packages.json"}, paths...)
	artifacts := []ReleaseArtifact{}
	profiles := []string{}
	for _, path := range paths {
		b, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		var declaration struct {
			Platform string           `json:"platform"`
			Packages []RuntimePackage `json:"packages"`
		}
		if err = json.Unmarshal(b, &declaration); err != nil || declaration.Platform != "ubuntu-24.04-amd64" {
			t.Fatal("invalid requirements", path, err)
		}
		a, _ := releaseFixture(t)
		a.Profile = filepath.Base(filepath.Dir(path))
		a.Archive = a.Profile + ".tar.gz"
		a.Packages = declaration.Packages
		artifacts = append(artifacts, a)
		profiles = append(profiles, a.Profile)
	}
	r := authenticatedFixture(t, releaseManifest(artifacts...))
	b, err = queryRuntimePackages(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	observed, err := parseRuntimePackages(b)
	if err != nil {
		t.Fatal(err)
	}
	if err = transitionUbuntuPackages(context.Background(), profiles, r, observed, false, nativeCommandTimeout); err != nil {
		t.Fatal(err)
	}
	if err = transitionUbuntuPackages(context.Background(), profiles, r, observed, true, nativeCommandTimeout); err != nil {
		t.Fatal(err)
	}
	if err = r.requireRuntimePackages(context.Background(), profiles, queryRuntimePackages); err != nil {
		t.Fatal(err)
	}
	t.Log("ALL_UBUNTU_REQUIREMENTS_PASS", len(artifacts), "profiles with Ubuntu requirements")
}

func TestUbuntuCandidateRequiresExactIdentity(t *testing.T) {
	p := RuntimePackage{"python3.12", "amd64", "1"}
	for _, tc := range []struct {
		policy string
		valid  bool
	}{
		{"python3.12:\n  Candidate: 3.12.3\n", true},
		{"python3.12:amd64:\n  Candidate: 3.12.3\n", true},
		{"python3012:\n  Candidate: 3.12.3\n", false},
		{"python3.12:\n  Candidate: 3.12.3\npython3012:\n  Candidate: 3.12.3\n", false},
		{"python3.12:\n  Candidate: (none)\n", false},
		{"python3.12:\n  Candidate: 3.12.3\n  Candidate: 3.12.4\n", false},
		{"", false},
	} {
		if _, ok := ubuntuCandidate([]byte(tc.policy), p); ok != tc.valid {
			t.Fatalf("accepted=%v %q", ok, tc.policy)
		}
	}
}
