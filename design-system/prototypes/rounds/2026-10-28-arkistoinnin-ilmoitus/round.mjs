export const title = 'Arkistoinnin ilmoituksen paikka';
export const app = true;
export const recap = false;
export const variants = [
  {name: 'Ylhäällä', axis: 'Kelluva kuittaus yläpalkin alla, kaukana kentästä; peittää vain langan vanhinta osaa', fn: 'anTop'},
  {name: 'Kenttärivi', axis: 'Kuittaus kentän yläreunassa omana rivinään; lanka väistää, mikään ei jää alle', fn: 'anDock'},
  {name: 'Paikallaan', axis: 'Ei kelluvaa ilmoitusta: kuittausrivi listassa siinä, mistä keskustelu lähti', fn: 'anPlace'},
];
