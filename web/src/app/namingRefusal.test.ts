import { describe, expect, it } from "vitest";
import {
  ConversationNotFound,
  NotAdmitted,
  TitleGenerationFailed,
} from "./conversations";
import { NameNotSaved, nameRefused, namingRefusal } from "./namingRefusal";

describe("naming refusals", () => {
  it("gives each refusal a reason that tells the cases apart", () => {
    const pending = namingRefusal(new NotAdmitted("title_pending"));
    const writer = namingRefusal(new NotAdmitted("writer_conflict"));
    const notNow = namingRefusal(new NotAdmitted("control_uncertain"));
    expect(new Set([pending, writer, notNow]).size).toBe(3);
    expect(namingRefusal(new NotAdmitted(""))).toBe(notNow);
    expect(namingRefusal(new ConversationNotFound())).toBe(notNow);
  });

  it("never reports an unknown outcome or a model failure as a refusal", () => {
    expect(namingRefusal(new Error("unavailable"))).toBeUndefined();
    expect(
      namingRefusal(new TitleGenerationFailed("model_unavailable")),
    ).toBeUndefined();
  });

  it("carries a refused manual name's reason to the field and leaves other failures alone", () => {
    const refused = nameRefused(new NotAdmitted("writer_conflict"));
    expect(refused).toBeInstanceOf(NameNotSaved);
    const lost = new Error("unavailable");
    expect(nameRefused(lost)).toBe(lost);
  });
});
