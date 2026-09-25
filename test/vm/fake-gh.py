#!/usr/bin/python3
"""Guest-only native gh stand-in. No network or real credential store."""
import json, os, pathlib, sys
args=sys.argv[1:]
with open('/tmp/native-gh-entry-'+str(os.getuid()),'a') as entry:
    entry.write(json.dumps({'uid':os.getuid(),'home':os.environ.get('HOME',''),'argc':len(args)})+'\n')
home=pathlib.Path(os.environ['HOME'])
assert str(home) in ('/home/agent-a','/home/agent-b') and os.getuid() in (21001,21002)
assert 'PRODUCT_VM_TOKEN' not in repr(args) and all('PRODUCT_VM_TOKEN' not in v for v in os.environ.values())
log=home/'gh-argv.jsonl'
with log.open('a') as f: f.write(json.dumps({'argv':args,'stdin':args[:2]==['auth','login'],'uid':os.getuid()})+'\n')
cred=home/'.config/gh/hosts.yml'
# Guest-only fault switch; no production executable reads this path. The root
# proof sets it before a fresh synthetic callback, then removes it.
fault=pathlib.Path('/run/fixture-gh-fault')
mode=fault.read_text().strip() if fault.is_file() else ''
if args==['auth','status','--hostname','github.com']:
    sys.exit(0 if cred.is_file() else 1)
if args==['auth','login','--hostname','github.com','--with-token','--git-protocol','https']:
    token=sys.stdin.read(4097)
    if mode=='fail-login': sys.exit(2)
    assert token == 'PRODUCT_VM_TOKEN_'+home.name.replace('-','_')+'_FIXTURE_ONLY_92764'
    cred.parent.parent.mkdir(mode=0o700, exist_ok=True)
    cred.parent.mkdir(mode=0o700, exist_ok=True)
    cred.write_text('github.com:\n    oauth_token: '+token+'\n')
    cred.chmod(0o600)
    sys.exit(0)
if args==['auth','setup-git','--hostname','github.com']:
    assert cred.is_file()
    sys.exit(0)
if args==['api','user','--jq','{id: .id, login: .login}']:
    assert cred.is_file()
    print(json.dumps({'id':39999 if mode=='wrong-id' else (31001 if home.name=='agent-a' else 31002),'login':home.name.replace('-','')}))
    sys.exit(0)
if args==['config','get','git_protocol','--host','github.com']:
    print('https');sys.exit(0)
if args[:3]==['auth','logout','--hostname']:
    cred.unlink(missing_ok=True);sys.exit(0)
sys.exit(3)
