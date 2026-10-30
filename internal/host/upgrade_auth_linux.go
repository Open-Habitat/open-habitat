//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/Open-Habitat/open-habitat/internal/bootguard"
	"github.com/Open-Habitat/open-habitat/internal/provision"
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
	// A generation installed before ADR 0034 may still hold release.sig; it
	// is neither read nor required.
	r, e := authenticateReleaseFile(gen, s.Release)
	if e != nil {
		return s, r, e
	}
	return s, r, generationMatches(ctx, s, r)
}

func upgradeDeclarationSame(a, b Site) bool {
	// Immutable generation metadata authenticates release/profile membership,
	// not a second copy of mutable admission/administration truth. Those values
	// are checked against the running predecessor's native authorities below.
	return a.Immutable() == b.Immutable() && slices.Equal(a.Profiles, b.Profiles)
}

// verifyServingPredecessor returns "" for a healthy serving predecessor and
// otherwise the reason naming the first failing observation. The plan reports
// that reason: a bare "not healthy" leaves the operator nothing to diagnose.
func verifyServingPredecessor(ctx context.Context, s Site, r AuthenticatedRelease) string {
	state, e := provision.InspectInstallation(ctx)
	switch {
	case e != nil:
		return "predecessor_broker_unavailable"
	case !admissionPublished(state, s):
		return "predecessor_admission_not_applied"
	case state.Epoch != state.ObservedEpoch:
		return "predecessor_admission_not_observed"
	case !gatewayConfigurationMatches(s):
		return "predecessor_gateway_configuration_drift"
	}
	policies, e := predecessorUnitPolicies(s)
	if e != nil {
		return "predecessor_generation_policies_unreadable"
	}
	if e := verifyUnitPolicies(ctx, policies); e != nil {
		return "predecessor_unit_policy_drift"
	}
	if c, e := r.ObserveRuntimePackages(ctx, s.Profiles); e != nil || c.Status != "pass" {
		return "predecessor_runtime_packages_not_ready"
	}
	if reason, _ := (&nativeApply{site: s}).verifyAdministration(ctx, administrationDeclared); reason != "" {
		return "predecessor_" + reason
	}
	for _, unit := range []string{"open-habitat-broker.service", "open-habitat-gateway.service"} {
		if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "is-active", "--quiet", unit); e != nil {
			return "predecessor_service_inactive"
		}
	}
	switch {
	case !preparationExists(s):
		return "predecessor_preparation_missing"
	case sessionPolicyReady(ctx) != nil:
		return "predecessor_session_policy_not_ready"
	case bootguard.Storage() != "verified":
		return "predecessor_storage_not_verified"
	case generationMatches(ctx, s, r) != nil:
		return "predecessor_generation_mismatch"
	}
	return ""
}

// The prior generation is an immutable unit/config generation, not a native
// identity registry. Its policy bytes are only compared to the installed
// predecessor; upgrade installs fixed bytes from its own authenticated binary.
func predecessorUnitPolicies(s Site) ([]policyFile, error) {
	b, e := trustedBytes(generationPath(s)+"/unit-policies.json", MaxReleaseManifestBytes)
	if e != nil {
		return nil, e
	}
	var ps []policyFile
	if strictJSON(b) != nil || json.Unmarshal(b, &ps) != nil || len(ps) == 0 {
		return nil, ErrUpgradeTarget
	}
	expected := append(preparePolicies(s), applyUnitPolicies(s)...)
	if len(ps) != len(expected) {
		return nil, ErrUpgradeTarget
	}
	names := map[string]bool{}
	for _, p := range expected {
		names[p.Path] = true
	}
	for i, p := range ps {
		if !names[p.Path] || p.Content == "" {
			return nil, ErrUpgradeTarget
		}
		// An activated pilot may retain its original immutable generation after
		// the bounded low-port unit repair. Verify the repaired live policy, not
		// stale snapshot bytes, without mutating that generation's evidence.
		oldGateway := legacyApplyUnitPolicies()[2]
		if p.Path == oldGateway.Path && p.Content == oldGateway.Content {
			repaired := applyUnitPolicies(s)[2]
			if policiesMatch("/", []policyFile{repaired}, 0) {
				ps[i] = repaired
			}
		}
		delete(names, p.Path)
	}
	return ps, nil
}
