#!/usr/bin/python3
"""Fixed GitHub TLS fixture, bound only to guest loopback."""
import http.server, json, ssl, pathlib, urllib.parse
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_POST(self):
        if self.path!='/login/oauth/access_token': return self.send_error(404)
        form=urllib.parse.parse_qs(self.rfile.read(int(self.headers['Content-Length'])).decode())
        code=form.get('code',[''])[0]
        if form.get('client_id')!=['fixture-client'] or form.get('client_secret')!=['fixture-secret'] or len(form.get('code_verifier',[''])[0])<32 or code not in ('a','b','unknown'): return self.send_error(403)
        self.send_json({'access_token':pathlib.Path('/usr/local/lib/fixture/tokens/'+('agent-a' if code=='a' else 'agent-b')).read_text() if code!='unknown' else 'PRODUCT_VM_TOKEN_UNKNOWN_FIXTURE_ONLY_92764','token_type':'bearer'})
    def do_GET(self):
        if self.path!='/user':return self.send_error(404)
        token=self.headers.get('Authorization','')
        key='PRODUCT_VM_TOKEN_'
        ident={'Bearer '+key+'agent_a_FIXTURE_ONLY_92764':31001,'Bearer '+key+'agent_b_FIXTURE_ONLY_92764':31002,'Bearer '+key+'UNKNOWN_FIXTURE_ONLY_92764':39999}.get(token)
        if ident is None:return self.send_error(403)
        login={31001:'agent-a',31002:'agent-b',39999:'unknown'}[ident]
        # Guest-only provider rename; the product never sees this control file.
        if ident==31001 and pathlib.Path('/run/fixture-rename').is_file(): login='renamed-fixture'
        self.send_json({'id':ident,'login':login})
    def send_json(self,data):
        body=json.dumps(data).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
server=http.server.HTTPServer(('127.0.0.1',443),Handler)
ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain('/etc/native-agent-host/tls.crt','/etc/native-agent-host/tls.key')
server.socket=ctx.wrap_socket(server.socket,server_side=True)
server.serve_forever()
