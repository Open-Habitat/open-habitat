#!/usr/bin/env python3
"""Recount tool-surface.md against the pinned Microsoft MCP server.

Usage: tool-surface-check.py <integrations runtime directory>
       (the directory holding bin/ms-365-mcp-server, for example the
       payload/runtime of a built integrations profile)

Run from the repository root. Starts the server once per account level with
the arguments internal/daemon/integrations/microsoft_linux.go registers, in a
throwaway HOME, and asks for tools/list. No network and no sign-in.
"""
import json, os, re, subprocess, sys, tempfile

runtime = sys.argv[1]
src = open("internal/daemon/integrations/microsoft_linux.go").read()


def go_list(name):
    body = re.search(r"var %s = \[\]string\{(.*?)\n\}" % name, src, re.S).group(1)
    return re.findall(r'"([^"]+)"', body)


outlook, files = go_list("microsoftOutlookTools"), go_list("microsoftFileTools")
pattern = "^(?:" + "|".join(outlook + files) + ")$"
teams = " Team.ReadBasic.All Channel.ReadBasic.All"
# microsoftLevelScopes, written out.
levels = {
    "full": "User.Read Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite" + teams,
    "nosend": "User.Read Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite Calendars.ReadWrite Contacts.ReadWrite" + teams,
    "drafts": "User.Read Files.Read.All Sites.Read.All Mail.ReadWrite Calendars.Read Contacts.Read" + teams,
    "read": "User.Read Files.Read.All Sites.Read.All Mail.Read Calendars.Read Contacts.Read" + teams,
}


def allowed(granted):  # microsoftAllowed
    g, out = set(granted.split()), ["User.Read"]
    for wide, narrow in [("Mail.ReadWrite", "Mail.Read"), ("Mail.Send", ""), ("Calendars.ReadWrite", "Calendars.Read"),
                         ("Contacts.ReadWrite", "Contacts.Read"), ("Files.ReadWrite.All", "Files.Read.All"),
                         ("Sites.ReadWrite.All", "Sites.Read.All")]:
        if wide in g:
            out.append(wide)
        elif narrow and narrow in g:
            out.append(narrow)
    return " ".join(out)


home = tempfile.mkdtemp()
env = {"HOME": home, "PATH": "/usr/bin:/bin", "MS365_MCP_CLIENT_ID": "00000000-0000-0000-0000-000000000001",
       "MS365_MCP_TENANT_ID": "11111111-1111-1111-1111-111111111111", "MS365_MCP_USE_KEYTAR": "false",
       "MS365_MCP_TOKEN_CACHE_PATH": home + "/.token-cache.json",
       "MS365_MCP_SELECTED_ACCOUNT_PATH": home + "/.selected-account.json"}


def tools(args):
    p = subprocess.Popen([os.path.join(runtime, "bin/ms-365-mcp-server")] + args, stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env, text=True)
    for m in ['{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}',
              '{"jsonrpc":"2.0","method":"notifications/initialized"}', '{"jsonrpc":"2.0","id":2,"method":"tools/list"}']:
        p.stdin.write(m + "\n")
        p.stdin.flush()
    for line in p.stdout:
        try:
            reply = json.loads(line)
        except ValueError:
            continue
        if reply.get("id") == 2:
            p.kill()
            return reply["result"]["tools"]
    sys.exit("no tools/list reply")


# The proposal in tool-surface.md: what stays, and each group that goes.
KEEP = {
    "files": "search-query search-onedrive-files search-sharepoint-sites list-sharepoint-site-drives get-drive-root-item list-folder-files get-drive-item get-download-url download-bytes-to-file",
    "mail: read": "list-mail-messages list-mail-folders list-mail-child-folders list-mail-folder-messages get-mail-message read-mail-text list-mail-attachments get-mail-attachment-content",
    "mail: draft and organise": "create-draft-email create-reply-draft create-reply-all-draft create-forward-draft update-mail-message move-mail-message delete-mail-message add-mail-attachment delete-mail-attachment",
    "mail: send": "send-draft-message",
    "calendar: read": "list-calendars list-calendar-events get-calendar-event get-calendar-view list-specific-calendar-events get-specific-calendar-event get-specific-calendar-view list-calendar-event-instances get-schedule list-supported-time-zones",
    "calendar: events": "create-calendar-event update-calendar-event delete-calendar-event create-specific-calendar-event update-specific-calendar-event delete-specific-calendar-event accept-calendar-event decline-calendar-event tentatively-accept-calendar-event cancel-calendar-event",
    "contacts: read": "list-outlook-contacts get-outlook-contact list-contact-folders list-contact-folder-child-folders list-contact-folder-contacts",
    "contacts: write": "create-outlook-contact update-outlook-contact delete-outlook-contact",
}
DROP = {
    "sign-in management": "login logout verify-login list-accounts select-account remove-account",
    "mail folder structure": "create-mail-folder create-mail-child-folder update-mail-folder delete-mail-folder",
    "focused inbox rules": "list-focused-inbox-overrides create-focused-inbox-override update-focused-inbox-override delete-focused-inbox-override",
    "calendar sharing": "list-my-calendar-permissions create-my-calendar-permission update-my-calendar-permission delete-my-calendar-permission",
    "calendars themselves": "create-calendar update-calendar delete-calendar",
    "contact folder structure": "create-contact-folder update-contact-folder delete-contact-folder create-contact-child-folder create-contact-in-folder",
    "sync deltas": "list-mail-folder-messages-delta list-calendar-events-delta list-calendar-view-delta",
    "one-step send": "send-mail reply-mail-message reply-all-mail-message forward-mail-message",
    "mailbox odds and ends": "get-mail-tips get-mail-message-mime list-supported-languages copy-mail-message",
    "upload plumbing": "create-mail-attachment-upload-session create-calendar-event-attachment-upload-session get-upload-url",
    "base64 download": "download-bytes",
    "calendar extras": "forward-calendar-event snooze-calendar-event-reminder dismiss-calendar-event-reminder add-calendar-event-attachment",
}
keep = {n for v in KEEP.values() for n in v.split()}
drop = {n for v in DROP.values() for n in v.split()}

offered = {}
size = {}
for level, scopes in levels.items():
    listed = tools(["--org-mode", "--enabled-tools", pattern, "--allowed-scopes", allowed(scopes)])
    offered[level] = [t["name"] for t in listed]
    size[level] = (len(json.dumps(listed)), len(json.dumps([t for t in listed if t["name"] in keep])))

full = set(offered["full"])
assert not keep & drop, keep & drop
assert keep | drop == full, (full - keep - drop, (keep | drop) - full)
print("registered names: %d Outlook + %d files = %d" % (len(outlook), len(files), len(outlook + files)))
print("registered but offered at no level:", sorted(set(outlook + files) - full))
print("offered at full but not registered by name:", sorted(full - set(outlook + files)))
print()
print("%-8s %6s %9s %10s %12s" % ("level", "today", "proposed", "today kB", "proposed kB"))
for level in levels:
    print("%-8s %6d %9d %10d %12d" % (level, len(offered[level]), len(keep & set(offered[level])), size[level][0] // 1000, size[level][1] // 1000))
print()
for title, groups in (("stays", KEEP), ("goes", DROP)):
    for name, value in groups.items():
        names = value.split()
        print("%s  %-26s %2d  %s" % (title, name, len(names), " ".join(
            "%s=%d" % (level, len(set(names) & set(offered[level]))) for level in levels)))
