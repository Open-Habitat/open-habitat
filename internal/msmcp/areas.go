// Package msmcp shares one native Microsoft MCP server among all of a
// person's conversations (ADR 0039). The person's daemon owns the single
// stdio child and serves it on a private Unix socket in the person's home;
// each Pi area entry runs a small relay (`open-habitat mcp-relay`) that
// copies its stdio to that socket. The daemon filters every listing and
// every call by the entry's area, so searching the files area never offers
// a mailbox-administration tool, and several accounts take turns in the one
// child slot instead of starting a second Microsoft process.
//
// Nothing here holds a credential or decides an account's permission level:
// the native server keeps its own token cache, and the daemon's resolver
// says which native configuration an account runs with.
package msmcp

import "slices"

// Area is one of the five topic areas an account's tools are divided into.
// A tool may sit in more than one area: download-bytes-to-file fetches both
// mail attachments and files, and mailbox administration lists the folders
// and calendars it renames.
type Area struct {
	Name  string
	Tools []string
}

// Areas in the order the agent's text names them. A version bump of the
// pinned server that offers a tool in no area fails
// TestMicrosoftMCPToolsPinnedServer, so a new tool is placed deliberately.
var Areas = []Area{
	{"mail", []string{
		"list-mail-messages", "list-mail-folders", "list-mail-child-folders", "list-mail-folder-messages", "get-mail-message",
		"read-mail-text", "list-mail-attachments", "get-mail-attachment-content", "download-bytes-to-file", "create-draft-email",
		"create-reply-draft", "create-reply-all-draft", "create-forward-draft", "update-mail-message", "move-mail-message",
		"copy-mail-message", "delete-mail-message", "add-mail-attachment", "delete-mail-attachment",
		"create-mail-attachment-upload-session", "get-upload-url", "send-draft-message", "send-mail", "reply-mail-message",
		"reply-all-mail-message", "forward-mail-message", "get-mail-message-mime", "get-mail-tips", "list-mail-folder-messages-delta",
	}},
	{"calendar", []string{
		"list-calendars", "list-calendar-events", "get-calendar-event", "get-calendar-view", "list-specific-calendar-events",
		"get-specific-calendar-event", "get-specific-calendar-view", "list-calendar-event-instances", "get-schedule",
		"list-supported-time-zones", "create-calendar-event", "update-calendar-event", "delete-calendar-event",
		"create-specific-calendar-event", "update-specific-calendar-event", "delete-specific-calendar-event",
		"accept-calendar-event", "decline-calendar-event", "tentatively-accept-calendar-event", "cancel-calendar-event",
		"forward-calendar-event", "snooze-calendar-event-reminder", "dismiss-calendar-event-reminder",
		"add-calendar-event-attachment", "create-calendar-event-attachment-upload-session", "list-calendar-events-delta",
		"list-calendar-view-delta",
	}},
	{"contacts", []string{
		"list-outlook-contacts", "get-outlook-contact", "list-contact-folders", "list-contact-folder-child-folders",
		"list-contact-folder-contacts", "create-outlook-contact", "update-outlook-contact", "delete-outlook-contact",
		"create-contact-in-folder",
	}},
	{"files", []string{
		"search-query", "search-onedrive-files", "search-sharepoint-sites", "list-sharepoint-site-drives", "get-drive-root-item",
		"list-folder-files", "get-drive-item", "get-download-url", "download-bytes-to-file", "download-bytes",
	}},
	{"admin", []string{
		"list-mail-folders", "list-mail-child-folders", "create-mail-folder", "create-mail-child-folder", "update-mail-folder",
		"delete-mail-folder", "list-focused-inbox-overrides", "create-focused-inbox-override", "update-focused-inbox-override",
		"delete-focused-inbox-override", "list-calendars", "create-calendar", "update-calendar", "delete-calendar",
		"list-my-calendar-permissions", "create-my-calendar-permission", "update-my-calendar-permission",
		"delete-my-calendar-permission", "list-contact-folders", "list-contact-folder-child-folders", "create-contact-folder",
		"update-contact-folder", "delete-contact-folder", "create-contact-child-folder", "list-supported-languages",
	}},
}

// SignIn are the tools the pinned server adds to every process whatever
// --enabled-tools says. Sign-in belongs to Settings → Integrations, so no
// area offers them; Pi's entries also hide them.
var SignIn = []string{"login", "logout", "verify-login", "list-accounts", "select-account", "remove-account"}

// AreaTools is the set of an area's tool names, nil for an unknown area.
func AreaTools(name string) map[string]bool {
	for _, a := range Areas {
		if a.Name == name {
			out := make(map[string]bool, len(a.Tools))
			for _, t := range a.Tools {
				if !slices.Contains(SignIn, t) {
					out[t] = true
				}
			}
			return out
		}
	}
	return nil
}

// AreaNames lists the areas' names in order.
func AreaNames() []string {
	out := make([]string, len(Areas))
	for i, a := range Areas {
		out[i] = a.Name
	}
	return out
}
