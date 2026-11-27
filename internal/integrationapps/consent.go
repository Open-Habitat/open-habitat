package integrationapps

import (
	"net/url"
	"strings"
)

// The Graph permissions of the Microsoft levels' applications: what an
// administrator consents to for each level, and what a sign-in's grant is
// shown against. MicrosoftFilesScopes and MicrosoftOutlookScopes together
// with MicrosoftTeamsScopes are the full level.
const (
	MicrosoftFilesScopes   = "openid profile User.Read offline_access Files.ReadWrite.All Sites.ReadWrite.All"
	MicrosoftOutlookScopes = "User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite"
	// MicrosoftTeamsScopes let the folder step of earlier releases offer the
	// libraries of the person's teams and channels. Nothing reads those
	// lists now that agents search instead; they stay in each level's
	// consent because dropping them changes the application an operator
	// sets up in Entra, which is a decision of its own.
	MicrosoftTeamsScopes = "Team.ReadBasic.All Channel.ReadBasic.All"
)

// MicrosoftLevelScopes are the permissions each level's application has, by
// level name. nosend is the full level without Mail.Send, the one permission
// that sends mail. drafts sends nothing: mail is drafted, calendars and files
// only read, since an event sends invitations and a file grant can create a
// public sharing link. Every level lists the person's teams and channels by
// name, which changes nothing.
var MicrosoftLevelScopes = map[string]string{
	"full":   MicrosoftFilesScopes + " " + MicrosoftOutlookScopes + " " + MicrosoftTeamsScopes,
	"nosend": "openid profile offline_access User.Read Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite Calendars.ReadWrite Contacts.ReadWrite " + MicrosoftTeamsScopes,
	"drafts": "openid profile offline_access User.Read Files.Read.All Sites.Read.All Mail.ReadWrite Calendars.Read Contacts.Read " + MicrosoftTeamsScopes,
	"read":   "openid profile offline_access User.Read Files.Read.All Sites.Read.All Mail.Read Calendars.Read Contacts.Read " + MicrosoftTeamsScopes,
}

// MicrosoftSectionLevel is the level a Microsoft section's application
// serves, single-tenant or shared: microsoft and microsoft_shared are full.
func MicrosoftSectionLevel(section string) string {
	switch strings.TrimPrefix(strings.TrimPrefix(section, "microsoft"), "_shared") {
	case "":
		return "full"
	case "_nosend":
		return "nosend"
	case "_drafts":
		return "drafts"
	case "_read":
		return "read"
	}
	return ""
}

// MicrosoftConsentURL is the admin-consent link of a level's application in
// one organisation: that tenant's administrator approves the level's set of
// permissions for the application. The tenant is the organisation's GUID,
// so the link can only be approved there. An unknown level is the full one.
func MicrosoftConsentURL(tenant, client, level string) string {
	scopes, ok := MicrosoftLevelScopes[level]
	if !ok {
		scopes = MicrosoftLevelScopes["full"]
	}
	identity := map[string]bool{"openid": true, "profile": true, "email": true, "offline_access": true}
	var named []string
	seen := map[string]bool{}
	for _, s := range strings.Fields(scopes) {
		if !identity[s] && !seen[s] {
			named, seen[s] = append(named, s), true
		}
	}
	return "https://login.microsoftonline.com/" + url.PathEscape(tenant) + "/v2.0/adminconsent?" + url.Values{"client_id": {client}, "scope": {"openid profile offline_access " + strings.Join(named, " ")}, "redirect_uri": {"https://login.microsoftonline.com/common/oauth2/nativeclient"}}.Encode()
}
