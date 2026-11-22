//go:build linux

package host

import (
	"context"
	_ "embed"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// The person's server browser (experimental) runs Google Chrome on a TigerVNC
// display. TigerVNC is an Ubuntu package and is declared in the core
// runtime's Ubuntu requirements like every other. Chrome is not: no build of
// Chromium that may be redistributed exists for both architectures (Chrome
// for Testing is Google-branded and carries a CDM nobody may pass on), and a
// pinned archive would go stale within days in a browser people sign in to.
// Google's own apt repository keeps it current through the host's apt, as
// internal/AGENTS.md's package rule says, so apply and upgrade add that
// repository and install the package once.
//
// Chrome is required, but apt runs after entries reopen so a Google outage
// cannot extend the maintenance downtime. Failure fails the command, not the
// already completed generation transition; the next apply retries. Once Chrome
// is installed its package owns the repository and key and keeps them identical
// to what is written here.
const (
	serverBrowserChrome  = "/opt/google/chrome/google-chrome"
	serverBrowserPackage = "google-chrome-stable"
	// The oldest Chrome the server browser was qualified with; Google's
	// repository offers only its current stable release.
	serverBrowserChromeMinimum = "157.0.8103.38-1"
	googleChromeKeyringPath    = "/usr/share/keyrings/google-chrome.gpg"
	googleChromeSourcesPath    = "/etc/apt/sources.list.d/google-chrome.sources"
	googleChromeLegacyList     = "/etc/apt/sources.list.d/google-chrome.list"
)

// googleChromeKeyring is Google's Linux package signing key exactly as
// google-chrome-stable's postinst writes it (158.0.8127.36), so the package
// later rewrites identical bytes. Its signing subkeys run to 2029; Chrome's
// own upgrades refresh the file before then.
//
//go:embed google-chrome.gpg
var googleChromeKeyring string

// googleChromeSources is the deb822 source google-chrome-stable's postinst
// writes for this architecture, byte for byte.
func googleChromeSources(arch string) string {
	return "### THIS FILE IS AUTOMATICALLY CONFIGURED ###\n" +
		"# Changes to this file will not be preserved.\n" +
		"# This file will not be recreated if removed.\n" +
		"X-Repolib-Name: Google Chrome\n" +
		"Types: deb\n" +
		"URIs: https://dl.google.com/linux/chrome-stable/deb/\n" +
		"Suites: stable\n" +
		"Components: main\n" +
		"Architectures: " + arch + "\n" +
		"Signed-By: " + googleChromeKeyringPath + "\n"
}

// ServerBrowserOutcome says what apply or upgrade did about the server
// browser's Chrome. Reason codes name the step that stopped; no apt output
// is carried.
type ServerBrowserOutcome struct {
	Outcome string `json:"outcome"`
	Reason  string `json:"reason,omitempty"`
}

// ErrServerBrowser means the generation transition completed but the required
// Chrome postcondition did not. Entries are open; retry with a fresh apply plan.
var ErrServerBrowser = errors.New("server_browser_required")

var (
	errServerBrowserObservation = errors.New("package_observation_unavailable")
	errServerBrowserSource      = errors.New("google_source_unavailable")
	errServerBrowserCandidate   = errors.New("apt_candidate_cannot_meet_minimum")
	errServerBrowserSolve       = errors.New("apt_solution_refused")
	errServerBrowserInstall     = errors.New("apt_install_failed")
)

func serverBrowserAction() Action {
	return Action{"server_browser.chrome", "planned", "ensure_required_minimum_after_entries_reopen"}
}

func requireServerBrowser(ctx context.Context, progress func(string) error) (*ServerBrowserOutcome, error) {
	failed := func(reason string, err error) (*ServerBrowserOutcome, error) {
		return &ServerBrowserOutcome{Outcome: "failed", Reason: reason}, errors.Join(ErrServerBrowser, err)
	}
	if progress != nil {
		if err := progress("server_browser"); err != nil {
			return failed("progress_unavailable", err)
		}
	}
	// The generation executor has released its lock. Serialize this apt step
	// too, and do not mutate packages behind another interrupted operation.
	lock, err := OpenOperationLock(ctx)
	if err != nil {
		return failed("operation_lock_unavailable", err)
	}
	defer lock.Close()
	if status, _ := observeJournal(operationDir, 0); status != "pass" {
		return failed("operation_incomplete", ErrRecovery)
	}
	installed, err := installServerBrowser(ctx, "/", 0, runtime.GOARCH, nativeCommandTimeout, queryRuntimePackages)
	if err != nil {
		return failed(err.Error(), errors.Join(err, ctx.Err()))
	}
	if installed {
		return &ServerBrowserOutcome{Outcome: "installed"}, nil
	}
	return &ServerBrowserOutcome{Outcome: "present"}, nil
}

// ServerBrowserCheck observes the required host Chrome without writes or network.
func ServerBrowserCheck(ctx context.Context) Check {
	return observeServerBrowser(ctx, "/", runtime.GOARCH, queryRuntimePackages)
}

// observeServerBrowser is read-only and networkless. A stray executable or a
// partially configured package must not masquerade as an installed browser.
func observeServerBrowser(ctx context.Context, root, arch string, query packageQuery) Check {
	check := Check{"server_browser.chrome", "unavailable", "package_observation_unavailable"}
	output, err := query(ctx)
	if err != nil {
		return check
	}
	packages, err := parseRuntimePackages(output)
	if err != nil {
		return check
	}
	check.Status = "fail"
	version := packages[serverBrowserPackage+":"+arch]
	if version == "" {
		check.Reason = "google_chrome_not_installed"
	} else if !packageVersionRE.MatchString(version) || compareDebVersions(version, serverBrowserChromeMinimum) < 0 {
		check.Reason = "google_chrome_below_minimum"
	} else if info, err := os.Stat(filepath.Join(root, serverBrowserChrome)); err != nil || !info.Mode().IsRegular() || info.Mode()&0111 == 0 {
		check.Reason = "google_chrome_executable_missing"
	} else {
		check.Status, check.Reason = "pass", "google_chrome_minimum_satisfied"
	}
	return check
}

// installServerBrowser reports whether it installed or repaired Chrome. A
// qualifying installed version is left to host apt updates; an administrator's
// own Google source (the legacy list file) is used as it is.
//
// What it wrote is withdrawn again when anything before the installation
// fails: a source the host cannot reach would make every later apt update
// warn or fail, and one that conflicts with an administrator's entry for the
// same repository would stop apt reading its sources at all. After a failed
// installation they stay, because dpkg may already have unpacked Chrome,
// whose package then owns them.
func installServerBrowser(ctx context.Context, root string, owner uint32, arch string, run ubuntuCommand, query packageQuery) (bool, error) {
	if arch != "amd64" && arch != "arm64" {
		return false, errServerBrowserSource
	}
	check := observeServerBrowser(ctx, root, arch, query)
	if check.Status == "pass" {
		return false, nil
	}
	if check.Status == "unavailable" {
		return false, errServerBrowserObservation
	}
	var wrote []string
	fail := func(err error) (bool, error) {
		for _, p := range wrote {
			_ = os.Remove(filepath.Join(root, p))
		}
		return false, err
	}
	source := googleChromeSourcesPath
	if _, err := os.Lstat(filepath.Join(root, googleChromeLegacyList)); err == nil {
		source = googleChromeLegacyList
	} else {
		for _, p := range []policyFile{{googleChromeKeyringPath, googleChromeKeyring}, {googleChromeSourcesPath, googleChromeSources(arch)}} {
			if _, err := os.Lstat(filepath.Join(root, p.Path)); err == nil {
				continue
			}
			if installPolicy(root, p, owner) != nil {
				return fail(errServerBrowserSource)
			}
			wrote = append(wrote, p.Path)
		}
	}
	// Refresh only Google's index: the host's own sources and their lists are
	// left exactly as the administrator's apt keeps them. apt reports a
	// failed fetch as success unless told otherwise. HTTPS to Google needs
	// ca-certificates, a core Ubuntu requirement.
	if _, err := run(ctx, 5*time.Minute, "/usr/bin/apt-get", "-q", "--error-on=any", "update",
		"-o", "Dir::Etc::SourceList="+source, "-o", "Dir::Etc::SourceParts=-",
		"-o", "APT::Get::List-Cleanup=false", "-o", "DPkg::Lock::Timeout=300"); err != nil {
		return fail(errServerBrowserSource)
	}
	output, err := run(ctx, time.Minute, "/usr/bin/apt-cache", "policy", serverBrowserPackage)
	candidate, exact := ubuntuCandidate(output, RuntimePackage{Name: serverBrowserPackage, Architecture: arch})
	if err != nil || !exact || compareDebVersions(candidate, serverBrowserChromeMinimum) < 0 {
		return fail(errServerBrowserCandidate)
	}
	args := aptInstallArgs([]string{serverBrowserPackage})
	if check.Reason == "google_chrome_executable_missing" {
		args = append([]string{"--reinstall"}, args...)
	}
	if _, err := run(ctx, 5*time.Minute, "/usr/bin/apt-get", append([]string{"--simulate"}, args...)...); err != nil {
		return fail(errServerBrowserSolve)
	}
	if _, err := run(ctx, 30*time.Minute, "/usr/bin/apt-get", args...); err != nil {
		return false, errServerBrowserInstall
	}
	if check := observeServerBrowser(ctx, root, arch, query); check.Status != "pass" {
		if check.Status == "unavailable" {
			return false, errServerBrowserObservation
		}
		return false, errServerBrowserInstall
	}
	return true, nil
}
