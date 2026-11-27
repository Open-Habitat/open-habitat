# Result

Soniox documents the stream error for a spent account: `error_code` 402
("Payment required"), with `error_type` `organization_balance_exhausted`,
`organization_monthly_budget_exhausted` or `project_monthly_budget_exhausted`
(https://docs.soniox.com/stt/api-reference/websocket-api). The dictation
engine now maps 402 to a new browser-side failure, `speech_out_of_credit`:

- refused at the start: the notice "The Soniox account is out of credit" with
  an Open Soniox console link (console.soniox.com, new tab) and Try again;
- refused mid-dictation: "Dictation cut off: the Soniox account ran out of
  credit", the text kept, with the console link and Continue.

The host still cannot see this case (the temporary key and `/v1/models`
succeed with zero balance), so the contract codes are unchanged. Other stream
errors (408, 500, 503, …) stay "Soniox is not responding", whose text now also
says to check in the Soniox console that the account has credit, with the
same console link.

Evidence: unit tests for the 402 mapping at start and mid-stream and for
other codes staying "not responding" (`web/src/app/dictation.test.ts`), a
component test for the notice and its link (`Composer.test.tsx`), and the
synthetic Soniox fixture's new `refuse&value=credit` case in
`web/tests/speech-input.spec.ts`. `./scripts/test-focused.sh --area web`,
`speech-input.spec.ts` and `dictation-bar.spec.ts` pass under `umask 077`.
