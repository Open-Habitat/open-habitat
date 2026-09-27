#!/usr/bin/python3
import os, pathlib, sys
args=sys.argv[1:]
assert 'PRODUCT_VM_TOKEN' not in repr(args) and all('PRODUCT_VM_TOKEN' not in v for v in os.environ.values())
home=pathlib.Path(os.environ['HOME'])
assert {21001:'/home/agent-a',21002:'/home/agent-b',21034:'/home/agent-c'}.get(os.getuid())==str(home)
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
