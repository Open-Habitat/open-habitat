import subprocess as s, os, tempfile, pathlib, ctypes, time, json
u='oh-lock-3627'; d=pathlib.Path(tempfile.mkdtemp(prefix='oh-lock-',dir='/var/tmp')); daemon=None

def run(*a,check=True):
 p=s.run(a,text=True,stdout=s.PIPE,stderr=s.PIPE)
 if check and p.returncode: raise RuntimeError(str(a[:2])+': '+p.stderr)
 return p

def pam(service):
 lib=ctypes.CDLL('libpam.so.0'); h=ctypes.c_void_p()
 class Conv(ctypes.Structure): _fields_=[('conv',ctypes.c_void_p),('data',ctypes.c_void_p)]
 conv=Conv(None,None); r=lib.pam_start(service.encode(),u.encode(),ctypes.byref(conv),ctypes.byref(h))
 if r==0:r=lib.pam_acct_mgmt(h,0);lib.pam_end(h,r)
 return r
try:
 assert run('getent','passwd',u,check=False).returncode!=0
 run('useradd','-m','-s','/bin/bash',u)
 run('ssh-keygen','-q','-t','ed25519','-N','','-f',str(d/'key'))
 (d/'authorized').write_text((d/'key.pub').read_text());os.chmod(d,0o755);os.chmod(d/'authorized',0o644)
 hostpub=pathlib.Path('/etc/ssh/ssh_host_ed25519_key.pub').read_text().split()
 (d/'known').write_text('[127.0.0.1]:22289 '+hostpub[0]+' '+hostpub[1]+'\n')
 uid=run('id','-u',u).stdout.strip()
 run('loginctl','enable-linger',u);time.sleep(2)
 run('systemd-run','--unit=oh-lock-3627','--property=User='+u,'/usr/bin/sleep','600')
 for state in ['password-locked','expired','password-aged','nologin']:
  run('usermod','-e','','-s','/bin/bash',u);run('chage','-d',str(int(time.time()/86400)),'-M','99999','-I','-1',u)
  if state=='expired':run('usermod','-e','1970-01-02',u)
  if state=='password-aged':run('chage','-d','1','-M','1',u)
  if state=='nologin':run('usermod','-s','/usr/sbin/nologin',u)
  out={'state':state,'pam_accounts':{x:pam(x) for x in ['sshd','su','cron','systemd-user']},'root_su':run('su','-s','/bin/bash','-c','true',u,check=False).returncode,'running_process':run('systemctl','is-active','oh-lock-3627.service',check=False).stdout.strip(),'user_manager':run('systemctl','is-active','user@'+uid+'.service',check=False).stdout.strip()}
  for usepam in ['yes','no']:
   cfg=d/'sshd';cfg.write_text(f'ListenAddress 127.0.0.1\nPort 22289\nHostKey /etc/ssh/ssh_host_ed25519_key\nPidFile {d}/pid\nAuthorizedKeysFile {d}/authorized\nStrictModes no\nUsePAM {usepam}\nPasswordAuthentication no\nKbdInteractiveAuthentication no\nAllowUsers {u}\n')
   daemon=s.Popen(['/usr/sbin/sshd','-D','-e','-f',str(cfg)],stdout=s.DEVNULL,stderr=s.DEVNULL);time.sleep(.3)
   p=run('ssh','-p','22289','-i',str(d/'key'),'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(d/'known'),u+'@127.0.0.1','true',check=False)
   out['ssh_key_pam_'+usepam]={'exit':p.returncode,'output':(p.stdout+p.stderr).strip()}
   daemon.terminate();daemon.wait();daemon=None
  print(json.dumps(out),flush=True)
finally:
 if daemon:daemon.terminate();daemon.wait()
 run('systemctl','stop','oh-lock-3627.service',check=False)
 if run('getent','passwd',u,check=False).returncode==0:
  run('loginctl','disable-linger',u,check=False);run('loginctl','terminate-user',u,check=False);run('userdel','-r',u)
 import shutil;shutil.rmtree(d)
 print('CLEANUP account_absent='+str(run('getent','passwd',u,check=False).returncode!=0),flush=True)
