#!/usr/bin/python3
"""Disposable activation envelope recorder; execs real product with same PID/fd."""
import json,os,pwd,socket,sys
name=pwd.getpwuid(os.getuid()).pw_name
assert name in ('agent-a','agent-b')
try:
    listener=socket.fromfd(3,socket.AF_UNIX,socket.SOCK_STREAM)
    path=listener.getsockname()
    listener.close()
except OSError:
    path='missing'
data={'pid':os.getpid(),'listen_pid':os.environ.get('LISTEN_PID',''),'listen_fds':os.environ.get('LISTEN_FDS',''),'listen_fdnames':os.environ.get('LISTEN_FDNAMES',''),'socket':path}
with open('/home/'+name+'/activation.json','w') as f:json.dump(data,f)
os.execv('/opt/native-agent-host/native-agent-host',['/opt/native-agent-host/native-agent-host',*sys.argv[1:]])
