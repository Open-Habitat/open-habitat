# Result

The thinking levels were already in the catalog: `pi_models_helper.mjs` gives
every model its `thinking_levels` in the one read the identity-scoped
`PiModelsProvider` keeps. The levels were struck through because the picker
disabled every row and level while the save was outstanding. The test
server's log at Jari's report time (03:51Z) shows each
`POST /api/v1/pi/models` taking about 3.1 s, because the write runs Pi's
catalog helper. So each click froze the picker for three seconds.

Pi's default model is now optimistic, following the classes in
`browser-mutation-layer`. The click shows the model and its levels at once,
and Pi confirms in the background:

- `PiModelsProvider` holds an in-memory overlay `{id, choice}`, keyed by a
  client command id. It is applied to the catalog every consumer reads, so the
  new-conversation default follows at once too. The overlay is dropped when Pi
  confirms or refuses, and with the identity-keyed provider on an identity
  change. Pi's `settings.json` stays the only record.
- One write is outstanding at a time. Picks made meanwhile collapse to the
  latest one, which is sent next. An earlier pick settles as `superseded`.
- A typed 4xx is a definite refusal: the overlay drops at once and shows its
  reason. A 5xx or a lost reply is not a refusal. The provider rereads Pi's
  default as the receipt. If the reread shows the choice, it is confirmed; if
  it shows another model, the choice is reverted with "Pi ei tallentanut
  valintaa oletukseksi". If the reread also fails, the choice stays pending
  until the next catalog read settles it.
- After 2 s without confirmation the picker says "Pi vahvistaa valintaa…".
  A refusal reads "Oletusta ei vaihdettu: <syy> Aiempi valinta palautettiin."
  and the selection returns to Pi's last confirmed default.
- `chooseDefault(choice, csrf) → confirmed | refused | superseded` is the
  one entry point. The settings picker and the recovery dialog's "also make it
  the default" both use it; App's `onChoice` runs only after confirmation.

Evidence (synthetic):

- `settings-model-picker.spec.ts`, with the POST held: the picked model is
  checked, the other rows and the levels stay enabled, `high` can be pressed
  before Pi answers, only one write is outstanding, the slow note appears, and
  the second write follows the first. A 503 is followed by the reread, which
  reverts to Sol/high with the alert, and Pi's saved default is unchanged.
  The spec passed 3/3.
- `PiModels.test.tsx`: the latest choice wins, and a 409 reverts to the last
  confirmed default with its own reason and no receipt read.
- `lab-sidebar-default.spec.ts` passed 3/3. In `account-settings.spec.ts`
  11 of 12 passed; "native key add" is the known pre-existing failure
  (it times out on the **Lisää avain** button before reaching the picker).
- `model-instant-{light,dark}-{1440,390}.{png,html}`: the picker right after
  a click, with the save still held.

## Decisions for later review

- The client command id is local only. The POST contract has no command field
  (`DisallowUnknownFields`), and setting a default is idempotent, so a repeat
  cannot apply twice in any harmful way. The shared layer may add a contract
  field when it migrates writes that are not idempotent.
- When the receipt cannot be read, the choice stays pending rather than being
  reverted. The layer's rule is that uncertain is not refused.
- `scope="new"` (choice for one new conversation) is unchanged. It writes
  nothing to Pi and is already immediate apart from its `onChoice` call.
