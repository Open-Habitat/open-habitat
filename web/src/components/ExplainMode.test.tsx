import { describe, expect, it } from "vitest";
import { readSituation } from "./ExplainMode";
import { parts } from "./explainParts";

const turn = (inner: string) =>
  `<ol class="ah-feed"><li data-kind="assistant"><section data-testid="agent-turn">${inner}</section></li></ol>`;
const view = (activity: string, body = "", header = "") => {
  const root = document.createElement("div");
  root.innerHTML = `<header class="ah-agent-header" data-activity="${activity}">${header}</header>${body}`;
  return root;
};

describe("readSituation", () => {
  it("is null outside a conversation and while the state is unknown", () => {
    expect(readSituation(document.createElement("div"))).toBeNull();
    expect(readSituation(view("unknown"))).toBeNull();
  });

  it("reads the situation the header and the latest turn show", () => {
    expect(
      readSituation(view("neutral", '<div data-testid="conversation-empty">')),
    ).toBe("notStarted");
    expect(readSituation(view("working", turn("")))).toBe("working");
    expect(
      readSituation(
        view("neutral", "", '<button data-testid="spinoff-waiting"></button>'),
      ),
    ).toBe("background");
    expect(
      readSituation(
        view(
          "neutral",
          turn('<div data-testid="stage-reply" data-reply-kind="failed">'),
        ),
      ),
    ).toBe("failed");
    expect(
      readSituation(
        view(
          "neutral",
          turn(
            '<div data-testid="stage-reply" class="ah-turn-interim"></div><div data-testid="turn-stage"></div>',
          ),
        ),
      ),
    ).toBe("stopped");
    expect(
      readSituation(
        view(
          "neutral",
          turn(
            '<div data-testid="turn-stage"></div><div data-testid="stage-reply"></div>',
          ),
        ),
      ),
    ).toBe("yourTurn");
  });
});

it("names every part by a selector the browser accepts", () => {
  for (const [id, part] of Object.entries(parts))
    expect(() => document.querySelector(part.sel), id).not.toThrow();
});
