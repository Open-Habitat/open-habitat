//go:build linux

package host

import (
	"bytes"
	"errors"
	"testing"
)

func TestReleaseVerificationContractAuthentication(t *testing.T) {
	a, _ := releaseFixture(t)
	m := releaseManifest(a)
	m.VerificationContract = RuntimeVerificationContract
	b, err := EncodeRelease(m)
	if err != nil {
		t.Fatal(err)
	}
	target := Release{m.Version, releaseDigest(b)}
	r, err := AuthenticateRelease(b, target)
	if err != nil || r.manifest.VerificationContract != RuntimeVerificationContract {
		t.Fatalf("contract round trip: %v", err)
	}
	changed := bytes.Replace(b, []byte(RuntimeVerificationContract), []byte("runtime-release-v999"), 1)
	if _, err := AuthenticateRelease(changed, target); !errors.Is(err, ErrReleaseTarget) {
		t.Fatalf("contract changed without new pin: %v", err)
	}
	// A declaration never chooses this binary's checks. Unknown declarations
	// and manifests from before the field existed remain verifiable.
	for _, id := range []string{"", "runtime-release-v999"} {
		m.VerificationContract = id
		b, err := EncodeRelease(m)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := AuthenticateRelease(b, Release{m.Version, releaseDigest(b)}); err != nil {
			t.Fatalf("metadata %q changed acceptance: %v", id, err)
		}
	}
	for _, value := range []string{`null`, `""`, `42`, `"bad id"`} {
		bad := bytes.Replace(changed, []byte(`"runtime-release-v999"`), []byte(value), 1)
		if _, err := AuthenticateRelease(bad, Release{m.Version, releaseDigest(bad)}); !errors.Is(err, ErrRelease) {
			t.Fatalf("accepted malformed contract %s: %v", value, err)
		}
	}
}
