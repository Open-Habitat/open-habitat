//go:build linux

package daemon

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/upgradenotice"
	"golang.org/x/sys/unix"
)

// The upgrade announcement (Jari, 2026-11-23): root's `host upgrade`
// publishes when it will begin stopping Habitat (internal/upgradenotice), and
// this daemon tells the agents of its own person's conversations and its
// person's browser. The record is read-only to the daemon and grants it
// nothing: it never writes it, never reaches another person and never
// restarts anything because of it, and a record it cannot trust is no
// schedule. Missing acknowledgements are counted, never waited for; the
// stop comes at the deadline regardless.
//
// Who is told: each live Pi this daemon runs (person-started, not a recap's
// helper). The companion picks the variant (process-extension.mjs, op
// "upgrade_notice"): a running turn is steered, an idle agent with live
// background processes gets a short turn, and an idle agent with nothing
// to lose holds it for a turn that may start before the deadline. A
// resting conversation is not started to be told. Taskfleet workers and
// other harnesses run under the user manager, outlive the daemon and are
// not told.
const (
	upgradeRereadInterval = 5 * time.Second
	upgradeAskTimeout     = 3 * time.Second
)

type upgradeState struct {
	rec    upgradenotice.Record
	status string // upgradenotice.Status*; "" means no schedule
	// outcome per handle for rec's key: told (it reached the model), queued
	// (sent, waiting for a tool call to return), held or not_delivered. Only
	// told stops the asking; queued counts as not delivered while it lasts.
	outcomes map[*conversation]string
	// untrusted: the last read found a record it must ignore (logged once).
	untrusted bool
}

func (c *ConversationController) setVersion(v string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.version = v
}

func (c *ConversationController) daemonVersion() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.version
}

func (c *ConversationController) upgradeNoticePath() string {
	if c.upgradePath != "" {
		return c.upgradePath
	}
	return upgradenotice.Path
}

func (c *ConversationController) readUpgradeNotice(path string) (upgradenotice.Record, error) {
	if c.upgradeRead != nil {
		return c.upgradeRead(path)
	}
	return upgradenotice.Read(path)
}

// watchUpgradeNotice follows the record: inotify on its directory for
// promptness, and a bounded reread because a watch can be lost.
func (c *ConversationController) watchUpgradeNotice(ctx context.Context) {
	path := c.upgradeNoticePath()
	changed := make(chan struct{}, 1)
	if fd, err := unix.InotifyInit1(unix.IN_CLOEXEC | unix.IN_NONBLOCK); err == nil {
		if _, err := unix.InotifyAddWatch(fd, filepath.Dir(path), unix.IN_CREATE|unix.IN_MOVED_TO|unix.IN_CLOSE_WRITE|unix.IN_DELETE|unix.IN_MOVED_FROM); err == nil {
			f := os.NewFile(uintptr(fd), "inotify")
			go func() { <-ctx.Done(); f.Close() }()
			go func() {
				buf := make([]byte, 4096)
				for {
					if _, err := f.Read(buf); err != nil {
						return
					}
					select {
					case changed <- struct{}{}:
					default:
					}
				}
			}()
		} else {
			unix.Close(fd)
		}
	}
	ticker := time.NewTicker(upgradeRereadInterval)
	defer ticker.Stop()
	c.refreshUpgrade(ctx, time.Now())
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-changed:
		}
		c.refreshUpgrade(ctx, time.Now())
	}
}

// refreshUpgrade rereads the record, tells browsers of a change and hands an
// announced schedule to the live conversations not yet told.
func (c *ConversationController) refreshUpgrade(ctx context.Context, now time.Time) {
	rec, err := c.readUpgradeNotice(c.upgradeNoticePath())
	status := ""
	if err == nil {
		status = rec.Status(now)
	}
	c.upgradeMu.Lock()
	st := &c.upgrade
	if err != nil && !errors.Is(err, os.ErrNotExist) && !st.untrusted {
		diagnostic.New(os.Stderr, "daemon").Warn("upgrade_notice", "outcome", "ignored", "reason", "untrusted_record")
	}
	st.untrusted = err != nil && !errors.Is(err, os.ErrNotExist)
	before := st.rec.Key() + "/" + st.status
	if status == "" {
		st.rec, st.status, st.outcomes = upgradenotice.Record{}, "", nil
	} else {
		if st.rec.Key() != rec.Key() {
			st.outcomes = map[*conversation]string{}
		}
		st.rec, st.status = rec, status
	}
	after := st.rec.Key() + "/" + st.status
	held := []*conversation{}
	if status == upgradenotice.StatusWithdrawn || status == upgradenotice.StatusUnknown {
		for s, o := range st.outcomes {
			if o == "held" {
				held = append(held, s)
				st.outcomes[s] = "withdrawn"
			}
		}
	}
	c.upgradeMu.Unlock()
	if before != after && c.journal != nil {
		c.journal.appendInvalidation("")
	}
	switch status {
	case upgradenotice.StatusCountdown:
		c.deliverUpgradeNotice(ctx, rec)
	case upgradenotice.StatusWithdrawn, upgradenotice.StatusUnknown:
		// A held announcement must not be given for a stop that is not
		// coming; one already given stands, as nothing is restarted.
		c.askConversations(ctx, held, func(s *conversation) map[string]any {
			return map[string]any{"op": "upgrade_notice_withdraw", "session_id": s.id, "generation": s.rpc.processGeneration, "schedule_id": rec.ScheduleID}
		}, nil)
	}
}

func (c *ConversationController) deliverUpgradeNotice(ctx context.Context, rec upgradenotice.Record) {
	notice := map[string]any{"schedule_id": rec.ScheduleID, "revision": rec.Revision, "version": rec.TargetVersion, "announced_at": rec.AnnouncedAt.UTC().Format(time.RFC3339Nano), "deadline": rec.Deadline.UTC().Format(time.RFC3339Nano)}
	c.upgradeMu.Lock()
	told := map[*conversation]bool{}
	for s, o := range c.upgrade.outcomes {
		told[s] = o == "told"
	}
	c.upgradeMu.Unlock()
	c.mu.Lock()
	var targets []*conversation
	for _, s := range c.sessions {
		if told[s] || !liveChild(s) || s.dead || s.recapOnly || s.rpc.processSocket == "" || s.state == "starting" || s.state == "stopping" {
			continue
		}
		targets = append(targets, s)
	}
	c.mu.Unlock()
	c.askConversations(ctx, targets, func(s *conversation) map[string]any {
		return map[string]any{"op": "upgrade_notice", "session_id": s.id, "generation": s.rpc.processGeneration, "notice": notice}
	}, func(s *conversation, outcome string) {
		c.upgradeMu.Lock()
		defer c.upgradeMu.Unlock()
		if c.upgrade.rec.Key() == rec.Key() && c.upgrade.outcomes != nil {
			c.upgrade.outcomes[s] = outcome
		}
	})
}

// askConversations sends one bridge request to each conversation at once,
// each bounded on its own.
func (c *ConversationController) askConversations(ctx context.Context, targets []*conversation, request func(*conversation) map[string]any, done func(*conversation, string)) {
	var wg sync.WaitGroup
	for _, s := range targets {
		wg.Add(1)
		go func(s *conversation) {
			defer wg.Done()
			askCtx, cancel := context.WithTimeout(ctx, upgradeAskTimeout)
			defer cancel()
			var out struct {
				Outcome string `json:"outcome"`
			}
			outcome := "not_delivered"
			if err := s.rpc.processRequest(askCtx, request(s), &out); err == nil && (out.Outcome == "told" || out.Outcome == "held" || out.Outcome == "queued") {
				outcome = out.Outcome
			}
			if done != nil {
				done(s, outcome)
			}
		}(s)
	}
	wg.Wait()
}

// upgradeCensus is the daemon's own report for the host's result: how far
// the announced schedule reached here. nil without a schedule.
func (c *ConversationController) upgradeCensus() map[string]any {
	c.upgradeMu.Lock()
	defer c.upgradeMu.Unlock()
	st := c.upgrade
	if st.status != upgradenotice.StatusCountdown && st.status != upgradenotice.StatusStarting {
		return nil
	}
	told, held, failed := 0, 0, 0
	for _, o := range st.outcomes {
		switch o {
		case "told":
			told++
		case "held":
			held++
		case "not_delivered", "queued":
			failed++
		}
	}
	return map[string]any{"schedule_id": st.rec.ScheduleID, "revision": st.rec.Revision, "told": told, "held": held, "not_delivered": failed}
}

// upgradeView is the snapshot's installation banner. The browser counts
// down to the deadline itself; status says what the record means now.
func (c *ConversationController) upgradeView() map[string]any {
	c.upgradeMu.Lock()
	defer c.upgradeMu.Unlock()
	st := c.upgrade
	if st.status == "" {
		return nil
	}
	return map[string]any{"schedule_id": st.rec.ScheduleID, "revision": st.rec.Revision, "target_version": st.rec.TargetVersion, "announced_at": st.rec.AnnouncedAt.UTC().Format(time.RFC3339), "deadline": st.rec.Deadline.UTC().Format(time.RFC3339), "status": st.status}
}

// FixtureWatchUpgradeNotice follows a synthetic schedule in the browser host
// only, where every identity shares one UID and no root record exists.
func (c *ConversationController) FixtureWatchUpgradeNotice(ctx context.Context, read func() (upgradenotice.Record, error)) {
	if !c.fixture {
		return
	}
	c.upgradeRead = func(string) (upgradenotice.Record, error) { return read() }
	go c.watchUpgradeNotice(ctx)
}

// FixtureRefreshUpgrade rereads the synthetic schedule at once.
func (c *ConversationController) FixtureRefreshUpgrade(ctx context.Context) {
	if c.fixture && c.upgradeRead != nil {
		c.refreshUpgrade(ctx, time.Now())
	}
}
