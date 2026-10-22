#!/usr/bin/env python3
"""Reject incomplete upgrade serial evidence; never infer acceptance from PASS."""
import hashlib
import json
from pathlib import Path
import sys


def validate(proof):
    required=('fresh_to_successor','preactivation_failure_predecessor_serving','stale_refused','immutable_owner','cold_reboot','homes_preserved','native_session_preserved','browser_session_preserved','broker_identity_admission_preserved','admin_preserved','persistent_user_service_preserved','gateway_gid_distinct','post_acceptance_session_mutation_no_change','user_service_restarted','closed_reboot_refused','after_open_sigkill','accepted_recovery_restarts_consumers','post_acceptance_admin_mutation_no_change')
    if not isinstance(proof,dict) or proof.get('status')!='passed' or any(proof.get(k) is not True for k in required):
        raise ValueError('missing upgrade acceptance predicate')
    if proof.get('phase_sigkills')!=['quiescing','activating','verifying','verified'] or proof.get('two_native_uids')!=[21032,21033] or proof.get('provider_call') is not False:
        raise ValueError('missing native boundary or explicit provider limit')


def main():
    run=Path(sys.argv[1]);commit,tree,dirty=sys.argv[2:]
    serial=json.loads((run/'serial-receipt.json').read_text())
    if serial['capped'] or serial['token_leaked']:raise ValueError('invalid serial')
    proof=None
    text=(run/'serial.log').read_text()
    for line in text.splitlines():
        if 'HOST_UPGRADE_RECEIPT ' in line:proof=json.loads(line.split('HOST_UPGRADE_RECEIPT ',1)[1])
    validate(proof)
    if 'HOST_UPGRADE_FAIL' in text or 'HOST_UPGRADE_PASS' not in text:raise ValueError('invalid terminal markers')
    def sha(path):
        h=hashlib.sha256()
        with open(path,'rb') as f:
            for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
        return h.hexdigest()
    expected=sha(run/'product/upgrade/bin/open-habitat')
    if proof['source_product_sha256']!=expected:raise ValueError('wrong adopted binary')
    result=dict(schema_version=1,source_commit=commit,source_tree=tree,source_dirty=dirty=='true',product_binary_sha256=expected,successor_manifest_sha256=sha(run/'product/upgrade/release/release.json'),predecessor_manifest_sha256=sha(run/'product/release/release.json'),serial_sha256=sha(run/'serial.log'),serial=serial,guest=proof)
    (run/'upgrade-receipt.json').write_text(json.dumps(result,indent=2)+'\n')


if __name__=='__main__':main()
