package main

import (
	"context"
	"os"
	"sync"

	"github.com/open-habitat/open-habitat/internal/gateway"
	"github.com/open-habitat/open-habitat/internal/livelimits"
)

// The synthetic host's live-limits file, as the broker keeps it. Every
// identity here runs as one UID, so each person's daemon reads a file made
// for it: the installation's limit and that person's own exception.
type fixtureLive struct {
	mu     sync.Mutex
	limits gateway.LiveLimits
}

var liveFixture = &fixtureLive{}

// file is root's file as subject's daemon would read it.
func (f *fixtureLive) file(subject string) ([]byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	file := livelimits.File{Default: f.limits.Default, People: map[uint32]int{}}
	for _, p := range f.limits.People {
		if p.ID == subject {
			file.People[uint32(os.Getuid())] = p.Limit
		}
	}
	return livelimits.Encode(file)
}

func (b *fixtureBroker) LiveLimits(context.Context) (gateway.LiveLimits, error) {
	liveFixture.mu.Lock()
	defer liveFixture.mu.Unlock()
	return copyLive(liveFixture.limits), nil
}

func (b *fixtureBroker) SetLiveLimit(_ context.Context, subject string, limit int) (gateway.LiveLimits, error) {
	if subject != "" {
		b.access.mu.Lock()
		_, bound := b.bound(subject)
		b.access.mu.Unlock()
		if !bound {
			return gateway.LiveLimits{}, gateway.ErrBoundUserNotFound
		}
	}
	liveFixture.mu.Lock()
	defer liveFixture.mu.Unlock()
	l := &liveFixture.limits
	if subject == "" {
		l.Default = limit
	} else {
		people := []gateway.LiveLimitPerson{}
		for _, p := range l.People {
			if p.ID != subject {
				people = append(people, p)
			}
		}
		if limit != 0 {
			people = append(people, gateway.LiveLimitPerson{ID: subject, Limit: limit})
		}
		l.People = people
	}
	return copyLive(*l), nil
}

func copyLive(l gateway.LiveLimits) gateway.LiveLimits {
	return gateway.LiveLimits{Default: l.Default, People: append([]gateway.LiveLimitPerson{}, l.People...)}
}
