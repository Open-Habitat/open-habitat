//go:build linux

package host

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
)

var ErrUpgradeTarget = errors.New("upgrade_target_invalid: require an authenticated compatible named successor and exact product bytes")

// Verify the executing successor as well as its assets. Root ownership alone is
// not release authentication. No executable from a runtime archive is invoked.
func verifyUpgradeProduct(ctx context.Context, r AuthenticatedRelease) error {
	if r.manifest.Upgrade == nil {
		return ErrUpgradeTarget
	}
	exe, web, _, e := productInputs()
	if e != nil {
		return e
	}
	expected := map[string]ProductFile{}
	for _, f := range r.manifest.Upgrade.Product {
		expected[f.Path] = f
	}
	verify := func(path, name string) error {
		if e := ctx.Err(); e != nil {
			return e
		}
		f, ok := expected[name]
		if !ok {
			return ErrUpgradeTarget
		}
		st, e := os.Lstat(path)
		if e != nil || !st.Mode().IsRegular() || uint32(st.Mode().Perm()) != f.Mode {
			return ErrUpgradeTarget
		}
		sum, e := trustedFileDigest(path)
		if e != nil || sum != f.SHA256 {
			return ErrUpgradeTarget
		}
		delete(expected, name)
		return nil
	}
	if e = verify(exe, "open-habitat"); e != nil {
		return e
	}
	e = filepath.WalkDir(web, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(web, path)
		if err != nil {
			return err
		}
		return verify(path, "web/"+filepath.ToSlash(rel))
	})
	if e != nil {
		return e
	}
	if len(expected) != 0 {
		return ErrUpgradeTarget
	}
	return nil
}

// A generation retains its independently authenticated release metadata and
// declaration. The declaration holds references, not credential contents. It is
// predecessor evidence, never a replacement broker/native identity registry.
func installedRelease(ctx context.Context) (Site, AuthenticatedRelease, error) {
	gen, e := os.Readlink("/opt/open-habitat/current")
	if e != nil || filepath.Dir(gen) != generationParent || !digestRE.MatchString(filepath.Base(gen)) {
		return Site{}, AuthenticatedRelease{}, ErrUpgradeTarget
	}
	s, e := LoadSite(gen + "/site.json")
	if e != nil {
		return s, AuthenticatedRelease{}, e
	}
	if gen != generationPath(s) {
		return s, AuthenticatedRelease{}, ErrUpgradeTarget
	}
	b, e := trustedBytes(gen+"/release.json", MaxReleaseManifestBytes)
	if e != nil {
		return s, AuthenticatedRelease{}, e
	}
	sig, e := trustedBytes(gen+"/release.sig", 64)
	if e != nil {
		return s, AuthenticatedRelease{}, e
	}
	key, e := trustedBytes(releaseTrustKey, ed25519.PublicKeySize)
	if e != nil {
		return s, AuthenticatedRelease{}, e
	}
	r, e := AuthenticateRelease(b, sig, key, s.Release)
	if e != nil {
		return s, r, e
	}
	return s, r, generationMatches(ctx, s, r)
}

func upgradeDeclarationSame(a, b Site) bool {
	// First delivery intentionally separates release transition from declaration
	// convergence. Apply owns role/admission/quota changes and their revocations.
	a.Release = b.Release
	x, _ := json.Marshal(a)
	y, _ := json.Marshal(b)
	return slices.Equal(x, y)
}
