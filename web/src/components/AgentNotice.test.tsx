import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Entry } from "../app/HistoryView";
import { AgentNoticeCard } from "./AgentNotice";

const notice = {
  notice_id: "22222222-2222-4222-8222-222222222222",
  origin: "agent" as const,
  timestamp: "2026-10-21T10:00:00Z",
  text: "<script>alert(1)</script><img src=x onerror=alert(1)>[click](javascript:alert(1))",
  persistence: "not_persisted" as const,
};
describe("untrusted agent notice", () => {
  it("renders native text without creating executable elements or links", () => {
    const view = render(<AgentNoticeCard notice={notice} />);
    expect(view.getByTestId("agent-notice").textContent).toContain(notice.text);
    expect(view.container.querySelectorAll("script,img,a")).toHaveLength(0);
    expect(view.container.querySelector("time")?.dateTime).toBe(
      notice.timestamp,
    );
    expect(view.getByTestId("agent-notice").dataset.persistence).toBe(
      "not_persisted",
    );
  });
  it("uses the same safe card for a reopened native entry", () => {
    const view = render(
      <Entry
        entry={{
          entry_key: "n",
          kind: "unknown",
          content: {
            media_type: "text/plain",
            text: notice.text,
            complete: true,
          },
          notice: { ...notice, persistence: "persisted" },
        }}
      />,
    );
    expect(view.getByTestId("agent-notice").dataset.persistence).toBe(
      "persisted",
    );
    expect(view.container.querySelectorAll("script,img,a")).toHaveLength(0);
  });
});
