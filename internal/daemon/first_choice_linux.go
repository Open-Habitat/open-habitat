//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

// Native Pi validates auth again on set_model. Discovery never grants entitlement.
func (c *ConversationController) validFirstChoice(ctx context.Context, choice *piStartupChoice) bool {
	if choice.Provider == "" {
		choice.Provider = "openai-codex"
	}
	if len(choice.Model) == 0 || len(choice.Model) > 160 || !validThinking(choice.Thinking) || (choice.Provider != "openai-codex" && choice.Provider != "openai" && choice.Provider != "claude-bridge") {
		return false
	}
	if c.fixture {
		return true
	}
	if c.runtime == nil {
		return false
	}
	device := &PiDevice{Home: c.home, Node: c.runtime.Node, Entry: c.runtime.Entry, Manifest: c.runtime.Manifest, TrustedRuntime: true}
	catalog, err := device.catalog(ctx, "")
	if err != nil || catalog.CatalogStatus == "unavailable" {
		return false
	}
	for _, model := range catalog.Models {
		if model.Provider == choice.Provider && model.ID == choice.Model {
			for _, level := range model.ThinkingLevels {
				if level == choice.Thinking {
					return true
				}
			}
		}
	}
	return false
}

// Called only after reserving the child's pending state. No other browser command
// can enter while the native emptiness check and correlated RPCs run. This is
// first-message intent, not general model switching or a host preference store.
func (c *ConversationController) applyFirstChoice(s *conversation, choice *piStartupChoice) error {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return err
	}
	found := false
	for _, native := range sessions {
		if native.id != s.id {
			continue
		}
		if found || native.state != "readable" || native.cwd != s.cwd {
			return errors.New("native history uncertain")
		}
		found = true
		if _, err := emptyNativeFile(native.path, c.cfg.UID, s.id, s.cwd); err != nil {
			return err
		}
		if c.piWriter(native.path, s.cwd) != "not_observed" {
			return errors.New("native writer uncertain")
		}
	}
	wire, _ := json.Marshal(choice)
	accepted, err := s.rpc.request("set_model", string(wire), 10*time.Second)
	if err != nil {
		return err
	}
	if !accepted {
		return errors.New("native model refused")
	}
	accepted, err = s.rpc.request("set_thinking_level", choice.Thinking, 10*time.Second)
	if err != nil {
		return err
	}
	if !accepted {
		return errors.New("native thinking refused")
	}
	c.mu.Lock()
	s.startupChoice = choice
	c.mu.Unlock()
	return nil
}
