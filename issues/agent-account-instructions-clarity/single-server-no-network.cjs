// Loaded only into the synthetic stdio Microsoft subprocess, never Pi/model calls.
const deny = () => { throw new Error('LAB_NETWORK_BLOCKED'); };
require('node:net').Socket.prototype.connect = deny;
require('node:tls').connect = deny;
globalThis.fetch = deny;
