#!/usr/bin/python3
"""Runs only in the isolated disposable VM; all fixtures are synthetic."""
import json,os,pathlib,subprocess,sys
state=pathlib.Path('/var/lib/fixture-boot-state.json')
def call(args,**kw):return subprocess.run(args,check=True,**kw)
def require(v,label):
 if not v:raise RuntimeError(label)
try:
 s=json.loads(state.read_text());stage=s['stage']
 boot=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip()
 require(boot not in s['boots'],'not a new boot');s['boots'].append(boot)
 units=['open-habitat-broker.service','open-habitat-broker.socket','open-habitat-daemon@agent-a.socket','open-habitat-agent@agent-a.socket']
 active=[subprocess.run(['systemctl','is-active','--quiet',u]).returncode==0 for u in units]
 paths=['/run/open-habitat/broker.sock','/run/open-habitat/users/agent-a/daemon.sock','/run/open-habitat/users/agent-a/agent.sock','/run/open-habitat/broker-body-started']
 present=[os.path.exists(p) for p in paths]
 if stage==0:
  require(all(active) and all(present),'good boot targets '+str(active)+str(present))
  require(subprocess.run(['/opt/open-habitat/current/open-habitat','boot-storage-check']).returncode==0,'good live check')
  # Read PID 1's monotonic lifecycle timestamps, not inferred unit text.
  def timestamp(unit,prop):
   return int(subprocess.check_output(['systemctl','show','--value','--property='+prop,unit],text=True).strip())
  gate_exit=timestamp('open-habitat-storage.service','ExecMainExitTimestampMonotonic')
  require(gate_exit>0 and all(timestamp(u,'ActiveEnterTimestampMonotonic')>=gate_exit for u in units),'storage did not finish before target activation')
  # Customer-owned remount declaration for next boot: accounting but no enforcement.
  fstab=pathlib.Path('/etc/fstab');fstab.write_text(fstab.read_text().replace('usrquota,nofail','defaults,nofail'))
 elif stage in (1,2,3):
  require(not any(active) and not any(present),'negative boot fell through '+str(active)+str(present))
  log=subprocess.check_output(['journalctl','-b','-u','open-habitat-storage.service','--no-pager'],text=True)
  reason={1:'quota_enforcement_required',2:'separate_home_required',3:'home_uuid_unavailable'}[stage]
  require(reason in log,'expected fixed gate reason '+reason+' journal='+log[-1000:])
  if stage==1:
   fstab=pathlib.Path('/etc/fstab');fstab.write_text('\n'.join(line for line in fstab.read_text().splitlines() if ' /home ' not in line)+'\n')
  elif stage==2:
   with open('/etc/fstab','a') as f:f.write('UUID='+s['uuid']+' /home ext4 usrquota,nofail 0 0\n')
   policy=pathlib.Path('/etc/open-habitat/storage-policy.json');p=json.loads(policy.read_text());p['home_uuid']='00000000-0000-0000-0000-000000000001';policy.write_text(json.dumps(p,separators=(',',':'))+'\n')
 else:raise RuntimeError('invalid stage')
 if stage==3:
  require(len(s['boots'])==4,'missing cold boots')
  print('VM_PROOF='+json.dumps({'status':'passed','scope':'host-boot-storage-only','cold_boots':4,'good_boot':True,'quota_off_refused':True,'missing_home_refused':True,'wrong_uuid_refused':True,'both_listeners':True,'broker_ordering':True,'pid1':'systemd'}),flush=True)
  call(['systemd-run','--on-active=5s','--unit=fixture-shutdown','/usr/bin/systemctl','poweroff','--no-block'],stdout=subprocess.DEVNULL)
 else:
  s['stage']+=1;state.write_text(json.dumps(s));call(['systemctl','reboot','--no-block'])
except Exception as e:
 subprocess.run(['journalctl','-b','-u','open-habitat-proc.service','-u','open-habitat-storage.service','-u','systemd-sysusers.service','--no-pager'])
 subprocess.run(['getent','group','open-habitat-proc'])
 print('VM_PROOF='+json.dumps({'status':'failed','scope':'host-boot-storage-only','reason':str(e)}),flush=True)
 subprocess.run(['systemctl','poweroff','--no-block']);sys.exit(1)
