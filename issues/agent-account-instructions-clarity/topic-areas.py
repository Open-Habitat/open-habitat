#!/usr/bin/env python3
"""Count research-topics.md's Microsoft topic areas against the pinned server.

Usage: topic-areas.py <integrations runtime directory> [--dump DIR]
       (the directory holding bin/ms-365-mcp-server)

Run from the repository root. For every account level and every area it
starts the server once, as one Pi entry per area would start it: Habitat's
level arguments with --enabled-tools narrowed to the area's names. No network
and no sign-in. It fails unless every tool offered at Full today lands in at
least one area or in SIGN_IN, and every area name is one the server knows.
With --dump it writes <DIR>/<level>-<area>.json (the tools/list reply and the
server instructions) for the search experiment.
"""
import json, os, re, subprocess, sys, tempfile

runtime = sys.argv[1]
dump = sys.argv[sys.argv.index("--dump") + 1] if "--dump" in sys.argv else None
src = open("internal/daemon/integrations/microsoft_linux.go").read()


def go_list(name):
    body = re.search(r"var %s = \[\]string\{(.*?)\n\}" % name, src, re.S).group(1)
    return re.findall(r'"([^"]+)"', body)


registered = go_list("microsoftOutlookTools") + go_list("microsoftFileTools")
teams = " Team.ReadBasic.All Channel.ReadBasic.All"
levels = {  # microsoftLevelScopes, written out, then microsoftAllowed
    "full": "User.Read Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite" + teams,
    "nosend": "User.Read Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite Calendars.ReadWrite Contacts.ReadWrite" + teams,
    "drafts": "User.Read Files.Read.All Sites.Read.All Mail.ReadWrite Calendars.Read Contacts.Read" + teams,
    "read": "User.Read Files.Read.All Sites.Read.All Mail.Read Calendars.Read Contacts.Read" + teams,
}


def allowed(granted):
    g, out = set(granted.split()), ["User.Read"]
    for wide, narrow in [("Mail.ReadWrite", "Mail.Read"), ("Mail.Send", ""), ("Calendars.ReadWrite", "Calendars.Read"),
                         ("Contacts.ReadWrite", "Contacts.Read"), ("Files.ReadWrite.All", "Files.Read.All"),
                         ("Sites.ReadWrite.All", "Sites.Read.All")]:
        if wide in g:
            out.append(wide)
        elif narrow and narrow in g:
            out.append(narrow)
    return " ".join(out)


# The areas. A name may sit in more than one area: each area is its own
# server process, so download-bytes-to-file serves both mail attachments and
# files, and the administration area lists the folders it renames.
AREAS = {
    "mail": """list-mail-messages list-mail-folders list-mail-child-folders list-mail-folder-messages get-mail-message
        read-mail-text list-mail-attachments get-mail-attachment-content download-bytes-to-file create-draft-email
        create-reply-draft create-reply-all-draft create-forward-draft update-mail-message move-mail-message
        copy-mail-message delete-mail-message add-mail-attachment delete-mail-attachment
        create-mail-attachment-upload-session get-upload-url send-draft-message send-mail reply-mail-message
        reply-all-mail-message forward-mail-message get-mail-message-mime get-mail-tips list-mail-folder-messages-delta""",
    "calendar": """list-calendars list-calendar-events get-calendar-event get-calendar-view list-specific-calendar-events
        get-specific-calendar-event get-specific-calendar-view list-calendar-event-instances get-schedule
        list-supported-time-zones create-calendar-event update-calendar-event delete-calendar-event
        create-specific-calendar-event update-specific-calendar-event delete-specific-calendar-event
        accept-calendar-event decline-calendar-event tentatively-accept-calendar-event cancel-calendar-event
        forward-calendar-event snooze-calendar-event-reminder dismiss-calendar-event-reminder
        add-calendar-event-attachment create-calendar-event-attachment-upload-session list-calendar-events-delta
        list-calendar-view-delta""",
    "contacts": """list-outlook-contacts get-outlook-contact list-contact-folders list-contact-folder-child-folders
        list-contact-folder-contacts create-outlook-contact update-outlook-contact delete-outlook-contact
        create-contact-in-folder""",
    "files": """search-query search-onedrive-files search-sharepoint-sites list-sharepoint-site-drives get-drive-root-item
        list-folder-files get-drive-item get-download-url download-bytes-to-file download-bytes""",
    "mailbox-admin": """list-mail-folders list-mail-child-folders create-mail-folder create-mail-child-folder update-mail-folder
        delete-mail-folder list-focused-inbox-overrides create-focused-inbox-override update-focused-inbox-override
        delete-focused-inbox-override list-calendars create-calendar update-calendar delete-calendar
        list-my-calendar-permissions create-my-calendar-permission update-my-calendar-permission
        delete-my-calendar-permission list-contact-folders list-contact-folder-child-folders create-contact-folder
        update-contact-folder delete-contact-folder create-contact-child-folder list-supported-languages""",
}
# The pinned server adds these to every process whatever --enabled-tools says;
# each area entry hides them with toolExposure.
SIGN_IN = set("login logout verify-login list-accounts select-account remove-account".split())
# Calls that pause for the person: every delete, and every call that reaches
# another person at once (sending, sharing the calendar, cancelling a meeting).
CONFIRM = re.compile(r"^(delete-|send-|reply-|forward-|cancel-calendar-event$|create-my-calendar-permission$|update-my-calendar-permission$)")

areas = {a: v.split() for a, v in AREAS.items()}
home = tempfile.mkdtemp()
env = {"HOME": home, "PATH": "/usr/bin:/bin", "MS365_MCP_CLIENT_ID": "00000000-0000-0000-0000-000000000001",
       "MS365_MCP_TENANT_ID": "11111111-1111-1111-1111-111111111111", "MS365_MCP_USE_KEYTAR": "false",
       "MS365_MCP_TOKEN_CACHE_PATH": home + "/.token-cache.json",
       "MS365_MCP_SELECTED_ACCOUNT_PATH": home + "/.selected-account.json"}


def listing(names, scopes):
    pattern = "^(?:" + "|".join(names) + ")$"
    p = subprocess.Popen([os.path.join(runtime, "bin/ms-365-mcp-server"), "--org-mode", "--enabled-tools", pattern,
                          "--allowed-scopes", allowed(scopes)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL, env=env, text=True)
    for m in ['{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}',
              '{"jsonrpc":"2.0","method":"notifications/initialized"}', '{"jsonrpc":"2.0","id":2,"method":"tools/list"}']:
        p.stdin.write(m + "\n")
        p.stdin.flush()
    replies = {}
    for line in p.stdout:
        try:
            reply = json.loads(line)
        except ValueError:
            continue
        replies[reply.get("id")] = reply.get("result")
        if 2 in replies:
            p.kill()
            return {"instructions": replies[1].get("instructions"), "tools": replies[2]["tools"]}
    sys.exit("no tools/list reply")


today = {lv: {t["name"] for t in listing(registered, sc)["tools"]} for lv, sc in levels.items()}
counts = {}
for lv, scopes in levels.items():
    for area, names in areas.items():
        reply = listing(names, scopes)
        got = {t["name"] for t in reply["tools"]}
        assert got - set(names) <= SIGN_IN, (lv, area, got - set(names))
        counts[lv, area] = got - SIGN_IN
        if dump:
            json.dump(reply, open(os.path.join(dump, "%s-%s.json" % (lv, area)), "w"))

full = today["full"]
named = {n for v in areas.values() for n in v}
assert named <= set(registered), named - set(registered)
assert full - SIGN_IN <= named, full - SIGN_IN - named
for lv in levels:  # the areas offer exactly what one server offers today, less sign-in
    assert set().union(*(counts[lv, a] for a in areas)) == today[lv] - SIGN_IN, lv

print("%-14s" % "area" + "".join("%8s" % lv for lv in levels) + "   confirm at full")
for area in areas:
    c = sorted(n for n in counts["full", area] if CONFIRM.match(n))
    print("%-14s" % area + "".join("%8d" % len(counts[lv, area]) for lv in levels) + "   %d" % len(c))
print("%-14s" % "distinct" + "".join("%8d" % len(set().union(*(counts[lv, a] for a in areas))) for lv in levels))
print("%-14s" % "today" + "".join("%8d" % len(today[lv]) for lv in levels) + "   (includes %d sign-in tools)" % len(SIGN_IN))
print()
for area in areas:
    print("%s: %s" % (area, " ".join(sorted(counts["full", area]))))
    print("  confirm: %s" % " ".join(sorted(n for n in counts["full", area] if CONFIRM.match(n))))
