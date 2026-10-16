// Spinoff-agentit pääkeskustelunsa alla työtilasivun suunnassa 1 (proto-spinoff-agents,
// 16.10.2026; riffi kierroksista 2026-10-16-tyotilasivu ja 2026-10-16-haaratyo). Pääagentti
// käynnistää spinoffit itse Taskfleetillä; käyttäjä ei aloita eikä kirjoita niille. Akseli:
// missä keskustelun spinoffit näkyvät. Sisältö on sama kaikissa: työtila aurinkokello,
// pääkeskustelu "Julkaisu 0.4: valmistelu" ja sen neljä spinoffia tiloissa työskentelee,
// mergetty, ei mergetty (työ tallessa) ja odottaa pääagenttia.
export const title = 'Spinoff-agentit';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Langassa', axis: 'spinoffit näkyvät pääkeskustelun langassa siinä kohdassa, jossa agentti käynnisti ne', fn: 'v1' },
  { name: 'Yläpalkissa', axis: 'pääkeskustelun yläpalkissa on spinoffien merkki, joka avaa listan; työtilasivun kortissa yksi rivi', fn: 'v2' },
  { name: 'Alirivit', axis: 'spinoffit ovat hiljaisia alirivejä pääkeskustelun alla sivupalkissa ja työtilasivun kortissa', fn: 'v3' },
];
