import { expect, it } from "vitest";
import {
  joinAttachments,
  messageText,
  splitAttachments,
} from "./AttachmentChips";

const shot =
  "![shot.png](/api/v1/attachments/11111111-1111-4111-8111-111111111111)";
const notes =
  "[notes.txt](/api/v1/attachments/22222222-2222-4222-8222-222222222222)";

it.each(["", "hei", "hei\n", "\n", "rivi\n\ntoinen"])(
  "keeps the typed text %j exactly through a draft with attachments",
  (text) => {
    const { attachments } = splitAttachments(`x\n${shot}\n${notes}`);
    const draft = joinAttachments(text, attachments);
    expect(splitAttachments(draft).text).toBe(text);
    expect(splitAttachments(draft).attachments.map((a) => a.source)).toEqual([
      shot,
      notes,
    ]);
  },
);

it("leaves a reference inside a sentence as the person's text", () => {
  const value = `katso ${notes} tästä`;
  expect(splitAttachments(value)).toEqual({ text: value, attachments: [] });
});

it("hides the host's attachment path lines only for the message's own attachments", () => {
  const sent = [
    "Katso liitteet",
    shot,
    "Attachment path: /home/alice/attachments/11111111-1111-4111-8111-111111111111",
    "Attachment path: /home/alice/attachments/33333333-3333-4333-8333-333333333333",
  ].join("\n");
  expect(messageText(sent)).toBe(
    "Katso liitteet\nAttachment path: /home/alice/attachments/33333333-3333-4333-8333-333333333333",
  );
});
