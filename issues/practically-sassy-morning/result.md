# Result

Fixed in [browser-mutation-layer](../browser-mutation-layer/result.md). `create`
now reads its reply through the mutation layer's `writeOutcome`: a typed 4xx
such as `429 capacity_exceeded` throws `WriteRefused`, and `createTracked`
removes the uncertainty marker on it. The creation view says "Keskustelua ei
luotu: Liian monta käynnissä olevaa keskustelua — sulje tai pysäytä jokin.",
gives messages written meanwhile back to the field and offers "Yritä
uudelleen"; + is not blocked. Only a lost reply or a 5xx stays uncertain.
Browser test: `mutation-layer.spec.ts` "a capacity refusal of + is a refusal,
not an uncertain creation".
