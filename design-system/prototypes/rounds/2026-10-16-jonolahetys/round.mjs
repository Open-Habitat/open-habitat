// Round of 2026-10-16: sending before Pi runs (proto-queued-send). Two decided behaviours
// share one look: a new conversation keeps its field enabled while it is created
// (composer-and-new-conversation point 3), and a stopped conversation opens readable with
// an enabled field and resumes Pi on send (lazy-resume-on-send). In both, the message waits
// until Pi takes it. The directions differ only in where the waiting message lives and how
// strongly it differs from a delivered one; Stop, the queue order and the failed start
// (message kept, retry) behave the same in all three.
export const title = 'Keskustelu · lähetys ennen kuin Pi on käynnissä';
export const app = true;
export const variants = [
  { name: 'Kupla odottaa', axis: 'viesti näkyy heti langassa omana kuplanaan, katkoviivalla ja himmeänä, ja kuplan otsakkeessa lukee Odottaa; kun Pi ottaa viestin, kupla muuttuu tavalliseksi', fn: 'v1' },
  { name: 'Jonossa kentän yllä', axis: 'viesti odottaa kirjaston jonolistassa kentän yllä; lankaan se tulee vasta, kun Pi ottaa sen', fn: 'v2' },
  { name: 'Kuittimerkki', axis: 'viesti näkyy heti langassa tavallisena kuplana; vain pieni merkki otsakkeessa kertoo, ettei Pi ole vielä saanut sitä', fn: 'v3' },
];
