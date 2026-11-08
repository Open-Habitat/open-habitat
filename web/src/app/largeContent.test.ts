import { describe, expect, it } from "vitest";
import { setPersonalLanguage } from "../i18n";
import { largeContentText } from "../text/largeContent";
import {
  attachmentOverflow,
  conversationWeight,
  rememberAttachmentSize,
} from "./largeContent";

const url = (i: number) =>
  `/api/v1/attachments/${String(i).padStart(8, "0")}-5555-4555-8555-555555555555`;
const MiB = 1024 * 1024;

describe("large content limits", () => {
  it("counts a message's attachments as the host does", () => {
    const urls = Array.from({ length: 30 }, (_, i) => url(i));
    expect(attachmentOverflow(urls)).toBeUndefined();
    // A file attached twice counts once.
    expect(attachmentOverflow([...urls, urls[0]])).toBeUndefined();
    expect(attachmentOverflow([...urls, url(30)])).toMatchObject({
      count: 31,
      reason: "count",
    });
  });
  it("sums the sizes this tab uploaded", () => {
    const urls = [url(100), url(101), url(102)];
    for (const u of urls) rememberAttachmentSize(u, 20 * MiB);
    expect(attachmentOverflow(urls)).toBeUndefined();
    rememberAttachmentSize(url(103), 20 * MiB);
    rememberAttachmentSize(url(104), 20 * MiB + 1);
    expect(attachmentOverflow([...urls, url(103), url(104)])).toEqual({
      count: 5,
      bytes: 100 * MiB + 1,
      reason: "bytes",
    });
    // An unknown size, from a draft of an earlier page load, counts as none.
    expect(attachmentOverflow([url(200)])).toBeUndefined();
  });
  it("warns once near the advised size and offers a new conversation past it", () => {
    expect(conversationWeight(undefined)).toBeUndefined();
    expect(conversationWeight(383 * MiB)).toBeUndefined();
    expect(conversationWeight(384 * MiB)).toBe("near");
    expect(conversationWeight(512 * MiB)).toBe("heavy");
  });
  it("words sizes as the limits read", () => {
    setPersonalLanguage("fi");
    expect(largeContentText.fi.size(100 * MiB)).toBe("100 Mt");
    expect(largeContentText.fi.size(4.5 * MiB)).toBe("4,5 Mt");
    expect(largeContentText.fi.size(140.4 * MiB)).toBe("140 Mt");
    setPersonalLanguage("en-US");
    expect(largeContentText["en-US"].size(530 * MiB)).toBe("530 MB");
    setPersonalLanguage(undefined);
  });
});
