//go:build linux

package host

import (
	"errors"
	"strings"
	"testing"
)

func TestSessionUnitPolicyAfterColdBoot(t *testing.T) {
	const inactive = "LoadState=loaded\nActiveState=inactive\nSubState=dead\nMainPID=0\nSupplementaryGroups=open-habitat-proc\n"
	const active = "LoadState=loaded\nActiveState=active\nSubState=running\nMainPID=123\nSupplementaryGroups=open-habitat-proc\n"
	for _, tc := range []struct {
		name, unit, props, status string
		readErr                   bool
		want                      bool
	}{
		{"dbus activated polkit", "polkit.service", inactive, "", false, true},
		{"logind must run", "systemd-logind.service", inactive, "", false, false},
		{"active polkit", "polkit.service", active, "Groups:\t988 999\n", false, true},
		{"active logind", "systemd-logind.service", active, "Groups:\t988\n", false, true},
		{"wrong live groups", "polkit.service", active, "Groups:\t999\n", false, false},
		{"unreadable live groups", "polkit.service", active, "", true, false},
		{"inactive but live pid", "polkit.service", strings.Replace(inactive, "MainPID=0", "MainPID=123", 1), "", false, false},
		{"failed polkit", "polkit.service", strings.Replace(inactive, "ActiveState=inactive", "ActiveState=failed", 1), "", false, false},
		{"masked polkit", "polkit.service", strings.Replace(inactive, "LoadState=loaded", "LoadState=masked", 1), "", false, false},
		{"missing loaded state", "polkit.service", strings.Replace(inactive, "LoadState=loaded\n", "", 1), "", false, false},
		{"wrong launch groups", "polkit.service", strings.Replace(inactive, "open-habitat-proc", "foreign", 1), "", false, false},
		{"duplicate pid", "polkit.service", inactive + "MainPID=0\n", "", false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reads := 0
			err := sessionUnitPolicy(tc.unit, []byte(tc.props), "988", func(path string) ([]byte, error) {
				reads++
				if path != "/proc/123/status" {
					t.Fatalf("unexpected read %s", path)
				}
				if tc.readErr {
					return nil, errors.New("unavailable")
				}
				return []byte(tc.status), nil
			})
			if (err == nil) != tc.want {
				t.Fatalf("err=%v want=%v", err, tc.want)
			}
			if tc.props == inactive && reads != 0 {
				t.Fatal("inactive policy read nonexistent process")
			}
		})
	}
}

func TestProcMountPolicyRequiresEffectiveExemption(t *testing.T) {
	good := "33 22 0:5 / /proc rw,nosuid,nodev,noexec,relatime - proc proc rw,gid=987,hidepid=invisible\n"
	if !procMountPolicy([]byte(good), "987") {
		t.Fatal("valid native proc policy rejected")
	}
	for _, bad := range []string{
		good + "34 22 0:6 / /proc rw - proc proc rw\n",
		"34 22 0:6 / /proc rw - proc proc rw\n" + good,
		good + good,
		"33 22 0:5 / /proc rw - proc proc rw\n",
		"33 22 0:5 / /proc rw - proc proc rw,gid=986,hidepid=invisible\n",
		"33 22 0:5 / /proc rw - proc proc rw,gid=987,hidepid=1\n",
		"33 22 0:5 / /other rw - proc proc rw,gid=987,hidepid=2\n",
		"33 22 0:5 / /proc rw,gid=987,hidepid=invisible - proc proc rw\n",
	} {
		if procMountPolicy([]byte(bad), "987") {
			t.Fatal("accepted ineffective proc policy", bad)
		}
	}
}
