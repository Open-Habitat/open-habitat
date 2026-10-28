---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: fixed
priority: normal
lane: google-wizard
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/google-wizard-email-scope
closed: 2026-10-28
---

# Google setup wizard lists the scope as 'email', which the Cloud Console does not offer

Jari 2026-10-28 (testikone): Asetukset › palvelimen integraatiot › Google: aseta tunnukset, vaihe 3/5 Käyttöoikeudet listaa scopet openid, email, drive, gmail.modify, calendar, contacts. Google Auth platform › Data Access › Add or Remove Scopes -luettelossa ei ole scopea 'email'; se on https://www.googleapis.com/auth/userinfo.email. Lista on web/src/components/ServerIntegrations.tsx googleScopes; daemon (internal/daemon/integrations/google_linux.go) pyytää 'openid email ...' ja hyväksyy molemmat muodot (googleIdentity). Ohjeen lista näyttää konsolissa löytyvät nimet.
