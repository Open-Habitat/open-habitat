//go:build linux

package host

import "testing"

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
