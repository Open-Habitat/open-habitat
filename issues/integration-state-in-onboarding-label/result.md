# Result

The pill on an integration row that is a step in the onboarding route now reads
**Tarjolla** / **Available** when the service is ready. Its accessible name and
hover tooltip say that people connect the service themselves in
Asetukset › Tiedot agenteille, that it shows as a step in their onboarding, and
that the pill opens the onboarding settings.

The "hidden" variant is shown while the service is **not** ready (the code's
`hidden = status !== "ready"`): the step stays on the route but is hidden from
people. The brief's wording "Tarjolla · ei aloituksessa" would have said the
opposite, so it reads **Ei tarjolla · vaihe piilossa** /
**Not available · step hidden** instead, and its tooltip says the step is hidden until
the service is ready.

## Try it

Asetukset › palvelimen integraatiot: a set-up service with an onboarding step
(e.g. Google) shows "Tarjolla"; hover it for the explanation. A service on the
route that is not yet set up (e.g. Microsoft with no app) shows
"Ei tarjolla · vaihe piilossa".
