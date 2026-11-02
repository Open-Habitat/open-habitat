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

const dimensionNote =
  "[Image: original 1170x2532, displayed at 924x2000. Multiply coordinates by 1.27 to map to original image.]";

it("hides only Pi's exact trailing dimension notes on image messages", () => {
  expect(messageText(`Look\n${shot}\n\n${dimensionNote}`)).toBe("Look");
  expect(messageText(`Look\n\n${dimensionNote}`, true)).toBe("Look");
  expect(messageText(`\n\n${dimensionNote}`, true)).toBe("");
  expect(messageText(`Look\n\n${dimensionNote}\n${dimensionNote}`, true)).toBe(
    "Look",
  );
  for (const text of [
    `Look\n\n${dimensionNote}`,
    `Look\n${notes}\n\n${dimensionNote}`,
  ]) {
    expect(messageText(text)).toContain(dimensionNote);
  }
  for (const text of [
    `${dimensionNote}\nLook`,
    `Look\n${dimensionNote}`,
    `Look\n\n${dimensionNote}\nMore`,
    `Look\n\n${dimensionNote.replace("1.27", "1.2")}`,
  ]) {
    expect(messageText(text, true)).toBe(text);
  }
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
