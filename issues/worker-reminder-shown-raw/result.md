# Result

The turn-end reminder (`oh-wait-reminder`, written by
`internal/daemon/process-extension.mjs`) now reaches the person the way the
restart catch-up does: the daemon projects only its `details` (run ids and
titles) into an optional history-entry field `wait_reminder`, and the browser
draws it as a quiet centred marker *Habitat muistutti agenttia: kukaan ei odota
workeria* with the run titles. The agent's text and the wait command stay in
Pi's context only; they are not in the history page, the live event, or a
block read (`TestWaitReminderIsPresentedFromItsDetails`,
`web/src/components/WaitReminder.test.tsx`).

## Decisions for later review

- **Wording and form.** A one-line marker in the restart notice's style
  (`ah-pi-marker`) rather than a card: the reminder asks nothing of the
  person, it only explains why the agent is about to start a wait or say why
  it will not. Alternative: hide it entirely (the person already sees the
  agent's response); rejected because the agent's next words ("I will wait
  for…") would then answer something invisible.
- **Bound.** At most twenty runs listed, as the reminder's own wait grammar
  does; the rest are counted (`more`, *ja N muuta*).
