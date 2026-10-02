import { useState } from "react";
import { NativeQuestion } from "../components";
import {
  NotAdmitted,
  questionTextFits,
  respondQuestion,
  type Status,
} from "./conversations";

// The marker is written before the request: a reload must never replay a dialog
// response whose Pi receipt cannot be correlated to this request ID.
export function PiQuestion({
  question,
  agentId,
  identity,
  csrf,
  refresh,
  onLogin,
  onOutcome,
}: {
  question: NonNullable<Status["pending_question"]>;
  agentId: string;
  identity: string;
  csrf?: string;
  refresh: () => Promise<void>;
  onLogin: () => void;
  onOutcome: (outcome: "uncertain" | "stale") => void;
}) {
  const key = `nah:${identity}:question:${agentId}:${question.request_id}`;
  const [value, setValue] = useState("");
  const [state, setState] = useState<
    "open" | "pending" | "uncertain" | "stale"
  >(() => (sessionStorage.getItem(key) ? "uncertain" : "open"));
  const respond = async (
    action: "answer" | "cancel",
    answer?: string | boolean,
  ) => {
    if (state !== "open" || !csrf) return;
    // Reject impossible local inputs before marking an attempt as sent.
    if (
      action === "answer" &&
      (answer === undefined ||
        (typeof answer === "string" && !questionTextFits(answer)))
    )
      return;
    sessionStorage.setItem(key, "sent");
    setState("pending");
    try {
      await respondQuestion(agentId, question.request_id, action, csrf, answer);
      setState("uncertain"); // The HTTP reply is not a Pi acknowledgement.
      onOutcome("uncertain");
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      const outcome = error instanceof NotAdmitted ? "stale" : "uncertain";
      setState(outcome);
      onOutcome(outcome);
    } finally {
      void refresh(); // Observe the next queued dialog, not a receipt for this one.
    }
  };
  return (
    <NativeQuestion
      kind={question.question_kind}
      prompt={question.prompt}
      choices={question.choices}
      value={value}
      state={csrf ? state : "unavailable"}
      onChange={setValue}
      onRespond={respond}
    />
  );
}
