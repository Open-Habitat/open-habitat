// Test-only network trap, loaded before Pi. Any unexpected URL fails closed.
const jwt = 'x.' + Buffer.from(JSON.stringify({'https://api.openai.com/auth':{chatgpt_account_id:'synthetic'}})).toString('base64url') + '.x';
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url === 'https://auth.openai.com/api/accounts/deviceauth/usercode')
    return {ok:true, json: async () => ({device_auth_id:'synthetic-device',user_code:'ABCD-1234',interval:0})};
  if (url === 'https://auth.openai.com/api/accounts/deviceauth/token') {
    if (process.env.MOCK_HOLD) await new Promise((_,reject) => init.signal.addEventListener('abort', () => reject(new Error('synthetic abort')), {once:true}));
    return {ok:true, json: async () => ({authorization_code:'synthetic-code',code_verifier:'synthetic-verifier'})};
  }
  if (url === 'https://auth.openai.com/oauth/token')
    return {ok:true, json: async () => ({access_token:jwt,refresh_token:'SYNTHETIC-REFRESH-SECRET',expires_in:3600})};
  throw new Error('unexpected network request');
};
