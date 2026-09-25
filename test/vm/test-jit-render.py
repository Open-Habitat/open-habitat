#!/usr/bin/env python3
"""Offline fixture contract: rendered C identity must match its allowlist and UID."""
import ast
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[2]
fixture = (root/'test/vm/jit-fixture.py').read_text()
provider = (root/'test/vm/fake-provider.py').read_text()
gh = (root/'test/vm/fake-gh.py').read_text()
proof = (root/'test/vm/jit-login-proof.py').read_text()
node = next(n.value for n in ast.walk(ast.parse(fixture)) if isinstance(n, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == 'data' for t in n.targets)
            and isinstance(n.value, ast.Call) and n.value.func.attr == 'replace')
replacements = []
while isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'replace':
    replacements.append(tuple(ast.literal_eval(v) for v in node.args))
    node = node.func.value
assert isinstance(node, ast.Name) and node.id == 'data'
def render(source):
    for old, new in reversed(replacements):
        source = source.replace(old, new)
    return source
provider, gh = render(provider), render(gh)
# Evaluate only the fixed synthetic mapping expression extracted from the rendered
# source; do not start the provider, use a network, or read a guest credential.
handler = next(n for n in ast.parse(provider).body if isinstance(n, ast.ClassDef) and n.name == 'Handler')
get = next(n for n in handler.body if isinstance(n, ast.FunctionDef) and n.name == 'do_GET')
identity = next(n.value for n in ast.walk(get) if isinstance(n, ast.Assign)
                and any(isinstance(t, ast.Name) and t.id == 'ident' for t in n.targets))
assert isinstance(identity, ast.Call) and isinstance(identity.func.value, ast.Dict)
def key(node):
    if isinstance(node, ast.Constant): return node.value
    if isinstance(node, ast.Name) and node.id == 'key': return 'PRODUCT_VM_TOKEN_'
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add): return key(node.left) + key(node.right)
    raise AssertionError('unexpected provider map expression')
identity_map = {key(k): ast.literal_eval(v) for k,v in zip(identity.func.value.keys, identity.func.value.values)}
name, uid, subject = 'guestthree', 21034, '100000003'
token = 'PRODUCT_VM_TOKEN_' + name + '_FIXTURE_ONLY_92764'
assert identity_map['Bearer ' + token] == int(subject)
assert "('agent-a' if code=='a' else 'agent-b' if code=='b' else 'agent-c')" not in provider
assert "'guestone' if code=='a' else 'guesttwo' if code=='b' else 'guestthree'" in provider
assert "31003" not in provider and "21034" in gh
assert "home.name=='guestthree'" in gh and "21034" in gh
assert "'PRODUCT_VM_TOKEN_'+home.name.replace('-','_')+'_FIXTURE_ONLY_92764'" in gh
assert "'100000003','alternate':'guestthree'" in proof
assert "c_uid=21034" in proof and "c_name='guestthree'" in proof
assert "native-agent-host-daemon@guestone.socket','native-agent-host-daemon@guestone.service" in proof
assert "not (root/'guestone'/'daemon.sock').exists()" in proof
print('rendered third identity: provider/token, allowlist, gh UID and revoked-socket gate aligned')

# The diagnostic cannot accidentally emit arbitrary `systemctl show` properties,
# argv, credential strings or unbounded text even if the command returns them.
import types
unit_source = ast.parse(proof)
fn = next(n for n in unit_source.body if isinstance(n, ast.FunctionDef) and n.name == 'unit_state')
space = {'subprocess':types.SimpleNamespace(run=lambda argv, **kw: types.SimpleNamespace(returncode=0,stdout=(
    b'ActiveState=active\nSubState=running\nResult=success\nMainPID=2345\n'
    b'ExecStart=/secret/PRODUCT_VM_TOKEN_foo\n')))}
exec(compile(ast.Module(body=[fn],type_ignores=[]),'<offline-unit-state>','exec'),space)
read = space['unit_state']('native-agent-host-daemon@guestthree.service',('ActiveState','SubState','Result','MainPID'))
assert read == {'ActiveState':'active','SubState':'running','Result':'success','MainPID':2345}
assert 'PRODUCT_VM_TOKEN' not in repr(read)
space['subprocess'].run=lambda argv, **kw: types.SimpleNamespace(returncode=0,stdout=b'ActiveState=active\nSubState=\xff\nMainPID=bad\n')
assert space['unit_state']('unit',('ActiveState','SubState','MainPID'))=={'ActiveState':'active','SubState':'unavailable','MainPID':None}
space['subprocess'].run=lambda argv, **kw: types.SimpleNamespace(returncode=1,stdout=b'ActiveState=active\n')
assert space['unit_state']('unit',('ActiveState',))=={'unavailable':True}
