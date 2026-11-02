//go:build linux

package host

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"strings"
	"testing"
)

func TestReleaseArchiveSourceDoesNotAuthorizeBytes(t *testing.T) {
	a, archive := releaseFixture(t)
	a.ArchiveRelease = "v1.2.2"
	m := releaseManifest(a)
	raw, err := EncodeRelease(m)
	if err != nil {
		t.Fatal(err)
	}
	target := Release{m.Version, releaseDigest(raw)}
	r, err := AuthenticateRelease(raw, target)
	if err != nil {
		t.Fatal(err)
	}
	selected, err := r.Select(nil)
	if err != nil || selected[0].ArchiveRelease != a.ArchiveRelease {
		t.Fatal(selected, err)
	}
	for _, tc := range []struct {
		name    string
		data    []byte
		missing bool
		wantOK  bool
	}{
		{"exact reused bytes", archive, false, true},
		{"tampered archive", append(append([]byte{}, archive...), 0), false, false},
		{"source tag cannot replace local archive", nil, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := r.stageRelease(context.Background(), nil, releaseParent(t), func(name string) (io.ReadCloser, error) {
				if name != a.Archive {
					t.Fatalf("source changed local name: %s", name)
				}
				if tc.missing {
					return nil, errors.New("missing")
				}
				return io.NopCloser(bytes.NewReader(tc.data)), nil
			}, uint32(os.Geteuid()))
			if (err == nil) != tc.wantOK {
				t.Fatalf("verification: %v", err)
			}
		})
	}
	changed := bytes.Replace(raw, []byte("v1.2.2"), []byte("v1.2.1"), 1)
	if _, err := AuthenticateRelease(changed, target); !errors.Is(err, ErrReleaseTarget) {
		t.Fatal("source not pinned", err)
	}
	for _, value := range []any{nil, "", "../v1.2.2", "https://example.org/v1.2.2", "v1.2.3", "v1.2.2/asset", "v1.2.2?x", 42} {
		valueJSON, _ := json.Marshal(value)
		bad := strings.Replace(string(raw), `"archive_release":"v1.2.2"`, `"archive_release":`+string(valueJSON), 1)
		if _, err := AuthenticateRelease([]byte(bad), Release{m.Version, releaseDigest([]byte(bad))}); !errors.Is(err, ErrRelease) {
			t.Fatalf("accepted source %v: %v", value, err)
		}
	}
}
