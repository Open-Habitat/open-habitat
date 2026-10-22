#!/usr/bin/env python3
"""Offline recipe/receipt checks, not installed-host acceptance."""
import importlib.util
from pathlib import Path
import subprocess
import sys

root=Path(__file__).resolve().parent
for name in ('host-apply-proof.py','host-upgrade-proof.py','check-upgrade-receipt.py'):
    compile((root/name).read_text(),name,'exec')
spec=importlib.util.spec_from_file_location('receipt',root/'check-upgrade-receipt.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
proof=dict(status='passed',fresh_to_successor=True,preactivation_failure_predecessor_serving=True,stale_refused=True,immutable_owner=True,cold_reboot=True,homes_preserved=True,native_session_preserved=True,browser_session_preserved=True,broker_identity_admission_preserved=True,admin_preserved=True,persistent_user_service_preserved=True,gateway_gid_distinct=True,post_acceptance_session_mutation_no_change=True,user_service_restarted=True,closed_reboot_refused=True,after_open_sigkill=True,accepted_recovery_restarts_consumers=True,post_acceptance_admin_mutation_no_change=True,unrelated_native_session_preserved=True,phase_sigkills=['quiescing','activating','verifying','verified'],two_native_uids=[21032,21033],provider_call=False)
module.validate(proof)
for key in proof:
    for value in (None,False if proof[key] is not False else True):
        bad=dict(proof);bad[key]=value
        try:module.validate(bad)
        except ValueError:pass
        else:raise RuntimeError('accepted missing/false predicate '+key)
if sys.flags.optimize==0:
    subprocess.run([sys.executable,'-O',__file__],check=True)
print('host upgrade offline recipe/receipt checks passed')
