#!/usr/bin/python3
import os, pathlib, pwd, sys
args=sys.argv[1:]
def mapped_home(uid, home, lookup=pwd.getpwuid):
    # The broker assigns the next UID in admission order, not identity order.
    # Verify the real NSS entry, never a fixture's guessed B/C allocation.
    if uid not in (21001,21002,21034): return False
    try: account=lookup(uid)
    except KeyError: return False
    return account.pw_uid==uid and account.pw_name==home.name and account.pw_dir==str(home)
assert 'PRODUCT_VM_TOKEN' not in repr(args) and all('PRODUCT_VM_TOKEN' not in v for v in os.environ.values())
home=pathlib.Path(os.environ['HOME'])
# Record only synthetic execution identity and command category before the
# guard, so a failed guest can distinguish a wrong UID/home from no exec.
with (home/'git-entry.jsonl').open('a') as f:
    import json
    f.write(json.dumps({'uid':os.getuid(),'home_matches':mapped_home(os.getuid(),home),'command':args[:2]})+'\n')
assert mapped_home(os.getuid(),home)
with (home/'git-argv.log').open('a') as f: f.write(repr(args)+'\n')
if args==['config','--global','--get','credential.https://github.com.helper']:
    print('!gh auth git-credential');sys.exit(0)
if args==['credential','fill']:
    assert sys.stdin.read()=='protocol=https\nhost=github.com\n\n'
    credential=home/'.config/gh/hosts.yml'
    assert credential.is_file()
    # Model real credential fill: the adapter must discard stdout entirely.
    token=credential.read_text().split('oauth_token: ',1)[1].strip()
    print('username=fixture\npassword='+token)
    sys.exit(0)
sys.exit(3)
