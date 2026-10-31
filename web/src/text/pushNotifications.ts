import { catalog } from "../i18n";

// The phone notifications card's device panel (components/PushDevices.tsx).
const fi = {
  heading: "Laitteet",
  none: "Ilmoituksia ei vielä lähetetä millekään laitteelle.",
  thisDevice: "tämä laite",
  added: (date: string) => `lisätty ${date}`,
  enable: "Ota käyttöön tällä laitteella",
  reenable: "Rekisteröi tämä laite uudelleen",
  test: "Lähetä testi",
  remove: "Poista",
  busy: "Hetki…",
  outcome: {
    delivered: "Testi lähetetty. Ilmoituksen pitäisi näkyä hetken kuluttua.",
    gone: "Push-palvelu ei enää tunne tätä laitetta, joten se poistettiin. Ota ilmoitukset uudelleen käyttöön laitteella.",
    rejected:
      "Push-palvelu hylkäsi ilmoituksen. Rekisteröi laite uudelleen ja yritä sitten uudestaan.",
    unreachable:
      "Palvelin ei saa yhteyttä push-palveluun, joten ilmoitukset eivät mene perille. Palvelimen ylläpitäjän on sallittava lähtevät HTTPS-yhteydet push-palveluihin.",
  },
  lastFailed: "Edellinen ilmoitus ei mennyt perille.",
  unsupported:
    "Tämä selain ei tue ilmoituksia. Kokeile toisella selaimella tai laitteella.",
  iphone:
    "iPhonessa ja iPadissa ilmoitukset tulevat vain Koti-valikkoon lisätylle sivulle: napauta Safarissa Jaa › Lisää Koti-valikkoon, avaa Open Habitat kotinäytön kuvakkeesta ja ota ilmoitukset käyttöön siellä.",
  denied:
    "Ilmoitukset on estetty tämän selaimen asetuksissa. Salli ne sivustolle selaimen tai laitteen asetuksista ja yritä uudelleen.",
  problem: {
    permission: "Ilmoituslupaa ei annettu.",
    subscribe: "Selain ei saanut tilausta push-palvelulta. Yritä uudelleen.",
    push_devices_full:
      "Laitteita on jo kymmenen. Poista ensin jokin, jota et enää käytä.",
    push_endpoint_refused:
      "Selaimen push-palvelua ei tunneta, joten ilmoituksia ei voi lähettää tälle laitteelle.",
    push_feature_off: "Ominaisuus on pois päältä. Ota se ensin käyttöön.",
    other: "Toimintoa ei voitu tehdä. Lue tilanne uudelleen ja yritä sitten.",
  },
  reload: "Lue uudelleen",
  readError: "Laitteita ei voitu lukea.",
};

export const pushNotificationsText = catalog(fi, {
  heading: "Devices",
  none: "Notifications are not sent to any device yet.",
  thisDevice: "this device",
  added: (date) => `added ${date}`,
  enable: "Turn on for this device",
  reenable: "Register this device again",
  test: "Send a test",
  remove: "Remove",
  busy: "One moment…",
  outcome: {
    delivered: "Test sent. The notification should show in a moment.",
    gone: "The push service no longer knows this device, so it was removed. Turn notifications on again on the device.",
    rejected:
      "The push service refused the notification. Register the device again and then try once more.",
    unreachable:
      "The server cannot reach the push service, so notifications cannot be delivered. The server's administrator has to allow outbound HTTPS to the push services.",
  },
  lastFailed: "The last notification was not delivered.",
  unsupported:
    "This browser does not support notifications. Try another browser or device.",
  iphone:
    "On an iPhone or iPad notifications reach only a page added to the home screen: in Safari tap Share › Add to Home Screen, open Open Habitat from the home screen icon and turn notifications on there.",
  denied:
    "Notifications are blocked in this browser's settings. Allow them for the site in the browser's or device's settings and try again.",
  problem: {
    permission: "Permission for notifications was not given.",
    subscribe:
      "The browser did not get a subscription from the push service. Try again.",
    push_devices_full:
      "There are already ten devices. Remove one you no longer use first.",
    push_endpoint_refused:
      "The browser's push service is not a known one, so notifications cannot be sent to this device.",
    push_feature_off: "The feature is off. Turn it on first.",
    other: "That could not be done. Read the state again and then try.",
  },
  reload: "Read again",
  readError: "The devices could not be read.",
});
