// Unit and component tests read the interface in Finnish, as most of them
// were written; a test of English sets the language itself.
Object.defineProperty(window.navigator, "languages", {
  configurable: true,
  get: () => ["fi-FI"],
});
